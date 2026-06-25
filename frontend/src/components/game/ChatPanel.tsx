import { CSSProperties, FormEvent, RefObject, useEffect, useRef } from 'react';
import { ArrowRight, ChatCircleText } from 'phosphor-react';
import { ChatMessage } from '@/types/game';
import PanelHeading from './PanelHeading';

interface ChatPanelProps {
  title?: string;
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
  autoScrollMode?: 'self' | 'all';
}

export default function ChatPanel({
  title = 'Chat',
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
  autoScrollMode = 'self',
}: ChatPanelProps) {
  const messageContainerRef = useRef<HTMLDivElement | null>(null);
  const pendingSelfScrollRef = useRef(false);
  const lastSubmitAtRef = useRef(0);
  const lastMessageIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const lastMessage = chatMessages[chatMessages.length - 1];
    if (!lastMessage) {
      return;
    }

    if (lastMessage.id === lastMessageIdRef.current) {
      return;
    }
    lastMessageIdRef.current = lastMessage.id;

    if (autoScrollMode === 'all') {
      const container = messageContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
      return;
    }

    if (!pendingSelfScrollRef.current || (!currentUsername && !currentPlayerId)) {
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
  }, [chatMessages, currentUsername, currentPlayerId, autoScrollMode]);

  const handleSubmit = (event: FormEvent) => {
    pendingSelfScrollRef.current = true;
    lastSubmitAtRef.current = Date.now();
    onSubmit(event);
  };

  return (
    <div>
      <div className="game-segment flex h-[calc(100vh-12rem)] flex-col" style={{ minHeight: 520 }}>
        <PanelHeading
          className="mb-4"
          icon={<ChatCircleText size={16} weight="duotone" />}
          title={title}
          action={<div className="eyebrow">Public misses</div>}
        />

        <div
          ref={messageContainerRef}
          className="flex-1 space-y-2 overflow-auto rounded-[3px] border p-3"
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
              className="rounded-[3px] border p-3"
              style={{
                borderColor: 'rgba(239, 68, 68, 0.4)',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
              }}
            >
              <div className="eyebrow mb-1">
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
