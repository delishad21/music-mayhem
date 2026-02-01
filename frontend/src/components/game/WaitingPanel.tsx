import { ReactNode } from 'react';
interface WaitingPanelProps {
  isHost: boolean;
  hostSetupPanel: ReactNode;
}

export default function WaitingPanel({ isHost, hostSetupPanel }: WaitingPanelProps) {
  return (
    <div className="card py-10">
      <h2 className="text-3xl font-bold mb-3 text-center">Waiting for game to start...</h2>
      <p className="opacity-60 text-center mb-8">
        {isHost
          ? 'Set the game settings, load a playlist and start the game when everyone is ready.'
          : 'The host is setting things up.'}
      </p>

      {hostSetupPanel}
    </div>
  );
}
