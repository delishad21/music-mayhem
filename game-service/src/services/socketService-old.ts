import { Server, Socket } from 'socket.io';
import { Room, Player, GameState, GameMode, AnswerSubmission } from '../types/game';
import {
  generateRoomCode,
  toHangmanFormat,
  isAnswerCorrect,
  calculateTimeBasedScore,
  selectRandomLyric,
  getRandomSnippet,
  getChallengeClips,
} from '../utils/gameUtils';
import Song from '../models/Song';
import User from '../models/User';

// In-memory storage for active rooms
const rooms = new Map<string, Room>();
const gameStates = new Map<string, GameState>();
const roomAnswers = new Map<string, AnswerSubmission[]>();

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    // Create or join room
    socket.on('create-room', async (data: { gameMode: GameMode; username: string; userId?: string }) => {
      try {
        const roomCode = generateRoomCode();
        const player: Player = {
          id: data.userId || socket.id,
          socketId: socket.id,
          username: data.username,
          score: 0,
          isHost: true,
          joinedAt: Date.now(),
        };

        const room: Room = {
          code: roomCode,
          gameMode: data.gameMode,
          players: [player],
          hostId: player.id,
          isActive: false,
          currentRound: 0,
          settings: {},
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

    socket.on('join-room', (data: { roomCode: string; username: string; userId?: string }) => {
      try {
        const room = rooms.get(data.roomCode);

        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        if (room.isActive) {
          socket.emit('error', { message: 'Game already in progress' });
          return;
        }

        const player: Player = {
          id: data.userId || socket.id,
          socketId: socket.id,
          username: data.username,
          score: 0,
          isHost: false,
          joinedAt: Date.now(),
        };

        room.players.push(player);
        socket.join(data.roomCode);

        io.to(data.roomCode).emit('player-joined', { player, room });
        socket.emit('room-joined', { room, player });

        console.log(`👤 ${data.username} joined room ${data.roomCode}`);
      } catch (error) {
        console.error('Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    socket.on('get-rooms', () => {
      const activeRooms = Array.from(rooms.values())
        .filter(room => !room.isActive)
        .map(room => ({
          code: room.code,
          gameMode: room.gameMode,
          playerCount: room.players.length,
          hostName: room.players.find(p => p.isHost)?.username,
        }));

      socket.emit('rooms-list', activeRooms);
    });

    socket.on('update-settings', (data: { roomCode: string; settings: any }) => {
      const room = rooms.get(data.roomCode);
      if (room) {
        room.settings = { ...room.settings, ...data.settings };
        io.to(data.roomCode).emit('settings-updated', room.settings);
      }
    });

    socket.on('start-game', async (data: { roomCode: string; songIds: string[] }) => {
      try {
        const room = rooms.get(data.roomCode);
        if (!room) return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player?.isHost) {
          socket.emit('error', { message: 'Only host can start the game' });
          return;
        }

        room.isActive = true;
        room.currentRound = 1;

        // Get first song
        const firstSong = await Song.findById(data.songIds[0]);
        if (!firstSong) {
          socket.emit('error', { message: 'Song not found' });
          return;
        }

        await startRound(io, room, firstSong);
      } catch (error) {
        console.error('Error starting game:', error);
        socket.emit('error', { message: 'Failed to start game' });
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
            isTyping: data.isTyping,
          });
        }
      }
    });

    socket.on('next-round', async (data: { roomCode: string; nextSongId: string }) => {
      try {
        const room = rooms.get(data.roomCode);
        if (!room) return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player?.isHost) return;

        room.currentRound++;
        const nextSong = await Song.findById(data.nextSongId);
        if (nextSong) {
          await startRound(io, room, nextSong);
        }
      } catch (error) {
        console.error('Error starting next round:', error);
      }
    });

    socket.on('end-game', async (data: { roomCode: string }) => {
      try {
        const room = rooms.get(data.roomCode);
        if (!room) return;

        // Save session history for all players
        for (const player of room.players) {
          if (player.id.length > 24) continue; // Skip non-DB users

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
            score: p.score,
          })),
        });

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

      // Remove player from all rooms
      for (const [roomCode, room] of rooms.entries()) {
        const playerIndex = room.players.findIndex(p => p.socketId === socket.id);

        if (playerIndex !== -1) {
          const player = room.players[playerIndex];
          room.players.splice(playerIndex, 1);

          if (player.isHost && room.players.length > 0) {
            // Transfer host to another player
            room.players[0].isHost = true;
            room.hostId = room.players[0].id;
          }

          io.to(roomCode).emit('player-left', { playerId: player.id, room });

          if (room.players.length === 0) {
            rooms.delete(roomCode);
            gameStates.delete(roomCode);
            roomAnswers.delete(roomCode);
          }
        }
      }
    });
  });
}

