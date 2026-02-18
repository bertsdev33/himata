import { useMemo, useState } from "react";
import { useSettingsContext } from "@/app/settings-context";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CHART_COLORS, MULTI_LINE_COLORS } from "@/lib/chart-colors";
import { useIsMobile } from "@/hooks/useIsMobile";
import { formatMoney, formatMonth, formatMoneyCompact } from "@/lib/format";
import { useLocaleContext } from "@/i18n/LocaleProvider";
import { useTranslation } from "react-i18next";
import type { MonthlyListingPerformance, YearMonth } from "@rental-analytics/core";
import type { RevenueBasis } from "@/app/types";

interface MultiLineRevenueChartProps {
  data: MonthlyListingPerformance[];
  currency: string;
  revenueBasis?: RevenueBasis;
  projection?: boolean;
}

export function MultiLineRevenueChart({
  data,
  currency,
  revenueBasis = "net",
  projection = false,
}: MultiLineRevenueChartProps) {
  const { getListingName } = useSettingsContext();
  const { locale } = useLocaleContext();
  const { t } = useTranslation("dashboard", { lng: locale });
  const [topOnly, setTopOnly] = useState(false);
  const isMobile = useIsMobile();

  const totalListings = new Set(data.map((lp) => lp.listingId)).size;

  const { chartData, listingIds, listingNames, hasProjection } = useMemo(() => {
    const isNet = revenueBasis === "net";

    // Compute total revenue per listing for ranking
    const totals = new Map<string, number>();
    const names = new Map<string, string>();

    for (const lp of data) {
      const val = isNet ? lp.netRevenueMinor : lp.grossRevenueMinor;
      totals.set(lp.listingId, (totals.get(lp.listingId) ?? 0) + val);
      names.set(lp.listingId, lp.listingName);
    }

    // Sort by total revenue, take top 5 or all
    const ranked = [...totals.entries()]
      .sort(([, a], [, b]) => b - a);
    const selectedIds = topOnly && totalListings > 5
      ? ranked.slice(0, 5).map(([id]) => id)
      : ranked.map(([id]) => id);
    const selectedSet = new Set(selectedIds);

    // Projection: scale current month
    const now = new Date();
    const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const scale = dayOfMonth > 0 ? daysInMonth / dayOfMonth : 1;

    // Build chart data: one row per month with a key per listing
    const monthMap = new Map<string, Record<string, number>>();
    for (const lp of data) {
      if (!selectedSet.has(lp.listingId)) continue;
      const row = monthMap.get(lp.month) ?? {};
      const val = isNet ? lp.netRevenueMinor : lp.grossRevenueMinor;
      row[lp.listingId] = (row[lp.listingId] ?? 0) + val / 100;
      monthMap.set(lp.month, row);
    }

    const months = [...monthMap.keys()].sort();
    const lastMonth = months[months.length - 1];
    const showProjection = projection && lastMonth === currentYm && scale > 1;

    const rows = months.map((month) => {
      const values = monthMap.get(month)!;
      const entry: Record<string, string | number> = {
        label: formatMonth(month as YearMonth, locale),
      };
      for (const id of selectedIds) {
        // Comparisons chart should never render below zero.
        entry[id] = Math.max(0, values[id] ?? 0);
      }
      // Add projected values for current month
      if (showProjection && month === currentYm) {
        for (const id of selectedIds) {
          const actual = Math.max(0, values[id] ?? 0);
          entry[`${id}_projected`] = Math.max(0, Math.round(actual * scale * 100) / 100);
        }
      }
      return entry;
    });

    return { chartData: rows, listingIds: selectedIds, listingNames: names, hasProjection: showProjection };
  }, [data, locale, revenueBasis, topOnly, totalListings, projection]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">{t("charts.revenue_by_listing.title")}</CardTitle>
        {totalListings > 5 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTopOnly(!topOnly)}
            className="w-full sm:w-auto"
          >
            {topOnly
              ? t("charts.revenue_by_listing.actions.show_all", { count: totalListings })
              : t("charts.revenue_by_listing.actions.top_5")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="min-w-0 overflow-hidden">
        <ResponsiveContainer width="100%" height={isMobile ? 250 : 350}>
          <LineChart data={chartData} margin={{ top: 5, right: isMobile ? 8 : 20, left: isMobile ? 0 : 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" className="text-xs" />
            <YAxis
              tickFormatter={(v) => formatMoneyCompact(v * 100, currency, locale)}
              className="text-xs"
              domain={[0, "auto"]}
            />
            <Tooltip
              formatter={(value: number) => formatMoney(Math.round(value * 100), currency, locale)}
            />
            {!(isMobile && listingIds.length > 5) && <Legend />}
            {listingIds.map((id, i) => (
              <Line
                key={id}
                type="monotone"
                dataKey={id}
                name={getListingName(id, listingNames.get(id) ?? id)}
                stroke={MULTI_LINE_COLORS[i % MULTI_LINE_COLORS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
            {hasProjection && listingIds.map((id, i) => (
              <Line
                key={`${id}_projected`}
                type="monotone"
                dataKey={`${id}_projected`}
                name={t("charts.revenue_by_listing.projected_name", {
                  name: getListingName(id, listingNames.get(id) ?? id),
                })}
                stroke={MULTI_LINE_COLORS[i % MULTI_LINE_COLORS.length]}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
                legendType="none"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        {hasProjection && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: CHART_COLORS.forecast }} />
            {t("charts.revenue_by_listing.projection_note")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
