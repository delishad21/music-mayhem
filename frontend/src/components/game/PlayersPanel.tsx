import { useEffect, useMemo } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { CheckCircle, Crown, Users, User, XCircle, WarningCircle } from 'phosphor-react';
import { GameMode, Player } from '@/types/game';
import PanelHeading from './PanelHeading';

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

function AnimatedScore({ value }: { value: number }) {
  const scoreValue = useMotionValue(value);
  const roundedScore = useTransform(scoreValue, latest => Math.round(latest).toLocaleString());

  useEffect(() => {
    const controls = animate(scoreValue, value, {
      duration: 0.55,
      ease: 'easeOut',
    });

    return () => controls.stop();
  }, [scoreValue, value]);

  return <motion.span>{roundedScore}</motion.span>;
}

export default function PlayersPanel({ players, mode, playerAnswerStatus, showStatusBorders = true }: PlayersPanelProps) {
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const scoreDelta = (b.score ?? 0) - (a.score ?? 0);
      if (scoreDelta !== 0) return scoreDelta;
      return a.joinedAt - b.joinedAt;
    });
  }, [players]);

  return (
    <div className="game-segment">
      <PanelHeading
        className="mb-4"
        icon={<Users size={16} weight="duotone" />}
        title="Players"
        action={<span className="mode-chip">{players.length}</span>}
      />
      <div className="flex flex-col gap-1.5">
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
              layout="position"
              initial={false}
              transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.8 }}
              className="flex items-center justify-between gap-2 border px-2.5 py-2"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--mode-accent) 7%, var(--card))',
                borderColor: showStatusBorders ? borderColor : 'rgba(255, 255, 255, 0.35)',
              }}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span style={{ color: player.isHost ? 'var(--mode-accent)' : undefined }}>
                    {player.isHost ? (
                      <Crown size={18} weight="duotone" />
                    ) : (
                      <User size={18} weight="duotone" />
                    )}
                  </span>
                  <span className="truncate font-semibold">{displayName}</span>
                  {player.isSpectator && (
                    <span className="text-xs px-2 py-0.5 rounded-[3px] border border-yellow-500 text-yellow-600">
                      Spectating
                    </span>
                  )}
                  {player.isTyping && <span className="text-xs italic opacity-60">typing...</span>}
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

              <span className="self-center font-mono text-lg font-bold" style={{ color: 'var(--mode-accent)' }}>
                <AnimatedScore value={player.score ?? 0} />
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
