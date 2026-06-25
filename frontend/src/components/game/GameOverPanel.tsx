import { Trophy } from 'phosphor-react';
import { PlayerScore } from '@/types/game';

interface GameOverPanelProps {
  finalScores: PlayerScore[];
  topThree: PlayerScore[];
  remainingScores: PlayerScore[];
  isHost: boolean;
  onPlayAgain: () => void;
  onBackHome: () => void;
}

export default function GameOverPanel({
  finalScores,
  topThree,
  remainingScores,
  isHost,
  onPlayAgain,
  onBackHome,
}: GameOverPanelProps) {
  return (
    <div className="game-segment game-segment-tint py-10">
      <div className="text-center mb-10">
        <div className="flex justify-center mb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-[3px] border" style={{ borderColor: 'color-mix(in srgb, var(--mode-accent) 38%, var(--border))', color: 'var(--mode-accent)' }}>
            <Trophy size={32} weight="duotone" />
          </div>
        </div>
        <h2 className="display-heading mb-2 text-5xl font-extrabold uppercase leading-none">Game Over</h2>
        <p className="eyebrow">Final scores</p>
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
                  className="rounded-[3px] border p-4"
                  style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--card)',
                  }}
                >
                  <div className="eyebrow">#{rank}</div>
                  <div className="display-heading mt-2 text-3xl font-bold" style={{ color: podiumColors[index] }}>
                    {player.displayName || player.username}
                  </div>
                  <div className="text-lg opacity-80 mt-1">{player.score} pts</div>
                </div>
              );
            })}
          </div>

          {remainingScores.length > 0 && (
            <div className="rounded-[3px] border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
              <div className="eyebrow mb-3">Leaderboard</div>
              <div className="space-y-2">
                {remainingScores.map((player, index) => (
                  <div
                    key={`${player.username}-${index}`}
                    className="flex items-center justify-between rounded-[3px] border px-3 py-2"
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
