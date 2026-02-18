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
import { formatMoney, formatMonth, formatMoneyCompact } from "@/lib/format";
import { useLocaleContext } from "@/i18n/LocaleProvider";
import { useTranslation } from "react-i18next";
import type { MonthlyCashflow, YearMonth } from "@rental-analytics/core";

interface CashflowSectionProps {
  data: MonthlyCashflow[];
  currency: string;
  projection?: boolean;
}

export function CashflowSection({ data, currency, projection = false }: CashflowSectionProps) {
  const { locale } = useLocaleContext();
  const { t } = useTranslation("cashflow", { lng: locale });
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
        label: formatMonth(month as YearMonth, locale),
        Payouts: payouts / 100,
        Projected: isProjected ? Math.round(payouts * scale) / 100 : null,
        isProjected,
      };
    });

    return { chartData: rows, hasProjection: showProjection };
  }, [data, locale, projection]);

  if (chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("section.monthly_payouts.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" className="text-xs" />
            <YAxis
              tickFormatter={(v) => formatMoneyCompact(v * 100, currency, locale)}
              className="text-xs"
            />
            <Tooltip
              formatter={(value: number, _name: string, props: { dataKey?: string | number }) => [
                formatMoney(Math.round(value * 100), currency, locale),
                props.dataKey === "Projected"
                  ? t("section.monthly_payouts.legend.projected_payouts")
                  : t("section.monthly_payouts.legend.payouts"),
              ]}
            />
            <Bar
              dataKey="Payouts"
              name={t("section.monthly_payouts.legend.payouts")}
              fill={CHART_COLORS.payout}
              radius={[4, 4, 0, 0]}
            >
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
                name={t("section.monthly_payouts.legend.projected_payouts")}
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
            {t("section.monthly_payouts.projection_note")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
