import { io, Socket } from 'socket.io-client';
import { useStore } from '@/store/useStore';
import { Room, Player, RoundEndData, GameMode, MyAnswerStatus, ChatMessage, AnswerFeedback, GameState } from '@/types/game';
import { getRuntimeConfig } from '@/lib/runtimeConfig';

const runtime = getRuntimeConfig();
const SOCKET_URL =
  typeof window !== 'undefined'
    ? runtime.NEXT_PUBLIC_API_URL || window.location.origin
    : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function buildEmptyAnswerStatus(mode?: GameMode): MyAnswerStatus {
  const base: MyAnswerStatus = {
    title: { answered: false, score: 0 },
    artist: { answered: false, score: 0 },
    lyric: { answered: false, score: 0 },
    locked: false,
    isComplete: false,
  };

  if (mode === 'finish-lyrics') {
    return base;
  }

  return base;
}

function attachListeners(socket: Socket) {
  const { setRoom, setCurrentPlayer, setGameState, setIsJoiningRoom, setIsLeavingRoom } = useStore.getState();

  const syncCurrentPlayer = (room: Room, playerId?: string) => {
    const state = useStore.getState();
    const current = state.currentPlayer;
    const idToMatch = playerId || current?.id;
    if (!idToMatch) return;
    const updated = room.players.find(p => p.id === idToMatch);
    if (updated) {
      state.setCurrentPlayer(updated);
    }
  };

  socket.off('connect');
  socket.on('connect', () => {
    console.log('✅ Connected to server');
  });

  // Handle automatic reconnection - rejoin room if we were in one
  socket.off('reconnect');
  socket.on('reconnect', (attemptNumber) => {
    console.log(`🔄 Reconnected to server after ${attemptNumber} attempts`);
    const state = useStore.getState();
    const room = state.room;
    const user = state.user;

    // If we were in a room before disconnect, rejoin it
    if (room && user) {
      console.log(`🔄 Automatically rejoining room ${room.code}`);
      socket.emit('join-room', {
        roomCode: room.code,
        username: user.username,
        displayName: user.displayName || user.username,
        userId: user.id,
      });
    }
  });

  socket.off('disconnect');
  socket.on('disconnect', (reason) => {
    console.log('❌ Disconnected from server:', reason);
  });

  socket.off('room-created');
  socket.on('room-created', ({ room, player }: { room: Room; player: Player }) => {
    console.log('Room created:', room.code);
    setIsJoiningRoom(false);
    setIsLeavingRoom(false);
    setRoom(room);
    setCurrentPlayer(player);
    setGameState({
      phase: 'waiting',
      totalSongs: 0,
      previousSongs: [],
      playerScores: undefined,
      finalScores: undefined,
      lyricAnswers: undefined,
      correctAnswer: undefined,
      chatMessages: [],
      myAnswerStatus: buildEmptyAnswerStatus(room.gameMode),
      lastAnswerFeedback: undefined,
      inputFlash: null,
      queueStatus: undefined,
      loadingMessage: undefined,
      playlistPreparing: false,
      playlistReady: false,
      errorMessage: undefined,
    });
  });

  socket.off('room-joined');
  socket.on('room-joined', ({ room, player }: { room: Room; player: Player }) => {
    console.log('Joined room:', room.code);
    setIsJoiningRoom(false);
    setIsLeavingRoom(false);
    setRoom(room);
    setCurrentPlayer(player);
    setGameState({
      phase: room.isActive ? 'loading' : 'waiting',
      totalSongs: room.isActive ? useStore.getState().gameState.totalSongs : 0,
      previousSongs: room.isActive ? useStore.getState().gameState.previousSongs : [],
      playerScores: undefined,
      finalScores: undefined,
      lyricAnswers: undefined,
      correctAnswer: undefined,
      chatMessages: [],
      myAnswerStatus: buildEmptyAnswerStatus(room.gameMode),
      lastAnswerFeedback: undefined,
      inputFlash: null,
      queueStatus: undefined,
      loadingMessage: undefined,
      playlistPreparing: false,
      playlistReady: false,
      errorMessage: undefined,
    });
    if (player.isSpectator) {
      setGameState({
        chatMessages: [],
        lastAnswerFeedback: undefined,
        inputFlash: null,
      });
    }
  });

  socket.off('player-joined');
  socket.on('player-joined', ({ player, room }: { player: Player; room: Room }) => {
    console.log('Player joined:', player.displayName || player.username);
    setRoom(room);
    syncCurrentPlayer(room);
  });

  socket.off('player-left');
  socket.on('player-left', ({ playerId, room }: { playerId: string; room: Room }) => {
    console.log('Player left:', playerId);
    setRoom(room);
    syncCurrentPlayer(room);
  });

  socket.off('settings-updated');
  socket.on('settings-updated', (settings: any) => {
    console.log('Settings updated:', settings);
  });

  socket.off('game-starting');
  socket.on('game-starting', (data: { totalSongs: number }) => {
    console.log('Game starting with', data.totalSongs, 'songs');
    const mode = useStore.getState().room?.gameMode;
    const state = useStore.getState();
    if (state.room) {
      state.setRoom({
        ...state.room,
        isActive: true,
        currentRound: Math.max(1, state.room.currentRound || 1),
      });
    }
    setGameState({
      phase: 'waiting',
      totalSongs: data.totalSongs,
      errorMessage: undefined,
      chatMessages: [],
      myAnswerStatus: buildEmptyAnswerStatus(mode),
      lastAnswerFeedback: undefined,
      inputFlash: null,
      playlistPreparing: false,
      playlistReady: false,
      previousSongs: [],
    });
  });

  socket.off('scores-reset');
  socket.on('scores-reset', ({ room: updatedRoom }: { room: Room }) => {
    console.log('Scores reset for new game');
    setRoom(updatedRoom);
    syncCurrentPlayer(updatedRoom);
  });

  socket.off('playlist-preparing');
  socket.on('playlist-preparing', (data: { message?: string; queueStatus?: any; totalSongs?: number }) => {
    setGameState({
      loadingMessage: data.message,
      queueStatus: data.queueStatus,
      totalSongs: data.totalSongs ?? useStore.getState().gameState.totalSongs,
      playlistPreparing: true,
      playlistReady: false,
    });
  });

  socket.off('playlist-ready');
  socket.on('playlist-ready', (data: { message?: string; queueStatus?: any }) => {
    setGameState({
      loadingMessage: data.message,
      queueStatus: data.queueStatus,
      playlistPreparing: false,
      playlistReady: true,
    });
  });

  socket.off('loading-song');
  socket.on('loading-song', (data: { message: string; queueStatus: any }) => {
    console.log('Loading song:', data.message);
    const mode = useStore.getState().room?.gameMode;
    setGameState({
      phase: 'loading',
      loadingMessage: data.message,
      queueStatus: data.queueStatus,
      loadingStartAt: Date.now(),
      loadingTimeoutMs: 60000,
      errorMessage: undefined,
      chatMessages: [],
      myAnswerStatus: buildEmptyAnswerStatus(mode),
      lastAnswerFeedback: undefined,
      inputFlash: null,
      playlistPreparing: false,
      playlistReady: false,
    });
  });

  socket.off('round-started');
  socket.on('round-started', (data: any) => {
    console.log('Round started:', data);
    if (data.lyricsSource) {
      console.log(`🎵 Lyrics source: ${data.lyricsSource}`);
    }
    const mode = useStore.getState().room?.gameMode;
    const state = useStore.getState();
    if (state.room) {
      state.setRoom({
        ...state.room,
        players: state.room.players.map(player => ({
          ...player,
          hasAnswered: player.isSpectator ? true : false,
          isTyping: false,
        })),
      });
    }
    setGameState({
      phase: 'playing-audio',
      paused: false,
      audioUrl: data.audioUrl,
      startTime: data.startTime,
      stopTime: data.stopTime,
      duration: data.duration,
      hangman: data.hangman,
      round: data.round,
      clipLyricLines: data.clipLyricLines,
      lyricsSource: data.lyricsSource,
      roundStartedAt: data.startedAt,
      errorMessage: undefined,
      chatMessages: [],
      myAnswerStatus: buildEmptyAnswerStatus(mode),
      lastAnswerFeedback: undefined,
      inputFlash: null,
      playlistPreparing: false,
      playerAnswerStatus: {},
    });
  });

  socket.off('round-countdown');
  socket.on('round-countdown', (data: { countdownMs: number; endsAt: number; round: number }) => {
    console.log('Round countdown:', data.countdownMs);
    const mode = useStore.getState().room?.gameMode;
    const state = useStore.getState();
    if (state.room) {
      state.setRoom({
        ...state.room,
        players: state.room.players.map(player => ({
          ...player,
          hasAnswered: player.isSpectator ? true : false,
          isTyping: false,
        })),
      });
    }
    setGameState({
      phase: 'countdown',
      paused: false,
      countdownMs: data.countdownMs,
      countdownEndsAt: data.endsAt,
      stopTime: undefined,
      duration: undefined,
      round: data.round,
      errorMessage: undefined,
      chatMessages: useStore.getState().gameState.chatMessages || [],
      myAnswerStatus: buildEmptyAnswerStatus(mode),
      lastAnswerFeedback: undefined,
      inputFlash: null,
      playerAnswerStatus: {},
    });
  });

  socket.off('show-hangman');
  socket.on('show-hangman', (data: { hangman: string; answerTime: number; targetLyric?: string }) => {
    console.log('Show hangman:', data.hangman);
    const mode = useStore.getState().room?.gameMode;
    setGameState({
      phase: 'answering',
      paused: false,
      hangman: data.hangman,
      targetLyric: data.targetLyric,
      answerTime: data.answerTime,
      errorMessage: undefined,
      chatMessages: useStore.getState().gameState.chatMessages || [],
      myAnswerStatus: useStore.getState().gameState.myAnswerStatus || buildEmptyAnswerStatus(mode),
      lastAnswerFeedback: undefined,
      inputFlash: null,
      playerAnswerStatus: useStore.getState().gameState.playerAnswerStatus || {},
    });
  });

  socket.off('play-clip');
  socket.on('play-clip', (data: any) => {
    console.log('Play clip:', data.clipPhase);
    if (data.lyricsSource) {
      console.log(`🎵 Lyrics source: ${data.lyricsSource}`);
    }
    const state = useStore.getState();
    const shouldResetStatus = data.clipPhase === 1;
    setGameState({
      phase: 'playing-audio',
      paused: false,
      audioUrl: data.audioUrl,
      startTime: data.startTime,
      stopTime: undefined,
      duration: data.duration,
      hangman: data.hangman,
      clipPhase: data.clipPhase,
      lyricsSource: data.lyricsSource,
      roundStartedAt: data.startedAt,
      errorMessage: undefined,
      chatMessages: state.gameState.chatMessages || [],
      myAnswerStatus: shouldResetStatus ? buildEmptyAnswerStatus(state.room?.gameMode) : state.gameState.myAnswerStatus || buildEmptyAnswerStatus(state.room?.gameMode),
      playlistPreparing: false,
      playerAnswerStatus: shouldResetStatus ? {} : state.gameState.playerAnswerStatus || {},
    });
  });

  socket.off('sync-state');
  socket.on('sync-state', (data: any) => {
    const mode = useStore.getState().room?.gameMode;
    const state = useStore.getState();
    if (state.room) {
      state.setRoom({
        ...state.room,
        isActive: true,
      });
    }
    setGameState({
      phase: data.phase,
      paused: data.paused ?? false,
      pausePhase: data.pausePhase,
      pauseRemainingMs: data.pauseRemainingMs,
      audioUrl: data.audioUrl,
      startTime: data.startTime,
      stopTime: data.stopTime,
      duration: data.duration,
      hangman: data.hangman,
      round: data.round,
      clipLyricLines: data.clipLyricLines,
      clipPhase: data.clipPhase,
      answerTime: data.answerTime,
      roundStartedAt: data.startedAt,
      countdownEndsAt: data.countdownEndsAt,
      myAnswerStatus: buildEmptyAnswerStatus(mode),
      inputFlash: null,
      playerAnswerStatus: {},
    });
  });

  socket.off('chat-message');
  socket.on('chat-message', (message: ChatMessage) => {
    const state = useStore.getState();
    const messages = state.gameState.chatMessages || [];
    setGameState({
      chatMessages: [...messages, message],
    });
  });

  socket.off('round-ended');
  socket.on('round-ended', (data: RoundEndData) => {
    console.log('Round ended:', data);
    const state = useStore.getState();
    const room = state.room;
    if (room && data.playerScores?.length) {
      const scoreMap = new Map(data.playerScores.map(p => [p.username, p.score]));
      state.setRoom({
        ...room,
        players: room.players.map(player => ({
          ...player,
          score: scoreMap.get(player.username) ?? player.score,
          hasAnswered: data.playerScores.find(p => p.username === player.username)?.hasAnswered ?? player.hasAnswered,
        })),
      });
    }

    const currentPlayer = useStore.getState().currentPlayer;
    const myRoundScore = currentPlayer
      ? data.playerScores?.find(p => p.username === currentPlayer.username)?.roundScore ?? 0
      : 0;
    const existingHistory = useStore.getState().gameState.previousSongs || [];
    const nextEntry = {
      title: data.correctAnswer?.title,
      artist: data.correctAnswer?.artist,
      albumArtUrl: data.correctAnswer?.albumArtUrl,
      roundScore: myRoundScore,
      skipped: false,
      timestamp: Date.now(),
    };

    setGameState({
      phase: 'showing-results',
      correctAnswer: data.correctAnswer,
      playerScores: data.playerScores,
      lyricAnswers: data.lyricAnswers,
      inputFlash: null,
      previousSongs: [nextEntry, ...existingHistory].slice(0, 20),
    });
  });

  socket.off('game-paused');
  socket.on('game-paused', (data: {
    paused: boolean;
    phase?: GameState['phase'];
    remainingMs?: number;
    resumeStartedAt?: number;
    resumeClipStartedAt?: number;
    resumeAnswerStartedAt?: number;
    resumeResultsStartedAt?: number;
  }) => {
    const state = useStore.getState();
    setGameState({
      paused: data.paused,
      pausePhase: data.phase,
      pauseRemainingMs: data.remainingMs,
      answerTime: data.phase === 'answering' && typeof data.remainingMs === 'number'
        ? data.remainingMs
        : state.gameState.answerTime,
      roundStartedAt: typeof data.resumeStartedAt === 'number'
        ? data.resumeStartedAt
        : state.gameState.roundStartedAt,
      chatMessages: state.gameState.chatMessages || [],
    });
  });

  socket.off('song-skipped');
  socket.on('song-skipped', (data: { title?: string; artist?: string; albumArtUrl?: string; reason?: string; skippedCount?: number }) => {
    const existingHistory = useStore.getState().gameState.previousSongs || [];
    const entry = {
      title: data.title,
      artist: data.artist,
      albumArtUrl: data.albumArtUrl,
      skipped: true,
      reason: data.reason,
      skippedCount: data.skippedCount,
      roundScore: 0,
      timestamp: Date.now(),
    };
    setGameState({
      previousSongs: [entry, ...existingHistory].slice(0, 20),
    });
  });

  socket.off('player-answer-status');
  socket.on('player-answer-status', (data: { playerId: string; titleAnswered?: boolean; artistMatchedCount?: number; artistTotal?: number; lyricAnswered?: boolean }) => {
    const state = useStore.getState();
    const existing = state.gameState.playerAnswerStatus || {};
    setGameState({
      playerAnswerStatus: {
        ...existing,
        [data.playerId]: {
          ...(existing[data.playerId] || {}),
          titleAnswered: data.titleAnswered ?? existing[data.playerId]?.titleAnswered,
          artistMatchedCount: data.artistMatchedCount ?? existing[data.playerId]?.artistMatchedCount,
          artistTotal: data.artistTotal ?? existing[data.playerId]?.artistTotal,
          lyricAnswered: data.lyricAnswered ?? existing[data.playerId]?.lyricAnswered,
        },
      },
    });
  });

  socket.off('game-ended');
  socket.on('game-ended', (data: { finalScores: any[] }) => {
    console.log('Game ended:', data);
    const state = useStore.getState();
    const room = state.room;
    if (room && data.finalScores?.length) {
      const scoreMap = new Map(data.finalScores.map(p => [p.username, p.score]));
      state.setRoom({
        ...room,
        isActive: false,
        players: room.players.map(player => ({
          ...player,
          score: scoreMap.get(player.username) ?? player.score,
        })),
      });
    } else if (room) {
      state.setRoom({
        ...room,
        isActive: false,
      });
    }
    setGameState({
      phase: 'game-over',
      finalScores: data.finalScores,
      paused: false,
      playlistPreparing: false,
      playlistReady: false,
      loadingMessage: undefined,
      queueStatus: undefined,
    });
  });

  socket.off('game-stopped');
  socket.on('game-stopped', ({ room }: { room: Room }) => {
    console.log('Game stopped');
    setRoom(room);
    const mode = room.gameMode;
    const finalScores = room.players.map(player => ({
      username: player.username,
      displayName: player.displayName || player.username,
      score: player.score,
    }));
    setGameState({
      phase: 'game-over',
      paused: false,
      audioUrl: undefined,
      startTime: undefined,
      stopTime: undefined,
      duration: undefined,
      hangman: undefined,
      answerTime: undefined,
      clipPhase: undefined,
      clipLyricLines: undefined,
      loadingStartAt: undefined,
      loadingTimeoutMs: undefined,
      errorMessage: undefined,
      chatMessages: [],
      myAnswerStatus: buildEmptyAnswerStatus(mode),
      lastAnswerFeedback: undefined,
      inputFlash: null,
      playlistPreparing: false,
      playlistReady: false,
      loadingMessage: undefined,
      queueStatus: undefined,
      finalScores,
    });
  });

  socket.off('answer-feedback');
  socket.on('answer-feedback', (feedback: AnswerFeedback) => {
    const state = useStore.getState();
    const currentPlayer = state.currentPlayer;

    if (currentPlayer && typeof feedback.totalScore === 'number') {
      state.setCurrentPlayer({
        ...currentPlayer,
        score: feedback.totalScore,
        hasAnswered: feedback.status.isComplete || feedback.status.locked,
      });
    }

    setGameState({
      myAnswerStatus: feedback.status,
      lastAnswerFeedback: feedback,
      inputFlash: feedback.correct ? 'green' : 'red',
    });
  });

  socket.off('player-typing');
  socket.on('player-typing', ({ playerId, username, displayName, isTyping }: any) => {
    console.log(`${displayName || username} is ${isTyping ? 'typing' : 'not typing'}`);
  });

  socket.off('error');
  socket.on('error', ({ message }: { message: string }) => {
    console.error('Socket error:', message);
    setIsJoiningRoom(false);
    if (message === 'Room not found') {
      setGameState({ phase: 'waiting', errorMessage: undefined });
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
      return;
    }
    setGameState({
      phase: 'loading',
      loadingMessage: 'Something went wrong while preparing the next song.',
      errorMessage: message,
      loadingStartAt: Date.now(),
      loadingTimeoutMs: 60000,
    });
  });

  socket.off('toast');
  socket.on('toast', (data: { id?: string; message: string; variant?: 'info' | 'warning' | 'error' }) => {
    setGameState({
      toast: {
        id: data.id || `${Date.now()}`,
        message: data.message,
        variant: data.variant || 'info',
      },
    });
  });
}

