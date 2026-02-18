import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatPercent, formatDeltaPercent } from "@/lib/format";
import { useLocaleContext } from "@/i18n/LocaleProvider";
import { useTranslation } from "react-i18next";
import type { MonthlyPortfolioPerformance, EstimatedOccupancy } from "@rental-analytics/core";
import { Info } from "lucide-react";
import type { RevenueBasis } from "@/app/types";

interface KPISummaryCardsProps {
  portfolioPerf: MonthlyPortfolioPerformance[];
  occupancy: EstimatedOccupancy[];
  currency: string;
  revenueBasis?: RevenueBasis;
  hasProjection?: boolean;
}

export function KPISummaryCards({
  portfolioPerf,
  occupancy,
  currency,
  revenueBasis = "net",
  hasProjection = false,
}: KPISummaryCardsProps) {
  const { locale } = useLocaleContext();
  const { t } = useTranslation("dashboard", { lng: locale });
  const totalNet = portfolioPerf.reduce((sum, p) => sum + p.netRevenueMinor, 0);
  const totalGross = portfolioPerf.reduce((sum, p) => sum + p.grossRevenueMinor, 0);
  const totalNights = portfolioPerf.reduce((sum, p) => sum + p.bookedNights, 0);

  const adr = totalNights > 0 ? Math.round(totalGross / totalNights) : 0;

  const occupancyRates = occupancy
    .filter((o) => o.estimatedOccupancyRate !== null)
    .map((o) => o.estimatedOccupancyRate!);
  const avgOccupancy =
    occupancyRates.length > 0
      ? occupancyRates.reduce((a, b) => a + b, 0) / occupancyRates.length
      : null;

  // MoM change from last two months
  const momChange = useMemo(() => {
    if (portfolioPerf.length < 2) return null;
    const sorted = [...portfolioPerf].sort((a, b) => a.month.localeCompare(b.month));
    const current = sorted[sorted.length - 1];
    const previous = sorted[sorted.length - 2];
    const currentVal = revenueBasis === "net" ? current.netRevenueMinor : current.grossRevenueMinor;
    const previousVal = revenueBasis === "net" ? previous.netRevenueMinor : previous.grossRevenueMinor;
    if (previousVal === 0) return null;
    return (currentVal - previousVal) / previousVal;
  }, [portfolioPerf, revenueBasis]);

  const projBadge = hasProjection ? (
    <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">
      {t("kpi.badges.projected")}
    </Badge>
  ) : null;

  const cards = [
    {
      title: t("kpi.cards.total_net_revenue"),
      value: formatMoney(totalNet, currency, locale),
      badge: projBadge,
    },
    {
      title: t("kpi.cards.total_gross_revenue"),
      value: formatMoney(totalGross, currency, locale),
      badge: projBadge,
    },
    {
      title: t("kpi.cards.booked_nights"),
      value: totalNights.toLocaleString(locale),
    },
    {
      title: t("kpi.cards.estimated_occupancy"),
      value: formatPercent(avgOccupancy, locale),
      tooltip: t("kpi.tooltips.estimated_occupancy"),
    },
    {
      title: t("kpi.cards.avg_daily_rate"),
      value: formatMoney(adr, currency, locale),
    },
    {
      title: t("kpi.cards.mom_change"),
      value: formatDeltaPercent(momChange, locale),
      color: momChange === null ? undefined : momChange >= 0 ? "text-green-600" : "text-red-600",
      tooltip: t("kpi.tooltips.mom_change", { revenueBasis }),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            {card.tooltip && (
              <Tooltip content={card.tooltip}>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </Tooltip>
            )}
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${card.color ?? ""}`}>
              {card.value}
              {card.badge}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
