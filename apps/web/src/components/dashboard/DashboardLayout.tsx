import { useMemo, useEffect } from "react";
import { useAppContext } from "@/app/state";
import {
  computeMonthlyPortfolioPerformance,
  computeTrailingComparisons,
  computeEstimatedOccupancy,
} from "@rental-analytics/core";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { useSettingsContext } from "@/app/settings-context";
import { DashboardHeader } from "./DashboardHeader";
import { FilterBar } from "./FilterBar";
import { WarningsPanel } from "@/components/shared/WarningsPanel";
import { PortfolioOverview } from "./tabs/PortfolioOverview";
import { ListingComparison } from "./tabs/ListingComparison";
import { ListingDetail } from "./tabs/ListingDetail";
import { CashflowTab } from "./tabs/CashflowTab";
import { ForecastTab } from "./tabs/ForecastTab";
import { TransactionsExplorer } from "./tabs/TransactionsExplorer";
import { DataQualityTab } from "./tabs/DataQualityTab";
import { SettingsTab } from "./tabs/SettingsTab";
import {
  applyProjection,
  applyNowcastProjectionToListingPerformance,
  filterCashflow,
  filterListingPerformance,
  filterTransactions,
} from "@/lib/dashboard-utils";
import type { DashboardTab } from "@/app/types";
import { transformMlForecastForDisplay } from "@/lib/ml-forecast-display-transform";
import { useMlForecastRefresh } from "@/hooks/useMlForecastRefresh";

interface TabDef {
  id: DashboardTab;
  label: string;
  enabled: boolean;
  reason?: string;
}

