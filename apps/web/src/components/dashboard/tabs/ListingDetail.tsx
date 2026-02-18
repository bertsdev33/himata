import { useMemo } from "react";
import { useSettingsContext } from "@/app/settings-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueTrendChart } from "../RevenueTrendChart";
import { NightsVsAdrChart } from "../NightsVsAdrChart";
import { formatMoney, formatDeltaPercent } from "@/lib/format";
import { projectMonthValue } from "@/lib/dashboard-utils";
import { useLocaleContext } from "@/i18n/LocaleProvider";
import { useTranslation } from "react-i18next";
import {
  computeMonthlyPortfolioPerformance,
} from "@rental-analytics/core";
import type { MonthlyListingPerformance } from "@rental-analytics/core";

interface ListingDetailProps {
  listingPerf: MonthlyListingPerformance[];
  currency: string;
  projection: boolean;
}

export function ListingDetail({
  listingPerf,
  currency,
  projection,
}: ListingDetailProps) {
  const { locale } = useLocaleContext();
  const { t } = useTranslation("dashboard", { lng: locale });
  // Convert listing perf to portfolio perf for RevenueTrendChart
  const portfolioPerf = useMemo(
    () => computeMonthlyPortfolioPerformance(listingPerf),
    [listingPerf],
  );

  const { getListingName } = useSettingsContext();

  const rawListingName =
    listingPerf.length > 0 ? listingPerf[0].listingName : t("listing_detail.fallback_listing_name");
  const listingId = listingPerf.length > 0 ? listingPerf[0].listingId : "";
  const listingName = listingId ? getListingName(listingId, rawListingName) : rawListingName;

  // Under/Over indicator: compare the most recent month against trailing average.
  // When projection is enabled and the current calendar month is in the data,
  // use the current calendar month (with projection) for comparison — this
  // correctly handles datasets that include future/forecast months.
  const indicator = useMemo(() => {
    const months = [...new Set(listingPerf.map((lp) => lp.month))].sort();
    if (months.length < 2) return null;

    const now = new Date();
    const currentCalendarYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthSet = new Set<string>(months);

    // Pick the comparison month: prefer current calendar month when projecting
    // and it exists in the data; otherwise fall back to the most recent month.
    const comparisonMonth =
      projection && monthSet.has(currentCalendarYm)
        ? currentCalendarYm
        : months[months.length - 1];

    const previousMonths = months.filter((m) => m < comparisonMonth);
    if (previousMonths.length === 0) return null;

    let currentVal = listingPerf
      .filter((lp) => lp.month === comparisonMonth)
      .reduce((s, lp) => s + lp.netRevenueMinor, 0);

    const isCurrentMonth = comparisonMonth === currentCalendarYm;

    // Apply projection to the current month value
    if (projection && isCurrentMonth) {
      currentVal = projectMonthValue(currentVal, comparisonMonth);
    }

    const trailingVals = previousMonths.map((m) =>
      listingPerf
        .filter((lp) => lp.month === m)
        .reduce((s, lp) => s + lp.netRevenueMinor, 0),
    );
    const trailingAvg = trailingVals.reduce((a, b) => a + b, 0) / trailingVals.length;

    if (trailingAvg === 0) return null;

    const delta = (currentVal - trailingAvg) / trailingAvg;
    return {
      currentVal,
      trailingAvg,
      delta,
      isOver: delta >= 0,
      isProjected: projection && isCurrentMonth,
    };
  }, [listingPerf, projection]);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{listingName}</h2>

      <RevenueTrendChart
        data={portfolioPerf}
        currency={currency}
        projection={projection}
      />

      <NightsVsAdrChart data={listingPerf} currency={currency} projection={projection} />

      {indicator && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("listing_detail.performance_vs_trailing")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div
                className={`rounded-lg px-4 py-3 text-center ${
                  indicator.isOver
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"
                }`}
              >
                <p
                  className={`text-2xl font-bold ${
                    indicator.isOver ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {formatDeltaPercent(indicator.delta, locale)}
                </p>
                <p
                  className={`text-sm font-medium ${
                    indicator.isOver ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {indicator.isOver
                    ? t("listing_detail.outperforming")
                    : t("listing_detail.underperforming")}
                </p>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  {t("listing_detail.current")}: {formatMoney(indicator.currentVal, currency, locale)}
                  {indicator.isProjected && (
                    <span className="ml-1 text-xs text-yellow-600">
                      ({t("listing_detail.projected")})
                    </span>
                  )}
                </p>
                <p>
                  {t("listing_detail.trailing_avg")}:{" "}
                  {formatMoney(Math.round(indicator.trailingAvg), currency, locale)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
