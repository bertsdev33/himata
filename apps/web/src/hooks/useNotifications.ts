import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { ImportWarning } from "@rental-analytics/core";
import type { MlForecastRefreshStatus } from "@/lib/ml-forecast-refresh-types";

export interface NotificationItem {
  id: string;
  kind: "import" | "forecast";
  severity: "warning" | "error";
  code: string;
  count: number;
  warnings?: ImportWarning[];
  forecastError?: string | null;
  isRead: boolean;
}

interface UseNotificationsInput {
  warnings: ImportWarning[];
  forecastStatus: {
    status: MlForecastRefreshStatus;
    error: string | null;
  };
}

export function useNotifications({ warnings, forecastStatus }: UseNotificationsInput) {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const prevWarningsRef = useRef(warnings);

  // Reset import read state when warnings array reference changes (new import)
  useEffect(() => {
    if (warnings !== prevWarningsRef.current) {
      prevWarningsRef.current = warnings;
      setReadIds((prev) => {
        const next = new Set<string>();
        for (const id of prev) {
          if (id.startsWith("forecast:")) next.add(id);
        }
        return next;
      });
    }
  }, [warnings]);

  const items = useMemo<NotificationItem[]>(() => {
    const result: NotificationItem[] = [];

    // Group warnings by code
    const grouped = new Map<string, ImportWarning[]>();
    for (const w of warnings) {
      const existing = grouped.get(w.code) ?? [];
      existing.push(w);
      grouped.set(w.code, existing);
    }

    for (const [code, group] of grouped) {
      const id = `import:${code}`;
      result.push({
        id,
        kind: "import",
        severity: "warning",
        code,
        count: group.length,
        warnings: group,
        isRead: readIds.has(id),
      });
    }

    // Forecast items
    if (forecastStatus.status === "failed") {
      const id = "forecast:failed";
      result.push({
        id,
        kind: "forecast",
        severity: "error",
        code: "failed",
        count: 1,
        forecastError: forecastStatus.error,
        isRead: readIds.has(id),
      });
    } else if (forecastStatus.status === "stale") {
      const id = "forecast:stale";
      result.push({
        id,
        kind: "forecast",
        severity: "warning",
        code: "stale",
        count: 1,
        isRead: readIds.has(id),
      });
    }

    return result;
  }, [warnings, forecastStatus.status, forecastStatus.error, readIds]);

  const unreadCount = useMemo(() => items.filter((i) => !i.isRead).length, [items]);

  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => new Set(prev).add(id));
  }, []);

  const markAllAsRead = useCallback(() => {
    setReadIds(new Set(items.map((i) => i.id)));
  }, [items]);

  return { items, unreadCount, markAsRead, markAllAsRead };
}
