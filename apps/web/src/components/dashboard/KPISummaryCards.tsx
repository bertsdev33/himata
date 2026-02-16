import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { formatMoney, formatPercent } from "@/lib/format";
import type { MonthlyPortfolioPerformance, EstimatedOccupancy } from "@rental-analytics/core";
import { Info } from "lucide-react";

interface KPISummaryCardsProps {
  portfolioPerf: MonthlyPortfolioPerformance[];
  occupancy: EstimatedOccupancy[];
  currency: string;
}

export function KPISummaryCards({
  portfolioPerf,
  occupancy,
  currency,
}: KPISummaryCardsProps) {
  // Aggregate totals
  const totalNet = portfolioPerf.reduce((sum, p) => sum + p.netRevenueMinor, 0);
  const totalGross = portfolioPerf.reduce((sum, p) => sum + p.grossRevenueMinor, 0);
  const totalNights = portfolioPerf.reduce((sum, p) => sum + p.bookedNights, 0);

  // ADR = gross / nights
  const adr = totalNights > 0 ? Math.round(totalGross / totalNights) : 0;

  // Average occupancy across all months
  const occupancyRates = occupancy
    .filter((o) => o.estimatedOccupancyRate !== null)
    .map((o) => o.estimatedOccupancyRate!);
  const avgOccupancy =
    occupancyRates.length > 0
      ? occupancyRates.reduce((a, b) => a + b, 0) / occupancyRates.length
      : null;

  const cards = [
    {
      title: "Total Net Revenue",
      value: formatMoney(totalNet, currency),
    },
    {
      title: "Total Gross Revenue",
      value: formatMoney(totalGross, currency),
    },
    {
      title: "Est. Occupancy",
      value: formatPercent(avgOccupancy),
      tooltip: "booked nights / (days_in_month * listings_in_service); not true occupancy",
    },
    {
      title: "Avg. Daily Rate",
      value: formatMoney(adr, currency),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <p className="text-2xl font-bold">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
