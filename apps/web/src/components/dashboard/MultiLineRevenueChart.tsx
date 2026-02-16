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
import { MULTI_LINE_COLORS } from "@/lib/chart-colors";
import { formatMonth, formatMoneyCompact } from "@/lib/format";
import type { MonthlyListingPerformance, YearMonth } from "@rental-analytics/core";
import type { RevenueBasis } from "@/app/types";

interface MultiLineRevenueChartProps {
  data: MonthlyListingPerformance[];
  currency: string;
  revenueBasis?: RevenueBasis;
}

export function MultiLineRevenueChart({
  data,
  currency,
  revenueBasis = "net",
}: MultiLineRevenueChartProps) {
  const [showAll, setShowAll] = useState(false);

  const { chartData, listingIds, listingNames } = useMemo(() => {
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
    const selectedIds = showAll
      ? ranked.map(([id]) => id)
      : ranked.slice(0, 5).map(([id]) => id);
    const selectedSet = new Set(selectedIds);

    // Build chart data: one row per month with a key per listing
    const monthMap = new Map<string, Record<string, number>>();
    for (const lp of data) {
      if (!selectedSet.has(lp.listingId)) continue;
      const row = monthMap.get(lp.month) ?? {};
      const val = isNet ? lp.netRevenueMinor : lp.grossRevenueMinor;
      row[lp.listingId] = (row[lp.listingId] ?? 0) + val / 100;
      monthMap.set(lp.month, row);
    }

    const rows = [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({
        label: formatMonth(month as YearMonth),
        ...values,
      }));

    return { chartData: rows, listingIds: selectedIds, listingNames: names };
  }, [data, revenueBasis, showAll]);

  const totalListings = new Set(data.map((lp) => lp.listingId)).size;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Revenue by Listing</CardTitle>
        {totalListings > 5 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Top 5" : `Show All (${totalListings})`}
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
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
