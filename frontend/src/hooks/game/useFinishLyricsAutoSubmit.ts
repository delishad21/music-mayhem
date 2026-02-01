import { useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { Room } from '@/types/game';
import { submitAnswer } from '@/hooks/useSocket';

interface UseFinishLyricsAutoSubmitProps {
  enabled: boolean;
  answerTime?: number;
  socket: Socket | null;
  room: Room | null;
  answer: string;
  gamePhase: string;
}

export function useFinishLyricsAutoSubmit({
  enabled,
  answerTime,
  socket,
  room,
  answer,
  gamePhase,
}: UseFinishLyricsAutoSubmitProps) {
  const autoSubmitTimeoutRef = useRef<number | null>(null);
  const autoSubmittedRef = useRef(false);
  const latestAnswerRef = useRef(answer);

  useEffect(() => {
    latestAnswerRef.current = answer;
  }, [answer]);

  useEffect(() => {
    if (!enabled) return;
    if (!answerTime) return;
    if (!socket || !room) return;

    autoSubmittedRef.current = false;

    if (autoSubmitTimeoutRef.current) {
      window.clearTimeout(autoSubmitTimeoutRef.current);
    }

    autoSubmitTimeoutRef.current = window.setTimeout(() => {
      if (autoSubmittedRef.current) return;
      const latestAnswer = latestAnswerRef.current;
      if (!latestAnswer.length) return;
      submitAnswer(socket, room.code, latestAnswer);
      autoSubmittedRef.current = true;
    }, answerTime);

    return () => {
      if (autoSubmitTimeoutRef.current) {
        window.clearTimeout(autoSubmitTimeoutRef.current);
      }
    };
  }, [enabled, answerTime, socket, room, gamePhase]);

  useEffect(() => {
    if (gamePhase === 'playing-audio') {
      autoSubmittedRef.current = false;
    }
  }, [gamePhase]);

  const markAutoSubmitted = () => {
    autoSubmittedRef.current = true;
  };

  return { markAutoSubmitted };
}
