import { Server, Socket } from 'socket.io';
import bcrypt from 'bcryptjs';
import { Room, Player, GameState, GameMode, AnswerSubmission, RoomSettings } from '../types/game';
import {
  generateRoomCode,
  calculateTimeBasedScore,
  calculateWordMatchScore,
  cleanTitleForGuess,
  extractFeaturedArtistsFromTitle,
  formatGuessHangman,
  getHangmanOptionsFromSettings,
  normalizeText,
  isAnswerCorrect,
  isArtistMatch,
  isTitleMatch,
  matchArtists,
  mergeArtists,
  splitArtists,
} from '../utils/gameUtils';
import Song from '../models/Song';
import User from '../models/User';
import * as queueManager from './songQueueManager';
import type { PrecomputedClip, PreparedSongMetadata } from './songQueueManager';

// In-memory storage for active rooms
export const rooms = new Map<string, Room>();
const gameStates = new Map<string, GameState>();
const roomAnswers = new Map<string, AnswerSubmission[]>();
const roomLoadingIntervals = new Map<string, NodeJS.Timeout>();
const roomLoadingTimeouts = new Map<string, NodeJS.Timeout>();
const roomPrepIntervals = new Map<string, NodeJS.Timeout>();
const roomPrepTimeouts = new Map<string, NodeJS.Timeout>();
const roomRoundTimeouts = new Map<string, NodeJS.Timeout[]>();
const ROUND_COUNTDOWN_MS = 3000;

function emitToast(io: Server, roomCode: string, message: string, variant: 'info' | 'warning' | 'error' = 'info') {
  io.to(roomCode).emit('toast', {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    variant,
  });
}

function emitSongSkipped(
  io: Server,
  roomCode: string,
  payload: { title?: string; artist?: string; albumArtUrl?: string; reason?: string; skippedCount?: number }
) {
  io.to(roomCode).emit('song-skipped', payload);
}

function endGame(io: Server, room: Room, gameState?: GameState) {
  room.isActive = false;
  if (gameState) {
    gameState.phase = 'waiting';
  }
  io.to(room.code).emit('game-ended', {
    finalScores: room.players.map(p => ({
      username: p.username,
      displayName: p.displayName || p.username,
      score: p.score,
    })),
  });
}

function shouldEndForMaxRounds(room: Room): boolean {
  const maxRounds = room.settings.maxRounds;
  return typeof maxRounds === 'number' && maxRounds > 0 && room.currentRound > maxRounds;
}

function normalizeRoomSettings(input: any = {}): RoomSettings {
  const clampNumber = (value: any, min: number, max: number, fallback: number) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
  };

  const maxRoundsValue = Number(input.maxRounds);
  const maxRounds =
    Number.isFinite(maxRoundsValue) && maxRoundsValue > 0
      ? Math.min(500, Math.floor(maxRoundsValue))
      : undefined;

  return {
    clipDuration: clampNumber(input.clipDuration, 5, 60, 15),
    randomStart: input.randomStart !== false,
    allowJoinInProgress: input.allowJoinInProgress !== false,
    allowChineseVariants: input.allowChineseVariants !== false,
    shufflePlaylist: input.shufflePlaylist !== false,
    convertChineseLyrics: input.convertChineseLyrics === 't2s' || input.convertChineseLyrics === 's2t'
      ? input.convertChineseLyrics
      : 'none',
    lyricAnswerTimeMs: clampNumber(input.lyricAnswerTimeMs, 10000, 60000, 20000),
    roundCountdownMs: clampNumber(input.roundCountdownMs, 0, 15000, ROUND_COUNTDOWN_MS),
    resultsDelayMs: clampNumber(input.resultsDelayMs, 2000, 20000, 7000),
    maxRounds,
    revealNumbers: input.revealNumbers === true,
    revealKorean: input.revealKorean !== false,
    revealJapanese: input.revealJapanese !== false,
    revealChinese: input.revealChinese === true,
    revealVietnamese: input.revealVietnamese !== false,
    revealSpanish: input.revealSpanish !== false,
  };
}

function areSettingsEqual(a?: RoomSettings, b?: RoomSettings) {
  if (!a || !b) return false;
  return (
    a.clipDuration === b.clipDuration &&
    a.randomStart === b.randomStart &&
    a.allowJoinInProgress === b.allowJoinInProgress &&
    a.allowChineseVariants === b.allowChineseVariants &&
    a.shufflePlaylist === b.shufflePlaylist &&
    a.convertChineseLyrics === b.convertChineseLyrics &&
    a.lyricAnswerTimeMs === b.lyricAnswerTimeMs &&
    a.roundCountdownMs === b.roundCountdownMs &&
    a.resultsDelayMs === b.resultsDelayMs &&
    a.maxRounds === b.maxRounds &&
    a.revealNumbers === b.revealNumbers &&
    a.revealKorean === b.revealKorean &&
    a.revealJapanese === b.revealJapanese &&
    a.revealChinese === b.revealChinese &&
    a.revealVietnamese === b.revealVietnamese &&
    a.revealSpanish === b.revealSpanish
  );
}

function buildSyncStatePayload(room: Room, gameState: GameState) {
  const currentSong = gameState.currentSong;
  if (!currentSong) {
    return {
      phase: gameState.phase,
      round: room.currentRound,
    };
  }

  const now = Date.now();
  const normalizeOptions = {
    allowChineseVariants: room.settings.allowChineseVariants !== false,
  };
  const answerTimeLimitMs = room.settings.lyricAnswerTimeMs ?? 20000;
  const answerTimeMs = gameState.answerStartedAt
    ? Math.max(0, answerTimeLimitMs - (now - gameState.answerStartedAt))
    : undefined;

  return {
    phase: gameState.phase,
    paused: gameState.paused,
    pausePhase: gameState.pausePhase,
    pauseRemainingMs: gameState.pauseRemainingMs,
    round: room.currentRound,
    audioUrl: currentSong.audioUrl,
    startTime: currentSong.startTime,
    stopTime: currentSong.stopTime,
    duration: gameState.clipDurationSec,
    hangman: currentSong.targetLyricDisplay,
    clipLyricLines: currentSong.clipLyricLines,
    clipPhase: gameState.clipPhase,
    startedAt: gameState.roundStartedAt,
    answerTime: answerTimeMs,
    countdownEndsAt: gameState.countdownEndsAt,
  };
}

function clearLoadingTimers(roomCode: string) {
  const interval = roomLoadingIntervals.get(roomCode);
  if (interval) {
    clearInterval(interval);
    roomLoadingIntervals.delete(roomCode);
  }

  const timeout = roomLoadingTimeouts.get(roomCode);
  if (timeout) {
    clearTimeout(timeout);
    roomLoadingTimeouts.delete(roomCode);
  }
}

function clearPrepTimers(roomCode: string) {
  const interval = roomPrepIntervals.get(roomCode);
  if (interval) {
    clearInterval(interval);
    roomPrepIntervals.delete(roomCode);
  }

  const timeout = roomPrepTimeouts.get(roomCode);
  if (timeout) {
    clearTimeout(timeout);
    roomPrepTimeouts.delete(roomCode);
  }
}

function trackRoundTimeout(roomCode: string, timeout: NodeJS.Timeout) {
  const list = roomRoundTimeouts.get(roomCode) || [];
  list.push(timeout);
  roomRoundTimeouts.set(roomCode, list);
}

function clearRoundTimers(roomCode: string) {
  const list = roomRoundTimeouts.get(roomCode);
  if (!list) return;
  for (const timeout of list) {
    clearTimeout(timeout);
  }
  roomRoundTimeouts.delete(roomCode);
}

function assignNextHost(room: Room) {
  if (room.players.length === 0) return;

  const nextHost = room.players.reduce((earliest, current) => {
    return current.joinedAt < earliest.joinedAt ? current : earliest;
  }, room.players[0]);

  room.players.forEach(p => { p.isHost = false; });
  nextHost.isHost = true;
  room.hostId = nextHost.id;
}

