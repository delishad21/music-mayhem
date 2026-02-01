export type GameMode = 'finish-lyrics' | 'guess-song-easy' | 'guess-song-challenge';

export interface Player {
  id: string;
  socketId: string;
  username: string;
  displayName?: string;
  score: number;
  isHost: boolean;
  joinedAt: number;
  isTyping?: boolean;
  hasAnswered?: boolean;
  isSpectator?: boolean;
}

export interface Room {
  code: string;
  gameMode: GameMode;
  players: Player[];
  hostId: string;
  isActive: boolean;
  currentRound: number;
  settings: RoomSettings;
  isPrivate?: boolean;
}

export interface RoomSettings {
  clipDuration?: number;
  randomStart?: boolean;
  isPrivate?: boolean;
  allowJoinInProgress?: boolean;
  allowChineseVariants?: boolean;
  shufflePlaylist?: boolean;
  convertChineseLyrics?: 'none' | 't2s' | 's2t';
  lyricAnswerTimeMs?: number;
  roundCountdownMs?: number;
  resultsDelayMs?: number;
  maxRounds?: number;
  revealNumbers?: boolean;
  revealKorean?: boolean;
  revealJapanese?: boolean;
  revealChinese?: boolean;
  revealVietnamese?: boolean;
  revealSpanish?: boolean;
}

export interface RoomListItem {
  code: string;
  gameMode: GameMode;
  playerCount: number;
  hostName?: string;
}

export interface GameState {
  phase: 'waiting' | 'loading' | 'countdown' | 'playing-audio' | 'answering' | 'showing-results' | 'game-over';
  paused?: boolean;
  pausePhase?: GameState['phase'];
  pauseRemainingMs?: number;
  audioUrl?: string;
  startTime?: number;
  stopTime?: number;
  duration?: number;
  hangman?: string;
  answerTime?: number;
  clipPhase?: number;
  clipLyricLines?: Array<{
    time: number;
    text: string;
  }>;
  lyricsSource?: string;
  targetLyric?: string;
  loadingStartAt?: number;
  loadingTimeoutMs?: number;
  errorMessage?: string;
  correctAnswer?: {
    title?: string;
    artist?: string;
    lyric?: string;
    albumArtUrl?: string;
  };
  playerScores?: PlayerScore[];
  finalScores?: PlayerScore[];
  lyricAnswers?: Array<{
    username: string;
    displayName?: string;
    answer: string;
    score: number;
  }>;
  chatMessages?: ChatMessage[];
  myAnswerStatus?: MyAnswerStatus;
  lastAnswerFeedback?: AnswerFeedback;
  inputFlash?: 'red' | 'green' | null;
  playlistPreparing?: boolean;
  playlistReady?: boolean;
  round?: number;
  totalSongs?: number;
  loadingMessage?: string;
  roundStartedAt?: number;
  countdownEndsAt?: number;
  countdownMs?: number;
  queueStatus?: {
    total: number;
    current: number;
    ready: number;
    preparing?: number;
    downloading: number;
    failed: number;
    nextProgress?: number;
    nextReady?: boolean;
    nextIndex?: number;
    hasNext: boolean;
  };
  toast?: {
    id: string;
    message: string;
    variant?: 'info' | 'warning' | 'error';
  };
  playerAnswerStatus?: Record<
    string,
    {
      titleAnswered?: boolean;
      artistMatchedCount?: number;
      artistTotal?: number;
      lyricAnswered?: boolean;
    }
  >;
  previousSongs?: Array<{
    title?: string;
    artist?: string;
    albumArtUrl?: string;
    roundScore?: number;
    skipped?: boolean;
    reason?: string;
    skippedCount?: number;
    timestamp?: number;
  }>;
}

export interface PlayerScore {
  username: string;
  displayName?: string;
  score: number;
  hasAnswered?: boolean;
  roundScore?: number;
  answeredTitle?: boolean;
  answeredArtist?: boolean;
  artistMatchedCount?: number;
  artistTotal?: number;
  artistMatches?: string[];
  artistMisses?: string[];
  answeredLyric?: boolean;
}

export interface RoundEndData {
  correctAnswer: {
    title?: string;
    artist?: string;
    lyric?: string;
    albumArtUrl?: string;
  };
  playerScores: PlayerScore[];
  lyricAnswers?: Array<{
    username: string;
    displayName?: string;
    answer: string;
    score: number;
  }>;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  username: string;
  displayName?: string;
  text: string;
  kind: 'wrong-answer';
  createdAt: number;
}

export interface MyAnswerFieldStatus {
  answered: boolean;
  score: number;
  correctAnswer?: string;
  matchedCount?: number;
  total?: number;
}

export interface MyAnswerStatus {
  title: MyAnswerFieldStatus;
  artist: MyAnswerFieldStatus;
  lyric: MyAnswerFieldStatus;
  locked: boolean;
  isComplete: boolean;
}

export interface AnswerFeedback {
  correct: boolean;
  field: 'title' | 'artist' | 'lyric' | 'both' | 'none';
  scoreAwarded: number;
  totalScore: number;
  status: MyAnswerStatus;
  message?: string;
}

export interface User {
  id: string;
  username: string;
  displayName?: string;
  token: string;
}

export interface SessionHistoryItem {
  gameMode: string;
  score: number;
  date: string;
  roomCode: string;
}
