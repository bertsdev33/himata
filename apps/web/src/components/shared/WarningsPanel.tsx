import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import type { ImportWarning } from "@rental-analytics/core";

interface WarningsPanelProps {
  warnings: ImportWarning[];
}

export function WarningsPanel({ warnings }: WarningsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (warnings.length === 0) return null;

  // Group warnings by code
  const grouped = new Map<string, ImportWarning[]>();
  for (const w of warnings) {
    const existing = grouped.get(w.code) ?? [];
    existing.push(w);
    grouped.set(w.code, existing);
  }

  return (
    <Alert className="mt-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle
        className="cursor-pointer flex items-center gap-1"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Import Warnings ({warnings.length})
      </AlertTitle>
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
