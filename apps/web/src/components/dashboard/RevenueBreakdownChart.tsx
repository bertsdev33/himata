import { useMemo } from "react";
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
import { useIsMobile } from "@/hooks/useIsMobile";
import { formatMoney, formatMonth, formatMoneyCompact } from "@/lib/format";
import { useLocaleContext } from "@/i18n/LocaleProvider";
import { useTranslation } from "react-i18next";
import type { MonthlyListingPerformance, YearMonth } from "@rental-analytics/core";

interface RevenueBreakdownChartProps {
  data: MonthlyListingPerformance[];
  currency: string;
  projection?: boolean;
}

export function RevenueBreakdownChart({ data, currency, projection = false }: RevenueBreakdownChartProps) {
  const { locale } = useLocaleContext();
  const { t } = useTranslation("dashboard", { lng: locale });
  const isMobile = useIsMobile();
  const chartData = useMemo(() => {
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

    const now = new Date();
    const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const scale = dayOfMonth > 0 ? daysInMonth / dayOfMonth : 1;

    return [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, values]) => {
        const isCurrentMonth = month === currentYm;
        const showProjection = projection && isCurrentMonth && scale > 1;

        // Actual values (always shown)
        const entry: Record<string, string | number> = {
          label: formatMonth(month as YearMonth, locale),
          Reservations: values.reservation / 100,
          Adjustments: values.adjustment / 100,
          Resolutions: values.resolution / 100,
          Cancellations: values.cancellation / 100,
          Projected: 0,
        };

        if (showProjection) {
          // Projected = (scaled total) - actual total
          const actualTotal = values.reservation + values.adjustment + values.resolution + values.cancellation;
          const projectedTotal = Math.round(actualTotal * scale);
          entry.Projected = (projectedTotal - actualTotal) / 100;
        }

        return entry;
      });
  }, [data, locale, projection]);

  const hasProjection = chartData.some((d) => (d.Projected as number) > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("charts.revenue_breakdown.title")}</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 overflow-hidden">
        <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
          <BarChart data={chartData} margin={{ top: 5, right: isMobile ? 8 : 20, left: isMobile ? 0 : 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" className="text-xs" />
            <YAxis
              tickFormatter={(v) => formatMoneyCompact(v * 100, currency, locale)}
              className="text-xs"
            />
            <Tooltip
              formatter={(value: number) => formatMoney(Math.round(value * 100), currency, locale)}
            />
            <Legend />
            <Bar
              dataKey="Reservations"
              name={t("charts.revenue_breakdown.legend.reservations")}
              stackId="a"
              fill={CHART_COLORS.reservation}
            />
            <Bar
              dataKey="Adjustments"
              name={t("charts.revenue_breakdown.legend.adjustments")}
              stackId="a"
              fill={CHART_COLORS.adjustment}
            />
            <Bar
              dataKey="Resolutions"
              name={t("charts.revenue_breakdown.legend.resolutions")}
              stackId="a"
              fill={CHART_COLORS.resolution}
            />
            <Bar
              dataKey="Cancellations"
              name={t("charts.revenue_breakdown.legend.cancellations")}
              stackId="a"
              fill={CHART_COLORS.cancellation}
            />
            {hasProjection && (
              <Bar
                dataKey="Projected"
                name={t("charts.revenue_breakdown.legend.projected")}
                stackId="a"
                fill={CHART_COLORS.forecast}
                fillOpacity={0.6}
                strokeDasharray="4 4"
                stroke={CHART_COLORS.forecast}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