async function cleanupRoomIfEmpty(roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room || room.players.length > 0) return;

  clearLoadingTimers(roomCode);
  clearPrepTimers(roomCode);
  clearRoundTimers(roomCode);
  await queueManager.cleanupQueue(roomCode);
  rooms.delete(roomCode);
  gameStates.delete(roomCode);
  roomAnswers.delete(roomCode);
}

async function removePlayerFromRoom(
  io: Server,
  roomCode: string,
  playerId: string,
  reason: 'leave' | 'disconnect' | 'switch-room'
) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const gameState = gameStates.get(roomCode);

  const playerIndex = room.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) return;

  const player = room.players[playerIndex];
  room.players.splice(playerIndex, 1);

  // Clean up any per-round tracking for this player.
  if (gameState?.roundStartScores) {
    delete gameState.roundStartScores[player.id];
  }
  if (gameState?.roundAnswerStatus) {
    delete gameState.roundAnswerStatus[player.id];
  }

  if (player.isHost && room.players.length > 0) {
    assignNextHost(room);
  }

  io.to(roomCode).emit('player-left', { playerId: player.id, room });

  const hostName = room.players.find(p => p.isHost)?.displayName || room.players.find(p => p.isHost)?.username;
  if (reason === 'disconnect') {
    console.log(
      `⚠️ Disconnect removed ${player.displayName || player.username} from room ${roomCode}. Remaining: ${room.players.length}. Host: ${hostName}`
    );
  } else if (reason === 'switch-room') {
    console.log(
      `🔄 ${player.displayName || player.username} was moved out of room ${roomCode}. Remaining: ${room.players.length}. Host: ${hostName}`
    );
  } else {
    console.log(
      `🚪 ${player.displayName || player.username} left room ${roomCode}. Remaining: ${room.players.length}. Host: ${hostName}`
    );
  }

  await cleanupRoomIfEmpty(roomCode);
}

