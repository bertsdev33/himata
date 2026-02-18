import { ArrowLeft, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/app/state";
import { useLocaleContext } from "@/i18n/LocaleProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { NotificationBell } from "./NotificationBell";
import type { NotificationItem } from "@/hooks/useNotifications";

interface DashboardHeaderProps {
  notifications?: {
    items: NotificationItem[];
    unreadCount: number;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
  };
}

export function DashboardHeader({ notifications }: DashboardHeaderProps) {
  const { dispatch } = useAppContext();
  const { locale } = useLocaleContext();
  const { t } = useTranslation("common", { lng: locale });

  return (
    <header className="border-b px-4 py-3 sm:py-4 sm:px-6">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">{t("app.title")}</h1>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <LocaleSwitcher className="h-8 w-[80px] text-xs sm:h-9 sm:w-[140px] sm:text-sm" />
          {notifications && (
            <NotificationBell
              items={notifications.items}
              unreadCount={notifications.unreadCount}
              markAsRead={notifications.markAsRead}
              markAllAsRead={notifications.markAllAsRead}
            />
          )}
          {/* Icon-only on mobile, full button on desktop */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => dispatch({ type: "RESET" })}
            className="h-8 w-8 sm:hidden"
            aria-label={t("actions.upload_new_files")}
          >
            <Upload className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => dispatch({ type: "RESET" })}
            className="hidden sm:inline-flex"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("actions.upload_new_files")}
          </Button>
        </div>
      </div>
    </header>
  );
}
