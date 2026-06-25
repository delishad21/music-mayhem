interface CountdownPanelProps {
  countdownLeft: number;
  countdownMs?: number;
  roundLabel?: string;
}

export default function CountdownPanel({ countdownLeft, countdownMs, roundLabel }: CountdownPanelProps) {
  return (
    <div className="game-segment game-segment-tint text-center py-14">
      {roundLabel && (
        <div className="flex justify-center mb-6">
          <div className="mode-chip">{roundLabel}</div>
        </div>
      )}
      <div className="display-heading mb-2 text-7xl font-extrabold" style={{ color: 'var(--mode-accent)' }}>
        {Math.max(0, Math.ceil(countdownLeft))}s
      </div>
      <div className="eyebrow mb-6">Get ready</div>
      <div className="progress-track mt-2">
        <div
          className="progress-fill duration-100"
          style={{
            width: `${
              countdownMs ? (countdownLeft / (countdownMs / 1000)) * 100 : 0
            }%`,
          }}
        />
      </div>
    </div>
  );
}
