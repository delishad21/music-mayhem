import { GameState } from '@/types/game';
import { CloudArrowDown } from 'phosphor-react';
import PanelHeading from './PanelHeading';

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
    <div className="game-segment game-segment-tint py-10">
      {roundLabel && (
        <div className="flex justify-center mb-6">
          <div className="mode-chip">{roundLabel}</div>
        </div>
      )}
      <div className="text-center mb-8">
        <div className="eyebrow mb-2">Preparing</div>
        <div className="mb-2 flex justify-center">
          <PanelHeading icon={<CloudArrowDown size={16} weight="duotone" />} title="Loading Song" />
        </div>
        <p className="opacity-70">
          {loadingMessage || 'Loading song and syncing lyrics.'}
        </p>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm opacity-70 mb-2">
          <span>Preparing song</span>
          <span>{Math.round(loadingProgress * 100)}%</span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill duration-200"
            style={{
              width: `${Math.round(loadingProgress * 100)}%`,
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
        <div className="mb-4 flex flex-wrap justify-center gap-2 text-sm">
          <span className="mode-chip">Ready {queueStatus.ready}</span>
          <span className="mode-chip">Loading {queueLoadingCount}</span>
          <span className="mode-chip">Failed {queueStatus.failed}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-[3px] bg-red-500 bg-opacity-20 text-red-500 border border-red-500">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
