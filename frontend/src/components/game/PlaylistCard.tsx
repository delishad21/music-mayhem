import { useState } from 'react';
import Image from 'next/image';
import { MusicNotes, SpotifyLogo, YoutubeLogo } from 'phosphor-react';
import { SongItem } from '@/lib/api';
import PanelHeading from './PanelHeading';

interface RecommendedPlaylist {
  name: string;
  url: string;
}

interface PlaylistCardProps {
  playlist: SongItem[];
  playlistSource: 'spotify' | 'youtube' | 'manual';
  playlistUrl: string;
  manualSongs: string;
  shuffleEnabled: boolean;
  isParsingPlaylist: boolean;
  isStartingGame: boolean;
  firstSongReady: boolean;
  nextSongProgress: number;
  queueLoadingCount: number;
  queueFailedCount: number;
  playlistPreparing?: boolean;
  recommendedPlaylists: {
    spotify?: RecommendedPlaylist[];
    youtube?: RecommendedPlaylist[];
  };
  onPlaylistSourceChange: (value: 'spotify' | 'youtube' | 'manual') => void;
  onPlaylistUrlChange: (value: string) => void;
  onManualSongsChange: (value: string) => void;
  onLoadPlaylist: () => void;
  onShufflePlaylist: () => void;
  onStartGame: () => void;
  onResetPlaylist: () => void;
}

