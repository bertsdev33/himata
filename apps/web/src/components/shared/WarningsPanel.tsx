import { useState, useEffect, useRef } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, X } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import type { ImportWarning } from "@rental-analytics/core";

interface WarningsPanelProps {
  warnings: ImportWarning[];
}

export function WarningsPanel({ warnings }: WarningsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const prevWarningsRef = useRef(warnings);

  // Reset dismissed state when warnings array changes (new import produces new array)
  useEffect(() => {
    if (warnings !== prevWarningsRef.current) {
      prevWarningsRef.current = warnings;
      setIsDismissed(false);
    }
  }, [warnings]);

  if (warnings.length === 0 || isDismissed) return null;

  // Group warnings by code
  const grouped = new Map<string, ImportWarning[]>();
  for (const w of warnings) {
    const existing = grouped.get(w.code) ?? [];
    existing.push(w);
    grouped.set(w.code, existing);
  }

  return (
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
        onClick={() => setIsDismissed(true)}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss warnings"
      >
        <X className="h-4 w-4" />
      </button>
      {isOpen && (
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
      )}
    </Alert>
  );
}
