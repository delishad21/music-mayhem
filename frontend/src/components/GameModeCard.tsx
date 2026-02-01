import { ReactNode } from "react";

interface GameModeCardProps {
  title: string;
  description: string;
  accentColor: string;
  hoverTint: string;
  icon: ReactNode;
  onClick: () => void;
}

export default function GameModeCard({
  title,
  description,
  accentColor,
  hoverTint,
  icon,
  onClick,
}: GameModeCardProps) {
  return (
    <button
      onClick={onClick}
      className="card mode-card cursor-pointer text-center p-8"
      style={{
        borderColor: accentColor,
        ["--card-hover-tint" as any]: hoverTint,
      }}
    >
      <div
        className="flex items-center justify-center gap-3 mb-5"
        style={{ color: accentColor }}
      >
        {icon}
      </div>
      <div
        className="text-lg font-extrabold uppercase tracking-[0.22em] mb-3"
        style={{ color: accentColor }}
      >
        {title}
      </div>
      <p className="text-lg opacity-80">{description}</p>
    </button>
  );
}
