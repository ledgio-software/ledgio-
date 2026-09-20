import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";
import { api } from "../lib/api";

interface BucketSummary {
  count: number;
  totalBalanceDue: number;
}

interface OverdueSummary {
  buckets: {
    days1to30: BucketSummary;
    days31to60: BucketSummary;
    days61to90: BucketSummary;
    days90plus: BucketSummary;
  };
  totalOverdueCount: number;
  totalOverdueBalance: number;
}

const BUCKET_LABELS: Record<string, string> = {
  days1to30:  "1–30 days",
  days31to60: "31–60 days",
  days61to90: "61–90 days",
  days90plus: "90+ days",
};

function severityBucket(summary: OverdueSummary): "critical" | "warning" | null {
  if (summary.buckets.days90plus.count > 0 || summary.buckets.days61to90.count > 0) return "critical";
  if (summary.buckets.days31to60.count > 0 || summary.buckets.days1to30.count > 0) return "warning";
  return null;
}

/**
 * A dismissible banner shown when outstanding AR invoices have crossed the
 * 30-day overdue threshold. Renders nothing when there are no overdue invoices
 * or when the user has dismissed it for this session.
 */
export function OverdueInvoiceAlertBanner() {
  const [summary, setSummary] = useState<OverdueSummary | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api
      .get<{ success: boolean; data: OverdueSummary }>("/reports/overdue-invoice-summary")
      .then((r) => {
        if (r.data.success) setSummary(r.data.data);
      })
      .catch(() => {});
  }, []);

  if (!summary || dismissed || summary.totalOverdueCount === 0) return null;

  const severity = severityBucket(summary);
  if (!severity) return null;

  const isCritical = severity === "critical";
  const bgClass = isCritical
    ? "bg-red-600 dark:bg-red-700 text-white"
    : "bg-amber-500 dark:bg-amber-600 text-white";

  // Build a compact breakdown of non-empty buckets
  const bucketParts = (Object.entries(summary.buckets) as [string, BucketSummary][])
    .filter(([, v]) => v.count > 0)
    .map(([k, v]) => `${v.count} invoice${v.count === 1 ? "" : "s"} (${BUCKET_LABELS[k]})`);

  const message = `${summary.totalOverdueCount} overdue invoice${summary.totalOverdueCount === 1 ? "" : "s"}: ${bucketParts.join(", ")}.`;

  return (
    <div className={`flex items-center gap-3 px-4 py-2 text-sm ${bgClass}`} role="alert">
      <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden />
      <span className="flex-1">{message}</span>
      <Link
        to="/reports/aging"
        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 rounded px-3 py-1 font-medium transition-colors whitespace-nowrap"
      >
        View AR Aging
      </Link>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss overdue invoice alert"
        className="hover:bg-white/20 rounded p-0.5 transition-colors"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
