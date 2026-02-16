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
import { CHART_COLORS } from "@/lib/chart-colors";
import { formatMonth, formatMoneyCompact } from "@/lib/format";
import type { MonthlyCashflow, YearMonth } from "@rental-analytics/core";

interface CashflowSectionProps {
  data: MonthlyCashflow[];
  currency: string;
}

export function CashflowSection({ data, currency }: CashflowSectionProps) {
  // Aggregate cashflow by month
  const monthMap = new Map<string, number>();
  for (const cf of data) {
    monthMap.set(cf.month, (monthMap.get(cf.month) ?? 0) + cf.payoutsMinor);
  }

  const chartData = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, payouts]) => ({
      label: formatMonth(month as YearMonth),
      Payouts: payouts / 100,
    }));

  if (chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Monthly Payouts</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
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
            <Bar dataKey="Payouts" fill={CHART_COLORS.payout} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
