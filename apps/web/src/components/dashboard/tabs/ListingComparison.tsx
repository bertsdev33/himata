import { ListingsTable } from "../ListingsTable";
import { MultiLineRevenueChart } from "../MultiLineRevenueChart";
import type { MonthlyListingPerformance } from "@rental-analytics/core";

interface ListingComparisonProps {
  listingPerf: MonthlyListingPerformance[];
  currency: string;
  onSelectListing: (listingId: string) => void;
}

export function ListingComparison({
  listingPerf,
  currency,
  onSelectListing,
}: ListingComparisonProps) {
  return (
    <div className="space-y-6">
      <MultiLineRevenueChart
        data={listingPerf}
        currency={currency}
      />
      <ListingsTable
        data={listingPerf}
        currency={currency}
        onSelectListing={onSelectListing}
      />
    </div>
  );
}
