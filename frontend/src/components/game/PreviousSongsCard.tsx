import Image from 'next/image';
import { MusicNote, SkipForward } from 'phosphor-react';
import { GameState } from '@/types/game';

interface PreviousSongsCardProps {
  previousSongs?: GameState['previousSongs'];
}

export default function PreviousSongsCard({ previousSongs = [] }: PreviousSongsCardProps) {
  const shouldScroll = previousSongs.length > 10;

  return (
    <div className="card">
      <h3 className="text-xl font-bold mb-4">Previous Songs</h3>
      {previousSongs.length === 0 ? (
        <div className="text-sm opacity-60">No rounds completed yet.</div>
      ) : (
        <div className={shouldScroll ? 'max-h-[60vh] overflow-y-auto pr-2 space-y-3' : 'space-y-3'}>
          {previousSongs.map((entry, index) => {
            const skippedLabel =
              entry.skippedCount && entry.skippedCount > 1
                ? `Skipped ${entry.skippedCount} songs`
                : entry.skipped
                  ? 'Skipped'
                  : null;

            return (
              <div
                key={`${entry.timestamp ?? index}-${entry.title ?? 'song'}`}
                className="flex gap-3 items-center p-3 rounded-lg border"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card-hover)' }}
              >
                {entry.albumArtUrl ? (
                  <Image
                    src={entry.albumArtUrl}
                    alt={entry.title || 'Album art'}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-lg object-cover border"
                    style={{ borderColor: 'var(--border)' }}
                    unoptimized
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center border"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <MusicNote size={20} weight="duotone" />
                  </div>
                )}

                <div className="flex-1">
                  <div className="font-semibold">
                    {entry.title || (entry.skippedCount ? 'Skipped songs' : 'Unknown Song')}
                  </div>
                  <div className="text-xs opacity-70">
                    {entry.artist || entry.reason || '—'}
                  </div>
                </div>

                <div className="text-right">
                  {skippedLabel ? (
                    <div className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-yellow-600">
                      <SkipForward size={14} weight="duotone" />
                      {skippedLabel}
                    </div>
                  ) : (
                    <div className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
                      +{entry.roundScore ?? 0}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