function getOrCreateSocket(): Socket {
  const { socket, setSocket } = useStore.getState();

  if (socket) {
    return socket;
  }

  const socketInstance = io(SOCKET_URL, {
    autoConnect: false,
    withCredentials: true,
  });

  attachListeners(socketInstance);
  setSocket(socketInstance);
  return socketInstance;
}

function emitWhenConnected(socket: Socket, event: string, payload: unknown) {
  if (socket.connected) {
    socket.emit(event, payload);
    return;
  }

  socket.once('connect', () => {
    socket.emit(event, payload);
  });

  socket.connect();
}

export function connectSocket() {
  const socket = getOrCreateSocket();
  if (!socket.connected) {
    socket.connect();
  }
  return socket;
}

export function disconnectSocket() {
  const { socket, setSocket, setIsJoiningRoom } = useStore.getState();
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    setSocket(null);
  }
  setIsJoiningRoom(false);
}

export function useSocket() {
  return useStore(state => state.socket);
}

export function createRoom(
  socket: Socket | null,
  gameMode: GameMode,
  username: string,
  displayName?: string,
  userId?: string,
  options?: { isPrivate?: boolean; password?: string; settings?: any }
) {
  useStore.getState().setIsJoiningRoom(true);
  const activeSocket = socket || getOrCreateSocket();
  emitWhenConnected(activeSocket, 'create-room', {
    gameMode,
    username,
    displayName,
    userId,
    isPrivate: options?.isPrivate === true,
    password: options?.password,
    settings: options?.settings,
  });
}

