interface StepperFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export default function StepperField({
  label,
  value,
  min,
  max,
  onChange,
}: StepperFieldProps) {
  const clampValue = (next: number) => Math.min(max, Math.max(min, next));

  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="font-semibold">{label}</span>
      <div className="flex items-center gap-2 rounded-[3px] border p-1" style={{ borderColor: 'var(--border)' }}>
        <button
          type="button"
          onClick={() => onChange(clampValue(value - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-[3px] border transition-colors hover:bg-[var(--card-hover)]"
          style={{ borderColor: 'var(--border)' }}
          disabled={value <= min}
        >
          -
        </button>
        <div className="min-w-[36px] text-center font-mono font-semibold" style={{ color: 'var(--mode-accent)' }}>{value}</div>
        <button
          type="button"
          onClick={() => onChange(clampValue(value + 1))}
          className="flex h-8 w-8 items-center justify-center rounded-[3px] border transition-colors hover:bg-[var(--card-hover)]"
          style={{ borderColor: 'var(--border)' }}
          disabled={value >= max}
        >
          +
        </button>
      </div>
    </div>
  );
}