async function evictPlayerFromOtherRooms(io: Server, playerId: string, keepRoomCode?: string) {
  for (const [roomCode, room] of rooms.entries()) {
    if (keepRoomCode && roomCode === keepRoomCode) continue;
    if (room.players.some(p => p.id === playerId)) {
      await removePlayerFromRoom(io, roomCode, playerId, 'switch-room');
    }
  }
}

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    // Create or join room
    socket.on('create-room', async (data: {
      gameMode: GameMode;
      username: string;
      displayName?: string;
      userId?: string;
      isPrivate?: boolean;
      password?: string;
      settings?: RoomSettings;
    }) => {
      try {
        const playerId = data.userId || socket.id;
        await evictPlayerFromOtherRooms(io, playerId);

        const roomCode = generateRoomCode();
        const joinedAt = Date.now();
        const player: Player = {
          id: playerId,
          socketId: socket.id,
          username: data.username,
          displayName: data.displayName || data.username,
          score: 0,
          isHost: true,
          joinedAt,
        };

        let passwordHash: string | undefined;
        const isPrivate = data.isPrivate === true;
        if (isPrivate) {
          if (!data.password || data.password.length < 3) {
            socket.emit('error', { message: 'Private rooms require a password (min 3 characters)' });
            return;
          }
          passwordHash = await bcrypt.hash(data.password, 10);
        }

        const room: Room = {
          code: roomCode,
          gameMode: data.gameMode,
          players: [player],
          hostId: player.id,
          isActive: false,
          currentRound: 0,
          settings: normalizeRoomSettings(data.settings),
          isPrivate,
          passwordHash,
          createdAt: new Date(),
        };

        rooms.set(roomCode, room);
        gameStates.set(roomCode, { phase: 'waiting' });

        socket.join(roomCode);
        socket.emit('room-created', { room, player });

        console.log(`🎮 Room created: ${roomCode} (${data.gameMode})`);
      } catch (error) {
        console.error('Error creating room:', error);
        socket.emit('error', { message: 'Failed to create room' });
      }
    });

    socket.on('join-room', async (data: {
      roomCode: string;
      username: string;
      displayName?: string;
      userId?: string;
      password?: string;
    }) => {
      try {
        const roomCode = data.roomCode.toUpperCase();
        const room = rooms.get(roomCode);

        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        if (room.isPrivate) {
          if (!data.password) {
            socket.emit('error', { message: 'Password required to join this room' });
            return;
          }

          if (!room.passwordHash) {
            socket.emit('error', { message: 'Room password is misconfigured' });
            return;
          }

          const passwordMatches = await bcrypt.compare(data.password, room.passwordHash);
          if (!passwordMatches) {
            socket.emit('error', { message: 'Invalid room password' });
            return;
          }
        }

        const playerId = data.userId || socket.id;
        await evictPlayerFromOtherRooms(io, playerId, roomCode);

        const existingPlayer = room.players.find(p => p.id === playerId);
        if (existingPlayer) {
          existingPlayer.socketId = socket.id;
          existingPlayer.username = data.username;
          existingPlayer.displayName = data.displayName || data.username;
          socket.join(roomCode);
          socket.emit('room-joined', { room, player: existingPlayer });
          const gameState = gameStates.get(roomCode);
          if (room.isActive && gameState) {
            socket.emit('sync-state', buildSyncStatePayload(room, gameState));
          }
          console.log(`🔁 Rejoined room ${roomCode}: ${data.displayName || data.username}`);
          return;
        }

        const joinedAt = Date.now();

        // Check if player was present at game start
        const wasActiveAtStart = room.activePlayerIds?.includes(playerId) ?? false;

        const allowJoinInProgress = room.settings.allowJoinInProgress !== false;
        const isSpectator = room.isActive && !wasActiveAtStart && !allowJoinInProgress;

        const player: Player = {
          id: playerId,
          socketId: socket.id,
          username: data.username,
          displayName: data.displayName || data.username,
          score: 0,
          isHost: false,
          joinedAt,
          // Allow players who were present at start to rejoin as active players
          isSpectator,
        };

        room.players.push(player);
        if (!player.isSpectator && room.isActive) {
          room.activePlayerIds = [...(room.activePlayerIds ?? []), player.id];
        }
        socket.join(roomCode);

        io.to(roomCode).emit('player-joined', { player, room });
        emitToast(
          io,
          roomCode,
          player.isSpectator
            ? `${player.displayName || player.username} joined as a spectator.`
            : `${player.displayName || player.username} joined the room.`,
          'info'
        );
        socket.emit('room-joined', { room, player });
        if (room.isActive) {
          const gameState = gameStates.get(roomCode);
          if (gameState) {
            socket.emit('sync-state', buildSyncStatePayload(room, gameState));
          }
        }

        console.log(`👤 ${data.displayName || data.username} joined room ${roomCode}`);
        console.log(
          `ℹ️ Room ${roomCode} now has ${room.players.length} players. Host: ${
            room.players.find(p => p.isHost)?.displayName || room.players.find(p => p.isHost)?.username
          }`
        );
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    socket.on('get-rooms', () => {
      const activeRooms = Array.from(rooms.values())
        .filter(room => !room.isActive && !room.isPrivate)
        .map(room => ({
          code: room.code,
          gameMode: room.gameMode,
          playerCount: room.players.length,
          hostName: room.players.find(p => p.isHost)?.displayName || room.players.find(p => p.isHost)?.username,
        }));

      socket.emit('rooms-list', activeRooms);
    });

    socket.on('update-settings', (data: { roomCode: string; settings: any }) => {
      const room = rooms.get(data.roomCode);
      if (room) {
        room.settings = normalizeRoomSettings({ ...room.settings, ...data.settings });
        io.to(data.roomCode).emit('settings-updated', room.settings);
      }
    });

    socket.on('prepare-playlist', async (data: {
      roomCode: string;
      playlist: Array<{ url?: string; songName?: string; artist?: string }>;
    }) => {
      try {
        const room = rooms.get(data.roomCode);
        if (!room) return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player?.isHost) {
          socket.emit('error', { message: 'Only host can prepare the playlist' });
          return;
        }

        if (room.isActive) {
          socket.emit('error', { message: 'Cannot change playlist during an active game' });
          return;
        }

        clearLoadingTimers(room.code);
        clearPrepTimers(room.code);

        const gameState = gameStates.get(room.code);
        if (gameState) {
          gameState.phase = 'waiting';
          gameState.currentSong = undefined;
          gameState.roundStartedAt = undefined;
          gameState.answerStartedAt = undefined;
          gameState.clipStartedAt = undefined;
          gameState.clipDurationSec = undefined;
          gameState.clipPhase = undefined;
        }

        await queueManager.prepareQueue(room.code, room.gameMode, room.settings, data.playlist);

        io.to(room.code).emit('playlist-preparing', {
          message: 'Loading the first song...',
          totalSongs: data.playlist.length,
          queueStatus: queueManager.getQueueStatus(room.code),
        });

        monitorPlaylistPreparation(io, room);
      } catch (error) {
        console.error('Error preparing playlist:', error);
        socket.emit('error', { message: 'Failed to prepare playlist' });
      }
    });

    // NEW: Start game with playlist (not pre-downloaded songs)
    socket.on('start-game', async (data: {
      roomCode: string;
      playlist: Array<{ url?: string; songName?: string; artist?: string }>
    }) => {
      try {
        const room = rooms.get(data.roomCode);
        if (!room) return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player?.isHost) {
          socket.emit('error', { message: 'Only host can start the game' });
          return;
        }

        clearPrepTimers(room.code);
        clearLoadingTimers(room.code);

        const existingQueue = queueManager.getQueueMeta(room.code);
        const queueExhausted = queueManager.isQueueExhausted(room.code);
        const shouldPrepareQueue =
          !existingQueue ||
          queueExhausted ||
          existingQueue.total !== data.playlist.length ||
          existingQueue.gameMode !== room.gameMode ||
          !areSettingsEqual(existingQueue.settings, room.settings);

        if (shouldPrepareQueue) {
          await queueManager.prepareQueue(room.code, room.gameMode, room.settings, data.playlist);
        }

        // Notify all players game is starting
        const maxRounds = room.settings.maxRounds;
        const effectiveTotalSongs =
          typeof maxRounds === 'number' && maxRounds > 0
            ? Math.min(maxRounds, data.playlist.length)
            : data.playlist.length;
        io.to(room.code).emit('game-starting', { totalSongs: effectiveTotalSongs });

        const startGameNow = async () => {
          clearPrepTimers(room.code);
          clearLoadingTimers(room.code);

          room.isActive = true;
          room.currentRound = 1;

          // Track which players were present at game start
          room.activePlayerIds = room.players.map(p => p.id);

          room.players.forEach(p => {
            p.score = 0;
            p.hasAnswered = false;
          });
          roomAnswers.delete(room.code);

          const gameState = gameStates.get(room.code);
          if (gameState) {
            gameState.phase = 'waiting';
            gameState.currentSong = undefined;
            gameState.roundStartedAt = undefined;
            gameState.answerStartedAt = undefined;
            gameState.clipStartedAt = undefined;
            gameState.clipDurationSec = undefined;
            gameState.clipPhase = undefined;
          }

          await startNextRound(io, room);
        };

        if (queueManager.isNextSongReady(room.code)) {
          await startGameNow();
          return;
        }

        io.to(room.code).emit('playlist-preparing', {
          message: 'Loading the first song...',
          totalSongs: data.playlist.length,
          queueStatus: queueManager.getQueueStatus(room.code),
        });

        // Wait for the first song to be ready, then start automatically.
        const interval = setInterval(async () => {
          const latestRoom = rooms.get(room.code);
          if (!latestRoom || latestRoom.isActive) {
            clearPrepTimers(room.code);
            return;
          }

          if (queueManager.isNextSongReady(latestRoom.code)) {
            clearPrepTimers(latestRoom.code);
            await startGameNow();
            return;
          }

          io.to(latestRoom.code).emit('playlist-preparing', {
            message: 'Loading the first song...',
            queueStatus: queueManager.getQueueStatus(latestRoom.code),
          });
        }, 1000);
        roomPrepIntervals.set(room.code, interval);

        const timeout = setTimeout(() => {
          clearPrepTimers(room.code);
          io.to(room.code).emit('error', {
            message: 'Still having trouble loading the first song. Try another playlist.',
          });
        }, 90000);
        roomPrepTimeouts.set(room.code, timeout);
      } catch (error) {
        console.error('Error starting game:', error);
        socket.emit('error', { message: 'Failed to start game' });
      }
    });

    socket.on('stop-game', async (data: { roomCode: string }) => {
      try {
        const room = rooms.get(data.roomCode);
        if (!room) return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player?.isHost) {
          socket.emit('error', { message: 'Only the host can stop the game' });
          return;
        }

        room.isActive = false;
        room.currentRound = 0;
        room.activePlayerIds = undefined; // Clear active player tracking
        room.players.forEach(p => {
          p.hasAnswered = false;
          p.isSpectator = false; // Remove spectator status when game stops
        });
        roomAnswers.delete(room.code);

        clearLoadingTimers(room.code);
        clearPrepTimers(room.code);
        clearRoundTimers(room.code);
        await queueManager.cleanupQueue(room.code);

        const gameState = gameStates.get(room.code);
        if (gameState) {
          gameState.phase = 'waiting';
          gameState.currentSong = undefined;
          gameState.roundStartedAt = undefined;
          gameState.answerStartedAt = undefined;
          gameState.clipStartedAt = undefined;
          gameState.clipDurationSec = undefined;
          gameState.clipPhase = undefined;
        } else {
          gameStates.set(room.code, { phase: 'waiting' });
        }

        io.to(room.code).emit('game-stopped', { room });
      } catch (error) {
        console.error('Error stopping game:', error);
        socket.emit('error', { message: 'Failed to stop game' });
      }
    });

    socket.on('pause-game', (data: { roomCode: string }) => {
      const room = rooms.get(data.roomCode);
      if (!room || !room.isActive) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player?.isHost) {
        socket.emit('error', { message: 'Only the host can pause the game' });
        return;
      }

      const gameState = gameStates.get(room.code);
      if (!gameState) return;
      if (gameState.paused) return;
      if (!['playing-audio', 'answering', 'showing-results'].includes(gameState.phase)) {
        socket.emit('error', { message: 'Cannot pause during this phase' });
        return;
      }

      clearRoundTimers(room.code);
      clearLoadingTimers(room.code);

      const now = Date.now();
      let remainingMs = 0;
      let elapsedMs = 0;

      if (gameState.phase === 'playing-audio') {
        if (room.gameMode === 'guess-song-challenge') {
          const clipDuration = gameState.clipDurationSec || 1;
          const clipStartedAt = gameState.clipStartedAt || now;
          elapsedMs = Math.max(0, now - clipStartedAt);
          remainingMs = Math.max(0, (clipDuration + 3) * 1000 - elapsedMs);
          gameState.pauseClipIndex = Math.max(0, (gameState.clipPhase || 1) - 1);
        } else if (room.gameMode === 'guess-song-easy') {
          const duration = gameState.clipDurationSec || room.settings.clipDuration || 15;
          elapsedMs = Math.max(0, now - (gameState.roundStartedAt || now));
          remainingMs = Math.max(0, (duration + 1) * 1000 - elapsedMs);
        } else {
          const startTime = gameState.currentSong?.startTime ?? 0;
          const stopTime = gameState.currentSong?.stopTime ?? startTime;
          const totalMs = Math.max(0, (stopTime - startTime) * 1000);
          elapsedMs = Math.max(0, now - (gameState.roundStartedAt || now));
          remainingMs = Math.max(0, totalMs - elapsedMs);
        }
      } else if (gameState.phase === 'answering') {
        const answerTimeLimit = room.settings.lyricAnswerTimeMs ?? 20000;
        elapsedMs = Math.max(0, now - (gameState.answerStartedAt || now));
        remainingMs = Math.max(0, answerTimeLimit - elapsedMs);
      } else if (gameState.phase === 'showing-results') {
        const resultsDelay = room.settings.resultsDelayMs ?? 7000;
        elapsedMs = Math.max(0, now - (gameState.resultsStartedAt || now));
        remainingMs = Math.max(0, resultsDelay - elapsedMs);
      }

      gameState.paused = true;
      gameState.pausedAt = now;
      gameState.pausePhase = gameState.phase;
      gameState.pauseRemainingMs = remainingMs;
      gameState.pauseElapsedMs = elapsedMs;

      io.to(room.code).emit('game-paused', {
        paused: true,
        phase: gameState.phase,
        remainingMs,
      });
    });

    socket.on('resume-game', (data: { roomCode: string }) => {
      const room = rooms.get(data.roomCode);
      if (!room || !room.isActive) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player?.isHost) {
        socket.emit('error', { message: 'Only the host can resume the game' });
        return;
      }

      const gameState = gameStates.get(room.code);
      if (!gameState || !gameState.paused) return;

      const phase = gameState.pausePhase || gameState.phase;
      const remainingMs = Math.max(0, gameState.pauseRemainingMs ?? 0);
      const elapsedMs = Math.max(0, gameState.pauseElapsedMs ?? 0);

      gameState.paused = false;
      gameState.pausedAt = undefined;
      gameState.pausePhase = undefined;
      gameState.pauseRemainingMs = undefined;
      gameState.pauseClipIndex = undefined;
      gameState.pauseElapsedMs = undefined;

      let resumeStartedAt: number | undefined;
      let resumeClipStartedAt: number | undefined;
      let resumeAnswerStartedAt: number | undefined;
      let resumeResultsStartedAt: number | undefined;

      if (phase === 'playing-audio') {
        if (room.gameMode === 'guess-song-challenge') {
          resumeClipStartedAt = Date.now() - elapsedMs;
          gameState.clipStartedAt = resumeClipStartedAt;
          resumeStartedAt = resumeClipStartedAt;
          gameState.roundStartedAt = resumeStartedAt;
        } else {
          resumeStartedAt = Date.now() - elapsedMs;
          gameState.roundStartedAt = resumeStartedAt;
        }
      } else if (phase === 'answering') {
        resumeAnswerStartedAt = Date.now() - elapsedMs;
        gameState.answerStartedAt = resumeAnswerStartedAt;
      } else if (phase === 'showing-results') {
        resumeResultsStartedAt = Date.now() - elapsedMs;
        gameState.resultsStartedAt = resumeResultsStartedAt;
      }

      io.to(room.code).emit('game-paused', {
        paused: false,
        phase,
        remainingMs,
        resumeStartedAt,
        resumeClipStartedAt,
        resumeAnswerStartedAt,
        resumeResultsStartedAt,
      });

      if (phase === 'playing-audio') {
        if (room.gameMode === 'guess-song-challenge') {
          const clips = gameState.challengeClips || [1, 2, 5, 10];
          const clipIndex = gameState.pauseClipIndex ?? Math.max(0, (gameState.clipPhase || 1) - 1);
          const timeout = setTimeout(() => {
            playNextClip(io, room, gameState, gameState.currentSong?.startTime || 0, clips, clipIndex + 1);
          }, remainingMs);
          trackRoundTimeout(room.code, timeout);
        } else if (room.gameMode === 'finish-lyrics') {
          const timeout = setTimeout(() => {
            gameState.phase = 'answering';
            gameState.answerStartedAt = Date.now();
            io.to(room.code).emit('show-hangman', {
              hangman: gameState.currentSong?.targetLyricDisplay,
              targetLyric: gameState.currentSong?.targetLyric,
              answerTime: room.settings.lyricAnswerTimeMs ?? 20000,
            });

            const answerTimeout = setTimeout(() => {
              endAnsweringPhase(io, room, gameState);
            }, room.settings.lyricAnswerTimeMs ?? 20000);
            trackRoundTimeout(room.code, answerTimeout);
          }, remainingMs);
          trackRoundTimeout(room.code, timeout);
        } else {
          const timeout = setTimeout(() => {
            endAnsweringPhase(io, room, gameState);
          }, remainingMs);
          trackRoundTimeout(room.code, timeout);
        }
      } else if (phase === 'answering') {
        const timeout = setTimeout(() => {
          endAnsweringPhase(io, room, gameState);
        }, remainingMs);
        trackRoundTimeout(room.code, timeout);
      } else if (phase === 'showing-results') {
        scheduleResultsAdvance(io, room, gameState, remainingMs);
      }
    });

    socket.on('skip-round', async (data: { roomCode: string }) => {
      try {
        const room = rooms.get(data.roomCode);
        if (!room || !room.isActive) return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player?.isHost) {
          socket.emit('error', { message: 'Only the host can skip the round' });
          return;
        }

        const gameState = gameStates.get(room.code);
        if (!gameState) return;

        clearRoundTimers(room.code);
        clearLoadingTimers(room.code);

        if (gameState.currentSong) {
          await queueManager.markSongUsed(room.code, gameState.currentSong.id);
          emitSongSkipped(io, room.code, {
            title: gameState.currentSong.title,
            artist: gameState.currentSong.artist,
            albumArtUrl: gameState.currentSong.albumArtUrl,
            reason: 'Skipped by host',
          });
        }

        emitToast(io, room.code, 'Round skipped by host.', 'warning');

        room.currentRound += 1;
        await startNextRound(io, room);
      } catch (error) {
        console.error('Error skipping round:', error);
        socket.emit('error', { message: 'Failed to skip round' });
      }
    });

    socket.on('submit-answer', (data: { roomCode: string; answer: string; timestamp: number }) => {
      handleAnswer(io, socket, data);
    });

    socket.on('typing-status', (data: { roomCode: string; isTyping: boolean }) => {
      const room = rooms.get(data.roomCode);
      if (room) {
        const player = room.players.find(p => p.socketId === socket.id);
        if (player) {
          player.isTyping = data.isTyping;
          socket.to(data.roomCode).emit('player-typing', {
            playerId: player.id,
            username: player.username,
            displayName: player.displayName || player.username,
            isTyping: data.isTyping,
          });
        }
      }
    });

    socket.on('next-round', async (data: { roomCode: string }) => {
      try {
        const room = rooms.get(data.roomCode);
        if (!room) return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player?.isHost) return;

        room.currentRound++;
        await startNextRound(io, room);
      } catch (error) {
        console.error('Error starting next round:', error);
      }
    });

    socket.on('leave-room', async (data: { roomCode: string; userId?: string }) => {
      try {
        const roomCode = data.roomCode.toUpperCase();
        const room = rooms.get(roomCode);
        if (!room) return;

        const player =
          room.players.find(p => p.socketId === socket.id) ||
          (data.userId ? room.players.find(p => p.id === data.userId) : undefined);
        if (!player) return;

        socket.leave(roomCode);
        await removePlayerFromRoom(io, roomCode, player.id, 'leave');
      } catch (error) {
        console.error('Error leaving room:', error);
        socket.emit('error', { message: 'Failed to leave room' });
      }
    });

    socket.on('end-game', async (data: { roomCode: string }) => {
      try {
        const room = rooms.get(data.roomCode);
        if (!room) return;

        // Save session history
        for (const player of room.players) {
          if (player.id.length > 24) continue;

          await User.findByIdAndUpdate(player.id, {
            $push: {
              sessionHistory: {
                gameMode: room.gameMode,
                score: player.score,
                date: new Date(),
                roomCode: room.code,
              },
            },
          });
        }

        io.to(data.roomCode).emit('game-ended', {
          finalScores: room.players.map(p => ({
            username: p.username,
            displayName: p.displayName || p.username,
            score: p.score,
          })),
        });

        // Cleanup queue and songs
        clearLoadingTimers(data.roomCode);
        clearPrepTimers(data.roomCode);
        await queueManager.cleanupQueue(data.roomCode);

        // Cleanup
        rooms.delete(data.roomCode);
        gameStates.delete(data.roomCode);
        roomAnswers.delete(data.roomCode);
      } catch (error) {
        console.error('Error ending game:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);

      for (const [roomCode, room] of rooms.entries()) {
        const playerIndex = room.players.findIndex(p => p.socketId === socket.id);

        if (playerIndex !== -1) {
          const player = room.players[playerIndex];
          void removePlayerFromRoom(io, roomCode, player.id, 'disconnect');
        }
      }
    });
  });
}

