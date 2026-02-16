import { useState, useEffect, useRef, useCallback } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, X } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import type { ImportWarning } from "@rental-analytics/core";

interface WarningsPanelProps {
  warnings: ImportWarning[];
}

export function WarningsPanel({ warnings }: WarningsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const prevWarningsRef = useRef(warnings);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset dismissed state when warnings array changes (new import produces new array)
  useEffect(() => {
    if (warnings !== prevWarningsRef.current) {
      prevWarningsRef.current = warnings;
      // Cancel any pending dismiss timer so new warnings aren't auto-dismissed
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      setIsDismissed(false);
      setIsVisible(true);
    }
  }, [warnings]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  // Handle dismiss with fade-out animation
  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    // Wait for transition to complete before fully removing
    dismissTimerRef.current = setTimeout(() => {
      setIsDismissed(true);
      dismissTimerRef.current = null;
    }, 300);
  }, []);

  if (warnings.length === 0 || isDismissed) return null;

  // Group warnings by code
  const grouped = new Map<string, ImportWarning[]>();
  for (const w of warnings) {
    const existing = grouped.get(w.code) ?? [];
    existing.push(w);
    grouped.set(w.code, existing);
  }

  return (
    <div
      className={`transition-all duration-300 ease-in-out ${
        isVisible
          ? "opacity-100 max-h-[500px] translate-y-0"
          : "opacity-0 max-h-0 -translate-y-2 overflow-hidden"
      }`}
    >
      <Alert className="mt-4 relative">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle
          className="cursor-pointer flex items-center gap-1 pr-8"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Import Warnings ({warnings.length})
        </AlertTitle>
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss warnings"
        >
          <X className="h-4 w-4" />
        </button>
        <div
          className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
            isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <AlertDescription>
              <div className="mt-2 space-y-3">
                {[...grouped.entries()].map(([code, items]) => (
                  <div key={code}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {code.replace(/_/g, " ")} ({items.length})
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {items.slice(0, 10).map((w, i) => (
                        <li key={i} className="text-xs text-muted-foreground">
                          {w.fileName}
                          {w.rowNumber ? `:${w.rowNumber}` : ""} — {w.message}
                        </li>
                      ))}
                      {items.length > 10 && (
                        <li className="text-xs text-muted-foreground italic">
                          ...and {items.length - 10} more
                        </li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </div>
        </div>
      </Alert>
    </div>
  );
}
