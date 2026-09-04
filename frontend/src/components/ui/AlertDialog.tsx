import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./Button";

interface AlertDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" shows a red confirm button; "warning" shows amber icon; default is neutral */
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function AlertDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: AlertDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
      document.body.style.overflow = "hidden";
      // Focus cancel button by default — safer UX for destructive dialogs
      cancelRef.current?.focus();
    } else {
      dialog.close();
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const Icon = variant === "warning" ? Info : AlertTriangle;
  const iconColor =
    variant === "warning"
      ? "text-amber-500"
      : variant === "danger"
      ? "text-red-500"
      : "text-secondary-400";

  return (
    <dialog
      ref={dialogRef}
      // Pressing Escape triggers oncancel; prevent closing and treat as cancel
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      // Backdrop click intentionally does NOT close — use buttons only
      className={cn(
        "backdrop:bg-secondary-950/60 backdrop:backdrop-blur-sm",
        "bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-800",
        "rounded-xl shadow-2xl p-0 w-full max-w-md",
        "open:flex flex-col m-auto"
      )}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alert-dialog-title"
      aria-describedby={description ? "alert-dialog-description" : undefined}
    >
      <div className="flex gap-4 px-6 pt-6 pb-4">
        <div className={cn("flex-shrink-0 mt-0.5", iconColor)}>
          <Icon size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <h2
            id="alert-dialog-title"
            className="text-base font-semibold text-secondary-900 dark:text-secondary-50 leading-snug"
          >
            {title}
          </h2>
          {description && (
            <p
              id="alert-dialog-description"
              className="mt-1.5 text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed"
            >
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-secondary-100 dark:border-secondary-800">
        <Button ref={cancelRef} variant="outline" size="sm" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          variant={variant === "default" ? "primary" : "danger"}
          size="sm"
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}

// ─── Imperative API ────────────────────────────────────────────────────────────

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
}

/**
 * Drop-in async replacement for window.confirm().
 *
 *   const ok = await confirm({ title: "Delete item?", description: "Cannot be undone." });
 *   if (!ok) return;
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const cleanup = (result: boolean) => {
      root.unmount();
      container.remove();
      resolve(result);
    };

    root.render(
      <AlertDialog
        open={true}
        title={options.title}
        description={options.description}
        confirmLabel={options.confirmLabel ?? "Confirm"}
        cancelLabel={options.cancelLabel ?? "Cancel"}
        variant={options.variant ?? "danger"}
        onConfirm={() => cleanup(true)}
        onCancel={() => cleanup(false)}
      />
    );
  });
}
