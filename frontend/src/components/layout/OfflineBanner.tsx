import { useEffect, useRef, useState } from "react";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { syncDb } from "../../lib/syncEngine";

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [reconnecting, setReconnecting] = useState(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      if (wasOfflineRef.current) {
        setReconnecting(true);
        setTimeout(() => window.location.reload(), 1500);
      }
    };
    const goOffline = () => {
      setIsOnline(false);
      wasOfflineRef.current = true;
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const pendingCount = useLiveQuery(
    () => syncDb.outbox.where("status").equals("pending").count(),
    [],
    0
  );

  if (reconnecting) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm">
        <Wifi size={14} className="flex-shrink-0" />
        <span>Back online — refreshing data…</span>
        <RefreshCw size={13} className="ml-auto animate-spin opacity-70" />
      </div>
    );
  }

  if (isOnline) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm">
      <WifiOff size={14} className="flex-shrink-0" />
      <span>
        You're offline — changes will sync automatically when you reconnect.
        {pendingCount > 0 && (
          <span className="ml-1 font-semibold">
            ({pendingCount} {pendingCount === 1 ? "change" : "changes"} waiting)
          </span>
        )}
      </span>
    </div>
  );
}
