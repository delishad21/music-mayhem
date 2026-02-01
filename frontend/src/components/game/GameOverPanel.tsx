import { ReactNode } from 'react';
import { Trophy } from 'phosphor-react';
import { PlayerScore } from '@/types/game';

interface GameOverPanelProps {
  finalScores: PlayerScore[];
  topThree: PlayerScore[];
  remainingScores: PlayerScore[];
  isHost: boolean;
  hostSetupPanel: ReactNode;
  onPlayAgain: () => void;
  onBackHome: () => void;
}

export default function GameOverPanel({
  finalScores,
  topThree,
  remainingScores,
  isHost,
  hostSetupPanel,
  onPlayAgain,
  onBackHome,
}: GameOverPanelProps) {
  return (
    <div className="card py-10">
      <div className="text-center mb-10">
        <div className="flex justify-center mb-4">
          <Trophy size={48} weight="duotone" />
        </div>
        <h2 className="text-4xl font-bold mb-2">Game Over!</h2>
        <p className="opacity-70">Final scores</p>
      </div>

      {finalScores.length > 0 && (
        <div className="space-y-8">
          <div className="grid md:grid-cols-3 gap-4 text-center">
            {topThree.map((player, index) => {
              const rank = index + 1;
              const podiumColors = ['#d4af37', '#c0c0c0', '#cd7f32'];
              return (
                <div
                  key={`${player.username}-${rank}`}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--card)',
                  }}
                >
                  <div className="text-sm uppercase tracking-widest opacity-60">#{rank}</div>
                  <div className="text-3xl font-bold mt-2" style={{ color: podiumColors[index] }}>
                    {player.displayName || player.username}
                  </div>
                  <div className="text-lg opacity-80 mt-1">{player.score} pts</div>
                </div>
              );
            })}
          </div>

          {remainingScores.length > 0 && (
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="text-sm uppercase tracking-widest opacity-60 mb-3">Leaderboard</div>
              <div className="space-y-2">
                {remainingScores.map((player, index) => (
                  <div
                    key={`${player.username}-${index}`}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="font-semibold">
                      {index + 4}. {player.displayName || player.username}
                    </div>
                    <div className="opacity-70">{player.score} pts</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isHost && (
        <div className="mt-10">
          <h3 className="text-xl font-bold text-center mb-4">Set Up Next Game</h3>
          {hostSetupPanel}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3 mt-10">
        {isHost && (
          <button onClick={onPlayAgain} className="btn">
            Play Again
          </button>
        )}
        <button onClick={onBackHome} className="btn-secondary">
          Back to Home
        </button>
      </div>
    </div>
  );
}