function monitorPlaylistPreparation(io: Server, room: Room) {
  clearPrepTimers(room.code);

  const interval = setInterval(() => {
    const latestRoom = rooms.get(room.code);
    if (!latestRoom) {
      clearPrepTimers(room.code);
      return;
    }

    if (latestRoom.isActive) {
      clearPrepTimers(room.code);
      return;
    }

    const queueStatus = queueManager.getQueueStatus(latestRoom.code);
    const firstReady = queueManager.isNextSongReady(latestRoom.code);

    if (firstReady) {
      io.to(latestRoom.code).emit('playlist-ready', {
        message: 'First song is ready. You can start the game.',
        queueStatus,
      });
      clearPrepTimers(latestRoom.code);
      return;
    }

    io.to(latestRoom.code).emit('playlist-preparing', {
      message: 'Loading songs...',
      queueStatus,
    });
  }, 1000);

  roomPrepIntervals.set(room.code, interval);

  const timeout = setTimeout(() => {
    clearPrepTimers(room.code);

    const latestRoom = rooms.get(room.code);
    if (!latestRoom || latestRoom.isActive) return;

    const { skipped } = queueManager.skipFailedSongs(latestRoom.code);
    const queueStatus = queueManager.getQueueStatus(latestRoom.code);

    if (queueManager.isNextSongReady(latestRoom.code)) {
      io.to(latestRoom.code).emit('playlist-ready', {
        message: skipped > 0
          ? `Skipped ${skipped} failed song(s). First song is ready.`
          : 'First song is ready. You can start the game.',
        queueStatus,
      });
      return;
    }

    io.to(latestRoom.code).emit('error', {
      message: 'Still having trouble loading the first song. Try another playlist.',
    });
  }, 90000);

  roomPrepTimeouts.set(room.code, timeout);
}

