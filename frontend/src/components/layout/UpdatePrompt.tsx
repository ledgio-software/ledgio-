import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw, X } from "lucide-react";
import { useState } from "react";

export function UpdatePrompt() {
  const [dismissed, setDismissed] = useState(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh || dismissed) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-secondary-900 dark:bg-secondary-800 border-b border-secondary-700 text-secondary-50 text-sm">
      <RefreshCw size={14} className="flex-shrink-0 text-amber-400" />
      <span className="flex-1">
        A new version of Ledgio is available.{" "}
        <button
          onClick={() => updateServiceWorker(true)}
          className="underline underline-offset-2 font-semibold text-amber-400 hover:text-amber-300 transition-colors"
        >
          Update now
        </button>
      </span>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss update notification"
        className="text-secondary-400 hover:text-secondary-200 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
