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

  return (
    <div className="card py-12">
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
      <div className="text-center mb-6">
        <h2
          className="text-2xl font-extrabold uppercase tracking-[0.22em] mb-4"
          style={{ color: accentColor }}
        >
          {modeLabel}
        </h2>
        {mode === 'finish-lyrics' && (
          <div className="mx-auto max-w-2xl text-center mb-6">
            <div className="text-sm uppercase tracking-widest opacity-60 mb-2">
              Previous Line:
            </div>
            <div className="text-xl leading-relaxed opacity-70">
              {(gameState.clipLyricLines || []).slice(-1)[0]?.text || '—'}
            </div>
          </div>
        )}

        {displayHangman && mode === 'finish-lyrics' && (
          <div className="mx-auto max-w-2xl text-center mb-6">
            <div className="text-sm uppercase tracking-widest opacity-60 mb-2">
              Next Line:
            </div>
            <div className="hangman-text whitespace-pre-line">{displayHangman}</div>
          </div>
        )}

        {showTimer && (
          <div className="mb-6">
            <div className="text-5xl font-bold" style={{ color: timeLeft < 3 ? '#ef4444' : 'var(--primary)' }}>
              {timeLeft.toFixed(1)}s
            </div>
            <div className="w-full bg-gray-300 dark:bg-gray-700 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full transition-all duration-100"
                style={{
                  width: `${(timeLeft / (gameState.answerTime ? gameState.answerTime / 1000 : 1)) * 100}%`,
                  backgroundColor: timeLeft < 3 ? '#ef4444' : 'var(--primary)',
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
            : 'grid md:grid-cols-2 gap-6 max-w-3xl mx-auto'
        }
      >
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
          <div className="font-bold mb-3">Your Progress</div>

          {mode === 'finish-lyrics' ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!myAnswerStatus?.lyric.answered} readOnly />
                  <span>Lyric</span>
                </label>
                <span className="font-semibold" style={{ color: 'var(--primary)' }}>
                  {myAnswerStatus?.lyric.score ?? 0}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!myAnswerStatus?.title.answered} readOnly />
                  <span>Song Title</span>
                </label>
                <span className="font-semibold" style={{ color: 'var(--primary)' }}>
                  {myAnswerStatus?.title.score ?? 0}
                </span>
              </div>
              {myAnswerStatus?.title.answered && myAnswerStatus.title.correctAnswer && (
                <div className="text-xs opacity-70">✓ {myAnswerStatus.title.correctAnswer}</div>
              )}

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!myAnswerStatus?.artist.answered} readOnly />
                  <span>
                    Artist
                    {typeof myAnswerStatus?.artist.total === 'number' && (
                      <span className="opacity-70">
                        {' '}
                        ({myAnswerStatus.artist.matchedCount ?? 0}/{myAnswerStatus.artist.total})
                      </span>
                    )}
                  </span>
                </label>
                <span className="font-semibold" style={{ color: 'var(--primary)' }}>
                  {myAnswerStatus?.artist.score ?? 0}
                </span>
              </div>
              {myAnswerStatus?.artist.answered && myAnswerStatus.artist.correctAnswer && (
                <div className="text-xs opacity-70">✓ {myAnswerStatus.artist.correctAnswer}</div>
              )}
            </div>
          )}
        </div>

        {mode === 'finish-lyrics' ? (
          <div className="space-y-3">
            {hasCompletedRound ? (
              <div className="p-3 rounded-lg border border-green-500 text-green-500 font-semibold text-sm text-center">
                ✓ Answer submitted.
              </div>
            ) : isSpectator ? (
              <div className="p-3 rounded-lg border border-yellow-500 text-yellow-600 font-semibold text-sm text-center">
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
              <div className="p-3 rounded-lg border border-green-500 text-green-500 font-semibold text-sm text-center">
                ✓ You have completed this round.
              </div>
            ) : isSpectator ? (
              <div className="p-3 rounded-lg border border-yellow-500 text-yellow-600 font-semibold text-sm text-center">
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
