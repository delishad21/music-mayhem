import { CSSProperties, FormEvent, RefObject, useEffect, useRef } from 'react';
import { ArrowRight } from 'phosphor-react';
import { ChatMessage } from '@/types/game';

interface ChatPanelProps {
  chatMessages: ChatMessage[];
  isAnswerPhase: boolean;
  answer: string;
  onAnswerChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  inputFlashStyle?: CSSProperties;
  answerInputRef: RefObject<HTMLInputElement>;
  chatDisabled: boolean;
  lastErrorMessage?: string;
  currentUsername?: string | null;
  currentPlayerId?: string | null;
}

export default function ChatPanel({
  chatMessages,
  isAnswerPhase,
  answer,
  onAnswerChange,
  onSubmit,
  inputFlashStyle,
  answerInputRef,
  chatDisabled,
  lastErrorMessage,
  currentUsername,
  currentPlayerId,
}: ChatPanelProps) {
  const messageContainerRef = useRef<HTMLDivElement | null>(null);
  const pendingSelfScrollRef = useRef(false);
  const lastSubmitAtRef = useRef(0);

  useEffect(() => {
    if (!pendingSelfScrollRef.current) return;
    const lastMessage = chatMessages[chatMessages.length - 1];
    if (!lastMessage || (!currentUsername && !currentPlayerId)) {
      return;
    }

    const isSelfMessage =
      (currentPlayerId && lastMessage.playerId === currentPlayerId) ||
      (currentUsername && lastMessage.username === currentUsername);
    const isLikelyLatest =
      lastMessage.createdAt >= lastSubmitAtRef.current - 3000;

    if (isSelfMessage && isLikelyLatest) {
      pendingSelfScrollRef.current = false;
      const container = messageContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [chatMessages, currentUsername, currentPlayerId]);

  const handleSubmit = (event: FormEvent) => {
    pendingSelfScrollRef.current = true;
    lastSubmitAtRef.current = Date.now();
    onSubmit(event);
  };

  return (
    <div className="lg:col-span-1">
      <div className="card h-[calc(100vh-12rem)] flex flex-col" style={{ minHeight: 520 }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">Chat</h3>
          <div className="text-xs opacity-60">Wrong attempts are public</div>
        </div>

        <div
          ref={messageContainerRef}
          className="flex-1 overflow-auto rounded-xl border p-3 space-y-2"
          style={{ borderColor: 'var(--border)' }}
        >
          {chatMessages.length === 0 && (
            <div className="text-sm opacity-60">
              {isAnswerPhase ? 'No wrong attempts yet.' : 'Chat activates during rounds.'}
            </div>
          )}
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className="p-3 rounded-lg border"
              style={{
                borderColor: 'rgba(239, 68, 68, 0.4)',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
              }}
            >
              <div className="text-xs uppercase tracking-wider opacity-60 mb-1">
                {msg.displayName || msg.username}
              </div>
              <div className="font-semibold text-red-500">{msg.text}</div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex gap-2 items-center">
          <input
            type="text"
            value={answer}
            onChange={(event) => onAnswerChange(event.target.value)}
            ref={answerInputRef}
            className="input text-center text-base transition-all flex-1"
            style={inputFlashStyle}
            placeholder={isAnswerPhase ? 'Type song title OR artist...' : 'Wait for the next round...'}
            autoFocus
            disabled={chatDisabled}
          />
          <button type="submit" className="btn px-4" disabled={chatDisabled}>
            <ArrowRight size={18} weight="duotone" />
          </button>
        </form>

        {lastErrorMessage && (
          <div className="text-sm text-red-500 font-semibold mt-3">{lastErrorMessage}</div>
        )}
      </div>
    </div>
  );
}
