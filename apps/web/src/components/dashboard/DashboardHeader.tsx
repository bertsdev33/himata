import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppContext } from "@/app/state";
import { useLocaleContext } from "@/i18n/LocaleProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

export function DashboardHeader() {
  const { state, dispatch } = useAppContext();
  const { locale } = useLocaleContext();
  const { t } = useTranslation("common", { lng: locale });
  const currency = state.filter.currency ?? state.analytics?.currency ?? "USD";

  return (
    <header className="border-b px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">{t("app.title")}</h1>
          <Badge variant="secondary">{currency}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <LocaleSwitcher />
          <Button
            variant="outline"
            onClick={() => dispatch({ type: "RESET" })}
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("actions.upload_new_files")}
          </Button>
        </div>
      </div>
    </header>
  );
}
