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
    <header className="flex items-center justify-between border-b px-6 py-4">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold tracking-tight">{t("app.title")}</h1>
        <Badge variant="secondary">{currency}</Badge>
      </div>
      <div className="flex items-center gap-3">
        <LocaleSwitcher />
        <Button variant="outline" onClick={() => dispatch({ type: "RESET" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("actions.upload_new_files")}
        </Button>
      </div>
    </header>
  );
}
