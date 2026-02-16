import { useMemo } from "react";
import {
  BarChart,
  Bar,
  Cell,
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
  projection?: boolean;
}

export function CashflowSection({ data, currency, projection = false }: CashflowSectionProps) {
  const { chartData, hasProjection } = useMemo(() => {
    // Aggregate cashflow by month
    const monthMap = new Map<string, number>();
    for (const cf of data) {
      monthMap.set(cf.month, (monthMap.get(cf.month) ?? 0) + cf.payoutsMinor);
    }

    const now = new Date();
    const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const scale = dayOfMonth > 0 ? daysInMonth / dayOfMonth : 1;

    const entries = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b));
    const hasCurrentMonth = monthMap.has(currentYm);
    const showProjection = projection && hasCurrentMonth && scale > 1;

    const rows = entries.map(([month, payouts]) => {
      const isProjected = showProjection && month === currentYm;
      return {
        month,
        label: formatMonth(month as YearMonth),
        Payouts: payouts / 100,
        Projected: isProjected ? Math.round(payouts * scale) / 100 : null,
        isProjected,
      };
    });

    return { chartData: rows, hasProjection: showProjection };
  }, [data, projection]);

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
              formatter={(value: number, name: string) => [
                new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency,
                }).format(value),
                name === "Projected" ? "Projected Payouts" : "Payouts",
              ]}
            />
            <Bar dataKey="Payouts" fill={CHART_COLORS.payout} radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.month}
                  fill={CHART_COLORS.payout}
                  fillOpacity={entry.isProjected ? 0.4 : 1}
                />
              ))}
            </Bar>
            {hasProjection && (
              <Bar
                dataKey="Projected"
                fill={CHART_COLORS.forecast}
                radius={[4, 4, 0, 0]}
                fillOpacity={0.5}
                strokeDasharray="4 4"
                stroke={CHART_COLORS.forecast}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
        {hasProjection && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: CHART_COLORS.forecast }} />
            Dashed bar shows projected month-end payout
          </p>
        )}
      </CardContent>
    </Card>
  );
}
