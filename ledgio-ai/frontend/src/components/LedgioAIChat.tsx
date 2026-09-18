import { useState, useRef, useEffect, FormEvent } from 'react';
import { useLedgioAI, Message } from '../hooks/useLedgioAI';

interface Props {
  authToken: string;
  businessName?: string;
  onClose?: () => void;
}

const SUGGESTED_PROMPTS = [
  'What is my cash balance today?',
  'Show me overdue invoices',
  'What were my sales this month?',
  'Are there any low-stock alerts?',
];

export function LedgioAIChat({ authToken, businessName, onClose }: Props) {
  const { messages, loading, error, sendMessage, clearConversation } = useLedgioAI({
    authToken,
    businessName,
  });
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input;
    setInput('');
    await sendMessage(text);
  }

  return (
    <div className="flex flex-col h-full bg-ink-950 rounded-2xl border border-ink-800/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink-800/60 bg-ink-900/80">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-brand-400 animate-pulse" />
          <span className="text-sm font-bold text-white">Ledgio AI</span>
          <span className="text-[10px] text-ink-500 font-medium uppercase tracking-wider">Beta</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearConversation}
            className="text-[11px] text-ink-500 hover:text-ink-300 transition-colors"
          >
            New chat
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-ink-500 hover:text-white transition-colors"
              aria-label="Close AI assistant"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="text-3xl">🤖</div>
            <p className="text-sm text-ink-400 max-w-xs">
              Ask me anything about your finances — invoices, cash flow, stock levels, payroll, or VAT.
            </p>
            <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="text-left text-xs px-3 py-2 bg-ink-900/60 border border-ink-800/60 rounded-lg text-ink-400 hover:text-white hover:border-brand-700/60 transition-all"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <ChatBubble key={msg.id} message={msg} />)
        )}

        {loading && (
          <div className="flex gap-2 items-start">
            <div className="h-6 w-6 rounded-full bg-brand-900/60 border border-brand-800/40 flex items-center justify-center text-[10px]">
              AI
            </div>
            <div className="flex gap-1 items-center px-3 py-2 bg-ink-900/60 rounded-xl rounded-tl-none">
              <span className="h-1.5 w-1.5 bg-brand-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 bg-brand-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 bg-brand-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-400 px-3 py-2 bg-red-950/30 border border-red-800/40 rounded-lg">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-ink-800/60 bg-ink-900/40">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your finances…"
            disabled={loading}
            className="flex-1 bg-ink-900/60 border border-ink-800/60 rounded-xl px-3 py-2 text-sm text-white placeholder-ink-600 focus:outline-none focus:border-brand-700/60 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors"
          >
            Send
          </button>
        </div>
        <p className="text-[10px] text-ink-600 mt-1.5 text-center">
          Ledgio AI can make mistakes. Verify important financial figures.
        </p>
      </form>
    </div>
  );
}

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-2 items-start ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
          isUser
            ? 'bg-ink-800 border border-ink-700 text-ink-400'
            : 'bg-brand-900/60 border border-brand-800/40 text-brand-400'
        }`}
      >
        {isUser ? 'You' : 'AI'}
      </div>
      <div
        className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-brand-900/40 border border-brand-800/40 text-brand-100 rounded-tr-none'
            : 'bg-ink-900/60 border border-ink-800/60 text-ink-200 rounded-tl-none'
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
