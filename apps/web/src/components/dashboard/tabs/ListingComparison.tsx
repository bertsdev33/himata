import { ListingsTable } from "../ListingsTable";
import { MultiLineRevenueChart } from "../MultiLineRevenueChart";
import type { MonthlyListingPerformance } from "@rental-analytics/core";
import type { RevenueBasis } from "@/app/types";

interface ListingComparisonProps {
  listingPerf: MonthlyListingPerformance[];
  currency: string;
  revenueBasis: RevenueBasis;
  onSelectListing: (listingId: string) => void;
}

export function ListingComparison({
  listingPerf,
  currency,
  revenueBasis,
  onSelectListing,
}: ListingComparisonProps) {
  return (
    <div className="space-y-6">
      <MultiLineRevenueChart
        data={listingPerf}
        currency={currency}
        revenueBasis={revenueBasis}
      />
      <ListingsTable
        data={listingPerf}
        currency={currency}
        onSelectListing={onSelectListing}
      />
    </div>
  );
}