// NEW: Start next round with queue checking
async function startNextRound(io: Server, room: Room) {
  const gameState = gameStates.get(room.code);
  if (!gameState) return;

  clearPrepTimers(room.code);
  clearLoadingTimers(room.code);
  clearRoundTimers(room.code);

  const { skipped: initialSkipped, hasNext } = queueManager.skipFailedSongs(room.code);
  if (initialSkipped > 0) {
    room.currentRound += initialSkipped;
    emitToast(io, room.code, `Skipped ${initialSkipped} song(s) that failed to load.`, 'warning');
    emitSongSkipped(io, room.code, {
      skippedCount: initialSkipped,
      reason: 'Failed to load',
    });
  }

  if (shouldEndForMaxRounds(room)) {
    await queueManager.cleanupQueue(room.code);
    endGame(io, room, gameState);
    return;
  }

  if (!hasNext || queueManager.isQueueExhausted(room.code)) {
    endGame(io, room, gameState);
    return;
  }

  // Check if next song is ready
  if (!queueManager.isNextSongReady(room.code)) {
    // Show loading state
    io.to(room.code).emit('loading-song', {
      message: 'Loading next song...',
      queueStatus: queueManager.getQueueStatus(room.code),
    });

    // Wait for song to be ready (check every second)
    const checkInterval = setInterval(async () => {
      const latestRoom = rooms.get(room.code);
      if (!latestRoom || !latestRoom.isActive) {
        clearLoadingTimers(room.code);
        return;
      }

      if (queueManager.isNextSongReady(latestRoom.code)) {
        clearLoadingTimers(latestRoom.code);
        const latestState = gameStates.get(latestRoom.code);
        if (latestState) {
          await proceedWithRound(io, latestRoom, latestState);
        }
        return;
      }

      if (queueManager.isQueueExhausted(latestRoom.code) || shouldEndForMaxRounds(latestRoom)) {
        clearLoadingTimers(latestRoom.code);
        if (shouldEndForMaxRounds(latestRoom)) {
          await queueManager.cleanupQueue(latestRoom.code);
        }
        endGame(io, latestRoom, gameStates.get(latestRoom.code));
        return;
      }
    }, 1000);
    roomLoadingIntervals.set(room.code, checkInterval);

    // Timeout after 60 seconds
    const timeout = setTimeout(() => {
      clearLoadingTimers(room.code);

      void (async () => {
        const latestRoom = rooms.get(room.code);
        const latestState = gameStates.get(room.code);
        if (!latestRoom || !latestState || !latestRoom.isActive) {
          return;
        }

        // If the song became ready while we were timing out, proceed.
        if (queueManager.isNextSongReady(latestRoom.code)) {
          await proceedWithRound(io, latestRoom, latestState);
          return;
        }

        // Try to skip failed songs so the game doesn't get stuck.
        const { skipped, hasNext } = queueManager.skipFailedSongs(latestRoom.code);
        if (skipped > 0) {
          latestRoom.currentRound += skipped;
          emitToast(io, latestRoom.code, `Skipped ${skipped} song(s) that failed to load.`, 'warning');
          emitSongSkipped(io, latestRoom.code, {
            skippedCount: skipped,
            reason: 'Failed to load',
          });
        }

        if (queueManager.isNextSongReady(latestRoom.code)) {
          if (skipped > 0) {
            io.to(latestRoom.code).emit('loading-song', {
              message: `Skipping ${skipped} failed song(s)...`,
              queueStatus: queueManager.getQueueStatus(latestRoom.code),
            });
          }
          await proceedWithRound(io, latestRoom, latestState);
          return;
        }

        if (!hasNext || shouldEndForMaxRounds(latestRoom)) {
          if (shouldEndForMaxRounds(latestRoom)) {
            await queueManager.cleanupQueue(latestRoom.code);
          }
          endGame(io, latestRoom, latestState);
          return;
        }

        io.to(latestRoom.code).emit('error', { message: 'Failed to load song, trying the next one...' });
        // Re-attempt the round start; this will show loading UI again.
        await startNextRound(io, latestRoom);
      })();
    }, 60000);
    roomLoadingTimeouts.set(room.code, timeout);
  } else {
    await proceedWithRound(io, room, gameState);
  }
}

function initializeRoundTracking(room: Room, gameState: GameState) {
  gameState.roundStartScores = {};
  gameState.roundAnswerStatus = {};

  for (const player of room.players) {
    gameState.roundStartScores[player.id] = player.score;
    gameState.roundAnswerStatus[player.id] = {
      titleAnswered: false,
      artistAnswered: false,
      artistMatches: [],
      artistTotal: 0,
      lyricAnswered: false,
      titleScore: 0,
      artistScore: 0,
      lyricScore: 0,
      locked: false,
    };
    player.hasAnswered = player.isSpectator === true;
  }
}

function setArtistTotals(gameState: GameState, artistCount: number) {
  if (!gameState.roundAnswerStatus) return;
  for (const status of Object.values(gameState.roundAnswerStatus)) {
    status.artistTotal = artistCount;
  }
}

async function proceedWithRound(io: Server, room: Room, gameState: GameState) {
  const nextSongData = await queueManager.getNextSong(room.code);

  if (!nextSongData) {
    endGame(io, room, gameState);
    return;
  }

  const song = await Song.findById(nextSongData.songId);
  if (!song) {
    queueManager.markSongFailed(room.code, nextSongData.index, 'Song data missing');
    emitToast(io, room.code, 'Skipped a song because its data could not be loaded.', 'warning');
    emitSongSkipped(io, room.code, {
      title: nextSongData.metadata?.title,
      artist: nextSongData.metadata?.artist,
      albumArtUrl: nextSongData.metadata?.albumArtUrl || undefined,
      reason: 'Song data missing',
    });
    room.currentRound += 1;
    await startNextRound(io, room);
    return;
  }
  const { clip, metadata } = nextSongData;

  // Reset player states and initialize per-round tracking
  initializeRoundTracking(room, gameState);
  roomAnswers.set(room.code, []);

  if (room.gameMode === 'finish-lyrics') {
    await startFinishLyricsRound(io, room, song, gameState, clip, metadata, nextSongData.index);
  } else if (room.gameMode === 'guess-song-easy') {
    await startGuessSongEasyRound(io, room, song, gameState, clip, metadata);
  } else if (room.gameMode === 'guess-song-challenge') {
    await startGuessSongChallengeRound(io, room, song, gameState, clip, metadata);
  }
}

