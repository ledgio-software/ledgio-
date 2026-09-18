import React from "react";
import { Brain, X, AlertTriangle, Info } from "lucide-react";
import { useAiInsights, AiInsight } from "../hooks/useAiInsights";

const SEVERITY_STYLES: Record<AiInsight["severity"], string> = {
  critical: "bg-red-600 dark:bg-red-700 text-white",
  warning: "bg-amber-500 dark:bg-amber-600 text-white",
  info: "bg-blue-600 dark:bg-blue-700 text-white",
};

const SEVERITY_ICONS: Record<AiInsight["severity"], React.ReactNode> = {
  critical: <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden />,
  warning: <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden />,
  info: <Info className="h-4 w-4 flex-shrink-0" aria-hidden />,
};

function InsightBanner({ insight, onDismiss }: { insight: AiInsight; onDismiss: (id: string) => void }) {
  const style = SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.info;

  return (
    <div className={`flex items-start gap-3 px-4 py-2 text-sm ${style}`} role="alert">
      <Brain className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden />
      {SEVERITY_ICONS[insight.severity]}
      <span className="flex-1 leading-snug">
        <span className="font-semibold">{insight.title}</span>
        {" — "}
        {insight.body}
      </span>
      <button
        onClick={() => onDismiss(insight.id)}
        aria-label="Dismiss AI insight"
        className="hover:bg-white/20 rounded p-0.5 transition-colors flex-shrink-0"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

/**
 * Renders dismissible AI insight banners in the MainLayout header stack.
 * Shows at most 3 banners (most severe first) to avoid overwhelming the UI.
 * Returns null when there are no active insights.
 */
export function AiInsightsBanner() {
  const { insights, loading, dismiss } = useAiInsights();

  if (loading || insights.length === 0) return null;

  // Show at most 3, most severe first (critical > warning > info)
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  const top = [...insights]
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, 3);

  return (
    <>
      {top.map((insight) => (
        <InsightBanner key={insight.id} insight={insight} onDismiss={dismiss} />
      ))}
    </>
  );
}
