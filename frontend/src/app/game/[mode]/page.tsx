'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useStore } from '@/store/useStore';
import {
  useSocket,
  createRoom,
  joinRoom,
  submitAnswer,
  sendTypingStatus,
  leaveRoom,
  connectSocket,
  disconnectSocket,
  startGame,
  stopGame,
  skipRound,
  preparePlaylist,
  pauseGame,
  resumeGame,
} from '@/hooks/useSocket';
import { useRoomLifecycle } from '@/hooks/game/useRoomLifecycle';
import { useGameSettingsSync } from '@/hooks/game/useGameSettingsSync';
import { useVolumePreference } from '@/hooks/game/useVolumePreference';
import { useAudioPlayback } from '@/hooks/game/useAudioPlayback';
import { useGameTimers } from '@/hooks/game/useGameTimers';
import { useTypingStatus } from '@/hooks/game/useTypingStatus';
import { useFinishLyricsAutoSubmit } from '@/hooks/game/useFinishLyricsAutoSubmit';
import { usePlaylistManager } from '@/hooks/game/usePlaylistManager';
import { useRoomSettings } from '@/hooks/game/useRoomSettings';
import ThemeToggle from '@/components/ThemeToggle';
import GameHeader from '@/components/game/GameHeader';
import PlayersPanel from '@/components/game/PlayersPanel';
import HowToPlayCard from '@/components/game/HowToPlayCard';
import WaitingPanel from '@/components/game/WaitingPanel';
import LoadingPanel from '@/components/game/LoadingPanel';
import CountdownPanel from '@/components/game/CountdownPanel';
import PlayingAudioPanel from '@/components/game/PlayingAudioPanel';
import AnswerPhasePanel from '@/components/game/AnswerPhasePanel';
import ResultsPanel from '@/components/game/ResultsPanel';
import GameOverPanel from '@/components/game/GameOverPanel';
import ChatPanel from '@/components/game/ChatPanel';
import HostSetupPanel from '@/components/game/HostSetupPanel';
import PreviousSongsCard from '@/components/game/PreviousSongsCard';
import { GameMode } from '@/types/game';
import { Headphones, MicrophoneStage, MusicNote, Pause, Play, SignOut, SkipForward, SpeakerHigh, Square, Trophy } from 'phosphor-react';

