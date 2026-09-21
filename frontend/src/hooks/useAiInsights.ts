import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export interface AiInsight {
  id: string;
  module: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  computedAt: string;
}

export function useAiInsights() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user?.tenantId) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get<{ success: boolean; data: AiInsight[] }>('/ai/insights');
      if (res.data.success) setInsights(res.data.data);
    } catch {
      // non-fatal — insights are additive
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]);

  const dismiss = useCallback(async (id: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== id));
    try {
      await api.post(`/ai/insights/${id}/dismiss`);
    } catch {
      // optimistic dismiss — ignore errors
    }
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 60_000);
    return () => clearInterval(interval);
  }, [fetch]);

  return { insights, loading, dismiss };
}
