import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CHART_COLORS } from "@/lib/chart-colors";
import { formatMoney, formatMonth, formatMoneyCompact } from "@/lib/format";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MLForecastSection } from "../MLForecastSection";
import { useLocaleContext } from "@/i18n/LocaleProvider";
import type {
  MonthlyPortfolioPerformance,
  MonthlyListingPerformance,
  YearMonth,
} from "@rental-analytics/core";
import type { ForecastResult } from "@rental-analytics/forecasting";
import type { MlForecastRefreshStatus, MlForecastSnapshot } from "@/lib/ml-forecast-refresh-types";

interface ForecastTabProps {
  portfolioPerf: MonthlyPortfolioPerformance[];
  listingPerf: MonthlyListingPerformance[];
  currency: string;
  mlForecast?: ForecastResult | null;
  nowcastPoint?: { month: string; revenueMinor: number; projected: boolean } | null;
  mlRefreshStatus: MlForecastRefreshStatus;
  mlRefreshError: string | null;
  mlRefreshSnapshot: MlForecastSnapshot | null;
  mlAutoRefreshEnabled: boolean;
  mlWorkerReady: boolean;
  onRefreshMlForecast: () => boolean;
}

export function ForecastTab({
  portfolioPerf,
  listingPerf,
  currency,
  mlForecast,
  nowcastPoint,
  mlRefreshStatus,
  mlRefreshError,
  mlRefreshSnapshot,
  mlAutoRefreshEnabled,
  mlWorkerReady,
  onRefreshMlForecast,
}: ForecastTabProps) {
  const { locale } = useLocaleContext();
  const { t } = useTranslation("forecast", { lng: locale });
  const upcomingRevenueData = useMemo(
    () =>
      [...portfolioPerf]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((d) => ({
          month: d.month,
          revenue: d.netRevenueMinor / 100,
        })),
    [portfolioPerf],
  );

  const nightsData = useMemo(() => {
    const monthMap = new Map<string, number>();
    for (const lp of listingPerf) {
      monthMap.set(lp.month, (monthMap.get(lp.month) ?? 0) + lp.bookedNights);
    }
    return [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, nights]) => ({
        month,
        nights,
      }));
  }, [listingPerf]);

  const revenueData = useMemo(
    () => {
      const rows: Array<{
        month: string;
        forecast: number;
        low: number;
        high: number;
        source: "model_forecast" | "projected_current_month" | "current_month_actual";
      }> = [];

      if (mlForecast && mlForecast.portfolio.targetMonth) {
        rows.push({
          month: mlForecast.portfolio.targetMonth,
          forecast: mlForecast.portfolio.forecastGrossRevenueMinor / 100,
          low: mlForecast.portfolio.lowerBandMinor / 100,
          high: mlForecast.portfolio.upperBandMinor / 100,
          source: "model_forecast",
        });
      }

      if (nowcastPoint) {
        const source: "projected_current_month" | "current_month_actual" = nowcastPoint.projected
          ? "projected_current_month"
          : "current_month_actual";
        const nowcastRow = {
          month: nowcastPoint.month,
          forecast: nowcastPoint.revenueMinor / 100,
          low: nowcastPoint.revenueMinor / 100,
          high: nowcastPoint.revenueMinor / 100,
          source,
        };
        const existingIdx = rows.findIndex((row) => row.month === nowcastPoint.month);
        if (existingIdx >= 0) {
          rows[existingIdx] = nowcastRow;
        } else {
          rows.push(nowcastRow);
        }
      }

      return rows.sort((a, b) => a.month.localeCompare(b.month));
    },
    [mlForecast, nowcastPoint],
  );

  const hasUpcomingData = upcomingRevenueData.length > 0 || nightsData.length > 0;
  const hasMlData = Boolean(mlForecast && mlForecast.listings.length > 0);
  const isFallbackFullHistory =
    mlRefreshSnapshot?.usedFallback ||
    mlRefreshSnapshot?.fallbackReason ===
      "insufficient_data_in_date_range__trained_on_full_history";
  const isUnavailableForScope =
    mlRefreshSnapshot?.fallbackReason === "insufficient_per_listing_history" ||
    mlRefreshSnapshot?.fallbackReason === "insufficient_training_data";
  const manualMode = !mlAutoRefreshEnabled;
  const upToDate = mlRefreshStatus === "up_to_date" && mlRefreshSnapshot !== null;
  const refreshing = mlRefreshStatus === "recomputing";
  const failed = mlRefreshStatus === "failed";
  const outdated = !upToDate && !refreshing && !failed;
  const workerPreparing = !mlWorkerReady && !refreshing;

  let primaryBannerClass = "border-yellow-200 bg-yellow-50";
  let primaryTextClass = "text-yellow-800";
  let primaryMessage = t("status.forecast_status");
  const requiredDisclaimer = t("status.required_disclaimer");
  let actionLabel: string | null = null;
  let actionDisabled = true;
  let actionLoading = false;

  if (refreshing) {
    primaryBannerClass = "border-sky-200 bg-sky-50";
    primaryTextClass = "text-sky-900";
    primaryMessage = t("status.calculating_in_background");
    actionLabel = t("actions.calculating");
    actionDisabled = true;
    actionLoading = true;
  } else if (workerPreparing) {
    primaryBannerClass = "border-blue-200 bg-blue-50";
    primaryTextClass = "text-blue-900";
    primaryMessage = t("status.preparing_engine");
    actionLabel = t("actions.preparing");
    actionDisabled = true;
  } else if (failed) {
    primaryBannerClass = "border-red-200 bg-red-50";
    primaryTextClass = "text-red-900";
    primaryMessage = mlRefreshError
      ? t("status.failed_with_error", { error: mlRefreshError })
      : t("status.failed");
    actionLabel = t("actions.retry_update");
    actionDisabled = !mlWorkerReady;
  } else if (manualMode && outdated) {
    primaryBannerClass = "border-amber-200 bg-amber-50";
    primaryTextClass = "text-amber-900";
    primaryMessage = t("status.outdated_manual");
    actionLabel = t("actions.refresh_forecast");
    actionDisabled = !mlWorkerReady;
  } else if (!manualMode && outdated) {
    primaryBannerClass = "border-amber-200 bg-amber-50";
    primaryTextClass = "text-amber-900";
    primaryMessage = t("status.outdated_auto");
    actionLabel = mlWorkerReady ? t("actions.refresh_now") : t("actions.preparing");
    actionDisabled = !mlWorkerReady;
  } else if (manualMode && upToDate) {
    primaryBannerClass = "border-emerald-200 bg-emerald-50";
    primaryTextClass = "text-emerald-900";
    primaryMessage = t("status.up_to_date");
    actionLabel = t("actions.up_to_date");
    actionDisabled = true;
  }

  return (
    <div className="space-y-6">
      <Alert className={primaryBannerClass}>
        {refreshing ? (
          <Loader2 className="h-4 w-4 animate-spin text-sky-700" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
        )}
        <AlertDescription className={`${primaryTextClass} flex flex-wrap items-center justify-between gap-3`}>
          <span>
            {primaryMessage}
            <span className="block text-xs font-normal">{requiredDisclaimer}</span>
          </span>
          {actionLabel && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRefreshMlForecast}
              disabled={actionDisabled}
            >
              {actionLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {actionLabel}
            </Button>
          )}
        </AlertDescription>
      </Alert>

      {isFallbackFullHistory && (
        <Alert className="border-violet-200 bg-violet-50">
          <AlertDescription className="text-violet-900">
            {t("status.fallback_full_history")}
          </AlertDescription>
        </Alert>
      )}

      {isUnavailableForScope && !hasMlData && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertDescription className="text-orange-900">
            {t("status.unavailable_for_scope")}
          </AlertDescription>
        </Alert>
      )}

      {mlRefreshSnapshot && (
        <div className="text-xs text-muted-foreground">
          {t("meta.summary", {
            trainedAt: new Date(mlRefreshSnapshot.trainedAt).toLocaleString(locale),
            start: mlRefreshSnapshot.trainingMeta.months.start ?? "?",
            end: mlRefreshSnapshot.trainingMeta.months.end ?? "?",
            rowCount: mlRefreshSnapshot.trainingMeta.rowCount,
            listingCount: mlRefreshSnapshot.trainingMeta.listingCount,
          })}
        </div>
      )}

      {hasUpcomingData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("cards.upcoming_revenue.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={upcomingRevenueData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  tickFormatter={(value) => formatMonth(value as YearMonth, locale)}
                  className="text-xs"
                  interval={0}
                />
                <YAxis
                  tickFormatter={(v) => formatMoneyCompact(v * 100, currency, locale)}
                  className="text-xs"
                />
                <Tooltip
                  formatter={(value: number) => formatMoney(Math.round(value * 100), currency, locale)}
                />
                <Bar
                  dataKey="revenue"
                  name={t("cards.upcoming_revenue.net_revenue")}
                  fill={CHART_COLORS.gross}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {nightsData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("cards.upcoming_nights.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={nightsData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  tickFormatter={(value) => formatMonth(value as YearMonth, locale)}
                  className="text-xs"
                  interval={0}
                />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar
                  dataKey="nights"
                  name={t("cards.upcoming_nights.booked_nights")}
                  fill={CHART_COLORS.gross}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {revenueData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("cards.nowcast_forecast.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="month"
                  tickFormatter={(value) => formatMonth(value as YearMonth, locale)}
                  className="text-xs"
                  interval={0}
                />
                <YAxis
                  tickFormatter={(v) => formatMoneyCompact(v * 100, currency, locale)}
                  className="text-xs"
                />
                <Tooltip
                  formatter={(value: number, _name, payload) => {
                    if (!payload) return formatMoney(Math.round(value * 100), currency, locale);
                    const row = payload.payload as {
                      low: number;
                      high: number;
                      source: "model_forecast" | "projected_current_month" | "current_month_actual";
                    };
                    return [
                      row.source === "model_forecast"
                        ? t("cards.nowcast_forecast.range_value", {
                            value: formatMoney(Math.round(value * 100), currency, locale),
                            low: formatMoney(Math.round(row.low * 100), currency, locale),
                            high: formatMoney(Math.round(row.high * 100), currency, locale),
                          })
                        : formatMoney(Math.round(value * 100), currency, locale),
                      t(`cards.nowcast_forecast.source.${row.source}`),
                    ];
                  }}
                />
                <Bar
                  dataKey="forecast"
                  name={t("cards.nowcast_forecast.predicted_revenue")}
                  fill={CHART_COLORS.forecast}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {mlForecast && mlForecast.listings.length > 0 && (
        <MLForecastSection forecast={mlForecast} />
      )}
    </div>
  );
}
