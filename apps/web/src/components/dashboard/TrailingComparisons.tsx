import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, formatDeltaPercent, formatMonth } from "@/lib/format";
import { useLocaleContext } from "@/i18n/LocaleProvider";
import { useTranslation } from "react-i18next";
import type { TrailingComparison, YearMonth } from "@rental-analytics/core";

interface TrailingComparisonsProps {
  data: TrailingComparison[];
  currency: string;
}

export function TrailingComparisons({ data, currency }: TrailingComparisonsProps) {
  const { locale } = useLocaleContext();
  const { t } = useTranslation("dashboard", { lng: locale });
  if (data.length === 0) return null;

  // Show comparisons for the latest month only
  const latestMonth = data.reduce((max, d) => (d.month > max ? d.month : max), data[0].month);
  const latestData = data.filter((d) => d.month === latestMonth);

  if (latestData.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("trailing_comparisons.title", {
            month: formatMonth(latestMonth as YearMonth, locale),
          })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {latestData.map((d, i) => {
            const metricLabel =
              d.metric === "netRevenueMinor"
                ? t("trailing_comparisons.metric.net_revenue")
                : t("trailing_comparisons.metric.gross_revenue");
            const isPositive = d.deltaMinor >= 0;
            return (
              <div key={i} className="rounded-md border p-4">
                <p className="text-sm text-muted-foreground">{metricLabel}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{d.label}</p>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-lg font-semibold">
                    {formatMoney(d.currentMinor, currency, locale)}
                  </span>
                  <span
                    className={`text-sm font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}
                  >
                    {formatDeltaPercent(d.deltaPct, locale)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("trailing_comparisons.baseline", {
                    amount: formatMoney(d.baselineMinor, currency, locale),
                  })}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