export function DashboardLayout() {
  const { state, dispatch } = useAppContext();
  const { settings } = useSettingsContext();
  const { analytics, filter } = state;

  if (!analytics) return null;

  const currency = filter.currency ?? analytics.currency;

  // Select pre-computed view data based on viewMode
  const viewData = analytics.views[filter.viewMode];
  const forecastViewData = analytics.views.forecast;

  // Shared scope filtering for listing-level monthly data.
  const filteredListingPerf = useMemo(
    () =>
      filterListingPerformance(viewData.listingPerformance, {
        currency,
        selectedAccountIds: filter.selectedAccountIds,
        selectedListingIds: filter.selectedListingIds,
        dateRange: filter.dateRange,
      }),
    [
      viewData.listingPerformance,
      currency,
      filter.selectedAccountIds,
      filter.selectedListingIds,
      filter.dateRange,
    ],
  );

  // Filtered transactions for TransactionsExplorer
  const filteredTransactions = useMemo(
    () =>
      filterTransactions(analytics.transactions, {
        viewMode: filter.viewMode,
        currency,
        selectedAccountIds: filter.selectedAccountIds,
        selectedListingIds: filter.selectedListingIds,
        dateRange: filter.dateRange,
      }),
    [
      analytics.transactions,
      filter.viewMode,
      currency,
      filter.selectedAccountIds,
      filter.selectedListingIds,
      filter.dateRange,
    ],
  );

  // Compute portfolio performance from filtered listing data
  const rawPortfolioPerf = useMemo(
    () => computeMonthlyPortfolioPerformance(filteredListingPerf),
    [filteredListingPerf],
  );

  // Apply projection math: scale the current incomplete month to full month estimate
  const filteredPortfolioPerf = useMemo(
    () => (filter.projection ? applyProjection(rawPortfolioPerf) : rawPortfolioPerf),
    [rawPortfolioPerf, filter.projection],
  );

  // Compute trailing comparisons from filtered listing data
  const filteredTrailing = useMemo(
    () => computeTrailingComparisons(filteredListingPerf),
    [filteredListingPerf],
  );

  // Filter cashflow by multi-select and currency
  const filteredCashflow = useMemo(
    () =>
      filterCashflow(viewData.cashflow, {
        currency,
        selectedAccountIds: filter.selectedAccountIds,
        selectedListingIds: filter.selectedListingIds,
        dateRange: filter.dateRange,
      }),
    [viewData, filter, currency],
  );

  // Recompute occupancy from filtered listing perf and service ranges
  const filteredOccupancy = useMemo(() => {
    const listingIds = new Set(filteredListingPerf.map((lp) => lp.listingId));
    const filteredRanges = analytics.serviceRanges.filter(
      (r) => r.currency === currency && listingIds.has(r.listingId),
    );
    return computeEstimatedOccupancy(filteredListingPerf, filteredRanges);
  }, [filteredListingPerf, analytics.serviceRanges, currency]);

  // Distinct listing IDs in filtered set
  const distinctListingIds = useMemo(
    () => [...new Set(filteredListingPerf.map((lp) => lp.listingId))],
    [filteredListingPerf],
  );

  const mlTrainingListingPerformance = useMemo(() => {
    if (!filter.projection) {
      return analytics.views.realized.listingPerformance;
    }

    return applyNowcastProjectionToListingPerformance({
      realized: analytics.views.realized.listingPerformance,
      upcoming: analytics.views.forecast.listingPerformance,
    });
  }, [
    filter.projection,
    analytics.views.realized.listingPerformance,
    analytics.views.forecast.listingPerformance,
  ]);

  // Forecast training scope:
  // - always use realized rows in the worker
  // - follow explicit date range when set
  // - with no explicit range, train on full realized history
  //   (avoids narrowing to future-only upcoming months that contain no training rows)
  const mlTrainingDateRange = useMemo(() => {
    return filter.dateRange;
  }, [filter.dateRange]);

  const mlRefresh = useMlForecastRefresh({
    analytics,
    realizedListingPerformance: mlTrainingListingPerformance,
    currency,
    selectedAccountIds: filter.selectedAccountIds,
    selectedListingIds: filter.selectedListingIds,
    dateRange: mlTrainingDateRange,
    autoRefreshEnabled: settings.mlForecastAutoRefresh,
    trainingFollowsDateRange: true,
    fallback: "none",
  });

  // Current-month point shown in the Forecast chart.
  // When projection is enabled, this reflects the nowcast-adjusted training rows.
  const mlScopedTrainingListingPerf = useMemo(
    () =>
      filterListingPerformance(mlTrainingListingPerformance, {
        currency,
        selectedAccountIds: filter.selectedAccountIds,
        selectedListingIds: filter.selectedListingIds,
        dateRange: mlTrainingDateRange,
      }),
    [
      mlTrainingListingPerformance,
      currency,
      filter.selectedAccountIds,
      filter.selectedListingIds,
      mlTrainingDateRange,
    ],
  );

  const mlScopedTrainingPortfolioPerf = useMemo(
    () => computeMonthlyPortfolioPerformance(mlScopedTrainingListingPerf),
    [mlScopedTrainingListingPerf],
  );

  const mlNowcastPoint = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const scopedRawRealized = filterListingPerformance(analytics.views.realized.listingPerformance, {
      currency,
      selectedAccountIds: filter.selectedAccountIds,
      selectedListingIds: filter.selectedListingIds,
      dateRange: mlTrainingDateRange,
    });
    const scopedRawPortfolio = computeMonthlyPortfolioPerformance(scopedRawRealized);

    const nowcast = mlScopedTrainingPortfolioPerf.find((p) => p.month === currentMonth);
    const raw = scopedRawPortfolio.find((p) => p.month === currentMonth);
    if (!nowcast) return null;

    return {
      month: currentMonth,
      revenueMinor: nowcast.grossRevenueMinor,
      projected:
        filter.projection &&
        raw !== undefined &&
        nowcast.grossRevenueMinor !== raw.grossRevenueMinor,
    };
  }, [
    analytics.views.realized.listingPerformance,
    currency,
    filter.selectedAccountIds,
    filter.selectedListingIds,
    mlTrainingDateRange,
    mlScopedTrainingPortfolioPerf,
    filter.projection,
  ]);

  const baseMlForecast =
    mlRefresh.snapshot === null
      ? (analytics.mlForecasts[currency] ?? null)
      : mlRefresh.snapshot.result;

  const filteredMlForecast = useMemo(
    () =>
      transformMlForecastForDisplay({
        forecast: baseMlForecast,
        selectedAccountIds: filter.selectedAccountIds,
        selectedListingIds: filter.selectedListingIds,
        // Date range drives model training scope; do not clip predicted target months in display.
        dateRange: { start: null, end: null },
      }),
    [baseMlForecast, filter.selectedAccountIds, filter.selectedListingIds],
  );

  // Projection detection: is the last month in the data the current month?
  const hasProjection = useMemo(() => {
    if (!filter.projection) return false;
    const months = filteredPortfolioPerf.map((p) => p.month).sort();
    if (months.length === 0) return false;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return months[months.length - 1] === currentMonth;
  }, [filter.projection, filteredPortfolioPerf]);

  // Tab enablement logic
  const tabs = useMemo<TabDef[]>(() => {
    const hasTransactions = filteredListingPerf.length > 0;
    const hasCashflow = filter.viewMode !== "forecast" && filteredCashflow.length > 0;
    const hasForecast = analytics.views.forecast.listingPerformance.length > 0;
    const hasBaselineMl = (analytics.mlForecasts[currency]?.listings.length ?? 0) > 0;
    const hasMlSnapshot = mlRefresh.snapshot !== null;
    const hasDisplayedMl = (filteredMlForecast?.listings.length ?? 0) > 0;
    const hasMlTrainingData = analytics.views.realized.listingPerformance.some(
      (lp) => lp.currency === currency,
    );

    return [
      {
        id: "portfolio-overview",
        label: "Portfolio",
        enabled: hasTransactions,
        reason: hasTransactions ? undefined : "No data matches current filters",
      },
      {
        id: "listing-comparison",
        label: "Comparison",
        enabled: distinctListingIds.length >= 2,
        reason:
          distinctListingIds.length >= 2
            ? undefined
            : "Need 2+ listings in filtered set",
      },
      {
        id: "listing-detail",
        label: "Listing Detail",
        enabled: distinctListingIds.length === 1,
        reason:
          distinctListingIds.length === 1
            ? undefined
            : "Select exactly 1 listing",
      },
      {
        id: "cashflow",
        label: "Cashflow",
        enabled: hasCashflow,
        reason: hasCashflow
          ? undefined
          : filter.viewMode === "forecast"
            ? "Not available in Forecast view"
            : "No cashflow data",
      },
      {
        id: "forecast",
        label: "Forecast",
        enabled:
          hasForecast ||
          hasDisplayedMl ||
          hasMlSnapshot ||
          hasBaselineMl ||
          hasMlTrainingData,
        reason:
          hasForecast || hasDisplayedMl || hasMlSnapshot || hasBaselineMl || hasMlTrainingData
          ? undefined
          : "No realized data available to train forecast",
      },
      {
        id: "transactions",
        label: "Transactions",
        enabled: filteredTransactions.length > 0,
        reason:
          filteredTransactions.length > 0 ? undefined : "No transactions match filters",
      },
      {
        id: "data-quality",
        label: "Data Quality",
        enabled: true,
      },
      {
        id: "settings",
        label: "Settings",
        enabled: true,
      },
    ];
  }, [
    filteredListingPerf,
    distinctListingIds,
    filteredCashflow,
    analytics.views.forecast.listingPerformance,
    filteredTransactions,
    filter.viewMode,
    filteredMlForecast,
    analytics.mlForecasts,
    analytics.views.realized.listingPerformance,
    currency,
    mlRefresh.snapshot,
  ]);

  // Auto-fallback: if current tab becomes disabled, switch to portfolio-overview
  const activeTab = filter.activeTab;
  const currentTabDef = tabs.find((t) => t.id === activeTab);
  useEffect(() => {
    if (currentTabDef && !currentTabDef.enabled) {
      const firstEnabled = tabs.find((t) => t.enabled);
      if (firstEnabled) {
        dispatch({
          type: "SET_FILTER",
          filter: { activeTab: firstEnabled.id },
        });
      }
    }
  }, [currentTabDef, tabs, dispatch]);

  // Handle "Show only this listing" from ListingsTable
  const handleSelectListing = (listingId: string) => {
    dispatch({
      type: "SET_FILTER",
      filter: {
        selectedListingIds: [listingId],
        activeTab: "listing-detail",
      },
    });
  };

  // Forecast listing perf filtered by same account/listing/currency/date range
  const filteredForecastListingPerf = useMemo(
    () =>
      filterListingPerformance(forecastViewData.listingPerformance, {
        currency,
        selectedAccountIds: filter.selectedAccountIds,
        selectedListingIds: filter.selectedListingIds,
        dateRange: filter.dateRange,
      }),
    [
      forecastViewData.listingPerformance,
      currency,
      filter.selectedAccountIds,
      filter.selectedListingIds,
      filter.dateRange,
    ],
  );

  const filteredForecastPortfolioPerf = useMemo(
    () => computeMonthlyPortfolioPerformance(filteredForecastListingPerf),
    [filteredForecastListingPerf],
  );

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader />

      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          dispatch({
            type: "SET_FILTER",
            filter: { activeTab: v as DashboardTab },
          })
        }
        className="flex-1 flex flex-col"
      >
        {/* Sticky header: filters + tabs */}
        <div className="sticky top-0 z-40">
          <FilterBar />
          <div className="bg-background border-b px-6 py-2">
            <TabsList className="flex-wrap h-auto gap-1">
              {tabs.map((tab) =>
                tab.enabled ? (
                  <TabsTrigger key={tab.id} value={tab.id}>
                    {tab.label}
                  </TabsTrigger>
                ) : (
                  <Tooltip key={tab.id} content={tab.reason ?? "Not available"}>
                    <TabsTrigger value={tab.id} disabled className="opacity-50">
                      {tab.label}
                    </TabsTrigger>
                  </Tooltip>
                ),
              )}
            </TabsList>
          </div>
        </div>

        <main className="flex-1 p-6">
          <WarningsPanel warnings={analytics.warnings} />

          <TabsContent value="portfolio-overview" className="mt-0">
            <PortfolioOverview
              portfolioPerf={filteredPortfolioPerf}
              listingPerf={filteredListingPerf}
              trailing={filteredTrailing}
              occupancy={filteredOccupancy}
              transactions={filteredTransactions}
              currency={currency}
              projection={filter.projection}
              hasProjection={hasProjection}
            />
          </TabsContent>

          <TabsContent value="listing-comparison" className="mt-0">
            <ListingComparison
              listingPerf={filteredListingPerf}
              currency={currency}
              projection={filter.projection}
              onSelectListing={handleSelectListing}
            />
          </TabsContent>

          <TabsContent value="listing-detail" className="mt-0">
            <ListingDetail
              listingPerf={filteredListingPerf}
              currency={currency}
              projection={filter.projection}
            />
          </TabsContent>

          <TabsContent value="cashflow" className="mt-0">
            <CashflowTab cashflow={filteredCashflow} currency={currency} projection={filter.projection} />
          </TabsContent>

          <TabsContent value="forecast" className="mt-0">
            <ForecastTab
              portfolioPerf={filteredForecastPortfolioPerf}
              listingPerf={filteredForecastListingPerf}
              currency={currency}
              mlForecast={filteredMlForecast}
              nowcastPoint={mlNowcastPoint}
              mlRefreshStatus={mlRefresh.status}
              mlRefreshError={mlRefresh.error}
              mlRefreshSnapshot={mlRefresh.snapshot}
              mlAutoRefreshEnabled={settings.mlForecastAutoRefresh}
              mlWorkerReady={mlRefresh.workerReady}
              onRefreshMlForecast={mlRefresh.refreshNow}
            />
          </TabsContent>

          <TabsContent value="transactions" className="mt-0">
            <TransactionsExplorer
              transactions={filteredTransactions}
              currency={currency}
            />
          </TabsContent>

          <TabsContent value="data-quality" className="mt-0">
            <DataQualityTab
              transactions={analytics.transactions}
              warnings={analytics.warnings}
            />
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            <SettingsTab />
          </TabsContent>
        </main>
      </Tabs>
    </div>
  );
}
