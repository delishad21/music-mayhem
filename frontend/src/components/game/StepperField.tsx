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
      <div className="flex items-center gap-3 px-2 py-1 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
        <button
          type="button"
          onClick={() => onChange(clampValue(value - 1))}
          className="w-8 h-8 flex items-center justify-center rounded-md border"
          style={{ borderColor: 'var(--border)' }}
          disabled={value <= min}
        >
          -
        </button>
        <div className="min-w-[36px] text-center font-semibold">{value}</div>
        <button
          type="button"
          onClick={() => onChange(clampValue(value + 1))}
          className="w-8 h-8 flex items-center justify-center rounded-md border"
          style={{ borderColor: 'var(--border)' }}
          disabled={value >= max}
        >
          +
        </button>
      </div>
    </div>
  );
}
