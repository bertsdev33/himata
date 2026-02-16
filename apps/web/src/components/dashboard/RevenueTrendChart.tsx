import {
  AreaChart,
  Area,
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

interface RevenueTrendChartProps {
  data: MonthlyPortfolioPerformance[];
  currency: string;
}

export function RevenueTrendChart({ data, currency }: RevenueTrendChartProps) {
  const chartData = data.map((d) => ({
    month: d.month,
    label: formatMonth(d.month as YearMonth),
    gross: d.grossRevenueMinor / 100,
    net: d.netRevenueMinor / 100,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Revenue Trend</CardTitle>
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
            <Area
              type="monotone"
              dataKey="gross"
              name="Gross Revenue"
              stroke={CHART_COLORS.gross}
              fill={CHART_COLORS.gross}
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="net"
              name="Net Revenue"
              stroke={CHART_COLORS.net}
              fill={CHART_COLORS.net}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