async function startRound(io: Server, room: Room, song: any) {
  const gameState = gameStates.get(room.code);
  if (!gameState) return;

  // Reset player answered status
  room.players.forEach(p => {
    p.hasAnswered = false;
  });
  roomAnswers.set(room.code, []);

  if (room.gameMode === 'finish-lyrics') {
    await startFinishLyricsRound(io, room, song, gameState);
  } else if (room.gameMode === 'guess-song-easy') {
    await startGuessSongEasyRound(io, room, song, gameState);
  } else if (room.gameMode === 'guess-song-challenge') {
    await startGuessSongChallengeRound(io, room, song, gameState);
  }
}

async function startFinishLyricsRound(io: Server, room: Room, song: any, gameState: GameState) {
  const lyricSelection = selectRandomLyric(song.lyricLines);
  if (!lyricSelection) {
    io.to(room.code).emit('error', { message: 'Not enough lyrics for this song' });
    return;
  }

  const { targetLine, startTime } = lyricSelection;
  const stopTime = targetLine.time;

  gameState.phase = 'playing-audio';
  gameState.currentSong = {
    id: song._id.toString(),
    title: song.title,
    artist: song.artist,
    audioUrl: `/audio/${song.audioPath.split('/').pop()}`,
    startTime,
    stopTime,
    targetLyric: targetLine.text,
    targetLyricDisplay: toHangmanFormat(targetLine.text),
  };

  io.to(room.code).emit('round-started', {
    phase: 'playing-audio',
    audioUrl: gameState.currentSong.audioUrl,
    startTime,
    stopTime,
    round: room.currentRound,
  });

  // Wait for audio to finish, then show hangman
  const audioDuration = (stopTime - startTime) * 1000;
  setTimeout(() => {
    gameState.phase = 'answering';
    io.to(room.code).emit('show-hangman', {
      hangman: gameState.currentSong!.targetLyricDisplay,
      answerTime: 10000, // 10 seconds
    });

    // Auto-end answering phase after 10 seconds
    setTimeout(() => {
      endAnsweringPhase(io, room, gameState);
    }, 10000);
  }, audioDuration);
}

async function startGuessSongEasyRound(io: Server, room: Room, song: any, gameState: GameState) {
  const clipDuration = room.settings.clipDuration || 15;
  const randomStart = room.settings.randomStart !== false;

  const snippet = getRandomSnippet(clipDuration, song.duration, randomStart, song.lyricLines);

  gameState.phase = 'playing-audio';
  gameState.currentSong = {
    id: song._id.toString(),
    title: song.title,
    artist: song.artist,
    audioUrl: `/audio/${song.audioPath.split('/').pop()}`,
    startTime: snippet.startTime,
    stopTime: snippet.startTime + snippet.duration,
    targetLyricDisplay: `${toHangmanFormat(song.title)} - ${toHangmanFormat(song.artist)}`,
  };

  io.to(room.code).emit('round-started', {
    phase: 'playing-audio',
    audioUrl: gameState.currentSong.audioUrl,
    startTime: snippet.startTime,
    duration: snippet.duration,
    hangman: gameState.currentSong.targetLyricDisplay,
    round: room.currentRound,
  });

  // End after clip finishes + 1 second buffer
  setTimeout(() => {
    endAnsweringPhase(io, room, gameState);
  }, (snippet.duration + 1) * 1000);
}

async function startGuessSongChallengeRound(io: Server, room: Room, song: any, gameState: GameState) {
  const { startTime, clips } = getChallengeClips(song.duration, song.lyricLines);

  gameState.phase = 'playing-audio';
  gameState.clipPhase = 0;
  gameState.currentSong = {
    id: song._id.toString(),
    title: song.title,
    artist: song.artist,
    audioUrl: `/audio/${song.audioPath.split('/').pop()}`,
    startTime,
    targetLyricDisplay: `${toHangmanFormat(song.title)} - ${toHangmanFormat(song.artist)}`,
  };

  playNextClip(io, room, gameState, startTime, clips, 0);
}