export default function PlaylistCard({
  playlist,
  playlistSource,
  playlistUrl,
  manualSongs,
  shuffleEnabled,
  isParsingPlaylist,
  isStartingGame,
  firstSongReady,
  nextSongProgress,
  queueLoadingCount,
  queueFailedCount,
  playlistPreparing,
  recommendedPlaylists,
  onPlaylistSourceChange,
  onPlaylistUrlChange,
  onManualSongsChange,
  onLoadPlaylist,
  onShufflePlaylist,
  onStartGame,
  onResetPlaylist,
}: PlaylistCardProps) {
  const VISIBLE_SONGS = 50;
  const [showAllSongs, setShowAllSongs] = useState(false);
  const recommended =
    playlistSource === 'manual' ? [] : recommendedPlaylists[playlistSource] || [];
  const visibleSongs = showAllSongs ? playlist : playlist.slice(0, VISIBLE_SONGS);
  const sourceButtonClass = (source: 'spotify' | 'youtube' | 'manual') =>
    playlistSource === source ? 'btn px-4 py-2 text-sm' : 'btn-secondary px-4 py-2 text-sm';

  return (
    <div className="space-y-4 border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'transparent' }}>
      {playlist.length > 0 ? (
        <>
          <PanelHeading
            icon={<MusicNotes size={16} weight="duotone" />}
            title="Playlist Ready"
            action={<div className="mode-chip">{playlist.length} songs</div>}
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            {shuffleEnabled && (
              <button
                type="button"
                onClick={onShufflePlaylist}
                className="btn-secondary px-3 py-2 text-xs"
                disabled={playlist.length === 0}
                title="Shuffle loaded playlist"
              >
                Reshuffle playlist
              </button>
            )}
            <button type="button" onClick={onResetPlaylist} className="btn-secondary px-3 py-2 text-xs">
              Change Playlist
            </button>
          </div>

          {!firstSongReady && (
            <div className="border p-2.5" style={{ borderColor: 'var(--border)' }}>
              <div className="mb-1 text-sm font-semibold">
                {playlistPreparing ? 'Loading first song...' : 'Preparing songs...'}
              </div>
              <div className="progress-track mb-2">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.round(nextSongProgress * 100)}%`,
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="mode-chip">Progress {Math.round(nextSongProgress * 100)}%</span>
                <span className="mode-chip">Loading {queueLoadingCount}</span>
                <span className="mode-chip">Failed {queueFailedCount}</span>
              </div>
            </div>
          )}

          {firstSongReady && (
            <div className="border border-green-500 p-2.5 text-sm font-semibold text-green-500">
              ✓ First song loaded. You can start the game.
            </div>
          )}

          <details className="group border" style={{ borderColor: 'var(--border)' }}>
            <summary className="cursor-pointer select-none px-4 py-3 font-semibold flex items-center justify-between bg-[var(--card-hover)]">
              <span>Loaded songs</span>
              <span className="flex items-center gap-2 text-sm opacity-70">
                {playlist.length} total
                <span className="text-2xl transition-transform duration-200 group-open:rotate-180">▾</span>
              </span>
            </summary>
            <div className="max-h-72 space-y-1.5 overflow-auto px-3 pb-3 pt-2">
              {visibleSongs.map((item, index) => (
                <div
                  key={`${item.songName || item.url}-${item.artist || ''}-${item.url || ''}-${index}`}
                  className="border px-2 py-2"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-2.5">
                    {item.albumArtUrl ? (
                      <Image
                        src={item.albumArtUrl}
                        alt={`${item.songName || 'Song'} artwork`}
                        width={48}
                        height={48}
                        className="h-10 w-10 object-cover"
                        style={{ borderColor: 'var(--border)' }}
                        unoptimized
                      />
                    ) : (
                      <div
                        className="flex h-10 w-10 items-center justify-center border text-xs opacity-60"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        Art
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{item.songName || 'Unknown Song'}</div>
                      <div className="text-sm opacity-70">{item.artist || 'Unknown Artist'}</div>
                    </div>
                  </div>
                </div>
              ))}
              {playlist.length > VISIBLE_SONGS && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAllSongs(prev => !prev)}
                    className="btn-secondary w-full"
                  >
                    {showAllSongs ? 'Show fewer songs' : `Show all ${playlist.length} songs`}
                  </button>
                </div>
              )}
            </div>
          </details>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onStartGame}
              className="btn px-8"
              disabled={isStartingGame || isParsingPlaylist || !firstSongReady}
            >
              {isStartingGame ? 'Starting...' : firstSongReady ? 'Start Game' : 'Waiting for first song...'}
            </button>
          </div>
        </>
      ) : (
        <>
          <PanelHeading icon={<MusicNotes size={16} weight="duotone" />} title="Playlist Import" />

          <div className="flex flex-wrap gap-1.5 border p-1" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={() => onPlaylistSourceChange('spotify')}
              className={sourceButtonClass('spotify')}
            >
              <SpotifyLogo size={18} weight="duotone" />
              Spotify Playlist
            </button>
            <button
              type="button"
              onClick={() => onPlaylistSourceChange('youtube')}
              className={sourceButtonClass('youtube')}
            >
              <YoutubeLogo size={18} weight="duotone" />
              YouTube Playlist
            </button>
            <button
              type="button"
              onClick={() => onPlaylistSourceChange('manual')}
              className={sourceButtonClass('manual')}
            >
              Manual List
            </button>
          </div>

          {(playlistSource === 'spotify' || playlistSource === 'youtube') && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold">
                {playlistSource === 'spotify' ? 'Spotify Playlist URL' : 'YouTube Playlist URL'}
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="url"
                  value={playlistUrl}
                  onChange={(e) => onPlaylistUrlChange(e.target.value)}
                  className="input flex-1"
                  placeholder={
                    playlistSource === 'spotify'
                      ? 'https://open.spotify.com/playlist/...'
                      : 'https://www.youtube.com/playlist?list=...'
                  }
                />
                <button type="button" onClick={onLoadPlaylist} className="btn" disabled={isParsingPlaylist}>
                  {isParsingPlaylist ? 'Loading...' : 'Load'}
                </button>
              </div>
            </div>
          )}

          {playlistSource === 'manual' && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold">Manual Song List</label>
              <p className="text-sm opacity-70">Enter one song per line in the format: Artist - Song Name</p>
              <textarea
                value={manualSongs}
                onChange={(e) => onManualSongsChange(e.target.value)}
                className="input min-h-[160px]"
                placeholder={`Taylor Swift - Blank Space\nAdele - Hello\nDaft Punk - Get Lucky`}
              />
              <div className="flex justify-end">
                <button type="button" onClick={onLoadPlaylist} className="btn" disabled={isParsingPlaylist}>
                  {isParsingPlaylist ? 'Loading...' : 'Use This List'}
                </button>
              </div>
            </div>
          )}

          {(playlistSource === 'spotify' || playlistSource === 'youtube') && recommended.length > 0 && (
            <div className="space-y-3">
              <div className="eyebrow">
                Recommended Playlists
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                {recommended.map((item) => (
                  <button
                    key={item.url}
                    type="button"
                    onClick={() => onPlaylistUrlChange(item.url)}
                    className="border px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--card-hover)]"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
