import { useState, useEffect, useRef } from "react";
import { Bell, AlertTriangle, XCircle, Check, CheckCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useLocaleContext } from "@/i18n/LocaleProvider";
import type { NotificationItem } from "@/hooks/useNotifications";
import type { ImportWarning } from "@rental-analytics/core";

const MAX_VISIBLE_WARNINGS = 5;

interface NotificationBellProps {
  items: NotificationItem[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

export function NotificationBell({ items, unreadCount, markAsRead, markAllAsRead }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const mobileOverlayRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const { locale } = useLocaleContext();
  const { t } = useTranslation("notifications", { lng: locale });
  const { t: tDq } = useTranslation("data-quality", { lng: locale });

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Click outside closes (desktop only — mobile overlay has its own close button)
  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (e: MouseEvent) => {
      // Skip on mobile — the full-screen overlay handles its own close
      if (window.matchMedia("(max-width: 639px)").matches) return;

      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Lock body scroll on mobile overlay — adapts if viewport resizes
  useEffect(() => {
    if (!isOpen) return;

    const mql = window.matchMedia("(max-width: 639px)");
    const prevOverflow = document.body.style.overflow;

    const applyLock = () => {
      if (mql.matches) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = prevOverflow;
      }
    };

    applyLock();
    mql.addEventListener("change", applyLock);

    return () => {
      document.body.style.overflow = prevOverflow;
      mql.removeEventListener("change", applyLock);
    };
  }, [isOpen]);

  const formatItemLabel = (item: NotificationItem) => {
    if (item.kind === "forecast") {
      return item.code === "failed" ? t("forecast_failed") : t("forecast_stale");
    }
    const codeName = tDq(`warnings.codes.${item.code}`, {
      defaultValue: item.code.replace(/_/g, " "),
    });
    return t("import_group", { name: codeName, count: item.count });
  };

  const formatWarningMessage = (warning: ImportWarning) =>
    warning.messageKey
      ? tDq(`warnings.message_keys.${warning.messageKey}`, {
          ...(warning.params ?? {}),
          defaultValue: warning.message,
        })
      : tDq(`warnings.messages.${warning.code}`, {
          ...(warning.params ?? {}),
          defaultValue: warning.message,
        });

  const renderItemDetails = (item: NotificationItem) => {
    if (item.kind === "forecast") {
      if (item.forecastError) {
        return <p className="mt-1 text-xs text-muted-foreground">{item.forecastError}</p>;
      }
      return null;
    }

    if (!item.warnings || item.warnings.length === 0) return null;

    const visible = item.warnings.slice(0, MAX_VISIBLE_WARNINGS);
    const remaining = item.warnings.length - visible.length;

    return (
      <ul className="mt-1 space-y-0.5">
        {visible.map((w, i) => (
          <li key={i} className="text-xs text-muted-foreground truncate">
            {w.fileName}
            {w.rowNumber ? `:${w.rowNumber}` : ""} — {formatWarningMessage(w)}
          </li>
        ))}
        {remaining > 0 && (
          <li className="text-xs text-muted-foreground italic">
            {tDq("warnings.and_more", { count: remaining })}
          </li>
        )}
      </ul>
    );
  };

  const renderItem = (item: NotificationItem) => (
    <li
      key={item.id}
      className={`flex items-start gap-3 border-b px-4 py-3 last:border-b-0 ${
        item.isRead ? "opacity-50" : ""
      }`}
    >
      {item.severity === "error" ? (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{formatItemLabel(item)}</p>
        {renderItemDetails(item)}
      </div>
      {item.isRead ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label={t("already_read")} />
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => markAsRead(item.id)}
          aria-label={t("mark_read")}
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
      )}
    </li>
  );

  const renderList = () =>
    items.length === 0 ? (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
    ) : (
      <ul>{items.map(renderItem)}</ul>
    );

  return (
    <div className="relative">
      <Button
        ref={bellRef}
        variant="ghost"
        size="icon"
        className="relative h-8 w-8"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={t("title")}
        aria-expanded={isOpen}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          {/* Desktop dropdown */}
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="false"
            className="absolute right-0 top-full z-50 mt-2 hidden w-[380px] max-h-[60vh] overflow-hidden rounded-lg border bg-background shadow-lg sm:flex sm:flex-col"
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">{t("title")}</h2>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={markAllAsRead}>
                  <CheckCheck className="mr-1 h-3.5 w-3.5" />
                  {t("mark_all_read")}
                </Button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">{renderList()}</div>
          </div>

          {/* Mobile full-screen overlay */}
          <div
            ref={mobileOverlayRef}
            className="fixed inset-0 z-50 flex flex-col bg-background sm:hidden"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">{t("title")}</h2>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={markAllAsRead}>
                    <CheckCheck className="mr-1 h-3.5 w-3.5" />
                    {t("mark_all_read")}
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)} aria-label={t("close")}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">{renderList()}</div>
          </div>
        </>
      )}
    </div>
  );
}
