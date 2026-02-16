import { useMemo } from "react";
import { useAppContext } from "@/app/state";
import {
  computeMonthlyPortfolioPerformance,
  computeTrailingComparisons,
  computeEstimatedOccupancy,
} from "@rental-analytics/core";
import { DashboardHeader } from "./DashboardHeader";
import { FilterBar } from "./FilterBar";
import { KPISummaryCards } from "./KPISummaryCards";
import { RevenueTrendChart } from "./RevenueTrendChart";
import { RevenueBreakdownChart } from "./RevenueBreakdownChart";
import { CashflowSection } from "./CashflowSection";
import { ListingsTable } from "./ListingsTable";
import { TrailingComparisons } from "./TrailingComparisons";
import { OccupancyDisplay } from "./OccupancyDisplay";
import { WarningsPanel } from "@/components/shared/WarningsPanel";

export function DashboardLayout() {
  const { state } = useAppContext();
  const { analytics, filter } = state;

  if (!analytics) return null;

  const currency = filter.currency ?? analytics.currency;

  // Select pre-computed view data based on viewMode
  const viewData = analytics.views[filter.viewMode];

  // Filter listing performance by scope and currency
  const filteredListingPerf = useMemo(() => {
    let data = viewData.listingPerformance.filter((lp) => lp.currency === currency);

    if (filter.scope === "account" && filter.accountId) {
      data = data.filter((lp) => lp.accountId === filter.accountId);
    } else if (filter.scope === "listing" && filter.listingId) {
      data = data.filter((lp) => lp.listingId === filter.listingId);
    } else if (filter.scope === "listing" && filter.accountId) {
      data = data.filter((lp) => lp.accountId === filter.accountId);
    }

    return data;
  }, [viewData, filter, currency]);

  // Compute portfolio performance from filtered listing data
  const filteredPortfolioPerf = useMemo(() => {
    return computeMonthlyPortfolioPerformance(filteredListingPerf);
  }, [filteredListingPerf]);

  // Compute trailing comparisons from filtered listing data
  const filteredTrailing = useMemo(() => {
    return computeTrailingComparisons(filteredListingPerf);
  }, [filteredListingPerf]);

  // Filter cashflow by scope and currency
  const filteredCashflow = useMemo(() => {
    let data = viewData.cashflow.filter((cf) => cf.currency === currency);

    if (filter.scope === "account" && filter.accountId) {
      data = data.filter((cf) => cf.accountId === filter.accountId);
    } else if (filter.scope === "listing" && filter.listingId) {
      data = data.filter((cf) => cf.listingId === filter.listingId);
    } else if (filter.scope === "listing" && filter.accountId) {
      // Listing scope with account selected but no specific listing
      data = data.filter((cf) => cf.accountId === filter.accountId);
    }

    return data;
  }, [viewData, filter, currency]);

  // Recompute occupancy from scope-filtered listing perf and service ranges
  const filteredOccupancy = useMemo(() => {
    const listingIds = new Set(filteredListingPerf.map((lp) => lp.listingId));
    const filteredRanges = analytics.serviceRanges.filter(
      (r) => r.currency === currency && listingIds.has(r.listingId)
    );
    return computeEstimatedOccupancy(filteredListingPerf, filteredRanges);
  }, [filteredListingPerf, analytics.serviceRanges, currency]);

  const showCashflow = filter.viewMode !== "forecast";

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader />
      <FilterBar />

      <main className="flex-1 space-y-6 p-6">
        {filter.viewMode === "forecast" && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            Forecast — subject to change (not finalized payouts)
          </div>
        )}

        <WarningsPanel warnings={analytics.warnings} />

        <KPISummaryCards
          portfolioPerf={filteredPortfolioPerf}
          occupancy={filteredOccupancy}
          currency={currency}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <RevenueTrendChart data={filteredPortfolioPerf} currency={currency} />
          <RevenueBreakdownChart data={filteredListingPerf} currency={currency} />
        </div>

        <ListingsTable data={filteredListingPerf} currency={currency} />

        {showCashflow && <CashflowSection data={filteredCashflow} currency={currency} />}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <TrailingComparisons data={filteredTrailing} currency={currency} />
          <OccupancyDisplay data={filteredOccupancy} />
        </div>
      </main>
    </div>
  );
}
