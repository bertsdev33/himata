import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Cell,
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
  projection?: boolean;
}

export function NightsVsAdrChart({ data, currency, projection = false }: NightsVsAdrChartProps) {
  const { chartData, hasProjection } = useMemo(() => {
    const now = new Date();
    const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const scale = dayOfMonth > 0 ? daysInMonth / dayOfMonth : 1;

    // Aggregate by month (single listing data expected but handle multiple)
    const monthMap = new Map<string, { nights: number; gross: number }>();
    for (const lp of data) {
      const existing = monthMap.get(lp.month) ?? { nights: 0, gross: 0 };
      existing.nights += lp.bookedNights;
      existing.gross += lp.grossRevenueMinor;
      monthMap.set(lp.month, existing);
    }

    const entries = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b));
    const hasCurrentMonth = monthMap.has(currentYm);
    const showProjection = projection && hasCurrentMonth && scale > 1;

    const rows = entries.map(([month, values]) => {
      const isProjected = showProjection && month === currentYm;
      const nights = isProjected ? Math.round(values.nights * scale) : values.nights;
      const gross = isProjected ? Math.round(values.gross * scale) : values.gross;
      return {
        month,
        label: formatMonth(month as YearMonth),
        nights,
        adr: nights > 0 ? gross / nights / 100 : 0,
        isProjected,
      };
    });

    return { chartData: rows, hasProjection: showProjection };
  }, [data, projection]);

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
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.month}
                  fill={CHART_COLORS.gross}
                  fillOpacity={entry.isProjected ? 0.35 : 0.7}
                  stroke={entry.isProjected ? CHART_COLORS.gross : undefined}
                  strokeDasharray={entry.isProjected ? "4 4" : undefined}
                />
              ))}
            </Bar>
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
        {hasProjection && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: CHART_COLORS.gross }} />
            Last bar shows projected month-end values
          </p>
        )}
      </CardContent>
    </Card>
  );
}
