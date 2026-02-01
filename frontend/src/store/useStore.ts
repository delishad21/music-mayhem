import { create } from 'zustand';
import { User, Room, Player, GameState } from '@/types/game';
import type { Socket } from 'socket.io-client';

interface AppState {
  // Theme
  isDarkMode: boolean;
  toggleDarkMode: () => void;

  // Auth
  authStatus: 'loading' | 'authenticated' | 'unauthenticated';
  setAuthStatus: (status: AppState['authStatus']) => void;
  user: User | null;
  setUser: (user: User | null) => void;

  // Room
  room: Room | null;
  currentPlayer: Player | null;
  isJoiningRoom: boolean;
  isLeavingRoom: boolean;
  setRoom: (room: Room | null) => void;
  setCurrentPlayer: (player: Player | null) => void;
  setIsJoiningRoom: (isJoining: boolean) => void;
  setIsLeavingRoom: (isLeaving: boolean) => void;
  resetRoomState: () => void;

  // Game State
  gameState: GameState;
  setGameState: (state: Partial<GameState>) => void;

  // Socket
  socket: Socket | null;
  setSocket: (socket: Socket | null) => void;
}

export const useStore = create<AppState>((set) => ({
  // Theme
  isDarkMode: false,
  toggleDarkMode: () => set((state) => {
    const newMode = !state.isDarkMode;
    if (typeof window !== 'undefined') {
      if (newMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    }
    return { isDarkMode: newMode };
  }),

  // Auth
  authStatus: 'loading',
  setAuthStatus: (authStatus) => set({ authStatus }),
  user: null,
  setUser: (user) => {
    if (typeof window !== 'undefined') {
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      } else {
        localStorage.removeItem('user');
      }
    }
    set({ user });
  },

  // Room
  room: null,
  currentPlayer: null,
  isJoiningRoom: false,
  isLeavingRoom: false,
  setRoom: (room) => set({ room }),
  setCurrentPlayer: (player) => set({ currentPlayer: player }),
  setIsJoiningRoom: (isJoiningRoom) => set({ isJoiningRoom }),
  setIsLeavingRoom: (isLeavingRoom) => set({ isLeavingRoom }),
  resetRoomState: () => set({
    room: null,
    currentPlayer: null,
    isJoiningRoom: false,
    isLeavingRoom: false,
    gameState: { phase: 'waiting' },
  }),

  // Game State
  gameState: { phase: 'waiting' },
  setGameState: (newState) => set((state) => ({
    gameState: { ...state.gameState, ...newState },
  })),

  // Socket
  socket: null,
  setSocket: (socket) => set({ socket }),
}));
