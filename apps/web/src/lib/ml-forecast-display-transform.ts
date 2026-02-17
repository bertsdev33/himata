import { buildPortfolio } from "@rental-analytics/forecasting";
import type { ForecastResult, ListingForecast } from "@rental-analytics/forecasting";

export function transformMlForecastForDisplay(args: {
  forecast: ForecastResult | null;
  selectedAccountIds: string[];
  selectedListingIds: string[];
  dateRange: { start: string | null; end: string | null };
}): ForecastResult | null {
  const { forecast, selectedAccountIds, selectedListingIds, dateRange } = args;
  if (!forecast || forecast.listings.length === 0) return null;

  let filtered: ListingForecast[] = forecast.listings;

  if (selectedAccountIds.length > 0) {
    const accountSet = new Set(selectedAccountIds);
    filtered = filtered.filter((listing) => accountSet.has(listing.accountId));
  }

  if (selectedListingIds.length > 0) {
    const listingSet = new Set(selectedListingIds);
    filtered = filtered.filter((listing) => listingSet.has(listing.listingId));
  }

  if (dateRange.start) {
    filtered = filtered.filter((listing) => listing.targetMonth >= dateRange.start!);
  }
  if (dateRange.end) {
    filtered = filtered.filter((listing) => listing.targetMonth <= dateRange.end!);
  }

  if (filtered.length === 0) return null;

  const byMonth = new Map<string, ListingForecast[]>();
  for (const listing of filtered) {
    const group = byMonth.get(listing.targetMonth);
    if (group) group.push(listing);
    else byMonth.set(listing.targetMonth, [listing]);
  }

  let largestGroup: ListingForecast[] = [];
  for (const group of byMonth.values()) {
    if (group.length > largestGroup.length) largestGroup = group;
  }

  let filteredExcluded = forecast.excluded;
  if (selectedAccountIds.length > 0) {
    const accountSet = new Set(selectedAccountIds);
    filteredExcluded = filteredExcluded.filter((excluded) => accountSet.has(excluded.accountId));
  }
  if (selectedListingIds.length > 0) {
    const listingSet = new Set(selectedListingIds);
    filteredExcluded = filteredExcluded.filter((excluded) => listingSet.has(excluded.listingId));
  }

  return {
    portfolio: buildPortfolio(largestGroup),
    listings: filtered,
    excluded: filteredExcluded,
  };
}

