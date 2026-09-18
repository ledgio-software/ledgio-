import { useState, useCallback } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface UseLedgioAIOptions {
  /** JWT from the main Ledgio auth session */
  authToken: string;
  /** Override the default service URL */
  serviceUrl?: string;
  businessName?: string;
}

export function useLedgioAI({ authToken, serviceUrl, businessName }: UseLedgioAIOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = serviceUrl ?? (import.meta.env.VITE_LEDGIO_AI_URL ?? 'http://localhost:4000');

  const sendMessage = useCallback(
    async (userText: string) => {
      if (!userText.trim() || loading) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: userText.trim(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${baseUrl}/api/ai/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            message: userText.trim(),
            conversation_id: conversationId,
            business_name: businessName,
          }),
        });

        if (!res.ok) {
          throw new Error(`AI service error: ${res.status}`);
        }

        const data = await res.json();
        if (data.conversation_id) setConversationId(data.conversation_id);

        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.reply,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [authToken, baseUrl, businessName, conversationId, loading],
  );

  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  }, []);

  return { messages, loading, error, sendMessage, clearConversation };
}
