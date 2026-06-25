import { ReactNode } from "react";

interface GameModeCardProps {
  title: string;
  tagline?: string;
  tag?: string;
  description: string;
  accentColor: string;
  hoverTint: string;
  icon: ReactNode;
  onClick: () => void;
}

export default function GameModeCard({
  title,
  tagline,
  tag,
  description,
  accentColor,
  hoverTint,
  icon,
  onClick,
}: GameModeCardProps) {
  return (
    <button
      onClick={onClick}
      className="group separator-panel mode-card cursor-pointer text-left"
      style={{
        borderColor: `color-mix(in srgb, ${accentColor} 38%, var(--border))`,
        background: 'var(--card)',
        ["--mode-accent" as any]: accentColor,
        ["--card-hover-tint" as any]: hoverTint,
      }}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center border"
          style={{
            color: accentColor,
            background: hoverTint,
            borderColor: `color-mix(in srgb, ${accentColor} 44%, transparent)`,
          }}
        >
          {icon}
        </div>
      </div>
      <div
        className="display-heading mb-1 text-2xl font-extrabold uppercase leading-none"
        style={{ color: accentColor }}
      >
        {title}
      </div>
      {tagline ? (
        <div className="mb-4 text-sm italic" style={{ color: accentColor }}>
          {tagline}
        </div>
      ) : null}
      <p className="text-sm leading-relaxed opacity-70">{description}</p>
    </button>
  );
}
