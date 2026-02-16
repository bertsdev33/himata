import { ListingsTable } from "../ListingsTable";
import { MultiLineRevenueChart } from "../MultiLineRevenueChart";
import type { MonthlyListingPerformance } from "@rental-analytics/core";

interface ListingComparisonProps {
  listingPerf: MonthlyListingPerformance[];
  currency: string;
  projection: boolean;
  onSelectListing: (listingId: string) => void;
}

export function ListingComparison({
  listingPerf,
  currency,
  projection,
  onSelectListing,
}: ListingComparisonProps) {
  return (
    <div className="space-y-6">
      <MultiLineRevenueChart
        data={listingPerf}
        currency={currency}
        projection={projection}
      />
      <ListingsTable
        data={listingPerf}
        currency={currency}
        onSelectListing={onSelectListing}
      />
    </div>
  );
}
