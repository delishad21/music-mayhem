import { useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import { Room } from '@/types/game';
import { sendTypingStatus } from '@/hooks/useSocket';

interface UseTypingStatusProps {
  socket: Socket | null;
  room: Room | null;
  isAnswerPhase: boolean;
  gamePhase: string;
  inputDisabled: boolean;
  answer: string;
  isTyping: boolean;
  setIsTyping: (value: boolean) => void;
  setAnswer: (value: string) => void;
}

export function useTypingStatus({
  socket,
  room,
  isAnswerPhase,
  gamePhase,
  inputDisabled,
  answer,
  isTyping,
  setIsTyping,
  setAnswer,
}: UseTypingStatusProps) {
  useEffect(() => {
    if (gamePhase === 'playing-audio' || gamePhase === 'answering') return;
    if (isTyping && socket && room) {
      sendTypingStatus(socket, room.code, false);
    }
    setAnswer('');
    setIsTyping(false);
  }, [gamePhase, isTyping, socket, room, setAnswer, setIsTyping]);

  useEffect(() => {
    if (!socket || !room || !isAnswerPhase) return;

    const timer = setTimeout(() => {
      if (isTyping && answer.length === 0) {
        setIsTyping(false);
        sendTypingStatus(socket, room.code, false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [answer, isTyping, socket, room, isAnswerPhase, setIsTyping]);

  useEffect(() => {
    if (!inputDisabled || !isTyping || !socket || !room) return;
    setIsTyping(false);
    sendTypingStatus(socket, room.code, false);
  }, [inputDisabled, isTyping, socket, room, setIsTyping]);
}