function playNextClip(io: Server, room: Room, gameState: GameState, startTime: number, clips: number[], clipIndex: number) {
  if (clipIndex >= clips.length) {
    endAnsweringPhase(io, room, gameState);
    return;
  }

  const clipDuration = clips[clipIndex];
  gameState.clipPhase = clipIndex + 1;

  io.to(room.code).emit('play-clip', {
    audioUrl: gameState.currentSong!.audioUrl,
    startTime,
    duration: clipDuration,
    clipPhase: gameState.clipPhase,
    hangman: gameState.currentSong!.targetLyricDisplay,
  });

  // Wait for clip + 3 second break, then play next
  setTimeout(() => {
    playNextClip(io, room, gameState, startTime, clips, clipIndex + 1);
  }, (clipDuration + 3) * 1000);
}

function handleAnswer(io: Server, socket: Socket, data: { roomCode: string; answer: string; timestamp: number }) {
  const room = rooms.get(data.roomCode);
  const gameState = gameStates.get(data.roomCode);
  if (!room || !gameState) return;

  const player = room.players.find(p => p.socketId === socket.id);
  if (!player || player.hasAnswered) return;

  player.hasAnswered = true;

  const submission: AnswerSubmission = {
    playerId: player.id,
    answer: data.answer,
    timestamp: data.timestamp,
  };

  let answers = roomAnswers.get(data.roomCode) || [];
  answers.push(submission);
  roomAnswers.set(data.roomCode, answers);

  // Calculate score
  const score = calculateAnswerScore(room, gameState, submission);
  if (score > 0) {
    player.score += score;
  }

  socket.emit('answer-received', { score });
}

function calculateAnswerScore(room: Room, gameState: GameState, submission: AnswerSubmission): number {
  if (!gameState.currentSong) return 0;

  const answer = submission.answer.toLowerCase();

  if (room.gameMode === 'finish-lyrics') {
    const targetLyric = gameState.currentSong.targetLyric || '';
    if (isAnswerCorrect(answer, targetLyric)) {
      // Score based on time: 1000 at 0-2s, 200 at 10s
      return calculateTimeBasedScore(submission.timestamp, 10000, 1000, 200);
    }
  } else if (room.gameMode === 'guess-song-easy') {
    const title = gameState.currentSong.title;
    const artist = gameState.currentSong.artist;

    let score = 0;

    // Check title match
    if (isAnswerCorrect(answer, title)) {
      const clipDuration = room.settings.clipDuration || 15;
      score += calculateTimeBasedScore(submission.timestamp, clipDuration * 1000, 1000, 200);
    }

    // Check artist match (flat 200 bonus)
    if (isAnswerCorrect(answer, artist)) {
      score += 200;
    }

    return score;
  } else if (room.gameMode === 'guess-song-challenge') {
    const title = gameState.currentSong.title;
    const artist = gameState.currentSong.artist;
    const clipPhase = gameState.clipPhase || 1;

    let score = 0;

    // Title score based on which clip they answered in
    if (isAnswerCorrect(answer, title)) {
      // 1000 for clip 1, 200 for clip 4
      const scores = [1000, 733, 467, 200];
      score += scores[clipPhase - 1] || 200;
    }

    // Artist score based on clip phase
    if (isAnswerCorrect(answer, artist)) {
      // 200 for clip 1, 50 for clip 4
      const artistScores = [200, 150, 100, 50];
      score += artistScores[clipPhase - 1] || 50;
    }

    return score;
  }

  return 0;
}

function endAnsweringPhase(io: Server, room: Room, gameState: GameState) {
  gameState.phase = 'showing-results';

  const answers = roomAnswers.get(room.code) || [];

  // Show correct answer and scores
  io.to(room.code).emit('round-ended', {
    correctAnswer: {
      title: gameState.currentSong?.title,
      artist: gameState.currentSong?.artist,
      lyric: gameState.currentSong?.targetLyric,
    },
    playerScores: room.players.map(p => ({
      username: p.username,
      score: p.score,
      hasAnswered: p.hasAnswered,
    })),
  });

  // Clear answers for next round
  roomAnswers.delete(room.code);
}
