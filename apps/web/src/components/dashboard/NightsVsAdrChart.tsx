import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
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
import type { MonthlyListingPerformance, YearMonth } from "@rental-analytics/core";

interface NightsVsAdrChartProps {
  data: MonthlyListingPerformance[];
  currency: string;
}

export function NightsVsAdrChart({ data, currency }: NightsVsAdrChartProps) {
  const chartData = useMemo(() => {
    // Aggregate by month (single listing data expected but handle multiple)
    const monthMap = new Map<string, { nights: number; gross: number }>();
    for (const lp of data) {
      const existing = monthMap.get(lp.month) ?? { nights: 0, gross: 0 };
      existing.nights += lp.bookedNights;
      existing.gross += lp.grossRevenueMinor;
      monthMap.set(lp.month, existing);
    }

    return [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => ({
        label: formatMonth(month as YearMonth),
        nights: values.nights,
        adr: values.nights > 0 ? values.gross / values.nights / 100 : 0,
      }));
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nights vs ADR</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" className="text-xs" />
            <YAxis yAxisId="left" className="text-xs" />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => formatMoneyCompact(v * 100, currency)}
              className="text-xs"
            />
            <Tooltip
              formatter={(value: number, name: string) =>
                name === "ADR"
                  ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value)
                  : value
              }
            />
            <Legend />
            <Bar
              yAxisId="left"
              dataKey="nights"
              name="Booked Nights"
              fill={CHART_COLORS.gross}
              fillOpacity={0.7}
              radius={[4, 4, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="adr"
              name="ADR"
              stroke={CHART_COLORS.net}
              strokeWidth={2}
              dot
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
