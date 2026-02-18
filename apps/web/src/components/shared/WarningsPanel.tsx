import { useState, useEffect, useRef, useCallback } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useLocaleContext } from "@/i18n/LocaleProvider";
import type { ImportWarning } from "@rental-analytics/core";

interface WarningsPanelProps {
  warnings: ImportWarning[];
}

export function WarningsPanel({ warnings }: WarningsPanelProps) {
  const { locale } = useLocaleContext();
  const { t } = useTranslation("data-quality", { lng: locale });
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

  const formatWarningCode = (code: string) =>
    t(`warnings.codes.${code}`, {
      defaultValue: code.replace(/_/g, " "),
    });

  const formatWarningMessage = (warning: ImportWarning) =>
    warning.messageKey
      ? t(`warnings.message_keys.${warning.messageKey}`, {
          ...(warning.params ?? {}),
          defaultValue: warning.message,
        })
      : t(`warnings.messages.${warning.code}`, {
          ...(warning.params ?? {}),
          defaultValue: warning.message,
        });

  return (
    <div
      className={`transition-all duration-300 ease-in-out ${
        isVisible
          ? "opacity-100 max-h-[500px] translate-y-0 mb-4"
          : "opacity-0 max-h-0 -translate-y-2 overflow-hidden mb-0"
      }`}
    >
      <Alert className="mt-4 relative">
        <AlertTriangle className="h-4 w-4" />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="absolute right-2 top-2 h-7 w-7 text-muted-foreground hover:text-foreground"
          aria-label={t("warnings.dismiss")}
        >
          <X className="h-4 w-4" />
        </Button>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="warnings" className="border-b-0">
            <AccordionTrigger className="py-0 pr-10 hover:no-underline">
              <AlertTitle>{t("warnings.title", { count: warnings.length })}</AlertTitle>
            </AccordionTrigger>
            <AccordionContent className="pb-0 pt-0">
              <AlertDescription>
                <div className="mt-2 space-y-3">
                  {[...grouped.entries()].map(([code, items]) => (
                    <div key={code}>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {formatWarningCode(code)} ({items.length})
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {items.slice(0, 10).map((w, i) => (
                          <li key={i} className="text-xs text-muted-foreground">
                            {w.fileName}
                            {w.rowNumber ? `:${w.rowNumber}` : ""} — {formatWarningMessage(w)}
                          </li>
                        ))}
                        {items.length > 10 && (
                          <li className="text-xs text-muted-foreground italic">
                            {t("warnings.and_more", { count: items.length - 10 })}
                          </li>
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Alert>
    </div>
  );
}
