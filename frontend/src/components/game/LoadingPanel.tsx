import { GameState } from '@/types/game';

interface LoadingPanelProps {
  loadingMessage?: string;
  loadingProgress: number;
  loadingSecondsLeft: number;
  queueStatus?: GameState['queueStatus'];
  queueLoadingCount: number;
  errorMessage?: string;
  roundLabel?: string;
}

export default function LoadingPanel({
  loadingMessage,
  loadingProgress,
  loadingSecondsLeft,
  queueStatus,
  queueLoadingCount,
  errorMessage,
  roundLabel,
}: LoadingPanelProps) {
  return (
    <div className="card py-12 max-w-3xl mx-auto">
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
      <div className="text-center mb-8">
        <div className="text-5xl mb-4">⏳</div>
        <h2 className="text-3xl font-bold mb-2">Loading Song...</h2>
        <p className="opacity-70">
          {loadingMessage || 'Loading song and syncing lyrics.'}
        </p>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm opacity-70 mb-2">
          <span>Preparing song</span>
          <span>{Math.round(loadingProgress * 100)}%</span>
        </div>
        <div className="w-full bg-gray-300 dark:bg-gray-700 h-3 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-200"
            style={{
              width: `${Math.round(loadingProgress * 100)}%`,
              backgroundColor: 'var(--primary)',
            }}
          />
        </div>
        {loadingSecondsLeft > 0 && (
          <div className="text-xs opacity-60 mt-2 text-right">
            Up to ~{loadingSecondsLeft}s remaining
          </div>
        )}
      </div>

      {queueStatus && (
        <div className="text-sm opacity-70 mb-4 text-center">
          Ready: {queueStatus.ready} • Loading: {queueLoadingCount} • Failed: {queueStatus.failed}
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-500 bg-opacity-20 text-red-500 border border-red-500">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