// Rest of the functions remain the same...
async function startFinishLyricsRound(
  io: Server,
  room: Room,
  song: any,
  gameState: GameState,
  clip: PrecomputedClip,
  metadata: PreparedSongMetadata,
  queueIndex: number
) {
  const startTime = clip.playbackStartSec;
  const stopTime = clip.playbackStopSec ?? startTime + 15;
  const clipLyricLines = clip.clipLyricLines || [];
  const targetLyric = clip.targetLyric;
  const targetLyricDisplay = clip.targetLyricDisplay;

  if (!targetLyric || !targetLyricDisplay) {
    queueManager.markSongFailed(room.code, queueIndex, 'Not enough lyrics for this song');
    emitToast(io, room.code, 'Skipped a song because it did not have enough lyrics.', 'warning');
    emitSongSkipped(io, room.code, {
      title: metadata.title,
      artist: metadata.artist,
      albumArtUrl: metadata.albumArtUrl || undefined,
      reason: 'Not enough lyrics',
    });
    room.currentRound += 1;
    await startNextRound(io, room);
    return;
  }

  const countdownMs = room.settings.roundCountdownMs ?? ROUND_COUNTDOWN_MS;
  const countdownEndsAt = Date.now() + countdownMs;
  gameState.phase = 'countdown';
  gameState.countdownEndsAt = countdownEndsAt;

  io.to(room.code).emit('round-countdown', {
    countdownMs,
    endsAt: countdownEndsAt,
    round: room.currentRound,
  });

  const countdownTimeout = setTimeout(() => {
    gameState.phase = 'playing-audio';
    gameState.roundStartedAt = Date.now();
    gameState.answerStartedAt = undefined;
    gameState.clipStartedAt = gameState.roundStartedAt;
    gameState.clipDurationSec = stopTime - startTime;
    gameState.currentSong = {
      id: song._id.toString(),
      title: metadata.title,
      artist: metadata.artist,
      audioUrl: `/audio/${song.audioPath.split('/').pop()}`,
      albumArtUrl: (song as any)?.albumArtUrl || metadata.albumArtUrl || undefined,
      startTime,
      stopTime,
      lyricsSource: (song as any)?.lyricsSource || metadata.lyricsSource || undefined,
      targetLyric,
      targetLyricDisplay,
      clipLyricLines,
    };

    io.to(room.code).emit('round-started', {
      phase: 'playing-audio',
      audioUrl: gameState.currentSong.audioUrl,
      startTime,
      stopTime,
      hangman: gameState.currentSong.targetLyricDisplay,
      clipLyricLines,
      lyricsSource: gameState.currentSong.lyricsSource,
      startedAt: gameState.roundStartedAt,
      round: room.currentRound,
    });

    const audioDuration = (stopTime - startTime) * 1000;
    const audioTimeout = setTimeout(() => {
      gameState.phase = 'answering';
      gameState.answerStartedAt = Date.now();
      io.to(room.code).emit('show-hangman', {
        hangman: gameState.currentSong!.targetLyricDisplay,
        targetLyric: gameState.currentSong!.targetLyric,
      answerTime: room.settings.lyricAnswerTimeMs ?? 20000,
  });

      const answerTimeout = setTimeout(() => {
        endAnsweringPhase(io, room, gameState);
      }, room.settings.lyricAnswerTimeMs ?? 20000);
      trackRoundTimeout(room.code, answerTimeout);
    }, audioDuration);
    trackRoundTimeout(room.code, audioTimeout);
  }, countdownMs);
  trackRoundTimeout(room.code, countdownTimeout);
}

async function startGuessSongEasyRound(
  io: Server,
  room: Room,
  song: any,
  gameState: GameState,
  clip: PrecomputedClip,
  metadata: PreparedSongMetadata
) {
  const startTime = clip.playbackStartSec;
  const duration = clip.playbackDurationSec ?? (room.settings.clipDuration || 15);
  const { cleanTitle, featuredArtists } = extractFeaturedArtistsFromTitle(metadata.title);
  const baseArtists = metadata.artists && metadata.artists.length
    ? metadata.artists
    : splitArtists(metadata.artist);
  const artists = mergeArtists(baseArtists, featuredArtists);
  const displayArtist = artists.join(', ');
  const hangmanOptions = getHangmanOptionsFromSettings(room.settings);
  const hangman = clip.hangman || formatGuessHangman(cleanTitle, artists, hangmanOptions);

  const countdownMs = room.settings.roundCountdownMs ?? ROUND_COUNTDOWN_MS;
  const countdownEndsAt = Date.now() + countdownMs;
  gameState.phase = 'countdown';
  gameState.countdownEndsAt = countdownEndsAt;

  io.to(room.code).emit('round-countdown', {
    countdownMs,
    endsAt: countdownEndsAt,
    round: room.currentRound,
  });

  const countdownTimeout = setTimeout(() => {
    gameState.phase = 'playing-audio';
    gameState.roundStartedAt = Date.now();
    gameState.answerStartedAt = undefined;
    gameState.clipStartedAt = gameState.roundStartedAt;
    gameState.clipDurationSec = duration;
    gameState.currentSong = {
      id: song._id.toString(),
      title: cleanTitle || metadata.title,
      artist: displayArtist || metadata.artist,
      artists,
      audioUrl: `/audio/${song.audioPath.split('/').pop()}`,
      albumArtUrl: (song as any)?.albumArtUrl || metadata.albumArtUrl || undefined,
      startTime,
      stopTime: startTime + duration,
      lyricsSource: (song as any)?.lyricsSource || metadata.lyricsSource || undefined,
      targetLyricDisplay: hangman,
    };

    setArtistTotals(gameState, artists.length);

    io.to(room.code).emit('round-started', {
      phase: 'playing-audio',
      audioUrl: gameState.currentSong.audioUrl,
      startTime,
      duration,
      hangman,
      lyricsSource: gameState.currentSong.lyricsSource,
      startedAt: gameState.roundStartedAt,
      round: room.currentRound,
    });

    const answerTimeout = setTimeout(() => {
      endAnsweringPhase(io, room, gameState);
    }, (duration + 1) * 1000);
    trackRoundTimeout(room.code, answerTimeout);
  }, countdownMs);
  trackRoundTimeout(room.code, countdownTimeout);
}

async function startGuessSongChallengeRound(
  io: Server,
  room: Room,
  song: any,
  gameState: GameState,
  clip: PrecomputedClip,
  metadata: PreparedSongMetadata
) {
  const startTime = clip.playbackStartSec;
  const clips = clip.challengeClips || [1, 2, 5, 10];
  const { cleanTitle, featuredArtists } = extractFeaturedArtistsFromTitle(metadata.title);
  const baseArtists = metadata.artists && metadata.artists.length
    ? metadata.artists
    : splitArtists(metadata.artist);
  const artists = mergeArtists(baseArtists, featuredArtists);
  const displayArtist = artists.join(', ');
  const hangmanOptions = getHangmanOptionsFromSettings(room.settings);
  const hangman = clip.hangman || formatGuessHangman(cleanTitle, artists, hangmanOptions);

  const countdownMs = room.settings.roundCountdownMs ?? ROUND_COUNTDOWN_MS;
  const countdownEndsAt = Date.now() + countdownMs;
  gameState.phase = 'countdown';
  gameState.countdownEndsAt = countdownEndsAt;
  gameState.challengeClips = clips;
  gameState.roundStartedAt = undefined;
  gameState.answerStartedAt = undefined;
  gameState.clipPhase = 0;
  gameState.clipStartedAt = undefined;
  gameState.clipDurationSec = undefined;
  gameState.currentSong = {
    id: song._id.toString(),
    title: cleanTitle || metadata.title,
    artist: displayArtist || metadata.artist,
    artists,
    audioUrl: `/audio/${song.audioPath.split('/').pop()}`,
    albumArtUrl: (song as any)?.albumArtUrl || metadata.albumArtUrl || undefined,
    startTime,
    lyricsSource: (song as any)?.lyricsSource || metadata.lyricsSource || undefined,
    targetLyricDisplay: hangman,
  };

  setArtistTotals(gameState, artists.length);

  io.to(room.code).emit('round-countdown', {
    countdownMs,
    endsAt: countdownEndsAt,
    round: room.currentRound,
  });

  const countdownTimeout = setTimeout(() => {
    gameState.phase = 'playing-audio';
    gameState.roundStartedAt = Date.now();
    playNextClip(io, room, gameState, startTime, clips, 0);
  }, countdownMs);
  trackRoundTimeout(room.code, countdownTimeout);
}

