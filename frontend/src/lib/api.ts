import axios from 'axios';
import { getRuntimeConfig } from './runtimeConfig';

const runtime = getRuntimeConfig();
const API_URL =
  typeof window !== 'undefined'
    ? runtime.NEXT_PUBLIC_API_URL || window.location.origin
    : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface RegisterData {
  username: string;
  password: string;
}

export interface LoginData {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
  };
}

export const authAPI = {
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },

  getHistory: async (username: string) => {
    const response = await api.get(`/auth/history/${username}`);
    return response.data;
  },
};

export interface SongItem {
  url?: string;
  songName?: string;
  artist?: string;
  albumArtUrl?: string;
}

export const songsAPI = {
  parseSpotifyPlaylist: async (playlistUrl: string): Promise<SongItem[]> => {
    const response = await api.post('/songs/parse-spotify-playlist', { playlistUrl });
    return response.data.tracks;
  },

  parseYouTubePlaylist: async (playlistUrl: string): Promise<SongItem[]> => {
    const response = await api.post('/songs/parse-youtube-playlist', { playlistUrl });
    return response.data.tracks;
  },

  createSongList: async (songs: SongItem[]): Promise<SongItem[]> => {
    const response = await api.post('/songs/create-song-list', { songs });
    return response.data.tracks;
  },
};

export const roomsAPI = {
  list: async () => {
    const response = await api.get('/rooms');
    return response.data.rooms as Array<{
      code: string;
      gameMode: string;
      playerCount: number;
      hostName?: string;
    }>;
  },
  get: async (code: string) => {
    const response = await api.get(`/rooms/${code}`);
    return response.data.room as {
      code: string;
      gameMode: string;
      isPrivate: boolean;
      playerCount: number;
      hostName?: string;
    };
  },
};

export default api;
