import { useMemo, useState } from "react";
import { useAppContext, initialFilter } from "@/app/state";
import { useSettingsContext } from "@/app/settings-context";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Button } from "@/components/ui/button";
import { RotateCcw, ChevronDown, SlidersHorizontal } from "lucide-react";
import type { ViewMode } from "@/app/types";
import { getPresetRange, type DatePreset } from "@/lib/dashboard-utils";

const MAX_QUICK_LISTINGS = 20;
const MAX_QUICK_ACCOUNTS = 10;

export function FilterBar() {
  const { state, dispatch } = useAppContext();
  const { filter, analytics } = state;
  const {
    settings,
    getListingName,
    getAccountName,
    setFilterBarExpanded,
  } = useSettingsContext();

  if (!analytics) return null;

  const [isExpanded, setIsExpanded] = useState(settings.filterBarExpanded);

  const handleToggleExpanded = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    setFilterBarExpanded(next);
  };

  // Account options for MultiSelect — apply custom names
  const accountOptions = useMemo(
    () => analytics.accountIds.map((id) => ({ value: id, label: getAccountName(id) })),
    [analytics.accountIds, getAccountName],
  );

  // Listing options for MultiSelect — filtered by account selection, with custom names
  const listingOptions = useMemo(() => {
    const accountFilter =
      filter.selectedAccountIds.length > 0
        ? new Set(filter.selectedAccountIds)
        : null;

    return analytics.listings
      .filter((l) => !accountFilter || accountFilter.has(l.accountId))
      .map((l) => ({ value: l.listingId, label: getListingName(l.listingId, l.listingName) }));
  }, [analytics.listings, filter.selectedAccountIds, getListingName]);

  const viewOptions: { value: ViewMode; label: string }[] = [
    { value: "realized", label: "Realized" },
    { value: "forecast", label: "Forecast" },
    { value: "all", label: "All" },
  ];

  // Get min/max months from data for date range bounds
  const monthBounds = useMemo(() => {
    const allMonths = analytics.views.all.portfolioPerformance.map((p) => p.month);
    if (allMonths.length === 0) return { min: "", max: "" };
    return {
      min: allMonths[0],
      max: allMonths[allMonths.length - 1],
    };
  }, [analytics]);

  // Last realized month = boundary between real and forecast data
  const lastRealizedMonth = useMemo(() => {
    const realizedMonths = analytics.views.realized.portfolioPerformance.map((p) => p.month);
    return realizedMonths.length > 0 ? realizedMonths[realizedMonths.length - 1] : "";
  }, [analytics]);

  // Effective max month for the active view mode
  const activeViewMax = useMemo(() => {
    const months = analytics.views[filter.viewMode].portfolioPerformance.map((p) => p.month);
    return months.length > 0 ? months[months.length - 1] : "";
  }, [analytics, filter.viewMode]);

  // Check if the selected end date extends into forecast territory
  const endInForecast = filter.dateRange.end
    ? filter.dateRange.end > lastRealizedMonth && lastRealizedMonth !== ""
    : activeViewMax > lastRealizedMonth && lastRealizedMonth !== "";

  // Check if individual date inputs are in the future
  const startIsForecast = filter.dateRange.start
    ? filter.dateRange.start > lastRealizedMonth && lastRealizedMonth !== ""
    : false;
  const endIsForecast = filter.dateRange.end
    ? filter.dateRange.end > lastRealizedMonth && lastRealizedMonth !== ""
    : false;

  const hasActiveFilters =
    filter.selectedAccountIds.length > 0 ||
    filter.selectedListingIds.length > 0 ||
    filter.dateRange.start !== null ||
    filter.dateRange.end !== null;

  const handleClearAll = () => {
    dispatch({
      type: "SET_FILTER",
      filter: {
        selectedAccountIds: initialFilter.selectedAccountIds,
        selectedListingIds: initialFilter.selectedListingIds,
        dateRange: initialFilter.dateRange,
      },
    });
  };

  // Quick action: compute "last month" and "current month" ranges
  const currentYm = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const lastMonthYm = useMemo(() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  // Check if a quick action for time is active
  const activeQuickTime = useMemo(() => {
    const { start, end } = filter.dateRange;
    if (!start && !end) return "all";
    if (start === lastMonthYm && end === lastMonthYm) return "last-month";
    if (start === currentYm && end === currentYm) return "current-month";
    for (const p of ["3m", "6m", "12m", "ytd"] as DatePreset[]) {
      const range = getPresetRange(p, monthBounds.max);
      if (range.start === start && range.end === end) return p;
    }
    return null;
  }, [filter.dateRange, lastMonthYm, currentYm, monthBounds.max]);

  const handleQuickTime = (key: string) => {
    if (key === "all") {
      dispatch({ type: "SET_FILTER", filter: { dateRange: { start: null, end: null } } });
    } else if (key === "last-month") {
      dispatch({ type: "SET_FILTER", filter: { dateRange: { start: lastMonthYm, end: lastMonthYm } } });
    } else if (key === "current-month") {
      dispatch({ type: "SET_FILTER", filter: { dateRange: { start: currentYm, end: currentYm } } });
    } else {
      const range = getPresetRange(key as DatePreset, monthBounds.max);
      dispatch({ type: "SET_FILTER", filter: { dateRange: range } });
    }
  };

  const quickTimeOptions = [
    { key: "all", label: "All Time" },
    { key: "12m", label: "Last 12 Months" },
    { key: "6m", label: "Last 6 Months" },
    { key: "3m", label: "Last 3 Months" },
    { key: "ytd", label: "YTD" },
    { key: "last-month", label: "Last Month" },
    { key: "current-month", label: "Current Month" },
  ];

  // ------- Contextual filtering -------
  // Data source for cross-filtering: listing performance from the active view
  const perfData = analytics.views[filter.viewMode].listingPerformance;

  // Contextual listings: filter by dateRange + account selection
  const contextualListingIds = useMemo(() => {
    let data = perfData;
    if (filter.dateRange.start) {
      data = data.filter((lp) => lp.month >= filter.dateRange.start!);
    }
    if (filter.dateRange.end) {
      data = data.filter((lp) => lp.month <= filter.dateRange.end!);
    }
    if (filter.selectedAccountIds.length > 0) {
      const accountSet = new Set(filter.selectedAccountIds);
      data = data.filter((lp) => accountSet.has(lp.accountId));
    }
    return new Set(data.map((lp) => lp.listingId));
  }, [perfData, filter.dateRange, filter.selectedAccountIds]);

  // Contextual accounts: filter by dateRange + listing selection
  const contextualAccountIds = useMemo(() => {
    let data = perfData;
    if (filter.dateRange.start) {
      data = data.filter((lp) => lp.month >= filter.dateRange.start!);
    }
    if (filter.dateRange.end) {
      data = data.filter((lp) => lp.month <= filter.dateRange.end!);
    }
    if (filter.selectedListingIds.length > 0) {
      const listingSet = new Set(filter.selectedListingIds);
      data = data.filter((lp) => listingSet.has(lp.listingId));
    }
    return new Set(data.map((lp) => lp.accountId));
  }, [perfData, filter.dateRange, filter.selectedListingIds]);

  // Contextual months: filter by account + listing selection
  const contextualMonthBounds = useMemo(() => {
    let data = perfData;
    if (filter.selectedAccountIds.length > 0) {
      const accountSet = new Set(filter.selectedAccountIds);
      data = data.filter((lp) => accountSet.has(lp.accountId));
    }
    if (filter.selectedListingIds.length > 0) {
      const listingSet = new Set(filter.selectedListingIds);
      data = data.filter((lp) => listingSet.has(lp.listingId));
    }
    const months = data.map((lp) => lp.month);
    if (months.length === 0) return { min: "", max: "" };
    months.sort();
    return { min: months[0], max: months[months.length - 1] };
  }, [perfData, filter.selectedAccountIds, filter.selectedListingIds]);

  // Quick listings: filtered to contextual set, apply custom order, cap at MAX
  const quickListings = useMemo(() => {
    let listings = analytics.listings.filter((l) => contextualListingIds.has(l.listingId));

    // Apply custom order if set
    if (settings.listingOrder) {
      const orderMap = new Map(settings.listingOrder.map((id, i) => [id, i]));
      listings = [...listings].sort((a, b) => {
        const aIdx = orderMap.get(a.listingId) ?? Infinity;
        const bIdx = orderMap.get(b.listingId) ?? Infinity;
        if (aIdx !== bIdx) return aIdx - bIdx;
        // Fall back to default order (by txCount DESC, then alpha)
        return b.transactionCount - a.transactionCount || a.listingName.localeCompare(b.listingName);
      });
    }

    return listings.slice(0, MAX_QUICK_LISTINGS).map((l) => ({
      value: l.listingId,
      label: getListingName(l.listingId, l.listingName),
    }));
  }, [analytics.listings, contextualListingIds, settings.listingOrder, getListingName]);

  // Quick accounts: filtered to contextual set, apply custom order, cap at MAX
  const quickAccounts = useMemo(() => {
    let accounts = analytics.accountIds.filter((id) => contextualAccountIds.has(id));

    if (settings.accountOrder) {
      const orderMap = new Map(settings.accountOrder.map((id, i) => [id, i]));
      accounts = [...accounts].sort((a, b) => {
        const aIdx = orderMap.get(a) ?? Infinity;
        const bIdx = orderMap.get(b) ?? Infinity;
        return aIdx - bIdx;
      });
    }

    return accounts.slice(0, MAX_QUICK_ACCOUNTS).map((id) => ({
      value: id,
      label: getAccountName(id),
    }));
  }, [analytics.accountIds, contextualAccountIds, settings.accountOrder, getAccountName]);

  // Active time presets: only show presets whose range overlaps contextual month bounds
  const activeTimePresets = useMemo(() => {
    return quickTimeOptions.filter((opt) => {
      // Always keep "All Time"
      if (opt.key === "all") return true;
      if (!contextualMonthBounds.min || !contextualMonthBounds.max) return false;

      let rangeStart: string;
      let rangeEnd: string;

      if (opt.key === "last-month") {
        rangeStart = lastMonthYm;
        rangeEnd = lastMonthYm;
      } else if (opt.key === "current-month") {
        rangeStart = currentYm;
        rangeEnd = currentYm;
      } else {
        const range = getPresetRange(opt.key as DatePreset, monthBounds.max);
        if (!range.start || !range.end) return true;
        rangeStart = range.start;
        rangeEnd = range.end;
      }

      // Check overlap: preset range intersects contextual range
      return rangeStart <= contextualMonthBounds.max && rangeEnd >= contextualMonthBounds.min;
    });
  }, [contextualMonthBounds, lastMonthYm, currentYm, monthBounds.max]);

  return (
    <div className="bg-background border-b px-6 py-2 space-y-2">
      {/* Row 1: Main filters — always visible */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Custom date range */}
        <div className="flex items-center gap-1.5">
          <input
            type="month"
            value={filter.dateRange.start ?? ""}
            min={monthBounds.min}
            max={filter.dateRange.end ?? monthBounds.max}
            onChange={(e) =>
              dispatch({
                type: "SET_FILTER",
                filter: {
                  dateRange: { ...filter.dateRange, start: e.target.value || null },
                },
              })
            }
            className={`h-8 rounded-md border px-2 text-xs transition-colors ${
              startIsForecast
                ? "border-yellow-400 bg-yellow-50 text-yellow-800"
                : "border-input bg-background"
            }`}
          />
          <span className="text-xs text-muted-foreground">—</span>
          <input
            type="month"
            value={filter.dateRange.end ?? ""}
            min={filter.dateRange.start ?? monthBounds.min}
            max={monthBounds.max}
            onChange={(e) =>
              dispatch({
                type: "SET_FILTER",
                filter: {
                  dateRange: { ...filter.dateRange, end: e.target.value || null },
                },
              })
            }
            className={`h-8 rounded-md border px-2 text-xs transition-colors ${
              endIsForecast
                ? "border-yellow-400 bg-yellow-50 text-yellow-800"
                : "border-input bg-background"
            }`}
          />
          {endInForecast && (
            <span className="text-[10px] font-medium text-yellow-600 whitespace-nowrap">
              Includes forecast
            </span>
          )}
        </div>

        {/* Account multi-select */}
        {analytics.accountIds.length > 1 && (
          <div className="w-48">
            <MultiSelect
              options={accountOptions}
              selected={filter.selectedAccountIds}
              onChange={(ids) =>
                dispatch({
                  type: "SET_FILTER",
                  filter: {
                    selectedAccountIds: ids,
                    selectedListingIds: [],
                  },
                })
              }
              placeholder="Accounts"
            />
          </div>
        )}

        {/* Listing multi-select */}
        {listingOptions.length > 1 && (
          <div className="w-64">
            <MultiSelect
              options={listingOptions}
              selected={filter.selectedListingIds}
              onChange={(ids) =>
                dispatch({
                  type: "SET_FILTER",
                  filter: { selectedListingIds: ids },
                })
              }
              placeholder="Listings"
              searchable
            />
          </div>
        )}

        {/* Clear all filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-muted-foreground"
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        )}

        {/* Currency selector */}
        {analytics.currencies.length > 1 && (
          <Select
            value={filter.currency ?? analytics.currency}
            onChange={(e) =>
              dispatch({
                type: "SET_FILTER",
                filter: { currency: e.target.value },
              })
            }
            options={analytics.currencies.map((c) => ({ value: c, label: c }))}
            className="w-24"
          />
        )}

        {/* Projection toggle */}
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={filter.projection}
            onChange={(e) =>
              dispatch({
                type: "SET_FILTER",
                filter: { projection: e.target.checked },
              })
            }
            className="h-4 w-4 rounded border-input"
          />
          <span className="text-muted-foreground whitespace-nowrap">Project this Month</span>
        </label>

        {/* Quick filters toggle + View mode — pushed right */}
        <div className="ml-auto flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleExpanded}
            className="gap-1.5 text-xs"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Quick Filters
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`} />
          </Button>
          <Tabs
            value={filter.viewMode}
            onValueChange={(v) =>
              dispatch({ type: "SET_FILTER", filter: { viewMode: v as ViewMode } })
            }
          >
            <TabsList>
              {viewOptions.map((opt) => (
                <TabsTrigger key={opt.value} value={opt.value}>
                  {opt.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Row 2: Quick actions — collapsible with transition */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 text-sm pb-1">
            {/* Time quick actions — contextual */}
            <div className="flex items-center gap-1.5">
              {activeTimePresets.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleQuickTime(opt.key)}
                  className={`px-3 py-1 rounded-md border transition-colors ${
                    activeQuickTime === opt.key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Account quick actions — contextual */}
            {quickAccounts.length > 1 && (
              <>
                <div className="h-5 w-px bg-border mx-1" />
                <div className="flex items-center gap-1.5">
                  {quickAccounts.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        dispatch({
                          type: "SET_FILTER",
                          filter: {
                            selectedAccountIds:
                              filter.selectedAccountIds.length === 1 && filter.selectedAccountIds[0] === opt.value
                                ? []
                                : [opt.value],
                            selectedListingIds: [],
                          },
                        })
                      }
                      className={`px-3 py-1 rounded-md border transition-colors ${
                        filter.selectedAccountIds.length === 1 && filter.selectedAccountIds[0] === opt.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Listing quick actions — contextual */}
            {quickListings.length > 1 && (
              <>
                <div className="h-5 w-px bg-border mx-1" />
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({
                        type: "SET_FILTER",
                        filter: { selectedListingIds: [] },
                      })
                    }
                    className={`px-3 py-1 rounded-md border transition-colors ${
                      filter.selectedListingIds.length === 0
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    All Listings
                  </button>
                  {quickListings.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        dispatch({
                          type: "SET_FILTER",
                          filter: {
                            selectedListingIds:
                              filter.selectedListingIds.length === 1 && filter.selectedListingIds[0] === opt.value
                                ? []
                                : [opt.value],
                          },
                        })
                      }
                      className={`px-3 py-1 rounded-md border transition-colors max-w-[240px] truncate ${
                        filter.selectedListingIds.length === 1 && filter.selectedListingIds[0] === opt.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                      title={opt.label}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
