import Image from 'next/image';
import { CheckCircle, XCircle, WarningCircle } from 'phosphor-react';
import { GameMode, GameState } from '@/types/game';

interface ResultsPanelProps {
  mode: GameMode;
  gameState: GameState;
  roundLabel?: string;
}

export default function ResultsPanel({ mode, gameState, roundLabel }: ResultsPanelProps) {
  return (
    <div className="card text-center py-16">
      {roundLabel && (
        <div className="flex justify-center mb-6">
          <div
            className="px-4 py-1 rounded-full text-xs font-semibold uppercase tracking-widest"
            style={{ border: '1px solid var(--border)', backgroundColor: 'var(--card-hover)' }}
          >
            {roundLabel}
          </div>
        </div>
      )}
      <h2 className="text-3xl font-bold mb-4">Round Complete!</h2>
      {gameState.correctAnswer?.albumArtUrl && (
        <div className="flex justify-center mb-6">
          <Image
            src={gameState.correctAnswer.albumArtUrl}
            alt={`${gameState.correctAnswer.title || 'Album art'}`}
            width={128}
            height={128}
            className="w-32 h-32 rounded-xl shadow-lg object-cover border"
            style={{ borderColor: 'var(--border)' }}
            unoptimized
          />
        </div>
      )}
      <div className="mb-6">
        <div className="text-sm uppercase tracking-widest opacity-60 mb-2">Song Info</div>
        <div className="text-2xl font-semibold">{gameState.correctAnswer?.title || 'Unknown Title'}</div>
        <div className="text-lg opacity-80">{gameState.correctAnswer?.artist || 'Unknown Artist'}</div>
      </div>
      {mode === 'finish-lyrics' && gameState.correctAnswer?.lyric && (
        <div className="mb-4">
          <div className="text-sm uppercase tracking-widest opacity-60 mb-2">Correct Lyric</div>
          <div className="text-2xl font-semibold">{gameState.correctAnswer.lyric}</div>
        </div>
      )}
      {(mode === 'guess-song-easy' || mode === 'guess-song-challenge') && gameState.playerScores && (
        <div className="max-w-3xl mx-auto mt-6 space-y-3 text-left">
          <div className="text-sm uppercase tracking-widest opacity-60 text-center">Player Results</div>
          <div className="space-y-3">
            {gameState.playerScores.map((player) => {
              const artistMatchedCount = player.artistMatchedCount ?? 0;
              const artistTotalRaw = player.artistTotal ?? 0;
              const displayArtistTotal = artistTotalRaw > 0 ? artistTotalRaw : (artistMatchedCount > 0 ? artistMatchedCount : 1);
              const hasAnyArtist = artistMatchedCount > 0;
              const hasAllArtists = artistMatchedCount > 0 && artistMatchedCount >= displayArtistTotal;
              const artistLabel = displayArtistTotal <= 1 ? 'Artist' : 'Artists';

              return (
                <div
                  key={player.username}
                  className="rounded-xl border px-4 py-3"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="font-semibold text-lg">{player.displayName || player.username}</div>
                      <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
                        <span className="inline-flex items-center gap-1">
                          {player.answeredTitle ? (
                            <CheckCircle size={18} weight="duotone" className="text-green-600" />
                          ) : (
                            <XCircle size={18} weight="duotone" className="text-red-500" />
                          )}
                          Title
                        </span>
                        <span className="inline-flex items-center gap-1">
                          {hasAllArtists ? (
                            <CheckCircle size={18} weight="duotone" className="text-green-600" />
                          ) : hasAnyArtist ? (
                            <WarningCircle size={18} weight="duotone" className="text-yellow-500" />
                          ) : (
                            <XCircle size={18} weight="duotone" className="text-red-500" />
                          )}
                          {artistLabel} {artistMatchedCount}/{displayArtistTotal}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold" style={{ color: 'var(--primary)' }}>
                        +{player.roundScore ?? 0}
                      </div>
                      <div className="text-xs opacity-60">Total {player.score}</div>
                    </div>
                  </div>

                  {(player.artistMatches?.length || player.artistMisses?.length) ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-2 text-sm">
                      {player.artistMatches?.length ? (
                        <div className="flex flex-col gap-1">
                          <div className="text-xs uppercase tracking-widest opacity-60">Matched</div>
                          <div className="flex flex-wrap gap-2">
                            {player.artistMatches.map((artist) => (
                              <span
                                key={`match-${player.username}-${artist}`}
                                className="px-2 py-1 rounded-full text-green-700 bg-green-500/15 border border-green-500/30"
                              >
                                {artist}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {player.artistMisses?.length ? (
                        <div className="flex flex-col gap-1">
                          <div className="text-xs uppercase tracking-widest opacity-60">Missing</div>
                          <div className="flex flex-wrap gap-2">
                            {player.artistMisses.map((artist) => (
                              <span
                                key={`miss-${player.username}-${artist}`}
                                className="px-2 py-1 rounded-full text-red-600 bg-red-500/10 border border-red-500/30"
                              >
                                {artist}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {mode === 'finish-lyrics' && gameState.lyricAnswers && (
        <div className="max-w-2xl mx-auto mt-6 space-y-3">
          <div className="text-sm uppercase tracking-widest opacity-60">Player Answers</div>
          <div className="space-y-2">
            {gameState.lyricAnswers.map((entry) => (
              <div
                key={entry.username}
                className="flex flex-col gap-1 p-3 rounded-lg border text-left"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{entry.displayName || entry.username}</div>
                  <div className="font-bold" style={{ color: 'var(--primary)' }}>
                    {entry.score}
                  </div>
                </div>
                <div className="text-sm opacity-80 whitespace-pre-wrap">{entry.answer || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="opacity-60 mt-4">Next round starting soon...</p>
    </div>
  );
}
