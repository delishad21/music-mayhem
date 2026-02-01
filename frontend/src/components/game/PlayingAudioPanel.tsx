import { MusicNote } from 'phosphor-react';
import { GameMode } from '@/types/game';

interface HangmanSection {
  label: string;
  value: string;
}

function parseHangmanSections(hangman: string): HangmanSection[] {
  const lines = hangman
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const sections: HangmanSection[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.endsWith(':')) {
      const label = line.slice(0, -1).trim();
      const value = lines[i + 1] ?? '';
      sections.push({ label, value });
      i += 1;
      continue;
    }

    if (!sections.length) {
      sections.push({ label: 'Song', value: line });
    } else {
      sections.push({ label: '', value: line });
    }
  }

  return sections;
}

interface PlayingAudioPanelProps {
  mode: GameMode;
  audioNeedsGesture: boolean;
  onRequestPlay: () => void;
  clipPhase?: number;
  audioTotal: number;
  audioElapsed: number;
  audioTimeLeft: number;
  hangman?: string;
  clipLyricLines?: Array<{ time: number; text: string }>;
  currentClipIndex: number;
  roundLabel?: string;
}

export default function PlayingAudioPanel({
  mode,
  audioNeedsGesture,
  onRequestPlay,
  clipPhase,
  audioTotal,
  audioElapsed,
  audioTimeLeft,
  hangman,
  clipLyricLines,
  currentClipIndex,
  roundLabel,
}: PlayingAudioPanelProps) {
  return (
    <div className="card text-center py-16">
      {roundLabel && (
        <div className="flex justify-center mb-6">
          <div
            className="px-4 py-1 rounded-full text-xs font-semibold uppercase tracking-widest"
            style={{ border: '1px solid var(--border)', backgroundColor: 'var(--card-hover)' }}
          >
            {roundLabel}
          </div>
        </div>
      )}
      <div className="flex justify-center mb-6">
        <MusicNote size={48} weight="duotone" />
      </div>
      <h2 className="text-3xl font-bold mb-4">Listen carefully...</h2>
      {audioNeedsGesture && (
        <div className="mb-4">
          <button type="button" onClick={onRequestPlay} className="btn px-6">
            Tap to Play Audio
          </button>
          <div className="text-xs opacity-70 mt-2">Your browser blocked autoplay.</div>
        </div>
      )}

      {mode === 'guess-song-challenge' && clipPhase && (
        <div className="space-y-2">
          <p className="text-xl opacity-80">Clip {clipPhase} of 4</p>
          {audioTotal > 0 && (
            <div>
              {(() => {
                const gapSeconds = 3;
                const timeSinceClipEnd = Math.max(0, audioElapsed - audioTotal);
                const isFinalClip = clipPhase >= 4;
                const isBetweenClips = !isFinalClip && audioElapsed >= audioTotal;
                const nextClipIn = Math.max(0, gapSeconds - timeSinceClipEnd);
                const progress = isBetweenClips
                  ? gapSeconds > 0
                    ? nextClipIn / gapSeconds
                    : 0
                  : audioTimeLeft / audioTotal;
                const barColor = isBetweenClips ? '#ef4444' : 'var(--primary)';
                const label = isBetweenClips
                  ? `Next clip in ${nextClipIn.toFixed(1)}s`
                  : `${audioTimeLeft.toFixed(1)}s`;

                return (
                  <>
                    <div className="text-3xl font-bold" style={{ color: barColor }}>
                      {label}
                    </div>
                    <div className="w-full bg-gray-300 dark:bg-gray-700 h-2 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full transition-all duration-100"
                        style={{
                          width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {mode === 'finish-lyrics' && (
        <div className="mt-8">
          <div className="text-sm uppercase tracking-widest opacity-60 mb-3">Lyrics</div>
          <div className="mx-auto max-w-2xl text-left">
            {(() => {
              const lines = clipLyricLines || [];
              if (!lines.length) {
                return <div className="opacity-60 text-center">...</div>;
              }

              const rowHeight = 96;
              const offset = Math.max(0, currentClipIndex - 1) * rowHeight;

              return (
                <div className="overflow-hidden" style={{ height: rowHeight * 3 }}>
                  <div
                    className="transition-transform duration-300"
                    style={{ transform: `translateY(-${offset}px)` }}
                  >
                    {lines.map((line, index) => {
                      const isCurrent = index === currentClipIndex;
                      return (
                        <div
                          key={`${line.time}-${index}`}
                          className={`${
                            isCurrent ? 'font-semibold text-[var(--foreground)]' : 'text-[var(--foreground)] opacity-50'
                          } text-2xl md:text-3xl flex items-center`}
                          style={{ height: rowHeight }}
                        >
                          <span
                            style={{
                              lineHeight: '34px',
                              paddingBottom: '4px',
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              whiteSpace: 'normal',
                              wordBreak: 'break-word',
                            }}
                          >
                            {line.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {(mode === 'guess-song-easy' || mode === 'guess-song-challenge') && hangman && (
        <div className="mt-6 space-y-4">
          {(() => {
            const sections = parseHangmanSections(hangman);
            const hasLabels = sections.some(section => section.label);
            if (!hasLabels) {
              return <div className="hangman-text whitespace-pre-line">{hangman}</div>;
            }

            return (
              <div
                className="rounded-xl border p-5 space-y-4"
                style={{ borderColor: 'var(--border)' }}
              >
                {sections.map((section, index) => (
                  <div key={`${section.label}-${index}`} className="space-y-1">
                    <div className="text-xs uppercase tracking-widest opacity-60">
                      {section.label || 'Answer'}
                    </div>
                    <div className="font-mono text-2xl md:text-3xl tracking-wide break-words">
                      {section.value || '—'}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {audioTotal > 0 && mode === 'guess-song-easy' && (
            <div>
              <div
                className="text-3xl font-bold"
                style={{ color: audioTimeLeft < 3 ? '#ef4444' : 'var(--primary)' }}
              >
                {audioTimeLeft.toFixed(1)}s
              </div>
              <div className="w-full bg-gray-300 dark:bg-gray-700 h-2 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full transition-all duration-100"
                  style={{
                    width: `${(audioTimeLeft / audioTotal) * 100}%`,
                    backgroundColor: audioTimeLeft < 3 ? '#ef4444' : 'var(--primary)',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
