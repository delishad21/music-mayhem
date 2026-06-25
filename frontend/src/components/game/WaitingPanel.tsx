import { ReactNode } from 'react';
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
    <div className="card py-10">
      {!isHost && (
        <>
          <h2 className="text-3xl font-bold mb-3 text-center">Waiting for game to start...</h2>
          <div
            className="max-w-2xl mx-auto mb-8 rounded-lg border px-4 py-4 text-center font-semibold"
            style={{
              borderColor: 'var(--primary)',
              backgroundColor: 'rgba(66, 133, 244, 0.08)',
            }}
          >
            {playerStatus}
            {playlistPreparing && !firstSongReady ? (
              <span className="ml-2 text-xs uppercase tracking-widest opacity-70">Loading</span>
            ) : null}
          </div>
        </>
      )}

      {hostSetupPanel}
    </div>
  );
}
