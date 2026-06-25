import { useMemo } from 'react';
import Image from 'next/image';
import { CheckCircle, MusicNote, Trophy, XCircle, WarningCircle } from 'phosphor-react';
import { GameMode, GameState } from '@/types/game';
import PanelHeading from './PanelHeading';

interface ResultsPanelProps {
  mode: GameMode;
  gameState: GameState;
  roundLabel?: string;
}

export default function ResultsPanel({ mode, gameState, roundLabel }: ResultsPanelProps) {
  const sortedPlayerScores = useMemo(() => {
    if (!gameState.playerScores) return [];
    return [...gameState.playerScores].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }, [gameState.playerScores]);

  const sortedLyricAnswers = useMemo(() => {
    if (!gameState.lyricAnswers) return [];
    return [...gameState.lyricAnswers].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }, [gameState.lyricAnswers]);

  return (
    <div className="game-segment game-segment-tint text-center py-6">
      {roundLabel && (
        <div className="flex justify-center mb-4">
          <div className="mode-chip">{roundLabel}</div>
        </div>
      )}
      <div className="mb-4 flex justify-center">
        <PanelHeading icon={<Trophy size={16} weight="duotone" />} title="Round Complete" />
      </div>

      {mode === 'finish-lyrics' ? (
        <div className="mb-4 overflow-hidden border text-left" style={{ borderColor: 'var(--border)' }}>
          <div className="flex min-w-0 items-stretch">
            {gameState.correctAnswer?.albumArtUrl ? (
              <Image
                src={gameState.correctAnswer.albumArtUrl}
                alt={`${gameState.correctAnswer.title || 'Album art'}`}
                width={180}
                height={180}
                className="h-36 w-36 flex-shrink-0 object-cover md:h-44 md:w-44"
                unoptimized
              />
            ) : (
              <div className="flex h-36 w-36 flex-shrink-0 items-center justify-center border-r md:h-44 md:w-44" style={{ borderColor: 'var(--border)' }}>
                <MusicNote size={42} weight="duotone" />
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col justify-end bg-[color-mix(in_srgb,var(--mode-accent)_9%,transparent)] p-4">
              <div className="eyebrow mb-2">Correct Song</div>
              <div className="display-heading truncate text-4xl font-extrabold leading-none md:text-5xl">
                {gameState.correctAnswer?.title || 'Unknown Title'}
              </div>
              <div className="mt-1 text-lg text-white">{gameState.correctAnswer?.artist || 'Unknown Artist'}</div>
            </div>
          </div>
          <div className="relative border-t p-5 text-left" style={{ borderColor: 'var(--border)' }}>
            <div className="absolute inset-x-0 top-0 h-1 bg-[var(--mode-accent)]" />
            <div className="eyebrow mb-3">Correct Lyric</div>
            <div className="text-2xl font-semibold leading-snug text-white md:text-3xl">
              {gameState.correctAnswer?.lyric || '—'}
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-4 overflow-hidden border text-left" style={{ borderColor: 'var(--border)' }}>
          <div className="flex min-w-0 items-stretch">
          {gameState.correctAnswer?.albumArtUrl ? (
            <Image
              src={gameState.correctAnswer.albumArtUrl}
              alt={`${gameState.correctAnswer.title || 'Album art'}`}
              width={180}
              height={180}
              className="h-36 w-36 flex-shrink-0 object-cover md:h-44 md:w-44"
              unoptimized
            />
          ) : (
            <div className="flex h-36 w-36 flex-shrink-0 items-center justify-center border-r md:h-44 md:w-44" style={{ borderColor: 'var(--border)' }}>
              <MusicNote size={42} weight="duotone" />
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col justify-end bg-[color-mix(in_srgb,var(--mode-accent)_9%,transparent)] p-4">
            <div className="eyebrow mb-2">Correct Song</div>
            <div className="display-heading truncate text-4xl font-extrabold leading-none md:text-5xl">
              {gameState.correctAnswer?.title || 'Unknown Title'}
            </div>
            <div className="mt-1 text-lg text-white">{gameState.correctAnswer?.artist || 'Unknown Artist'}</div>
          </div>
          </div>
        </div>
      )}

      {/* Guess mode player results - compact grid */}
      {(mode === 'guess-song-easy' || mode === 'guess-song-challenge') && sortedPlayerScores.length > 0 && (
        <div className="mt-4 text-left">
          <div className="eyebrow mb-2 text-center">Player Results</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {sortedPlayerScores.map((player) => {
              const artistMatchedCount = player.artistMatchedCount ?? 0;
              const artistTotalRaw = player.artistTotal ?? 0;
              const displayArtistTotal = artistTotalRaw > 0 ? artistTotalRaw : (artistMatchedCount > 0 ? artistMatchedCount : 1);
              const hasAnyArtist = artistMatchedCount > 0;
              const hasAllArtists = artistMatchedCount > 0 && artistMatchedCount >= displayArtistTotal;

              return (
                <div
                  key={player.username}
                  className="rounded-[3px] border px-3 py-2"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate">{player.displayName || player.username}</div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-0.5">
                          {player.answeredTitle ? (
                            <CheckCircle size={14} weight="duotone" className="text-green-600" />
                          ) : (
                            <XCircle size={14} weight="duotone" className="text-red-500" />
                          )}
                          Title
                        </span>
                        <span className="inline-flex items-center gap-0.5">
                          {hasAllArtists ? (
                            <CheckCircle size={14} weight="duotone" className="text-green-600" />
                          ) : hasAnyArtist ? (
                            <WarningCircle size={14} weight="duotone" className="text-yellow-500" />
                          ) : (
                            <XCircle size={14} weight="duotone" className="text-red-500" />
                          )}
                          {artistMatchedCount}/{displayArtistTotal}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-mono text-sm font-bold" style={{ color: 'var(--mode-accent)' }}>
                        +{player.roundScore ?? 0}
                      </div>
                      <div className="text-xs opacity-60">{player.score}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Finish lyrics player answers - compact */}
      {mode === 'finish-lyrics' && sortedLyricAnswers.length > 0 && (
        <div className="mt-4">
          <div className="eyebrow mb-2">Player Answers</div>
          <div className="space-y-1.5">
            {sortedLyricAnswers.map((entry) => (
              <div
                key={entry.username}
                className="grid items-stretch gap-2 text-left sm:grid-cols-[9rem_1fr_6rem]"
              >
                <div className="flex min-w-0 items-center text-sm font-semibold">{entry.displayName || entry.username}</div>
                <div
                  className="min-h-11 border px-3 py-2 text-sm font-semibold text-white"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'color-mix(in srgb, var(--foreground) 7%, transparent)' }}
                >
                  {entry.answer || '—'}
                </div>
                <div
                  className="flex min-h-11 w-full items-center justify-center border px-2 font-mono text-sm font-bold"
                  style={{ borderColor: 'color-mix(in srgb, var(--mode-accent) 45%, var(--border))', color: 'var(--mode-accent)' }}
                >
                  {entry.score}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="opacity-60 mt-3 text-sm">Next round starting soon...</p>
    </div>
  );
}
