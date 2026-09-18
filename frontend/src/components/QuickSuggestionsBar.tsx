import { useNavigate } from "react-router-dom";
import { Sparkles, X, ArrowRight } from "lucide-react";
import { useAiInsights } from "../hooks/useAiInsights";

interface SuggestionChip {
  event_type: string;
  label: string;
  route: string;
  probability: number;
}

interface NextActionData {
  user_id: string;
  suggestions: SuggestionChip[];
}

/**
 * Renders a thin row of "what to do next" action chips beneath the banner stack.
 * Driven by next_action module insights from the Intelligence Engine (Phase 2).
 * Each chip deep-links to the suggested page. The whole bar is dismissible.
 */
export function QuickSuggestionsBar() {
  const { insights, loading, dismiss } = useAiInsights();
  const navigate = useNavigate();

  if (loading) return null;

  // One next_action insight per user — take the first one that has suggestions.
  const nextActionInsight = insights.find(
    (i) => i.module === "next_action" && Array.isArray((i.data as unknown as NextActionData | null)?.suggestions)
  );

  if (!nextActionInsight) return null;

  const chips = ((nextActionInsight.data as unknown as NextActionData).suggestions ?? []).slice(0, 3);
  if (chips.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-secondary-50 dark:bg-secondary-900 border-b border-secondary-200 dark:border-secondary-700 text-xs text-secondary-600 dark:text-secondary-400">
      <Sparkles className="h-3.5 w-3.5 text-primary-500 flex-shrink-0" aria-hidden />
      <span className="font-medium text-secondary-500 dark:text-secondary-400 flex-shrink-0">
        Next step:
      </span>
      <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
        {chips.map((chip) => (
          <button
            key={chip.event_type}
            onClick={() => navigate(chip.route)}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-600 text-secondary-700 dark:text-secondary-300 hover:border-primary-400 hover:text-primary-700 dark:hover:text-primary-400 transition-colors text-xs font-medium"
          >
            {chip.label}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </button>
        ))}
      </div>
      <button
        onClick={() => dismiss(nextActionInsight.id)}
        aria-label="Dismiss suggestions"
        className="hover:bg-secondary-200 dark:hover:bg-secondary-700 rounded p-0.5 transition-colors flex-shrink-0 ml-auto"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
