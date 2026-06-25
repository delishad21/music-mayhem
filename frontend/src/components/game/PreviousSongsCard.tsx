import Image from 'next/image';
import { ClockCounterClockwise, MusicNote, SkipForward } from 'phosphor-react';
import { GameState } from '@/types/game';
import PanelHeading from './PanelHeading';

interface PreviousSongsCardProps {
  previousSongs?: GameState['previousSongs'];
}

export default function PreviousSongsCard({ previousSongs = [] }: PreviousSongsCardProps) {
  const shouldScroll = previousSongs.length > 10;

  return (
    <div className="game-segment">
      <PanelHeading
        className="mb-4"
        icon={<ClockCounterClockwise size={16} weight="duotone" />}
        title="Previous Songs"
        action={<span className="mode-chip">{previousSongs.length}</span>}
      />
      {previousSongs.length === 0 ? (
        <div className="text-sm opacity-60">No rounds completed yet.</div>
      ) : (
        <div className={shouldScroll ? 'max-h-[60vh] space-y-1.5 overflow-y-auto pr-2' : 'space-y-1.5'}>
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
                className="flex h-[68px] items-stretch overflow-hidden border"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card-hover)' }}
              >
                {entry.albumArtUrl ? (
                  <Image
                    src={entry.albumArtUrl}
                    alt={entry.title || 'Album art'}
                    width={76}
                    height={76}
                    className="w-20 flex-shrink-0 self-stretch object-cover"
                    unoptimized
                  />
                ) : (
                  <div
                    className="flex w-20 flex-shrink-0 items-center justify-center border-r"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <MusicNote size={20} weight="duotone" />
                  </div>
                )}

                <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2">
                  <div className="truncate font-semibold leading-tight">
                    {entry.title || (entry.skippedCount ? 'Skipped songs' : 'Unknown Song')}
                  </div>
                  <div className="truncate text-xs opacity-70">
                    {entry.artist || entry.reason || '—'}
                  </div>
                </div>

                <div className="flex w-20 flex-shrink-0 items-center justify-end px-3 text-right">
                  {skippedLabel ? (
                    <div className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-yellow-600">
                      <SkipForward size={14} weight="duotone" />
                      {skippedLabel}
                    </div>
                  ) : (
                    <div className="font-mono text-lg font-bold" style={{ color: 'var(--mode-accent)' }}>
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