function playNextClip(io: Server, room: Room, gameState: GameState, startTime: number, clips: number[], clipIndex: number) {
  if (clipIndex >= clips.length) {
    endAnsweringPhase(io, room, gameState);
    return;
  }

  const clipDuration = clips[clipIndex];
  gameState.clipPhase = clipIndex + 1;
  gameState.clipStartedAt = Date.now();
  gameState.clipDurationSec = clipDuration;

  io.to(room.code).emit('play-clip', {
    audioUrl: gameState.currentSong!.audioUrl,
    startTime,
    duration: clipDuration,
    clipPhase: gameState.clipPhase,
    hangman: gameState.currentSong!.targetLyricDisplay,
    lyricsSource: gameState.currentSong?.lyricsSource,
    startedAt: gameState.clipStartedAt,
  });

  const isLastClip = clipIndex >= clips.length - 1;
  const clipDelaySec = isLastClip ? clipDuration : clipDuration + 3;
  const clipTimeout = setTimeout(() => {
    playNextClip(io, room, gameState, startTime, clips, clipIndex + 1);
  }, clipDelaySec * 1000);
  trackRoundTimeout(room.code, clipTimeout);
}

function emitWrongAnswerChat(io: Server, room: Room, player: Player, answer: string) {
  io.to(room.code).emit('chat-message', {
    id: `${Date.now()}-${player.id}`,
    playerId: player.id,
    username: player.username,
    displayName: player.displayName || player.username,
    text: answer,
    kind: 'wrong-answer',
    createdAt: Date.now(),
  });
}

function getOrCreatePlayerRoundStatus(gameState: GameState, playerId: string) {
  if (!gameState.roundAnswerStatus) {
    gameState.roundAnswerStatus = {};
  }

  if (!gameState.roundAnswerStatus[playerId]) {
    gameState.roundAnswerStatus[playerId] = {
      titleAnswered: false,
      artistAnswered: false,
      artistMatches: [],
      artistTotal: 0,
      lyricAnswered: false,
      titleScore: 0,
      artistScore: 0,
      lyricScore: 0,
      locked: false,
    };
  }

  return gameState.roundAnswerStatus[playerId];
}

function buildStatusPayload(gameState: GameState, playerId: string) {
  const status = getOrCreatePlayerRoundStatus(gameState, playerId);
  const currentSong = gameState.currentSong;
  const artistTotal = currentSong?.artists?.length ?? status.artistTotal ?? 0;
  const matchedCount = status.artistMatches?.length ?? 0;

  return {
    title: {
      answered: status.titleAnswered,
      score: status.titleScore,
      correctAnswer: status.titleAnswered ? currentSong?.title : undefined,
    },
    artist: {
      answered: status.artistAnswered,
      score: status.artistScore,
      matchedCount,
      total: artistTotal,
      correctAnswer: status.artistAnswered ? currentSong?.artist : undefined,
    },
    lyric: {
      answered: status.lyricAnswered,
      score: status.lyricScore,
      correctAnswer: status.lyricAnswered ? currentSong?.targetLyric : undefined,
    },
    locked: status.locked,
    isComplete: status.lyricAnswered || (status.titleAnswered && status.artistAnswered),
  };
}

function handleAnswer(io: Server, socket: Socket, data: { roomCode: string; answer: string; timestamp: number }) {
  const room = rooms.get(data.roomCode);
  const gameState = gameStates.get(data.roomCode);
  if (!room || !gameState) return;

  const player = room.players.find(p => p.socketId === socket.id);
  if (!player) return;

  const isFinishLyrics = room.gameMode === 'finish-lyrics';
  const isGuessMode = room.gameMode === 'guess-song-easy' || room.gameMode === 'guess-song-challenge';
  const canAnswer =
    (isFinishLyrics && gameState.phase === 'answering') ||
    (isGuessMode && gameState.phase === 'playing-audio');

  if (!canAnswer) {
    socket.emit('error', { message: 'Answers are not accepted right now' });
    return;
  }

  const status = getOrCreatePlayerRoundStatus(gameState, player.id);
  if (isFinishLyrics && (status.locked || status.lyricAnswered)) return;
  if (isGuessMode && status.titleAnswered && status.artistAnswered) return;

  const answerText = data.answer.trim();
  if (!answerText) return;

  const submission: AnswerSubmission = {
    playerId: player.id,
    answer: answerText,
    timestamp: data.timestamp,
  };

  const currentSong = gameState.currentSong;
  if (!currentSong) return;

  const normalizeOptions = {
    allowChineseVariants: room.settings.allowChineseVariants !== false,
  };
  const shouldStripNumbers = isGuessMode && room.settings.revealNumbers === false;
  const stripNumbers = (value: string) => value.replace(/[0-9]/g, '');
  const normalizeForGuess = (value: string) => {
    const normalized = normalizeText(value, normalizeOptions);
    const stripped = shouldStripNumbers ? stripNumbers(normalized) : normalized;
    return stripped.replace(/\s+/g, '');
  };

  const titleMatch =
    isGuessMode &&
    !status.titleAnswered &&
    normalizeForGuess(answerText) === normalizeForGuess(currentSong.title);
  const artistList = currentSong.artists && currentSong.artists.length
    ? currentSong.artists
    : splitArtists(currentSong.artist);
  const matchedArtists = (() => {
    if (!isGuessMode) return [];
    if (!shouldStripNumbers) {
      return matchArtists(answerText, artistList, normalizeOptions);
    }

    const answerParts = normalizeText(answerText, normalizeOptions)
      .split(/\s*(?:,|&| and | x | × |\/|;)\s*/i)
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => normalizeForGuess(part));

    const normalizedAnswers = new Set(answerParts.map(part => part.toLowerCase()));
    const matched: string[] = [];
    for (const artist of artistList) {
      const normalizedArtist = normalizeForGuess(artist).toLowerCase().trim();
      if (!normalizedArtist) continue;
      if (normalizedAnswers.has(normalizedArtist)) {
        matched.push(artist);
      }
    }
    return matched;
  })();
  const existingMatches = status.artistMatches || [];
  const newArtistMatches = matchedArtists.filter(
    artist => !existingMatches.some(existing => isAnswerCorrect(existing, artist, normalizeOptions))
  );
  const artistMatch = isGuessMode && newArtistMatches.length > 0;
  const targetLyric = currentSong.targetLyric || '';
  const lyricScoreData = isFinishLyrics
    ? calculateWordMatchScore(answerText, targetLyric, 1000, normalizeOptions)
    : { score: 0, matchedWords: 0, totalWords: 0 };
  const lyricMatch = isFinishLyrics && !status.lyricAnswered;
  const anyMatch = isGuessMode ? titleMatch || artistMatch : lyricScoreData.matchedWords > 0;

  // For finish-lyrics, lock the player after their first attempt to prevent brute force.
  if (isFinishLyrics && status.locked) return;

  const scores = calculateAnswerScores(room, gameState, {
    titleMatch,
    artistMatchCount: newArtistMatches.length,
    lyricMatch,
  }, answerText);

  let scoreAwarded = 0;

  if (lyricMatch) {
    status.lyricAnswered = true;
    status.lyricScore = scores.lyricScore;
    scoreAwarded += scores.lyricScore;
    player.hasAnswered = true;
    status.locked = true;
  }

  if (titleMatch) {
    status.titleAnswered = true;
    status.titleScore = scores.titleScore;
    scoreAwarded += scores.titleScore;
  }

  if (artistMatch) {
    status.artistMatches = [...existingMatches, ...newArtistMatches];
    status.artistScore += scores.artistScore;
    scoreAwarded += scores.artistScore;
    status.artistAnswered = status.artistMatches.length >= (artistList.length || 1);
  }

  if (isFinishLyrics && !lyricMatch) {
    status.locked = true;
    player.hasAnswered = true;
  }

  if (isGuessMode) {
    player.hasAnswered = status.titleAnswered && status.artistAnswered;
  }

  if (scoreAwarded > 0) {
    player.score += scoreAwarded;
  }

  submission.wasCorrect = anyMatch;
  submission.matchedTitle = titleMatch;
  submission.matchedArtist = artistMatch;
  submission.matchedLyric = lyricScoreData.matchedWords > 0;
  submission.scoreAwarded = scoreAwarded;

  const answers = roomAnswers.get(data.roomCode) || [];
  answers.push(submission);
  roomAnswers.set(data.roomCode, answers);

  if (!anyMatch && !isFinishLyrics) {
    emitWrongAnswerChat(io, room, player, answerText);
  }

  socket.emit('answer-feedback', {
    correct: anyMatch,
    field: lyricMatch ? 'lyric' : titleMatch && artistMatch ? 'both' : titleMatch ? 'title' : artistMatch ? 'artist' : 'none',
    scoreAwarded,
    totalScore: player.score,
    status: buildStatusPayload(gameState, player.id),
    message: isFinishLyrics
      ? lyricScoreData.matchedWords > 0
        ? `Matched ${lyricScoreData.matchedWords}/${lyricScoreData.totalWords} words`
        : 'No matching words'
      : anyMatch
        ? undefined
        : 'Incorrect answer',
  });

  io.to(room.code).emit('player-answer-status', {
    playerId: player.id,
    titleAnswered: status.titleAnswered,
    artistMatchedCount: status.artistMatches?.length ?? 0,
    artistTotal: status.artistTotal ?? (artistList.length || 0),
    lyricAnswered: status.lyricAnswered,
  });

  // Auto-advance when all active players have answered.
  if (allActivePlayersAnswered(room)) {
    endAnsweringPhase(io, room, gameState);
  }
}

