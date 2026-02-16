import type { CanonicalTransaction } from "@rental-analytics/core";
import {
  allocatePerformanceToMonths,
  computeMonthlyListingPerformance,
  computeMonthlyPortfolioPerformance,
  computeTrailingComparisons,
  inferListingServiceRanges,
  computeEstimatedOccupancy,
  computeMonthlyCashflow,
} from "@rental-analytics/core";
import {
  importAirbnbV1Session,
  type ImportAirbnbV1Input,
} from "@rental-analytics/importer-airbnb-v1";
import type { FileEntry, AnalyticsData, ViewData } from "./types";
import { readFileAsText } from "@/lib/file-helpers";

/**
 * Compute a ViewData from a subset of transactions.
 */
function computeViewData(
  transactions: CanonicalTransaction[],
  listingNames: Map<string, string>,
): ViewData {
  if (transactions.length === 0) {
    return {
      listingPerformance: [],
      portfolioPerformance: [],
      cashflow: [],
      trailing: [],
      occupancy: [],
    };
  }

  const allocations = allocatePerformanceToMonths(transactions);
  const listingPerformance = computeMonthlyListingPerformance(allocations, listingNames);
  const portfolioPerformance = computeMonthlyPortfolioPerformance(listingPerformance);
  const trailing = computeTrailingComparisons(listingPerformance);
  const serviceRanges = inferListingServiceRanges(listingPerformance, transactions);
  const occupancy = computeEstimatedOccupancy(listingPerformance, serviceRanges);
  const cashflow = computeMonthlyCashflow(transactions);

  return { listingPerformance, portfolioPerformance, cashflow, trailing, occupancy };
}

/**
 * Pure, synchronous pipeline: ImportAirbnbV1Input[] -> AnalyticsData.
 * Exported for testing.
 */
export function computeAnalyticsFromInputs(inputs: ImportAirbnbV1Input[]): AnalyticsData {
  const { transactions, warnings } = importAirbnbV1Session(inputs);

  // Build listing name map and metadata
  const listingNames = new Map<string, string>();
  const listingSet = new Map<string, { listingId: string; listingName: string; accountId: string }>();
  const accountIdSet = new Set<string>();
  const currencyCounts = new Map<string, number>();
  const txCountMap = new Map<string, number>();

  for (const tx of transactions) {
    if (tx.listing) {
      listingNames.set(tx.listing.listingId, tx.listing.listingName);
      accountIdSet.add(tx.listing.accountId);
      txCountMap.set(tx.listing.listingId, (txCountMap.get(tx.listing.listingId) ?? 0) + 1);
      if (!listingSet.has(tx.listing.listingId)) {
        listingSet.set(tx.listing.listingId, {
          listingId: tx.listing.listingId,
          listingName: tx.listing.listingName,
          accountId: tx.listing.accountId,
        });
      }
    }
    const c = tx.netAmount.currency;
    currencyCounts.set(c, (currencyCounts.get(c) ?? 0) + 1);
  }

  // Primary currency = most frequent
  const currencies = [...currencyCounts.keys()].sort();
  const currency =
    [...currencyCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";

  // Partition transactions by datasetKind
  const paidTx = transactions.filter((tx) => tx.datasetKind === "paid");
  const upcomingTx = transactions.filter((tx) => tx.datasetKind === "upcoming");

  // Compute per-view analytics
  const allView = computeViewData(transactions, listingNames);
  const realizedView = computeViewData(paidTx, listingNames);
  const forecastView = computeViewData(upcomingTx, listingNames);

  // Service ranges from all transactions
  const serviceRanges = inferListingServiceRanges(allView.listingPerformance, transactions);

  return {
    transactions,
    warnings,
    serviceRanges,
    currency,
    currencies,
    accountIds: [...accountIdSet].sort(),
    listingNames,
    listings: [...listingSet.values()]
      .map((l) => ({ ...l, transactionCount: txCountMap.get(l.listingId) ?? 0 }))
      .sort((a, b) => b.transactionCount - a.transactionCount || a.listingName.localeCompare(b.listingName)),
    views: {
      all: allView,
      realized: realizedView,
      forecast: forecastView,
    },
  };
}

/**
 * Async entry point: reads File objects, then runs the pure pipeline.
 */
export async function computeAnalytics(files: FileEntry[]): Promise<AnalyticsData> {
  const inputs: ImportAirbnbV1Input[] = await Promise.all(
    files.map(async (entry) => ({
      fileName: entry.file.name,
      csvText: await readFileAsText(entry.file),
      accountId: entry.accountId,
      datasetKind: entry.datasetKind,
    }))
  );

  return computeAnalyticsFromInputs(inputs);
}