export function joinRoom(
  socket: Socket | null,
  roomCode: string,
  username: string,
  displayName?: string,
  userId?: string,
  password?: string
) {
  useStore.getState().setIsJoiningRoom(true);
  const activeSocket = socket || getOrCreateSocket();
  emitWhenConnected(activeSocket, 'join-room', { roomCode, username, displayName, userId, password });
}

export function getRooms(socket: Socket | null) {
  const activeSocket = socket || getOrCreateSocket();
  emitWhenConnected(activeSocket, 'get-rooms', {});
}

export function updateSettings(socket: Socket | null, roomCode: string, settings: any) {
  const activeSocket = socket || getOrCreateSocket();
  emitWhenConnected(activeSocket, 'update-settings', { roomCode, settings });
}

export function startGame(socket: Socket | null, roomCode: string, playlist: Array<{ url?: string; songName?: string; artist?: string }>) {
  const activeSocket = socket || getOrCreateSocket();
  emitWhenConnected(activeSocket, 'start-game', { roomCode, playlist });
}

export function preparePlaylist(
  socket: Socket | null,
  roomCode: string,
  playlist: Array<{ url?: string; songName?: string; artist?: string }>
) {
  const activeSocket = socket || getOrCreateSocket();
  emitWhenConnected(activeSocket, 'prepare-playlist', { roomCode, playlist });
}

