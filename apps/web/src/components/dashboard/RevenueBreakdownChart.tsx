import {
  BarChart,
  Bar,
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

interface RevenueBreakdownChartProps {
  data: MonthlyListingPerformance[];
  currency: string;
}

export function RevenueBreakdownChart({ data, currency }: RevenueBreakdownChartProps) {
  // Aggregate by month across all listings
  const monthMap = new Map<
    string,
    { reservation: number; adjustment: number; resolution: number; cancellation: number }
  >();

  for (const lp of data) {
    const existing = monthMap.get(lp.month) ?? {
      reservation: 0,
      adjustment: 0,
      resolution: 0,
      cancellation: 0,
    };
    existing.reservation += lp.reservationRevenueMinor;
    existing.adjustment += lp.adjustmentRevenueMinor;
    existing.resolution += lp.resolutionAdjustmentRevenueMinor;
    existing.cancellation += lp.cancellationFeeRevenueMinor;
    monthMap.set(lp.month, existing);
  }

  const chartData = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, values]) => ({
      label: formatMonth(month as YearMonth),
      Reservations: values.reservation / 100,
      Adjustments: values.adjustment / 100,
      Resolutions: values.resolution / 100,
      Cancellations: values.cancellation / 100,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Revenue Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
            <Bar dataKey="Reservations" stackId="a" fill={CHART_COLORS.reservation} />
            <Bar dataKey="Adjustments" stackId="a" fill={CHART_COLORS.adjustment} />
            <Bar dataKey="Resolutions" stackId="a" fill={CHART_COLORS.resolution} />
            <Bar dataKey="Cancellations" stackId="a" fill={CHART_COLORS.cancellation} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
