import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatPercent, formatDeltaPercent } from "@/lib/format";
import { useLocaleContext } from "@/i18n/LocaleProvider";
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
    <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">projected</Badge>
  ) : null;

  const cards = [
    {
      title: "Total Net Revenue",
      value: formatMoney(totalNet, currency, locale),
      badge: projBadge,
    },
    {
      title: "Total Gross Revenue",
      value: formatMoney(totalGross, currency, locale),
      badge: projBadge,
    },
    {
      title: "Booked Nights",
      value: totalNights.toLocaleString(locale),
    },
    {
      title: "Est. Occupancy",
      value: formatPercent(avgOccupancy, locale),
      tooltip: "booked nights / (days_in_month * listings_in_service); not true occupancy",
    },
    {
      title: "Avg. Daily Rate",
      value: formatMoney(adr, currency, locale),
    },
    {
      title: "MoM Change",
      value: formatDeltaPercent(momChange, locale),
      color: momChange === null ? undefined : momChange >= 0 ? "text-green-600" : "text-red-600",
      tooltip: `Month-over-month ${revenueBasis} revenue change`,
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
