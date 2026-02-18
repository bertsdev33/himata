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
import { formatMoney, formatMonth, formatMoneyCompact } from "@/lib/format";
import { useLocaleContext } from "@/i18n/LocaleProvider";
import { useTranslation } from "react-i18next";
import type { MonthlyPortfolioPerformance, YearMonth } from "@rental-analytics/core";
import type { RevenueBasis } from "@/app/types";

interface RevenueTrendChartProps {
  data: MonthlyPortfolioPerformance[];
  currency: string;
  projection?: boolean;
}

const BASIS_OPTIONS: RevenueBasis[] = ["both", "net", "gross"];

export function RevenueTrendChart({
  data,
  currency,
  projection = false,
}: RevenueTrendChartProps) {
  const { locale } = useLocaleContext();
  const { t } = useTranslation("dashboard", { lng: locale });
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
        label: formatMonth(d.month as YearMonth, locale),
        gross: d.grossRevenueMinor / 100,
        net: d.netRevenueMinor / 100,
        trailingAvg: avgValue / 100,
        isProjected,
      };
    });
  }, [data, locale, revenueBasis, projection]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 space-y-0 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">{t("charts.revenue_trend.title")}</CardTitle>
        <div className="flex w-full items-center gap-0.5 rounded-lg border p-0.5 sm:w-auto">
          {BASIS_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setRevenueBasis(opt)}
              className={`flex-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors sm:flex-none ${
                revenueBasis === opt
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`charts.revenue_trend.basis.${opt}`)}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="min-w-0 overflow-hidden">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" className="text-xs" />
            <YAxis
              tickFormatter={(v) => formatMoneyCompact(v * 100, currency, locale)}
              className="text-xs"
            />
            <Tooltip
              formatter={(value: number) => formatMoney(Math.round(value * 100), currency, locale)}
              labelFormatter={(label) => label}
            />
            <Legend />

            {/* Gross line/area */}
            {(isBoth || revenueBasis === "gross") && (
              <Area
                type="monotone"
                dataKey="gross"
                name={t("charts.revenue_trend.legend.gross_revenue")}
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
                name={t("charts.revenue_trend.legend.net_revenue")}
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
              name={t("charts.revenue_trend.legend.trailing_avg")}
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
