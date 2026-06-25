import { ReactNode } from 'react';
import { HourglassMedium } from 'phosphor-react';
import PanelHeading from './PanelHeading';

interface WaitingPanelProps {
  isHost: boolean;
  hostSetupPanel: ReactNode;
  hasPlaylist: boolean;
  playlistPreparing?: boolean;
  firstSongReady: boolean;
}

export default function WaitingPanel({
  isHost,
  hostSetupPanel,
  hasPlaylist,
  playlistPreparing,
  firstSongReady,
}: WaitingPanelProps) {
  const playerStatus = (() => {
    if (!hasPlaylist) return 'Waiting for host to load a playlist';
    if (!firstSongReady) return 'Waiting for the first song to finish downloading';
    return 'Waiting for host to start the game';
  })();

  return (
    <div className="game-segment game-segment-tint py-8">
      {!isHost && (
        <>
          <div className="mb-3 text-center">
            <div className="eyebrow mb-2">Lobby Status</div>
            <div className="flex justify-center">
              <PanelHeading icon={<HourglassMedium size={16} weight="duotone" />} title="Waiting" />
            </div>
          </div>
          <div
            className="mx-auto mb-8 max-w-2xl rounded-[3px] border px-5 py-5 text-center text-lg font-semibold"
            style={{
              borderColor: 'color-mix(in srgb, var(--mode-accent) 40%, var(--border))',
              backgroundColor: 'color-mix(in srgb, var(--mode-accent) 10%, transparent)',
            }}
          >
            {playerStatus}
            {playlistPreparing && !firstSongReady ? (
              <span className="mode-chip ml-2 align-middle">Loading</span>
            ) : null}
          </div>
        </>
      )}

      {hostSetupPanel}
    </div>
  );
}
