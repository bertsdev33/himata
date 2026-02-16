import { KPISummaryCards } from "../KPISummaryCards";
import { RevenueTrendChart } from "../RevenueTrendChart";
import { RevenueBreakdownChart } from "../RevenueBreakdownChart";
import { TopMoversTable } from "../TopMoversTable";
import { TrailingComparisons } from "../TrailingComparisons";
import { SeasonalityHeatmap } from "../SeasonalityHeatmap";
import { OccupancyHeatmaps } from "../OccupancyHeatmaps";
import type {
  MonthlyPortfolioPerformance,
  MonthlyListingPerformance,
  TrailingComparison,
  EstimatedOccupancy,
  CanonicalTransaction,
} from "@rental-analytics/core";

interface PortfolioOverviewProps {
  portfolioPerf: MonthlyPortfolioPerformance[];
  listingPerf: MonthlyListingPerformance[];
  trailing: TrailingComparison[];
  occupancy: EstimatedOccupancy[];
  transactions: CanonicalTransaction[];
  currency: string;
  projection: boolean;
  hasProjection: boolean;
}

export function PortfolioOverview({
  portfolioPerf,
  listingPerf,
  trailing,
  occupancy,
  transactions,
  currency,
  projection,
  hasProjection,
}: PortfolioOverviewProps) {
  return (
    <div className="space-y-6">
      <KPISummaryCards
        portfolioPerf={portfolioPerf}
        occupancy={occupancy}
        currency={currency}
        hasProjection={hasProjection}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RevenueTrendChart
          data={portfolioPerf}
          currency={currency}
          projection={projection}
        />
        <RevenueBreakdownChart data={listingPerf} currency={currency} projection={projection} />
      </div>

      <TopMoversTable listingPerf={listingPerf} currency={currency} projection={projection} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SeasonalityHeatmap data={portfolioPerf} currency={currency} />
        <OccupancyHeatmaps transactions={transactions} />
      </div>

      <TrailingComparisons data={trailing} currency={currency} />
    </div>
  );
}
