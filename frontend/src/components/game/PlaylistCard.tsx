import { useState } from 'react';
import Image from 'next/image';
import { SpotifyLogo, YoutubeLogo } from 'phosphor-react';
import { SongItem } from '@/lib/api';

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

  return (
    <div className="space-y-5 rounded-xl border p-5" style={{ borderColor: 'var(--border)' }}>
      {playlist.length > 0 ? (
        <>
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="text-base font-semibold uppercase tracking-[0.18em] text-[var(--text)]">
              Playlist Ready
            </h3>
            <div className="text-sm opacity-70">{playlist.length} songs</div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 px-4">
            {shuffleEnabled && (
              <button
                type="button"
                onClick={onShufflePlaylist}
                className="btn-secondary px-3 py-1 text-xs"
                disabled={playlist.length === 0}
                title="Shuffle loaded playlist"
              >
                Reshuffle playlist
              </button>
            )}
            <button type="button" onClick={onResetPlaylist} className="btn-secondary px-3 py-1 text-xs">
              Change Playlist
            </button>
          </div>

          {!firstSongReady && (
            <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm font-semibold mb-1">
                {playlistPreparing ? 'Loading first song...' : 'Preparing songs...'}
              </div>
              <div className="w-full bg-gray-300 dark:bg-gray-700 h-2 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${Math.round(nextSongProgress * 100)}%`,
                    backgroundColor: 'var(--primary)',
                  }}
                />
              </div>
              <div className="text-xs opacity-70">
                Progress: {Math.round(nextSongProgress * 100)}% • Loading: {queueLoadingCount} • Failed: {queueFailedCount}
              </div>
            </div>
          )}

          {firstSongReady && (
            <div className="p-3 rounded-lg border border-green-500 text-green-500 text-sm font-semibold">
              ✓ First song loaded. You can start the game.
            </div>
          )}

          <details className="group rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            <summary className="cursor-pointer select-none px-4 py-3 font-semibold flex items-center justify-between bg-[var(--card-hover)]">
              <span>Loaded songs</span>
              <span className="flex items-center gap-2 text-sm opacity-70">
                {playlist.length} total
                <span className="text-2xl transition-transform duration-200 group-open:rotate-180">▾</span>
              </span>
            </summary>
            <div className="max-h-72 overflow-auto space-y-2 px-4 pb-4">
              {visibleSongs.map((item, index) => (
                <div
                  key={`${item.songName || item.url}-${item.artist || ''}-${item.url || ''}-${index}`}
                  className="p-3 rounded-lg border"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3">
                    {item.albumArtUrl ? (
                      <Image
                        src={item.albumArtUrl}
                        alt={`${item.songName || 'Song'} artwork`}
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-md object-cover border"
                        style={{ borderColor: 'var(--border)' }}
                        unoptimized
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-md border flex items-center justify-center text-xs opacity-60"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        Art
                      </div>
                    )}
                    <div>
                      <div className="font-semibold">{item.songName || 'Unknown Song'}</div>
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
          <div className="text-sm font-semibold uppercase tracking-[0.2em] opacity-70">Playlist Import</div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onPlaylistSourceChange('spotify')}
              className={playlistSource === 'spotify' ? 'btn px-4 py-2 text-sm' : 'btn-secondary px-4 py-2 text-sm'}
            >
              <span className="flex items-center gap-2">
                <SpotifyLogo size={18} weight="duotone" />
                Spotify Playlist
              </span>
            </button>
            <button
              type="button"
              onClick={() => onPlaylistSourceChange('youtube')}
              className={playlistSource === 'youtube' ? 'btn px-4 py-2 text-sm' : 'btn-secondary px-4 py-2 text-sm'}
            >
              <span className="flex items-center gap-2">
                <YoutubeLogo size={18} weight="duotone" />
                YouTube Playlist
              </span>
            </button>
            <button
              type="button"
              onClick={() => onPlaylistSourceChange('manual')}
              className={playlistSource === 'manual' ? 'btn px-4 py-2 text-sm' : 'btn-secondary px-4 py-2 text-sm'}
            >
              Manual List
            </button>
          </div>

          {(playlistSource === 'spotify' || playlistSource === 'youtube') && (
            <div className="space-y-3">
              <label className="block font-semibold">
                {playlistSource === 'spotify' ? 'Spotify Playlist URL' : 'YouTube Playlist URL'}
              </label>
              <div className="flex gap-3">
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
              <label className="block font-semibold">Manual Song List</label>
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
              <div className="text-sm font-semibold uppercase tracking-[0.2em] opacity-70">
                Recommended Playlists
              </div>
              <div className="grid md:grid-cols-2 gap-2">
                {recommended.map((item) => (
                  <button
                    key={item.url}
                    type="button"
                    onClick={() => onPlaylistUrlChange(item.url)}
                    className="text-left px-3 py-2 rounded-lg border text-sm hover:bg-[var(--card-hover)] transition-colors"
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
