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
import { formatMonth, formatMoneyCompact } from "@/lib/format";
import { AlertTriangle, Loader2 } from "lucide-react";
import { MLForecastSection } from "../MLForecastSection";
import type { MonthlyPortfolioPerformance, MonthlyListingPerformance, YearMonth } from "@rental-analytics/core";
import type { ForecastResult } from "@rental-analytics/forecasting";
import type { MlForecastRefreshStatus, MlForecastSnapshot } from "@/lib/ml-forecast-refresh-types";

interface ForecastTabProps {
  portfolioPerf: MonthlyPortfolioPerformance[];
  listingPerf: MonthlyListingPerformance[];
  currency: string;
  mlForecast?: ForecastResult | null;
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
  mlRefreshStatus,
  mlRefreshError,
  mlRefreshSnapshot,
  mlAutoRefreshEnabled,
  mlWorkerReady,
  onRefreshMlForecast,
}: ForecastTabProps) {
  const revenueData = useMemo(
    () =>
      [...portfolioPerf]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((d) => ({
          label: formatMonth(d.month as YearMonth),
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
        label: formatMonth(month as YearMonth),
        nights,
      }));
  }, [listingPerf]);

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
  let primaryMessage = "Forecast data is based on upcoming/unfulfilled reservations and is subject to change.";
  let actionLabel: string | null = null;
  let actionDisabled = true;
  let actionLoading = false;

  if (refreshing) {
    primaryBannerClass = "border-sky-200 bg-sky-50";
    primaryTextClass = "text-sky-900";
    primaryMessage = "Calculating forecast for current filters in the background.";
    actionLabel = "Calculating...";
    actionDisabled = true;
    actionLoading = true;
  } else if (workerPreparing) {
    primaryBannerClass = "border-blue-200 bg-blue-50";
    primaryTextClass = "text-blue-900";
    primaryMessage = "Preparing forecast engine...";
    actionLabel = "Preparing...";
    actionDisabled = true;
  } else if (failed) {
    primaryBannerClass = "border-red-200 bg-red-50";
    primaryTextClass = "text-red-900";
    primaryMessage = `Could not update forecast${mlRefreshError ? `: ${mlRefreshError}` : "."}`;
    actionLabel = "Retry update";
    actionDisabled = !mlWorkerReady;
  } else if (manualMode && outdated) {
    primaryBannerClass = "border-amber-200 bg-amber-50";
    primaryTextClass = "text-amber-900";
    primaryMessage = "Forecast is out of date for current filters. Click Refresh to update.";
    actionLabel = "Refresh forecast";
    actionDisabled = !mlWorkerReady;
  } else if (!manualMode && outdated) {
    primaryBannerClass = "border-amber-200 bg-amber-50";
    primaryTextClass = "text-amber-900";
    primaryMessage = "Forecast is out of date for current filters. Auto-refresh will run when the app is idle.";
    actionLabel = mlWorkerReady ? "Refresh now" : "Preparing...";
    actionDisabled = !mlWorkerReady;
  } else if (manualMode && upToDate) {
    primaryBannerClass = "border-emerald-200 bg-emerald-50";
    primaryTextClass = "text-emerald-900";
    primaryMessage = "Data is up to date.";
    actionLabel = "Up to date";
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
          <span>{primaryMessage}</span>
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
            Not enough realized data in the selected date range. Trained on full history for the selected listings.
          </AlertDescription>
        </Alert>
      )}

      {isUnavailableForScope && !hasMlData && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertDescription className="text-orange-900">
            ML forecast is unavailable for the current scope due to insufficient realized training history.
          </AlertDescription>
        </Alert>
      )}

      {mlRefreshSnapshot && (
        <div className="text-xs text-muted-foreground">
          Trained: {new Date(mlRefreshSnapshot.trainedAt).toLocaleString()} · Window{" "}
          {mlRefreshSnapshot.trainingMeta.months.start ?? "?"} to{" "}
          {mlRefreshSnapshot.trainingMeta.months.end ?? "?"} · Rows{" "}
          {mlRefreshSnapshot.trainingMeta.rowCount} · Listings{" "}
          {mlRefreshSnapshot.trainingMeta.listingCount}
        </div>
      )}

      {revenueData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Forward Revenue Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" className="text-xs" />
                <YAxis
                  tickFormatter={(v) => formatMoneyCompact(v * 100, currency)}
                  className="text-xs"
                />
                <Tooltip
                  formatter={(value: number) =>
                    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value)
                  }
                />
                <Bar
                  dataKey="revenue"
                  name="Net Revenue"
                  fill={CHART_COLORS.forecast}
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
            <CardTitle className="text-base">Upcoming Nights by Month</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={nightsData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar
                  dataKey="nights"
                  name="Booked Nights"
                  fill={CHART_COLORS.gross}
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
