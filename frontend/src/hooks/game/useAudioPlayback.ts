import { RefObject, useEffect } from 'react';
import { GameMode, GameState } from '@/types/game';
import { getRuntimeConfig } from '@/lib/runtimeConfig';

interface UseAudioPlaybackProps {
  mode: GameMode;
  gameState: GameState;
  audioElementRef: RefObject<HTMLAudioElement | null>;
  setAudioNeedsGesture: (value: boolean) => void;
  setAudioTimeLeft: (value: number) => void;
  setAudioTotal: (value: number) => void;
  setAudioElapsed: (value: number) => void;
  setCurrentClipIndex: (value: number) => void;
}

export function useAudioPlayback({
  mode,
  gameState,
  audioElementRef,
  setAudioNeedsGesture,
  setAudioTimeLeft,
  setAudioTotal,
  setAudioElapsed,
  setCurrentClipIndex,
}: UseAudioPlaybackProps) {
  useEffect(() => {
    const audio = audioElementRef.current;
    if (!audio) return;

    const onError = async () => {
      const src = audio.currentSrc || audio.src;
      if (src && !src.includes('/audio/')) {
        return;
      }
      console.error('Audio element error. src=', src);

      if (src) {
        try {
          const response = await fetch(src, { method: 'HEAD' });
          console.error('Audio HEAD status:', response.status, response.statusText);
        } catch (err) {
          console.error('Audio HEAD request failed:', err);
        }
      }
    };

    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('error', onError);
    };
  }, [audioElementRef]);

  useEffect(() => {
    const audio = audioElementRef.current;
    if (!audio) return;

    const shouldKeepAudio =
      !!gameState.audioUrl &&
      (gameState.phase === 'playing-audio' ||
        gameState.phase === 'answering' ||
        gameState.phase === 'showing-results');

    if (!shouldKeepAudio) {
      audio.pause();
      audio.src = '';
      return;
    }

    const runtime = getRuntimeConfig();
    const baseUrl =
      typeof window !== 'undefined'
        ? runtime.NEXT_PUBLIC_API_URL || window.location.origin
        : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const desiredSrc = `${baseUrl}${gameState.audioUrl}`;
    if (audio.src !== desiredSrc) {
      audio.src = desiredSrc;
    }

    if (gameState.paused) {
      audio.pause();
      return;
    }

    if (gameState.phase === 'answering' && mode === 'finish-lyrics') {
      audio.pause();
      return;
    }

    if (gameState.phase === 'playing-audio') {
      const baseStart = gameState.startTime || 0;
      const elapsed =
        gameState.roundStartedAt ? Math.max(0, (Date.now() - gameState.roundStartedAt) / 1000) : 0;
      audio.currentTime = baseStart + elapsed;

      audio
        .play()
        .then(() => setAudioNeedsGesture(false))
        .catch(err => {
          console.error('Audio play error:', err);
          setAudioNeedsGesture(true);
        });

      if (gameState.stopTime) {
        const checkTime = setInterval(() => {
          if (audio.currentTime >= gameState.stopTime!) {
            audio.pause();
            clearInterval(checkTime);
          }
        }, 100);

        return () => clearInterval(checkTime);
      } else if (gameState.duration) {
        const remaining = Math.max(0, gameState.duration - elapsed);
        setTimeout(() => {
          audio.pause();
        }, remaining * 1000);
      }
    }

    if (gameState.phase === 'showing-results' && audio.paused) {
      audio
        .play()
        .then(() => setAudioNeedsGesture(false))
        .catch(err => {
          console.error('Audio play error:', err);
          setAudioNeedsGesture(true);
        });
    }
  }, [
    mode,
    gameState.phase,
    gameState.paused,
    gameState.audioUrl,
    gameState.startTime,
    gameState.stopTime,
    gameState.duration,
    gameState.roundStartedAt,
    audioElementRef,
    setAudioNeedsGesture,
  ]);

  useEffect(() => {
    if (mode === 'finish-lyrics') return;
    if (gameState.phase !== 'playing-audio') {
      setAudioTimeLeft(0);
      setAudioTotal(0);
      setAudioElapsed(0);
      return;
    }
    if (gameState.paused) {
      return;
    }

    const totalDuration = (() => {
      if (typeof gameState.stopTime === 'number' && typeof gameState.startTime === 'number') {
        return Math.max(0, gameState.stopTime - gameState.startTime);
      }
      if (typeof gameState.duration === 'number') {
        return Math.max(0, gameState.duration);
      }
      return 0;
    })();

    if (!totalDuration || !gameState.roundStartedAt) {
      setAudioTimeLeft(0);
      setAudioTotal(0);
      setAudioElapsed(0);
      return;
    }

    setAudioTotal(totalDuration);

    const interval = window.setInterval(() => {
      const elapsed = (Date.now() - gameState.roundStartedAt!) / 1000;
      const remaining = Math.max(0, totalDuration - elapsed);
      setAudioTimeLeft(remaining);
      setAudioElapsed(Math.max(0, elapsed));
    }, 100);

    return () => window.clearInterval(interval);
  }, [
    mode,
    gameState.phase,
    gameState.paused,
    gameState.duration,
    gameState.startTime,
    gameState.stopTime,
    gameState.roundStartedAt,
    setAudioTimeLeft,
    setAudioTotal,
    setAudioElapsed,
  ]);

  useEffect(() => {
    const audio = audioElementRef.current;
    if (!audio) return;
    if (mode !== 'finish-lyrics') return;
    if (gameState.phase !== 'playing-audio' || gameState.paused) return;
    if (!gameState.clipLyricLines || gameState.clipLyricLines.length === 0) {
      setCurrentClipIndex(0);
      return;
    }

    const updateLyric = () => {
      const fallbackTime = (() => {
        if (!gameState.roundStartedAt || typeof gameState.startTime !== 'number') {
          return audio.currentTime;
        }
        const elapsed = (Date.now() - gameState.roundStartedAt) / 1000;
        return gameState.startTime + Math.max(0, elapsed);
      })();
      const currentTime = audio.currentTime || fallbackTime;
      const lines = gameState.clipLyricLines!;
      const activeLine = [...lines].reverse().find(line => line.time <= currentTime);
      const index = Math.max(0, lines.findIndex(line => line.time === activeLine?.time));
      setCurrentClipIndex(index >= 0 ? index : 0);
    };

    updateLyric();
    const interval = window.setInterval(updateLyric, 100);
    return () => {
      window.clearInterval(interval);
    };
  }, [
    mode,
    gameState.phase,
    gameState.paused,
    gameState.clipLyricLines,
    gameState.roundStartedAt,
    gameState.startTime,
    audioElementRef,
    setCurrentClipIndex,
  ]);
}
