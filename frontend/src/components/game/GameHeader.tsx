import { ReactNode } from "react";

interface GameHeaderProps {
  modeIcon: ReactNode;
  modeLabel: string;
  accentColor: string;
  roomCode: string;
  round?: number;
  totalRounds?: number;
  rightContent?: ReactNode;
}

export default function GameHeader({
  modeIcon,
  modeLabel,
  accentColor,
  roomCode,
  rightContent,
}: GameHeaderProps) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-3 mb-2">
          {modeIcon}
          <h1
            className="text-3xl font-extrabold uppercase tracking-[0.22em]"
            style={{ color: accentColor }}
          >
            {modeLabel}
          </h1>
        </div>
        <div className="text-sm opacity-60">
          Room Code:{" "}
          <span className="font-mono font-bold text-2xl">{roomCode}</span>
        </div>
      </div>
      {rightContent ? (
        <div className="flex flex-wrap items-center gap-3">{rightContent}</div>
      ) : null}
    </div>
  );
}
