import type { ReactNode } from 'react';
import { GameMode } from '@/types/game';
import StepperField from '@/components/game/StepperField';
import { Clock, Eye, GearSix, Translate } from 'phosphor-react';

interface SettingsCardProps {
  mode: GameMode;
  roundCountdownSec: number;
  resultsDelaySec: number;
  guessClipDurationSec: number;
  lyricAnswerTimeSec: number;
  maxRounds: number;
  allowJoinInProgress: boolean;
  allowChineseVariants: boolean;
  shufflePlaylist: boolean;
  convertChineseLyrics: 'none' | 't2s' | 's2t';
  revealNumbers: boolean;
  revealKorean: boolean;
  revealJapanese: boolean;
  revealChinese: boolean;
  revealVietnamese: boolean;
  revealSpanish: boolean;
  onRoundCountdownChange: (value: number) => void;
  onResultsDelayChange: (value: number) => void;
  onGuessClipDurationChange: (value: number) => void;
  onLyricAnswerTimeChange: (value: number) => void;
  onMaxRoundsChange: (value: number) => void;
  onAllowJoinInProgressChange: (value: boolean) => void;
  onAllowChineseVariantsChange: (value: boolean) => void;
  onShufflePlaylistChange: (value: boolean) => void;
  onConvertChineseLyricsChange: (value: 'none' | 't2s' | 's2t') => void;
  onRevealNumbersChange: (value: boolean) => void;
  onRevealKoreanChange: (value: boolean) => void;
  onRevealJapaneseChange: (value: boolean) => void;
  onRevealChineseChange: (value: boolean) => void;
  onRevealVietnameseChange: (value: boolean) => void;
  onRevealSpanishChange: (value: boolean) => void;
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-t pt-4 first:border-t-0 first:pt-0" style={{ borderColor: 'var(--border)' }}>
      <div className="eyebrow mb-3 flex items-center gap-2">
        {icon}
        {title}
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 border px-3 py-2.5 text-sm transition-colors hover:bg-[var(--card-hover)]" style={{ borderColor: 'var(--border)' }}>
      <input
        type="checkbox"
        className="mt-0.5 accent-[var(--mode-accent)]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0">
        <span className="font-semibold leading-tight">{label}</span>
        {description ? <span className="mt-0.5 block text-xs opacity-60">{description}</span> : null}
      </span>
    </label>
  );
}

export default function SettingsCard({
  mode,
  roundCountdownSec,
  resultsDelaySec,
  guessClipDurationSec,
  lyricAnswerTimeSec,
  maxRounds,
  allowJoinInProgress,
  allowChineseVariants,
  shufflePlaylist,
  convertChineseLyrics,
  revealNumbers,
  revealKorean,
  revealJapanese,
  revealChinese,
  revealVietnamese,
  revealSpanish,
  onRoundCountdownChange,
  onResultsDelayChange,
  onGuessClipDurationChange,
  onLyricAnswerTimeChange,
  onMaxRoundsChange,
  onAllowJoinInProgressChange,
  onAllowChineseVariantsChange,
  onShufflePlaylistChange,
  onConvertChineseLyricsChange,
  onRevealNumbersChange,
  onRevealKoreanChange,
  onRevealJapaneseChange,
  onRevealChineseChange,
  onRevealVietnameseChange,
  onRevealSpanishChange,
}: SettingsCardProps) {
  return (
    <div className="space-y-5">
      <Section title="Round Flow" icon={<Clock size={14} weight="duotone" />}>
        <div className="grid gap-3 md:grid-cols-2">
          <StepperField
            label="Countdown"
            value={roundCountdownSec}
            min={0}
            max={15}
            onChange={onRoundCountdownChange}
          />
          <StepperField
            label="Results duration"
            value={resultsDelaySec}
            min={2}
            max={20}
            onChange={onResultsDelayChange}
          />
          <StepperField
            label="Max rounds"
            value={maxRounds}
            min={0}
            max={200}
            onChange={onMaxRoundsChange}
          />
          {mode === 'guess-song-easy' && (
            <StepperField
              label="Clip duration"
              value={guessClipDurationSec}
              min={5}
              max={60}
              onChange={onGuessClipDurationChange}
            />
          )}
          {mode === 'finish-lyrics' && (
            <StepperField
              label="Answer time"
              value={lyricAnswerTimeSec}
              min={10}
              max={60}
              onChange={onLyricAnswerTimeChange}
            />
          )}
        </div>
        <div className="text-xs opacity-60">Set max rounds to 0 for no round cap.</div>
      </Section>

      <Section title="Room Behavior" icon={<GearSix size={14} weight="duotone" />}>
        <div className="grid gap-2 md:grid-cols-2">
          <ToggleRow
            label="Allow mid-game joins"
            description="Late players enter as spectators until the next round."
            checked={allowJoinInProgress}
            onChange={onAllowJoinInProgressChange}
          />
          <ToggleRow
            label="Shuffle playlist"
            description="Randomize order whenever the playlist is prepared."
            checked={shufflePlaylist}
            onChange={onShufflePlaylistChange}
          />
        </div>
      </Section>

      <Section title="Lyric Handling" icon={<Translate size={14} weight="duotone" />}>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
          <label className="grid gap-2 text-sm">
            <span className="font-semibold">Chinese lyric conversion</span>
            <select
              className="input"
              value={convertChineseLyrics}
              onChange={(event) => onConvertChineseLyricsChange(event.target.value as 'none' | 't2s' | 's2t')}
            >
              <option value="none">No conversion</option>
              <option value="t2s">Traditional to Simplified</option>
              <option value="s2t">Simplified to Traditional</option>
            </select>
          </label>
          <ToggleRow
            label="Match Chinese variants"
            description="Treat Traditional and Simplified Chinese as equivalent."
            checked={allowChineseVariants}
            onChange={onAllowChineseVariantsChange}
          />
        </div>
      </Section>

      <Section title="Lyric Masking" icon={<Eye size={14} weight="duotone" />}>
        <div className="grid gap-2 md:grid-cols-2">
          <ToggleRow label="Reveal numbers" checked={revealNumbers} onChange={onRevealNumbersChange} />
          <ToggleRow label="Reveal Korean" checked={revealKorean} onChange={onRevealKoreanChange} />
          <ToggleRow label="Reveal Japanese" checked={revealJapanese} onChange={onRevealJapaneseChange} />
          <ToggleRow label="Reveal Chinese" checked={revealChinese} onChange={onRevealChineseChange} />
          <ToggleRow label="Reveal Vietnamese accents" checked={revealVietnamese} onChange={onRevealVietnameseChange} />
          <ToggleRow label="Reveal Spanish accents" checked={revealSpanish} onChange={onRevealSpanishChange} />
        </div>
      </Section>
    </div>
  );
}
