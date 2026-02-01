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

export interface RoomSettings {
  clipDuration?: number; // For guess-song-easy
  randomStart?: boolean; // For guess-song-easy
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

export interface Room {
  code: string;
  gameMode: GameMode;
  players: Player[];
  hostId: string;
  isActive: boolean;
  currentRound: number;
  currentSongId?: string;
  settings: RoomSettings;
  isPrivate?: boolean;
  passwordHash?: string;
  createdAt: Date;
  activePlayerIds?: string[]; // Player IDs who were present when game started
}

export interface GameState {
  phase: 'waiting' | 'countdown' | 'playing-audio' | 'answering' | 'showing-results' | 'game-over';
  paused?: boolean;
  pausedAt?: number;
  pausePhase?: GameState['phase'];
  pauseRemainingMs?: number;
  pauseClipIndex?: number;
  pauseElapsedMs?: number;
  resultsStartedAt?: number;
  challengeClips?: number[];
  roundStartedAt?: number;
  countdownEndsAt?: number;
  answerStartedAt?: number;
  clipStartedAt?: number;
  clipDurationSec?: number;
  roundStartScores?: Record<string, number>;
  roundAnswerStatus?: Record<
    string,
    {
      titleAnswered: boolean;
      artistAnswered: boolean;
      artistMatches?: string[];
      artistTotal?: number;
      lyricAnswered: boolean;
      titleScore: number;
      artistScore: number;
      lyricScore: number;
      locked: boolean;
    }
  >;
  currentSong?: {
    id: string;
    title: string;
    artist: string;
    artists?: string[];
    audioUrl: string;
    albumArtUrl?: string;
    startTime: number;
    stopTime?: number;
    lyricsSource?: string;
    targetLyric?: string;
    targetLyricDisplay?: string; // Hangman format
    clipLyricLines?: Array<{
      time: number;
      text: string;
    }>;
  };
  roundScores?: Array<{
    playerId: string;
    username: string;
    score: number;
    answer?: string;
  }>;
  clipPhase?: number; // For guess-song-challenge (1, 2, 3, 4)
}

export interface AnswerSubmission {
  playerId: string;
  answer: string;
  timestamp: number;
  wasCorrect?: boolean;
  matchedTitle?: boolean;
  matchedArtist?: boolean;
  matchedLyric?: boolean;
  scoreAwarded?: number;
}