export function submitAnswer(socket: Socket | null, roomCode: string, answer: string) {
  const activeSocket = socket || getOrCreateSocket();
  const timestamp = Date.now();
  emitWhenConnected(activeSocket, 'submit-answer', { roomCode, answer, timestamp });
}

export function sendTypingStatus(socket: Socket | null, roomCode: string, isTyping: boolean) {
  const activeSocket = socket || getOrCreateSocket();
  emitWhenConnected(activeSocket, 'typing-status', { roomCode, isTyping });
}

export function nextRound(socket: Socket | null, roomCode: string, nextSongId: string) {
  const activeSocket = socket || getOrCreateSocket();
  emitWhenConnected(activeSocket, 'next-round', { roomCode, nextSongId });
}

export function leaveRoom(socket: Socket | null, roomCode: string) {
  const { user, setIsLeavingRoom, setIsJoiningRoom } = useStore.getState();
  setIsLeavingRoom(true);
  setIsJoiningRoom(false);
  const activeSocket = socket || getOrCreateSocket();
  emitWhenConnected(activeSocket, 'leave-room', { roomCode, userId: user?.id });
}

export function endGame(socket: Socket | null, roomCode: string) {
  const activeSocket = socket || getOrCreateSocket();
  emitWhenConnected(activeSocket, 'end-game', { roomCode });
}

export function stopGame(socket: Socket | null, roomCode: string) {
  const activeSocket = socket || getOrCreateSocket();
  emitWhenConnected(activeSocket, 'stop-game', { roomCode });
}

export function skipRound(socket: Socket | null, roomCode: string) {
  const activeSocket = socket || getOrCreateSocket();
  emitWhenConnected(activeSocket, 'skip-round', { roomCode });
}

export function pauseGame(socket: Socket | null, roomCode: string) {
  const activeSocket = socket || getOrCreateSocket();
  emitWhenConnected(activeSocket, 'pause-game', { roomCode });
}

export function resumeGame(socket: Socket | null, roomCode: string) {
  const activeSocket = socket || getOrCreateSocket();
  emitWhenConnected(activeSocket, 'resume-game', { roomCode });
}
