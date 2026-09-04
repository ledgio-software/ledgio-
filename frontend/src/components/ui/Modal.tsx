import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** When true, Escape key and overlay click do not close the modal (prevents accidental data loss). */
  preventEasyClose?: boolean;
}

export function Modal({ isOpen, onClose, title, description, children, className, preventEasyClose }: ModalProps) {
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !preventEasyClose) onClose();
      }}
    >
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="fixed inset-0 z-40 bg-secondary-950/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Content */}
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "flex flex-col w-full max-w-lg max-h-[90vh]",
            "bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-800",
            "rounded-xl shadow-2xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "duration-200",
            className
          )}
          // When preventEasyClose, block Escape and overlay-click-to-close
          onEscapeKeyDown={preventEasyClose ? (e) => e.preventDefault() : undefined}
          onInteractOutside={preventEasyClose ? (e) => e.preventDefault() : undefined}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-100 dark:border-secondary-800 flex-shrink-0">
            <div>
              <Dialog.Title className="text-lg font-semibold text-secondary-900 dark:text-secondary-50">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="text-sm text-secondary-500 dark:text-secondary-400 mt-1">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              onClick={preventEasyClose ? undefined : onClose}
              disabled={preventEasyClose}
              className="rounded-full p-2 hover:bg-secondary-100 dark:hover:bg-secondary-800 text-secondary-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto flex-1">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
