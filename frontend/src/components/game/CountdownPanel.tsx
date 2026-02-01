interface CountdownPanelProps {
  countdownLeft: number;
  countdownMs?: number;
  roundLabel?: string;
}

export default function CountdownPanel({ countdownLeft, countdownMs, roundLabel }: CountdownPanelProps) {
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
      <div className="text-6xl font-bold mb-4">
        {Math.max(0, Math.ceil(countdownLeft))}s
      </div>
      <div className="text-lg opacity-70 mb-6">Get ready...</div>
      <div className="w-full bg-gray-300 dark:bg-gray-700 h-2 rounded-full mt-2 overflow-hidden">
        <div
          className="h-full transition-all duration-100"
          style={{
            width: `${
              countdownMs ? (countdownLeft / (countdownMs / 1000)) * 100 : 0
            }%`,
            backgroundColor: 'var(--primary)',
          }}
        />
      </div>
    </div>
  );
}