export default function GamePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const socket = useSocket();
  const {
    user,
    authStatus,
    room,
    currentPlayer,
    isJoiningRoom,
    isLeavingRoom,
    gameState,
    setGameState,
    setRoom,
    setCurrentPlayer,
    setIsJoiningRoom,
    setIsLeavingRoom,
    resetRoomState,
  } = useStore();

  const [answer, setAnswer] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [countdownLeft, setCountdownLeft] = useState(0);
  const [resultsFade, setResultsFade] = useState(1);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [isStoppingGame, setIsStoppingGame] = useState(false);
  const [isSkippingRound, setIsSkippingRound] = useState(false);
  const [currentClipIndex, setCurrentClipIndex] = useState<number>(0);
  const [audioTimeLeft, setAudioTimeLeft] = useState(0);
  const [audioTotal, setAudioTotal] = useState(0);
  const [audioElapsed, setAudioElapsed] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingSecondsLeft, setLoadingSecondsLeft] = useState(60);
  const [roundCountdownSec, setRoundCountdownSec] = useState(3);
  const [resultsDelaySec, setResultsDelaySec] = useState(7);
  const [guessClipDurationSec, setGuessClipDurationSec] = useState(15);
  const [lyricAnswerTimeSec, setLyricAnswerTimeSec] = useState(20);
  const [maxRounds, setMaxRounds] = useState(0);
  const [allowJoinInProgress, setAllowJoinInProgress] = useState(true);
  const [allowChineseVariants, setAllowChineseVariants] = useState(true);
  const [shufflePlaylist, setShufflePlaylist] = useState(true);
  const [convertChineseLyrics, setConvertChineseLyrics] = useState<'none' | 't2s' | 's2t'>('none');
  const [revealNumbers, setRevealNumbers] = useState(false);
  const [revealKorean, setRevealKorean] = useState(true);
  const [revealJapanese, setRevealJapanese] = useState(true);
  const [revealChinese, setRevealChinese] = useState(false);
  const [revealVietnamese, setRevealVietnamese] = useState(true);
  const [revealSpanish, setRevealSpanish] = useState(true);
  const [volume, setVolume] = useState(0.7);
  const [audioNeedsGesture, setAudioNeedsGesture] = useState(false);
  const answerInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const audioElementRef = useRef<HTMLAudioElement>(null);

  const mode = params.mode as GameMode;
  const roomCodeParam = typeof params.roomCode === 'string' ? params.roomCode.toUpperCase() : undefined;
  const shouldCreateRoom = searchParams.get('create') === '1';
  const isPrivate = searchParams.get('private') === '1';
  const roomPassword = searchParams.get('password') || undefined;
  const isGuessMode = mode === 'guess-song-easy' || mode === 'guess-song-challenge';
  const showChat = mode !== 'finish-lyrics';
  const isAnswerPhase =
    gameState.phase === 'answering' || (gameState.phase === 'playing-audio' && isGuessMode);
  const isHost = currentPlayer?.isHost === true;
  const isSpectator = currentPlayer?.isSpectator === true;
  const myAnswerStatus = gameState.myAnswerStatus;
  const chatMessages = gameState.chatMessages || [];
  const firstSongReady = gameState.queueStatus?.nextReady === true;
  const queueLoadingCount =
    (gameState.queueStatus?.preparing ?? 0) + (gameState.queueStatus?.downloading ?? 0);
  const nextSongProgress = Math.max(
    0,
    Math.min(1, Number(gameState.queueStatus?.nextProgress ?? (firstSongReady ? 1 : 0)))
  );
  const totalRounds = gameState.totalSongs ?? gameState.queueStatus?.total;
  const roundLabel =
    typeof gameState.round === 'number'
      ? `Round ${gameState.round}${typeof totalRounds === 'number' ? ` / ${totalRounds}` : ''}`
      : undefined;
  const hasCompletedRound =
    mode === 'finish-lyrics'
      ? Boolean(myAnswerStatus?.lyric.answered || myAnswerStatus?.locked)
      : Boolean(myAnswerStatus?.title.answered && myAnswerStatus?.artist.answered);
  const inputDisabled =
    (gameState.phase === 'answering' && gameState.answerTime ? timeLeft <= 0 : false) ||
    hasCompletedRound ||
    isSpectator;
  const chatDisabled = !isAnswerPhase || inputDisabled;
  const displayHangman =
    mode === 'finish-lyrics' && gameState.hangman && gameState.targetLyric
      ? applyAnswerToHangmanByWords(gameState.targetLyric, gameState.hangman, answer)
      : gameState.hangman;

  const modeTheme = (() => {
    switch (mode) {
      case 'finish-lyrics':
        return { accent: 'var(--amber-gold)', tint: 'rgba(251, 188, 5, 0.08)' };
      case 'guess-song-easy':
        return { accent: 'var(--medium-jungle)', tint: 'rgba(52, 168, 83, 0.08)' };
      case 'guess-song-challenge':
        return { accent: 'var(--cinnabar)', tint: 'rgba(234, 67, 53, 0.08)' };
      default:
        return { accent: 'var(--azure-blue)', tint: 'rgba(66, 133, 244, 0.08)' };
    }
  })();

  const modeLabel = (() => {
    switch (mode) {
      case 'finish-lyrics':
        return 'FINISH THE LYRICS';
      case 'guess-song-easy':
        return 'GUESS THE SONG';
      case 'guess-song-challenge':
        return 'CHALLENGE MODE';
      default:
        return 'MUSIC GAME';
    }
  })();

  const modeIcon = (() => {
    switch (mode) {
      case 'finish-lyrics':
        return <MicrophoneStage size={28} weight="duotone" style={{ color: modeTheme.accent }} />;
      case 'guess-song-easy':
        return <Headphones size={28} weight="duotone" style={{ color: modeTheme.accent }} />;
      case 'guess-song-challenge':
        return <Trophy size={28} weight="duotone" style={{ color: modeTheme.accent }} />;
      default:
        return <MusicNote size={28} weight="duotone" style={{ color: modeTheme.accent }} />;
    }
  })();
  const inputFlashStyle =
    gameState.inputFlash === 'red'
      ? { boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.6)' }
      : gameState.inputFlash === 'green'
        ? { boxShadow: '0 0 0 3px rgba(34, 197, 94, 0.6)' }
        : undefined;

  useRoomLifecycle({
    authStatus,
    user,
    room,
    isJoiningRoom,
    isLeavingRoom,
    roomCodeParam,
    shouldCreateRoom,
    isPrivate,
    roomPassword,
    mode,
    socket,
    resetRoomState,
    setIsLeavingRoom,
    setRoom,
    setCurrentPlayer,
    setIsJoiningRoom,
    setGameState,
    connectSocket,
    joinRoom,
    createRoom,
    disconnectSocket,
    router,
  });

  useGameSettingsSync({
    room,
    setRoundCountdownSec,
    setResultsDelaySec,
    setGuessClipDurationSec,
    setLyricAnswerTimeSec,
    setMaxRounds,
    setAllowJoinInProgress,
    setAllowChineseVariants,
    setShufflePlaylist,
    setConvertChineseLyrics,
    setRevealNumbers,
    setRevealKorean,
    setRevealJapanese,
    setRevealChinese,
    setRevealVietnamese,
    setRevealSpanish,
  });

  const {
    playlistSource,
    setPlaylistSource,
    playlistUrl,
    setPlaylistUrl,
    manualSongs,
    setManualSongs,
    playlist,
    isParsingPlaylist,
    hostError,
    setHostError,
    loadPlaylist,
    resetPlaylist,
    reshufflePlaylist,
    recommendedPlaylists,
  } = usePlaylistManager({
    socket,
    room,
    isHost,
    shufflePlaylist,
  });

  const { settingsHandlers, values: settingsValues } = useRoomSettings({
    socket,
    room,
    isHost,
    setHostError,
    roundCountdownSec,
    setRoundCountdownSec,
    resultsDelaySec,
    setResultsDelaySec,
    guessClipDurationSec,
    setGuessClipDurationSec,
    lyricAnswerTimeSec,
    setLyricAnswerTimeSec,
    maxRounds,
    setMaxRounds,
    allowJoinInProgress,
    setAllowJoinInProgress,
    allowChineseVariants,
    setAllowChineseVariants,
    shufflePlaylist,
    setShufflePlaylist,
    convertChineseLyrics,
    setConvertChineseLyrics,
    revealNumbers,
    setRevealNumbers,
    revealKorean,
    setRevealKorean,
    revealJapanese,
    setRevealJapanese,
    revealChinese,
    setRevealChinese,
    revealVietnamese,
    setRevealVietnamese,
    revealSpanish,
    setRevealSpanish,
  });

  useVolumePreference({
    user,
    volume,
    resultsFade,
    audioElementRef,
    setVolume,
    audioUrl: gameState.audioUrl,
  });

  useAudioPlayback({
    mode,
    gameState,
    audioElementRef,
    setAudioNeedsGesture,
    setAudioTimeLeft,
    setAudioTotal,
    setAudioElapsed,
    setCurrentClipIndex,
  });

  useGameTimers({
    gameState,
    setTimeLeft,
    setCountdownLeft,
    setResultsFade,
    setLoadingProgress,
    setLoadingSecondsLeft,
    nextSongProgress,
  });

  useTypingStatus({
    socket,
    room,
    isAnswerPhase,
    inputDisabled,
    answer,
    isTyping,
    setIsTyping,
    setAnswer,
    gamePhase: gameState.phase,
  });

  const { markAutoSubmitted } = useFinishLyricsAutoSubmit({
    enabled: mode === 'finish-lyrics' && isAnswerPhase,
    answerTime: gameState.answerTime,
    socket,
    room,
    answer,
    gamePhase: gameState.phase,
  });

  // Auto-focus answer input when it appears
  useEffect(() => {
    if (!isAnswerPhase || inputDisabled) return;
    const timer = window.setTimeout(() => {
      answerInputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isAnswerPhase, inputDisabled]);

  // Clear transient flash feedback after a short delay
  useEffect(() => {
    if (!gameState.inputFlash) return;
    const timer = window.setTimeout(() => {
      setGameState({ inputFlash: null });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [gameState.inputFlash, setGameState]);

  // Auto-dismiss toast notifications
  useEffect(() => {
    if (!gameState.toast?.id) return;
    const toastId = gameState.toast.id;
    const timer = window.setTimeout(() => {
      const latestToast = useStore.getState().gameState.toast;
      if (latestToast?.id === toastId) {
        setGameState({ toast: undefined });
      }
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [gameState.toast?.id, setGameState]);

  // If the game has started, stop showing "Starting..." on the host button
  useEffect(() => {
    if (gameState.phase !== 'waiting' || gameState.playlistPreparing) {
      setIsStartingGame(false);
    }
  }, [gameState.phase, gameState.playlistPreparing]);

  const handleLeaveRoom = () => {
    setIsLeavingRoom(true);
    if (socket && room) {
      leaveRoom(socket, room.code);
    }

    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }

    disconnectSocket();
    setRoom(null);
    setCurrentPlayer(null);
    setIsJoiningRoom(false);
    setGameState({ phase: 'waiting' });
    router.push('/');
  };

  const handleSkipRound = async () => {
    if (!room || !socket || isSkippingRound) return;
    setIsSkippingRound(true);
    skipRound(socket, room.code);
    window.setTimeout(() => setIsSkippingRound(false), 1000);
  };

  const handleTogglePause = () => {
    if (!room || !socket) return;
    if (gameState.paused) {
      resumeGame(socket, room.code);
    } else {
      pauseGame(socket, room.code);
    }
  };

  const handleAnswerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (inputDisabled) return;
    const newAnswer = e.target.value;
    setAnswer(newAnswer);

    if (socket && room && isAnswerPhase) {
      if (!isTyping && newAnswer.length > 0) {
        setIsTyping(true);
        sendTypingStatus(socket, room.code, true);
      }
    }
  };


  const handleStartGame = () => {
    if (!socket || !room) return;
      if (!playlist.length) {
        setHostError('Load a playlist before starting the game.');
        return;
      }
      if (!firstSongReady) {
      setHostError('First song is still loading. Please wait.');
        return;
      }

    setHostError('');
    setIsStartingGame(true);
    startGame(socket, room.code, playlist);
  };

  const handlePlayAgain = () => {
    if (!socket || !room) return;
    if (!playlist.length) {
      setHostError('Load a playlist before starting the game.');
      return;
    }
    setHostError('');
    // Re-prepare the playlist so the queue restarts cleanly.
    preparePlaylist(socket, room.code, playlist);
  };

  const handleStopGame = () => {
    if (!socket || !room) return;
    setIsStoppingGame(true);
    stopGame(socket, room.code);
  };

  useEffect(() => {
    if (!isStoppingGame) return;
    if (gameState.phase === 'game-over' || gameState.phase === 'waiting') {
      setIsStoppingGame(false);
    }
  }, [gameState.phase, isStoppingGame]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputDisabled) return;
    if (socket && room && answer.trim()) {
      submitAnswer(socket, room.code, answer.trim());
      markAutoSubmitted();
      if (mode !== 'finish-lyrics') {
        setAnswer('');
      }
      if (isTyping) {
        setIsTyping(false);
        sendTypingStatus(socket, room.code, false);
      }
    }
  };


  const hostSetupPanel = isHost ? (
    <HostSetupPanel
      mode={mode}
      hostError={hostError}
      settings={settingsValues}
      settingsHandlers={settingsHandlers}
      playlist={playlist}
      playlistSource={playlistSource}
      playlistUrl={playlistUrl}
      manualSongs={manualSongs}
      isParsingPlaylist={isParsingPlaylist}
      isStartingGame={isStartingGame}
      firstSongReady={firstSongReady}
      nextSongProgress={nextSongProgress}
      queueLoadingCount={queueLoadingCount}
      queueFailedCount={gameState.queueStatus?.failed ?? 0}
      playlistPreparing={gameState.playlistPreparing}
      shuffleEnabled={shufflePlaylist}
      recommendedPlaylists={recommendedPlaylists}
      onPlaylistSourceChange={setPlaylistSource}
      onPlaylistUrlChange={setPlaylistUrl}
      onManualSongsChange={setManualSongs}
      onLoadPlaylist={loadPlaylist}
      onShufflePlaylist={reshufflePlaylist}
      onStartGame={handleStartGame}
      onResetPlaylist={resetPlaylist}
    />
  ) : null;

  const finalScores = (gameState.finalScores || gameState.playerScores || []).slice()
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const topThree = finalScores.slice(0, 3);
  const remainingScores = finalScores.slice(3);

  if (authStatus === 'loading') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
      >
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <MusicNote size={40} weight="duotone" />
          </div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  if (!room || !currentPlayer) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
      >
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <MusicNote size={40} weight="duotone" />
          </div>
          <div>Setting up room...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full p-6 md:p-8"
      style={{
        backgroundColor: modeTheme.tint,
        ['--card-border' as any]: modeTheme.accent,
      }}
    >
      <audio ref={audioElementRef} />

      <div className="w-full">
        {gameState.toast ? (
          <div className="fixed top-6 left-1/2 z-50 -translate-x-1/2">
            <div
              className="rounded-md px-4 py-2 text-sm font-semibold shadow-lg"
              style={{
                backgroundColor:
                  gameState.toast.variant === 'error'
                    ? 'rgba(234, 67, 53, 0.9)'
                    : gameState.toast.variant === 'warning'
                      ? 'rgba(251, 188, 5, 0.9)'
                      : 'rgba(66, 133, 244, 0.9)',
                color: '#fff',
              }}
            >
              {gameState.toast.message}
            </div>
          </div>
        ) : null}

        <GameHeader
          modeIcon={modeIcon}
          modeLabel={modeLabel}
          accentColor={modeTheme.accent}
          roomCode={room.code}
          rightContent={
            <>
              <label className="flex items-center gap-2 text-sm opacity-80">
                <SpeakerHigh size={16} weight="duotone" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                />
                <span className="w-10 text-right">{Math.round(volume * 100)}%</span>
              </label>
              {isHost && room.isActive && (
                <button
                  type="button"
                  onClick={handleTogglePause}
                  className="btn-secondary px-4 py-2 text-sm"
                  disabled={
                    ![
                      'playing-audio',
                      'answering',
                      'showing-results',
                    ].includes(gameState.phase)
                  }
                >
                  <span className="flex items-center gap-2">
                    {gameState.paused ? (
                      <Play size={16} weight="duotone" />
                    ) : (
                      <Pause size={16} weight="duotone" />
                    )}
                    {gameState.paused ? 'Resume' : 'Pause'}
                  </span>
                </button>
              )}
              {isHost && room.isActive && (
                <button
                  type="button"
                  onClick={handleStopGame}
                  className="btn-secondary px-4 py-2 text-sm"
                  disabled={isStoppingGame}
                >
                  <span className="flex items-center gap-2">
                    <Square size={16} weight="duotone" />
                    {isStoppingGame ? 'Stopping...' : 'Stop'}
                  </span>
                </button>
              )}
              {isHost && room.isActive && (
                <button
                  type="button"
                  onClick={handleSkipRound}
                  className="btn-secondary px-4 py-2 text-sm"
                  disabled={isSkippingRound}
                >
                  <span className="flex items-center gap-2">
                    <SkipForward size={16} weight="duotone" />
                    {isSkippingRound ? 'Skipping...' : 'Skip Round'}
                  </span>
                </button>
              )}
              <button onClick={handleLeaveRoom} className="btn-secondary px-4 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <SignOut size={16} weight="duotone" />
                  Leave
                </span>
              </button>
              <ThemeToggle />
            </>
          }
        />

        <div className={showChat ? 'grid lg:grid-cols-4 gap-6' : 'grid lg:grid-cols-3 gap-6'}>
          {/* Left Sidebar - Players & Info */}
          <div className="space-y-6 lg:col-span-1">
            <PlayersPanel
              players={room.players}
              mode={mode}
              playerAnswerStatus={gameState.playerAnswerStatus}
              showStatusBorders={
                gameState.phase === 'playing-audio' ||
                gameState.phase === 'answering' ||
                gameState.phase === 'showing-results' ||
                gameState.phase === 'game-over'
              }
            />
            {(!room.isActive && (gameState.previousSongs?.length ?? 0) === 0) ? (
              <HowToPlayCard mode={mode} lyricAnswerTimeSec={lyricAnswerTimeSec} />
            ) : (
              <PreviousSongsCard previousSongs={gameState.previousSongs} />
            )}
          </div>

          {/* Main Game Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Game Phase Display */}
            {gameState.phase === 'waiting' && (
              <WaitingPanel isHost={isHost} hostSetupPanel={hostSetupPanel} />
            )}

            {gameState.phase === 'loading' && (
              <LoadingPanel
                loadingMessage={gameState.loadingMessage}
                loadingProgress={loadingProgress}
                loadingSecondsLeft={loadingSecondsLeft}
                queueStatus={gameState.queueStatus}
                queueLoadingCount={queueLoadingCount}
                errorMessage={gameState.errorMessage}
                roundLabel={roundLabel}
              />
            )}

            {gameState.phase === 'countdown' && (
              <CountdownPanel
                countdownLeft={countdownLeft}
                countdownMs={gameState.countdownMs}
                roundLabel={roundLabel}
              />
            )}

            {gameState.phase === 'playing-audio' && (
              <PlayingAudioPanel
                mode={mode}
                audioNeedsGesture={audioNeedsGesture}
                onRequestPlay={() =>
                  audioElementRef
                    .current?.play()
                    .then(() => setAudioNeedsGesture(false))
                    .catch(() => setAudioNeedsGesture(true))
                }
                clipPhase={gameState.clipPhase}
                audioTotal={audioTotal}
                audioElapsed={audioElapsed}
                audioTimeLeft={audioTimeLeft}
                hangman={gameState.hangman}
                clipLyricLines={gameState.clipLyricLines}
                currentClipIndex={currentClipIndex}
                roundLabel={roundLabel}
              />
            )}

            {isAnswerPhase && (
              <AnswerPhasePanel
                mode={mode}
                modeLabel={modeLabel}
                accentColor={modeTheme.accent}
                gameState={gameState}
                timeLeft={timeLeft}
                roundLabel={roundLabel}
                displayHangman={displayHangman}
                hasCompletedRound={hasCompletedRound}
                isSpectator={isSpectator}
                inputDisabled={inputDisabled}
                isAnswerPhase={isAnswerPhase}
                inputFlashStyle={inputFlashStyle}
                answer={answer}
                onAnswerChange={setAnswer}
                onSubmit={handleSubmit}
                answerInputRef={answerInputRef}
                myAnswerStatus={myAnswerStatus}
              />
            )}

            {gameState.phase === 'showing-results' && (
              <ResultsPanel mode={mode} gameState={gameState} roundLabel={roundLabel} />
            )}

            {gameState.phase === 'game-over' && (
              <GameOverPanel
                finalScores={finalScores}
                topThree={topThree}
                remainingScores={remainingScores}
                isHost={isHost}
                hostSetupPanel={hostSetupPanel}
                onPlayAgain={handlePlayAgain}
                onBackHome={() => router.push('/')}
              />
            )}
          </div>

          {/* Right Chat Column */}
          {showChat && (
            <ChatPanel
              chatMessages={chatMessages}
              isAnswerPhase={isAnswerPhase}
              answer={answer}
              onAnswerChange={setAnswer}
              onSubmit={handleSubmit}
              inputFlashStyle={inputFlashStyle}
              answerInputRef={answerInputRef as React.RefObject<HTMLInputElement>}
              chatDisabled={chatDisabled}
              lastErrorMessage={
                !gameState.lastAnswerFeedback?.correct ? gameState.lastAnswerFeedback?.message : undefined
              }
              currentUsername={currentPlayer?.username}
              currentPlayerId={currentPlayer?.id}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function applyAnswerToHangmanByWords(target: string, hangman: string, answer: string) {
  if (!answer) return hangman;

  const isCjkChar = (char: string) => /[\p{Script=Han}\u3040-\u30FF\uAC00-\uD7AF]/u.test(char);
  const isLatinLike = (char: string) => /[\p{L}\p{N}]/u.test(char) && !isCjkChar(char);

  const answerCjkChars = Array.from(answer).filter(isCjkChar);
  const answerWordTokens = answer
    .split(/\s+/)
    .map(token => Array.from(token).filter(isLatinLike).join(''))
    .filter(Boolean);

  let cjkIndex = 0;
  let wordIndex = 0;

  const parts = target.split(/(\s+)/);

  const filledParts = parts.map(part => {
    if (part.trim() === '') return part;

    const partChars = Array.from(part);
    const hasCjk = partChars.some(isCjkChar);
    const hasLatin = partChars.some(isLatinLike);

    if (!hasCjk && !hasLatin) {
      return part;
    }

    if (hasCjk) {
      return partChars
        .map(char => {
          if (char !== '_') {
            // keep punctuation/symbols
            if (!isCjkChar(char)) return char;
          }
          if (!isCjkChar(char)) return char;
          const next = answerCjkChars[cjkIndex];
          if (!next) return '_';
          cjkIndex += 1;
          return next;
        })
        .join('');
    }

    // Latin-like word segment: fill per word token
    const typedWord = answerWordTokens[wordIndex] || '';
    if (typedWord) {
      wordIndex += 1;
    }
    let letterIndex = 0;
    return partChars
      .map(char => {
        if (!isLatinLike(char)) return char;
        const next = typedWord[letterIndex];
        if (!next) return '_';
        letterIndex += 1;
        return next;
      })
      .join('');
  });

  return filledParts.join('');
}
