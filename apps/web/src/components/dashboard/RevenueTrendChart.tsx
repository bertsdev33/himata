import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_COLORS } from "@/lib/chart-colors";
import { formatMonth, formatMoneyCompact } from "@/lib/format";
import type { MonthlyPortfolioPerformance, YearMonth } from "@rental-analytics/core";
import type { RevenueBasis } from "@/app/types";

interface RevenueTrendChartProps {
  data: MonthlyPortfolioPerformance[];
  currency: string;
  projection?: boolean;
}

const BASIS_OPTIONS: { value: RevenueBasis; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "net", label: "Net" },
  { value: "gross", label: "Gross" },
];

export function RevenueTrendChart({
  data,
  currency,
  projection = false,
}: RevenueTrendChartProps) {
  const [revenueBasis, setRevenueBasis] = useState<RevenueBasis>("both");
  const isBoth = revenueBasis === "both";

  const chartData = useMemo(() => {
    const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month));

    return sorted.map((d, i) => {
      const isProjected = projection && i === sorted.length - 1;

      // Trailing 6-month average (based on net for single, primary for both)
      const windowStart = Math.max(0, i - 5);
      const windowSlice = sorted.slice(windowStart, i + 1);
      const primaryKey = revenueBasis === "gross" ? "grossRevenueMinor" : "netRevenueMinor";
      const avgValue =
        windowSlice.reduce((s, w) => s + w[primaryKey], 0) / windowSlice.length;

      return {
        label: formatMonth(d.month as YearMonth),
        gross: d.grossRevenueMinor / 100,
        net: d.netRevenueMinor / 100,
        trailingAvg: avgValue / 100,
        isProjected,
      };
    });
  }, [data, revenueBasis, projection]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Revenue Trend</CardTitle>
        <div className="flex items-center gap-0.5 rounded-lg border p-0.5">
          {BASIS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRevenueBasis(opt.value)}
              className={`px-2 py-0.5 text-xs font-medium rounded-md transition-colors ${
                revenueBasis === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
              labelFormatter={(label) => label}
            />
            <Legend />

            {/* Gross line/area */}
            {(isBoth || revenueBasis === "gross") && (
              <Area
                type="monotone"
                dataKey="gross"
                name="Gross Revenue"
                stroke={CHART_COLORS.gross}
                fill={CHART_COLORS.gross}
                fillOpacity={0.15}
                strokeWidth={2}
                connectNulls
              />
            )}

            {/* Net line/area */}
            {(isBoth || revenueBasis === "net") && (
              <Area
                type="monotone"
                dataKey="net"
                name="Net Revenue"
                stroke={CHART_COLORS.net}
                fill={CHART_COLORS.net}
                fillOpacity={0.15}
                strokeWidth={2}
                connectNulls
              />
            )}

            {/* Trailing average */}
            <Line
              type="monotone"
              dataKey="trailingAvg"
              name="6-mo Avg"
              stroke={CHART_COLORS.trailingAvg}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