function calculateAnswerScores(
  room: Room,
  gameState: GameState,
  matches: { titleMatch: boolean; artistMatchCount: number; lyricMatch: boolean },
  answerText: string
) {
  const currentSong = gameState.currentSong;
  if (!currentSong) {
    return { titleScore: 0, artistScore: 0, lyricScore: 0 };
  }

  const now = Date.now();
  const normalizeOptions = {
    allowChineseVariants: room.settings.allowChineseVariants !== false,
  };

  const linearScore = (maxScore: number, minScore: number, progress: number) => {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const score = maxScore - (maxScore - minScore) * clampedProgress;
    return Math.round(Math.max(minScore, Math.min(maxScore, score)));
  };

  if (room.gameMode === 'finish-lyrics') {
    const targetLyric = currentSong.targetLyric || '';
    const wordScore = calculateWordMatchScore(answerText, targetLyric, 1000, normalizeOptions);
    return {
      titleScore: 0,
      artistScore: 0,
      lyricScore: matches.lyricMatch ? wordScore.score : 0,
    };
  }

  if (room.gameMode === 'guess-song-easy') {
    const clipDuration = room.settings.clipDuration || 15;
    const clipStartedAt = gameState.clipStartedAt || gameState.roundStartedAt || now;
    const bufferMs = 1000;
    const effectiveTimeTaken = Math.max(0, now - clipStartedAt - bufferMs);

    return {
      titleScore: matches.titleMatch
        ? calculateTimeBasedScore(effectiveTimeTaken, clipDuration * 1000, 1000, 200)
        : 0,
      artistScore: matches.artistMatchCount > 0 ? 200 * matches.artistMatchCount : 0,
      lyricScore: 0,
    };
  }

  if (room.gameMode === 'guess-song-challenge') {
    const clipDurationSec = gameState.clipDurationSec || 1;
    const clipStartedAt = gameState.clipStartedAt || gameState.roundStartedAt || now;
    const elapsedInClipSec = Math.max(0, (now - clipStartedAt) / 1000);
    const heardSeconds = Math.min(clipDurationSec, elapsedInClipSec);
    const progress = heardSeconds / 10;

    return {
      titleScore: matches.titleMatch ? linearScore(1000, 200, progress) : 0,
      artistScore: matches.artistMatchCount > 0 ? 200 * matches.artistMatchCount : 0,
      lyricScore: 0,
    };
  }

  return { titleScore: 0, artistScore: 0, lyricScore: 0 };
}

async function endAnsweringPhase(io: Server, room: Room, gameState: GameState) {
    if (gameState.phase === 'showing-results') {
      return;
    }
  // Stop any scheduled clip/answer timers from continuing the round UI.
  clearRoundTimers(room.code);
  gameState.phase = 'showing-results';
  gameState.resultsStartedAt = Date.now();

  const roundStartScores = gameState.roundStartScores || {};
  const roundStatus = gameState.roundAnswerStatus || {};
  const normalizeOptions = {
    allowChineseVariants: room.settings.allowChineseVariants !== false,
  };
  const answers = roomAnswers.get(room.code) || [];
  const latestAnswerByPlayer = new Map<string, AnswerSubmission>();
  for (const submission of answers) {
    latestAnswerByPlayer.set(submission.playerId, submission);
  }

  const lyricAnswers = room.gameMode === 'finish-lyrics'
    ? room.players.map(player => ({
      username: player.username,
      displayName: player.displayName || player.username,
      answer: latestAnswerByPlayer.get(player.id)?.answer || '',
      score: roundStatus[player.id]?.lyricScore || 0,
    }))
    : undefined;

  io.to(room.code).emit('round-ended', {
    correctAnswer: {
      title: gameState.currentSong?.title,
      artist: gameState.currentSong?.artist,
      lyric: gameState.currentSong?.targetLyric,
      albumArtUrl: gameState.currentSong?.albumArtUrl,
    },
    playerScores: room.players.map(p => ({
      username: p.username,
      displayName: p.displayName || p.username,
      score: p.score,
      hasAnswered: p.hasAnswered,
      roundScore: p.score - (roundStartScores[p.id] ?? p.score),
      answeredTitle: roundStatus[p.id]?.titleAnswered,
      answeredArtist: roundStatus[p.id]?.artistAnswered,
      artistMatchedCount: roundStatus[p.id]?.artistMatches?.length ?? 0,
      artistTotal: roundStatus[p.id]?.artistTotal ?? (gameState.currentSong?.artists?.length ?? 0),
      artistMatches: (() => {
        const artists = gameState.currentSong?.artists || [];
        if (!artists.length) return [];
        return (roundStatus[p.id]?.artistMatches || []).slice();
      })(),
      artistMisses: (() => {
        const artists = gameState.currentSong?.artists || [];
        if (!artists.length) return [];
        const matches = roundStatus[p.id]?.artistMatches || [];
        return artists.filter(artist =>
          !matches.some(match => isArtistMatch(match, artist, normalizeOptions))
        );
      })(),
      answeredLyric: roundStatus[p.id]?.lyricAnswered,
    })),
    lyricAnswers,
    queueStatus: queueManager.getQueueStatus(room.code),
  });

  // Mark song as used and delete it
  if (gameState.currentSong) {
    await queueManager.markSongUsed(room.code, gameState.currentSong.id);
  }

  roomAnswers.delete(room.code);

  scheduleResultsAdvance(io, room, gameState, room.settings.resultsDelayMs ?? 7000);
}

function scheduleResultsAdvance(io: Server, room: Room, gameState: GameState, delayMs: number) {
  const resultsTimeout = setTimeout(async () => {
    const latestRoom = rooms.get(room.code);
    const latestGameState = gameStates.get(room.code);
    if (!latestRoom || !latestGameState) return;
    if (!latestRoom.isActive) return;

    const maxRounds = latestRoom.settings.maxRounds;
    if (typeof maxRounds === 'number' && maxRounds > 0 && latestRoom.currentRound >= maxRounds) {
      await queueManager.cleanupQueue(latestRoom.code);
      endGame(io, latestRoom, latestGameState);
      return;
    }

    latestRoom.currentRound += 1;
    await startNextRound(io, latestRoom);
  }, delayMs);
  trackRoundTimeout(room.code, resultsTimeout);
}

function allActivePlayersAnswered(room: Room): boolean {
  const activePlayers = room.players.filter(player => !player.isSpectator);
  if (activePlayers.length === 0) {
    return false;
  }
  return activePlayers.every(player => player.hasAnswered);
}
