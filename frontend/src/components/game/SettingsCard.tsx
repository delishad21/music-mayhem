import { GameMode } from '@/types/game';
import StepperField from '@/components/game/StepperField';

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
    <div className="rounded-xl border p-5" style={{ borderColor: 'var(--border)' }}>
      <details className="group" open>
        <summary className="flex items-center justify-between cursor-pointer rounded-lg px-4 py-3 text-base font-semibold uppercase tracking-[0.18em] text-[var(--text)]">
          <span>Game Settings</span>
          <span className="text-2xl transition-transform duration-200 group-open:rotate-180">▾</span>
        </summary>
        <div className="mt-4 space-y-4">
          <StepperField
            label="Countdown before round (seconds)"
            value={roundCountdownSec}
            min={0}
            max={15}
            onChange={onRoundCountdownChange}
          />
          <StepperField
            label="Results screen duration (seconds)"
            value={resultsDelaySec}
            min={2}
            max={20}
            onChange={onResultsDelayChange}
          />
          {mode === 'guess-song-easy' && (
            <StepperField
              label="Clip duration (seconds)"
              value={guessClipDurationSec}
              min={5}
              max={60}
              onChange={onGuessClipDurationChange}
            />
          )}
          {mode === 'finish-lyrics' && (
            <StepperField
              label="Answer time (seconds)"
              value={lyricAnswerTimeSec}
              min={10}
              max={60}
              onChange={onLyricAnswerTimeChange}
            />
          )}
          <StepperField
            label="Max rounds (0 = off)"
            value={maxRounds}
            min={0}
            max={200}
            onChange={onMaxRoundsChange}
          />
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={allowJoinInProgress}
              onChange={(e) => onAllowJoinInProgressChange(e.target.checked)}
            />
            <span className="font-semibold">Allow players to join mid-game</span>
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={shufflePlaylist}
              onChange={(e) => onShufflePlaylistChange(e.target.checked)}
            />
            <span className="font-semibold">Shuffle playlist (default on)</span>
          </label>
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold">Chinese lyric conversion</span>
            <select
              className="input"
              value={convertChineseLyrics}
              onChange={(e) => onConvertChineseLyricsChange(e.target.value as 'none' | 't2s' | 's2t')}
            >
              <option value="none">No conversion</option>
              <option value="t2s">Traditional → Simplified</option>
              <option value="s2t">Simplified → Traditional</option>
            </select>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={allowChineseVariants}
              onChange={(e) => onAllowChineseVariantsChange(e.target.checked)}
            />
            <span className="font-semibold">
              Treat Traditional/Simplified Chinese as equivalent
            </span>
          </label>
          <div className="border-t border-[var(--border)] pt-4 space-y-3">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] opacity-70">
              Lyric Masking
            </div>
            <div className="text-sm opacity-70">
              Toggle whether numbers and non-Latin characters are revealed or masked.
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={revealNumbers} onChange={(e) => onRevealNumbersChange(e.target.checked)} />
              <span className="font-semibold">Reveal numbers (0-9)</span>
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={revealKorean} onChange={(e) => onRevealKoreanChange(e.target.checked)} />
              <span className="font-semibold">Reveal Korean (Hangul)</span>
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={revealJapanese} onChange={(e) => onRevealJapaneseChange(e.target.checked)} />
              <span className="font-semibold">Reveal Japanese (Hiragana/Katakana)</span>
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={revealChinese} onChange={(e) => onRevealChineseChange(e.target.checked)} />
              <span className="font-semibold">Reveal Chinese (CJK)</span>
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={revealVietnamese} onChange={(e) => onRevealVietnameseChange(e.target.checked)} />
              <span className="font-semibold">Reveal Vietnamese accents</span>
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={revealSpanish} onChange={(e) => onRevealSpanishChange(e.target.checked)} />
              <span className="font-semibold">Reveal Spanish accents</span>
            </label>
          </div>
        </div>
      </details>
    </div>
  );
}
