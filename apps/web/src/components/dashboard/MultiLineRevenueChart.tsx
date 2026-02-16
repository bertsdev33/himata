import { useMemo, useState } from "react";
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
import { formatMonth, formatMoneyCompact } from "@/lib/format";
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
  const [topOnly, setTopOnly] = useState(false);

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
        label: formatMonth(month as YearMonth),
      };
      for (const id of selectedIds) {
        entry[id] = values[id] ?? 0;
      }
      // Add projected values for current month
      if (showProjection && month === currentYm) {
        for (const id of selectedIds) {
          const actual = (values[id] ?? 0);
          entry[`${id}_projected`] = Math.round(actual * scale * 100) / 100;
        }
      }
      return entry;
    });

    return { chartData: rows, listingIds: selectedIds, listingNames: names, hasProjection: showProjection };
  }, [data, revenueBasis, topOnly, totalListings, projection]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Revenue by Listing</CardTitle>
        {totalListings > 5 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTopOnly(!topOnly)}
          >
            {topOnly ? `Show All (${totalListings})` : "Top 5"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" className="text-xs" />
            <YAxis
              tickFormatter={(v) => formatMoneyCompact(v * 100, currency)}
              className="text-xs"
            />
            <Tooltip
              formatter={(value: number) =>
                new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency,
                }).format(value)
              }
            />
            <Legend />
            {listingIds.map((id, i) => (
              <Line
                key={id}
                type="monotone"
                dataKey={id}
                name={listingNames.get(id) ?? id}
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
                name={`${listingNames.get(id) ?? id} (proj.)`}
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
            Dashed lines show projected month-end values
          </p>
        )}
      </CardContent>
    </Card>
  );
}
