import { useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { Room } from '@/types/game';
import { SongItem, songsAPI } from '@/lib/api';
import { preparePlaylist } from '@/hooks/useSocket';

type PlaylistSource = 'spotify' | 'youtube' | 'manual';

interface UsePlaylistManagerProps {
  socket: Socket | null;
  room: Room | null;
  isHost: boolean;
  shufflePlaylist: boolean;
}

const recommendedPlaylists = {
  spotify: [
    { name: 'Top Songs 2020 (Pop)', url: 'https://open.spotify.com/playlist/0uCoUrWzW9yXYH7x0twKzv' },
    { name: "BEST SONGS OF 2000's — Hits 2000–2010", url: 'https://open.spotify.com/playlist/5Kmy9U2iJ5sqpLEgrhltqa' },
    { name: 'Call Me Maybe • 2000s & 2010s Pop Hits', url: 'https://open.spotify.com/playlist/6gUhaSEgyA2LtrW7F1gfvh' },
    { name: 'Pop Bangers (Mostly 2010s Pop)', url: 'https://open.spotify.com/playlist/7yudxFQNo8KXpvYYjH28o5' },
    { name: '2020s Dance Pop (Female Vocals)', url: 'https://open.spotify.com/playlist/26cZQR2Yg9TWh8CL3DemOy' },
    { name: "10's Pop Punk / Emo (2010s)", url: 'https://open.spotify.com/playlist/3lHqG5QOdYNGwqyYhzV7Xx' },
    { name: "Reddit's Hip Hop of the Decade (2010s)", url: 'https://open.spotify.com/playlist/5kTH0VgKBNYoNSxarl1gt1' },
    { name: 'Good Vibes (Rap)', url: 'https://open.spotify.com/playlist/10qpx580DXgXwVEw8xVpYx' },
    { name: 'Vibe w/ Me (Hip Hop & R&B)', url: 'https://open.spotify.com/playlist/0iGO5PqQRIpOxq0o5ameH5' },
    { name: 'Underground Rap/Trap 2k19', url: 'https://open.spotify.com/playlist/53AYu5sh7ODuSLRqc8Rie7' },
  ],
  youtube: [
    { name: 'Popular Music Videos', url: 'https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI' },
    { name: 'Top 100 Songs 2025', url: 'https://www.youtube.com/playlist?list=PLx0sYbCqOb8QTF1DCJVfQrtWknZFzuoAE' },
    { name: 'Your Top Songs 2021', url: 'https://www.youtube.com/playlist?list=PLjK6P9rkjhm4NvFMwcay_vNUhPjeE6NYX' },
  ],
};

export function usePlaylistManager({ socket, room, isHost, shufflePlaylist }: UsePlaylistManagerProps) {
  const [playlistSource, setPlaylistSource] = useState<PlaylistSource>('spotify');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [manualSongs, setManualSongs] = useState('');
  const [playlist, setPlaylist] = useState<SongItem[]>([]);
  const [rawPlaylist, setRawPlaylist] = useState<SongItem[]>([]);
  const [isParsingPlaylist, setIsParsingPlaylist] = useState(false);
  const [hostError, setHostError] = useState('');
  const lastShuffleRef = useRef(shufflePlaylist);

  const recommended = useMemo(() => recommendedPlaylists, []);

  const parseManualSongs = (input: string): SongItem[] => {
    return input
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(' - ');
        if (parts.length >= 2) {
          const artist = parts[0].trim();
          const songName = parts.slice(1).join(' - ').trim();
          return { songName, artist };
        }
        return { songName: line };
      });
  };

  const shuffleSongs = (songs: SongItem[]) => {
    const copy = [...songs];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const loadPlaylist = async () => {
    setHostError('');

    try {
      setIsParsingPlaylist(true);

      let tracks: SongItem[] = [];

      if (playlistSource === 'spotify') {
        if (!playlistUrl.trim()) {
          setHostError('Enter a Spotify playlist URL.');
          return;
        }
        tracks = await songsAPI.parseSpotifyPlaylist(playlistUrl.trim());
      } else if (playlistSource === 'youtube') {
        if (!playlistUrl.trim()) {
          setHostError('Enter a YouTube playlist URL.');
          return;
        }
        tracks = await songsAPI.parseYouTubePlaylist(playlistUrl.trim());
      } else {
        tracks = parseManualSongs(manualSongs);
      }

      if (!tracks.length) {
        setHostError('No songs found. Try a different playlist or add manual entries.');
        return;
      }

      setRawPlaylist(tracks);
      const finalTracks = shufflePlaylist ? shuffleSongs(tracks) : tracks;
      setPlaylist(finalTracks);

      if (socket && room && isHost) {
        preparePlaylist(socket, room.code, finalTracks);
      }
    } catch (error: any) {
      setHostError(error?.response?.data?.error || error?.message || 'Failed to load playlist.');
    } finally {
      setIsParsingPlaylist(false);
    }
  };

  const resetPlaylist = () => {
    setPlaylist([]);
    setRawPlaylist([]);
    setHostError('');
    setManualSongs('');
    setPlaylistUrl('');
  };

  const reshufflePlaylist = () => {
    const source = playlist;
    if (!source.length) return;
    const currentKeys = source.map(item => `${item.url || ''}|${item.songName || ''}|${item.artist || ''}`).join('||');
    let nextPlaylist = shuffleSongs(source);
    let nextKeys = nextPlaylist.map(item => `${item.url || ''}|${item.songName || ''}|${item.artist || ''}`).join('||');
    let attempts = 0;
    while (nextKeys === currentKeys && attempts < 5) {
      nextPlaylist = shuffleSongs(source);
      nextKeys = nextPlaylist.map(item => `${item.url || ''}|${item.songName || ''}|${item.artist || ''}`).join('||');
      attempts += 1;
    }
    if (nextKeys === currentKeys && source.length > 1) {
      nextPlaylist = [...source.slice(1), source[0]];
    }
    setPlaylist(nextPlaylist);

    if (socket && room && isHost) {
      preparePlaylist(socket, room.code, nextPlaylist);
    }
  };

  useEffect(() => {
    if (lastShuffleRef.current === shufflePlaylist) return;
    lastShuffleRef.current = shufflePlaylist;
    if (!rawPlaylist.length) return;

    const nextPlaylist = shufflePlaylist ? shuffleSongs(rawPlaylist) : rawPlaylist;
    setPlaylist(nextPlaylist);

    if (socket && room && isHost) {
      preparePlaylist(socket, room.code, nextPlaylist);
    }
  }, [shufflePlaylist, rawPlaylist, socket, room, isHost]);

  return {
    playlistSource,
    setPlaylistSource,
    playlistUrl,
    setPlaylistUrl,
    manualSongs,
    setManualSongs,
    playlist,
    setPlaylist,
    isParsingPlaylist,
    hostError,
    setHostError,
    loadPlaylist,
    resetPlaylist,
    reshufflePlaylist,
    recommendedPlaylists: recommended,
  };
}
