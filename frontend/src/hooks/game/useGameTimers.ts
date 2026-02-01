import { useEffect } from 'react';
import { GameState } from '@/types/game';

interface UseGameTimersProps {
  gameState: GameState;
  setTimeLeft: (value: number | ((prev: number) => number)) => void;
  setCountdownLeft: (value: number) => void;
  setResultsFade: (value: number) => void;
  setLoadingProgress: (value: number) => void;
  setLoadingSecondsLeft: (value: number) => void;
  nextSongProgress: number;
}

export function useGameTimers({
  gameState,
  setTimeLeft,
  setCountdownLeft,
  setResultsFade,
  setLoadingProgress,
  setLoadingSecondsLeft,
  nextSongProgress,
}: UseGameTimersProps) {
  useEffect(() => {
    if (gameState.phase !== 'answering' || !gameState.answerTime) return;

    if (gameState.paused && gameState.pausePhase === 'answering') {
      if (typeof gameState.pauseRemainingMs === 'number') {
        setTimeLeft(gameState.pauseRemainingMs / 1000);
      }
      return;
    }

    setTimeLeft(gameState.answerTime / 1000);

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0.1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 0.1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [
    gameState.phase,
    gameState.answerTime,
    gameState.paused,
    gameState.pausePhase,
    gameState.pauseRemainingMs,
    setTimeLeft,
  ]);

  useEffect(() => {
    if (gameState.phase !== 'countdown') return;
    if (gameState.paused && gameState.pausePhase === 'countdown') {
      if (typeof gameState.pauseRemainingMs === 'number') {
        setCountdownLeft(Math.max(0, gameState.pauseRemainingMs / 1000));
      }
      return;
    }

    const getRemaining = () => {
      if (gameState.countdownEndsAt) {
        return Math.max(0, (gameState.countdownEndsAt - Date.now()) / 1000);
      }
      if (gameState.countdownMs) {
        return Math.max(0, gameState.countdownMs / 1000);
      }
      return 0;
    };

    setCountdownLeft(getRemaining());
    const interval = window.setInterval(() => {
      setCountdownLeft(getRemaining());
    }, 100);

    return () => window.clearInterval(interval);
  }, [
    gameState.phase,
    gameState.countdownEndsAt,
    gameState.countdownMs,
    gameState.paused,
    gameState.pausePhase,
    gameState.pauseRemainingMs,
    setCountdownLeft,
  ]);

  useEffect(() => {
    if (gameState.phase !== 'showing-results') {
      setResultsFade(1);
      return;
    }

    if (gameState.paused && gameState.pausePhase === 'showing-results') {
      setResultsFade(1);
      return;
    }

    const RESULTS_DELAY_MS = typeof gameState.pauseRemainingMs === 'number'
      ? Math.max(0, gameState.pauseRemainingMs)
      : 7000;
    const FADE_DURATION_MS = 1500;
    const fadeStartMs = Math.max(0, RESULTS_DELAY_MS - FADE_DURATION_MS);
    const startedAt = Date.now();

    setResultsFade(1);

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      if (elapsed < fadeStartMs) {
        setResultsFade(1);
        return;
      }

      const fadeElapsed = elapsed - fadeStartMs;
      const ratio = Math.max(0, 1 - fadeElapsed / FADE_DURATION_MS);
      setResultsFade(ratio);
    }, 100);

    const timeout = window.setTimeout(() => {
      setResultsFade(0);
    }, RESULTS_DELAY_MS);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
      setResultsFade(1);
    };
  }, [
    gameState.phase,
    gameState.paused,
    gameState.pausePhase,
    gameState.pauseRemainingMs,
    setResultsFade,
  ]);

  useEffect(() => {
    if (gameState.phase !== 'loading') {
      setLoadingProgress(0);
      setLoadingSecondsLeft(60);
      return;
    }

    const update = () => {
      setLoadingProgress(nextSongProgress);
      setLoadingSecondsLeft(0);
    };

    update();
    const interval = window.setInterval(update, 200);
    return () => {
      window.clearInterval(interval);
    };
  }, [gameState.phase, gameState.queueStatus, nextSongProgress, setLoadingProgress, setLoadingSecondsLeft]);
}
