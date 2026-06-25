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
    <div className="relative mb-6 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <div className="flex items-center justify-center" style={{ color: accentColor }}>
              {modeIcon}
            </div>
            <h1
              className="display-heading text-3xl font-extrabold uppercase leading-none md:text-4xl"
              style={{ color: accentColor }}
            >
              {modeLabel}
            </h1>
          </div>
          <div className="eyebrow">
            Room Code{" "}
            <span className="ml-2 text-lg font-bold opacity-100" style={{ color: accentColor }}>
              {roomCode}
            </span>
          </div>
        </div>
        {rightContent ? (
          <div className="flex flex-wrap items-center justify-end gap-2">{rightContent}</div>
        ) : null}
      </div>
      <div
        className="absolute bottom-0 left-1/2 h-px w-screen -translate-x-1/2"
        style={{ backgroundColor: accentColor }}
      />
    </div>
  );
}
