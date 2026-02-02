import { useMemo } from 'react';
import Image from 'next/image';
import { CheckCircle, XCircle, WarningCircle } from 'phosphor-react';
import { GameMode, GameState } from '@/types/game';

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
    <div className="card text-center py-6">
      {roundLabel && (
        <div className="flex justify-center mb-4">
          <div
            className="px-4 py-1 rounded-full text-xs font-semibold uppercase tracking-widest"
            style={{ border: '1px solid var(--border)', backgroundColor: 'var(--card-hover)' }}
          >
            {roundLabel}
          </div>
        </div>
      )}
      <h2 className="text-2xl font-bold mb-4">Round Complete!</h2>

      {/* Song info - horizontal layout with album art on left */}
      <div className="flex items-center justify-center gap-4 mb-4">
        {gameState.correctAnswer?.albumArtUrl && (
          <Image
            src={gameState.correctAnswer.albumArtUrl}
            alt={`${gameState.correctAnswer.title || 'Album art'}`}
            width={80}
            height={80}
            className="w-20 h-20 rounded-lg shadow-lg object-cover border flex-shrink-0"
            style={{ borderColor: 'var(--border)' }}
            unoptimized
          />
        )}
        <div className="text-left">
          <div className="text-xl font-semibold">{gameState.correctAnswer?.title || 'Unknown Title'}</div>
          <div className="text-base opacity-80">{gameState.correctAnswer?.artist || 'Unknown Artist'}</div>
        </div>
      </div>
      {mode === 'finish-lyrics' && gameState.correctAnswer?.lyric && (
        <div className="mb-4">
          <div className="text-sm uppercase tracking-widest opacity-60 mb-1">Correct Lyric</div>
          <div className="text-lg font-semibold">{gameState.correctAnswer.lyric}</div>
        </div>
      )}

      {/* Guess mode player results - compact grid */}
      {(mode === 'guess-song-easy' || mode === 'guess-song-challenge') && sortedPlayerScores.length > 0 && (
        <div className="mt-4 text-left">
          <div className="text-xs uppercase tracking-widest opacity-60 text-center mb-2">Player Results</div>
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
                  className="rounded-lg border px-3 py-2"
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
                      <div className="text-sm font-bold" style={{ color: 'var(--primary)' }}>
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
          <div className="text-xs uppercase tracking-widest opacity-60 mb-2">Player Answers</div>
          <div className="space-y-1">
            {sortedLyricAnswers.map((entry) => (
              <div
                key={entry.username}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border text-left"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="font-semibold text-sm min-w-0 flex-shrink-0">{entry.displayName || entry.username}</div>
                <div className="text-sm opacity-80 truncate flex-1">{entry.answer || '—'}</div>
                <div className="font-bold text-sm flex-shrink-0" style={{ color: 'var(--primary)' }}>
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
