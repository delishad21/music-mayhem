import { CSSProperties, FormEvent, RefObject } from 'react';
import { GameMode, GameState, MyAnswerStatus } from '@/types/game';

interface AnswerPhasePanelProps {
  mode: GameMode;
  modeLabel: string;
  accentColor: string;
  gameState: GameState;
  timeLeft: number;
  roundLabel?: string;
  displayHangman?: string;
  hasCompletedRound: boolean;
  isSpectator: boolean;
  inputDisabled: boolean;
  isAnswerPhase: boolean;
  inputFlashStyle?: CSSProperties;
  answer: string;
  onAnswerChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  answerInputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  myAnswerStatus?: MyAnswerStatus;
}

export default function AnswerPhasePanel({
  mode,
  modeLabel,
  accentColor,
  gameState,
  timeLeft,
  roundLabel,
  displayHangman,
  hasCompletedRound,
  isSpectator,
  inputDisabled,
  isAnswerPhase,
  inputFlashStyle,
  answer,
  onAnswerChange,
  onSubmit,
  answerInputRef,
  myAnswerStatus,
}: AnswerPhasePanelProps) {
  const showTimer = gameState.answerTime && gameState.phase === 'answering';
  const answerProgress =
    showTimer && gameState.answerTime
      ? Math.max(0, Math.min(100, (timeLeft / (gameState.answerTime / 1000)) * 100))
      : 0;

  return (
    <div className="game-segment game-segment-tint py-8">
      {roundLabel && (
        <div className="flex justify-center mb-6">
          <div className="mode-chip">{roundLabel}</div>
        </div>
      )}
      <div className="text-center mb-6">
        <h2
          className="display-heading mb-4 text-4xl font-extrabold uppercase leading-none"
          style={{ color: accentColor }}
        >
          {modeLabel}
        </h2>
        {mode === 'finish-lyrics' && (
          <div className="mx-auto max-w-2xl text-center mb-6">
            <div className="eyebrow mb-2">
              Previous Line
            </div>
            <div className="rounded-[3px] border px-4 py-3 text-xl leading-relaxed opacity-80" style={{ borderColor: 'var(--border)' }}>
              {(gameState.clipLyricLines || []).slice(-1)[0]?.text || '—'}
            </div>
          </div>
        )}

        {displayHangman && mode === 'finish-lyrics' && (
          <div className="mx-auto max-w-2xl text-center mb-6">
            <div className="eyebrow mb-2">
              Next Line
            </div>
            <div className="rounded-[3px] border px-4 py-5" style={{ borderColor: 'color-mix(in srgb, var(--mode-accent) 35%, var(--border))' }}>
              <div className="hangman-text whitespace-pre-line">{displayHangman}</div>
            </div>
          </div>
        )}

        {showTimer && (
          <div className="mb-6">
            <div className="display-heading text-6xl font-extrabold" style={{ color: timeLeft < 3 ? '#ef4444' : 'var(--mode-accent)' }}>
              {timeLeft.toFixed(1)}s
            </div>
            <div className="progress-track mt-2">
              <div
                className="progress-fill duration-100"
                style={{
                  width: `${answerProgress}%`,
                  backgroundColor: timeLeft < 3 ? '#ef4444' : 'var(--mode-accent)',
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div
        className={
          mode === 'finish-lyrics'
            ? 'space-y-6 max-w-3xl mx-auto'
            : 'max-w-3xl mx-auto'
        }
      >
        {mode === 'finish-lyrics' && (
          <div className="rounded-[3px] border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}>
            <div className="eyebrow mb-3">Your Progress</div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!myAnswerStatus?.lyric.answered} readOnly />
                  <span>Lyric</span>
                </label>
                <span className="font-mono font-semibold" style={{ color: 'var(--mode-accent)' }}>
                  {myAnswerStatus?.lyric.score ?? 0}
                </span>
              </div>
            </div>
          </div>
        )}

        {mode === 'finish-lyrics' ? (
          <div className="space-y-3">
            {hasCompletedRound ? (
              <div className="p-3 rounded-[3px] border border-green-500 text-green-500 font-semibold text-sm text-center">
                ✓ Answer submitted.
              </div>
            ) : isSpectator ? (
              <div className="p-3 rounded-[3px] border border-yellow-500 text-yellow-600 font-semibold text-sm text-center">
                Spectating this round.
              </div>
            ) : (
              <div className="text-sm opacity-70 text-center">
                Type your answer below. One attempt only.
              </div>
            )}
            <form onSubmit={onSubmit} className="space-y-3">
              <textarea
                value={answer}
                onChange={(event) => onAnswerChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    onSubmit(event as unknown as React.FormEvent);
                  }
                }}
                ref={answerInputRef as RefObject<HTMLTextAreaElement>}
                className="input min-h-[180px] text-lg"
                style={inputFlashStyle}
                placeholder="Type the missing lyric..."
                disabled={inputDisabled || !isAnswerPhase}
              />
              <button type="submit" className="btn w-full" disabled={inputDisabled || !isAnswerPhase}>
                Submit Answer
              </button>
            </form>
            {!gameState.lastAnswerFeedback?.correct && gameState.lastAnswerFeedback?.message && (
              <div className="text-sm text-red-500 font-semibold text-center">
                {gameState.lastAnswerFeedback.message}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col justify-center">
            {hasCompletedRound ? (
              <div className="p-3 rounded-[3px] border border-green-500 text-green-500 font-semibold text-sm text-center">
                ✓ You have completed this round.
              </div>
            ) : isSpectator ? (
              <div className="p-3 rounded-[3px] border border-yellow-500 text-yellow-600 font-semibold text-sm text-center">
                Spectating this round.
              </div>
            ) : (
              <div className="text-sm opacity-70 text-center">
                Use the chat on the right. Title and artist score separately.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
