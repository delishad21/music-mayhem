import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Socket } from 'socket.io-client';
import { GameMode, Player, Room, User, GameState } from '@/types/game';

interface UseRoomLifecycleProps {
  authStatus: 'loading' | 'authenticated' | 'unauthenticated';
  user: User | null;
  room: Room | null;
  isJoiningRoom: boolean;
  isLeavingRoom: boolean;
  roomCodeParam?: string;
  shouldCreateRoom: boolean;
  isPrivate: boolean;
  roomPassword?: string;
  mode: GameMode;
  socket: Socket | null;
  resetRoomState: () => void;
  setIsLeavingRoom: (value: boolean) => void;
  setRoom: (room: Room | null) => void;
  setCurrentPlayer: (player: Player | null) => void;
  setIsJoiningRoom: (value: boolean) => void;
  setGameState: (state: Partial<GameState>) => void;
  connectSocket: () => void;
  joinRoom: (
    socket: Socket | null,
    roomCode: string,
    username: string,
    displayName?: string,
    userId?: string,
    password?: string
  ) => void;
  createRoom: (
    socket: Socket | null,
    mode: GameMode,
    username: string,
    displayName?: string,
    userId?: string,
    options?: { isPrivate?: boolean; password?: string }
  ) => void;
  disconnectSocket: () => void;
  router: ReturnType<typeof useRouter>;
}

export function useRoomLifecycle({
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
}: UseRoomLifecycleProps) {
  const roomCodeRef = useRef<string | null>(null);
  const isCreatingRoomRef = useRef(false);
  const joinAttemptRef = useRef<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const cleanupTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (authStatus === 'loading') return;

    if (!user) {
      router.push('/auth');
      return;
    }

    if (roomCodeParam) {
      if (room?.code === roomCodeParam) {
        return;
      }
      if (isJoiningRoom) {
        return;
      }
      if (joinAttemptRef.current === roomCodeParam) {
        return;
      }

      if (room && room.code !== roomCodeParam) {
        resetRoomState();
      }

      setIsLeavingRoom(false);
      connectSocket();
      joinAttemptRef.current = roomCodeParam;
      joinRoom(socket, roomCodeParam, user.username, user.displayName || user.username, user.id, roomPassword);
      return;
    }

    if (!shouldCreateRoom) {
      if (!room) {
        router.replace('/');
      }
      return;
    }

    if (room || isJoiningRoom || isCreatingRoomRef.current || isLeavingRoom) {
      return;
    }

    isCreatingRoomRef.current = true;
    setIsLeavingRoom(false);
    connectSocket();
    createRoom(socket, mode, user.username, user.displayName || user.username, user.id, {
      isPrivate,
      password: roomPassword,
    });
  }, [
    authStatus,
    user,
    room,
    isJoiningRoom,
    isLeavingRoom,
    socket,
    mode,
    roomCodeParam,
    shouldCreateRoom,
    isPrivate,
    roomPassword,
    router,
    resetRoomState,
    setIsLeavingRoom,
    connectSocket,
    joinRoom,
    createRoom,
  ]);

  useEffect(() => {
    roomCodeRef.current = room?.code ?? null;
    if (room) {
      isCreatingRoomRef.current = false;
      joinAttemptRef.current = null;
    }
  }, [room]);

  useEffect(() => {
    if (!room && !isJoiningRoom) {
      isCreatingRoomRef.current = false;
      joinAttemptRef.current = null;
    }
  }, [room, isJoiningRoom]);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    if (cleanupTimerRef.current) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }

    return () => {
      setIsLeavingRoom(true);

      cleanupTimerRef.current = window.setTimeout(() => {
        const currentSocket = socketRef.current;
        const code = roomCodeRef.current;
        if (currentSocket?.connected && code) {
          currentSocket.emit('leave-room', { roomCode: code });
        }

        disconnectSocket();
        setRoom(null);
        setCurrentPlayer(null);
        setIsJoiningRoom(false);
        setGameState({ phase: 'waiting' });
        cleanupTimerRef.current = null;
      }, 0);
    };
  }, [setRoom, setCurrentPlayer, setIsJoiningRoom, setIsLeavingRoom, setGameState, disconnectSocket]);
}
