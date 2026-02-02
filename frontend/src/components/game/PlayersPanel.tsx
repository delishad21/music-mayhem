import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Crown, User, XCircle, WarningCircle } from 'phosphor-react';
import { GameMode, Player } from '@/types/game';

interface PlayersPanelProps {
  players: Player[];
  mode: GameMode;
  playerAnswerStatus?: Record<
    string,
    {
      titleAnswered?: boolean;
      artistMatchedCount?: number;
      artistTotal?: number;
      lyricAnswered?: boolean;
    }
  >;
  showStatusBorders?: boolean;
}

export default function PlayersPanel({ players, mode, playerAnswerStatus, showStatusBorders = true }: PlayersPanelProps) {
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }, [players]);

  return (
    <div className="card">
      <h3 className="text-xl font-bold mb-4">Players ({players.length})</h3>
      <div className="flex flex-col gap-3">
        {sortedPlayers.map((player) => {
          const displayName = player.displayName || player.username;
          const status = playerAnswerStatus?.[player.id];
          const showFinishLyrics = mode === 'finish-lyrics';
          const showGuessStatus = mode !== 'finish-lyrics';

          const titleAnswered = status?.titleAnswered ?? false;
          const artistMatchedCount = status?.artistMatchedCount ?? 0;
          const artistTotal = status?.artistTotal ?? 0;
          const lyricAnswered = status?.lyricAnswered ?? player.hasAnswered ?? false;

          const hasAnyArtist = artistMatchedCount > 0;
          const displayArtistTotal = artistTotal > 0 ? artistTotal : (hasAnyArtist ? artistMatchedCount : 1);
          const hasAllArtists = artistMatchedCount > 0 && artistMatchedCount >= displayArtistTotal;

          const borderColor = showFinishLyrics
            ? lyricAnswered
              ? 'rgba(34, 197, 94, 1)'
              : 'rgba(239, 68, 68, 1)'
            : titleAnswered && hasAllArtists
              ? 'rgba(16, 185, 129, 1)'
              : titleAnswered
                ? 'rgba(34, 197, 94, 1)'
                : hasAnyArtist
                  ? 'rgba(251, 188, 5, 1)'
                  : 'rgba(239, 68, 68, 1)';

          return (
            <motion.div
              key={player.id}
              layout
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="flex justify-between items-center gap-3 p-3 rounded-lg border-2"
              style={{
                backgroundColor: 'var(--card-hover)',
                borderColor: showStatusBorders ? borderColor : 'rgba(255, 255, 255, 0.35)',
              }}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className={player.isHost ? 'text-xl' : ''}>
                    {player.isHost ? (
                      <Crown size={18} weight="duotone" />
                    ) : (
                      <User size={18} weight="duotone" />
                    )}
                  </span>
                  <span className="font-semibold">{displayName}</span>
                  {player.isSpectator && (
                    <span className="text-xs px-2 py-0.5 rounded-full border border-yellow-500 text-yellow-600">
                      Spectating
                    </span>
                  )}
                  {player.isTyping && <span className="text-sm opacity-60">typing...</span>}
                </div>

                {showStatusBorders && showFinishLyrics && (
                  <div className="text-xs uppercase tracking-widest opacity-70 flex items-center gap-2">
                    {lyricAnswered ? (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <CheckCircle size={14} weight="duotone" />
                        Submitted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-500">
                        <XCircle size={14} weight="duotone" />
                        Not submitted
                      </span>
                    )}
                  </div>
                )}

                {showStatusBorders && showGuessStatus && (
                  <div className="text-xs uppercase tracking-widest opacity-70 flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      {titleAnswered ? (
                        <CheckCircle size={14} weight="duotone" className="text-green-600" />
                      ) : (
                        <XCircle size={14} weight="duotone" className="text-red-500" />
                      )}
                      Title
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {hasAllArtists ? (
                        <CheckCircle size={14} weight="duotone" className="text-green-600" />
                      ) : hasAnyArtist ? (
                        <WarningCircle size={14} weight="duotone" className="text-yellow-500" />
                      ) : (
                        <XCircle size={14} weight="duotone" className="text-red-500" />
                      )}
                      {displayArtistTotal <= 1 ? 'Artist' : 'Artists'} {artistMatchedCount}/{displayArtistTotal}
                    </span>
                  </div>
                )}
              </div>

              <span className="font-bold self-center" style={{ color: 'var(--primary)' }}>
                {player.score}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
