import { useMemo, useState } from "react";
import { useAppContext, initialFilter } from "@/app/state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Button } from "@/components/ui/button";
import { RotateCcw, ChevronDown, ChevronRight, SlidersHorizontal } from "lucide-react";
import type { ViewMode } from "@/app/types";
import { getPresetRange, type DatePreset } from "@/lib/dashboard-utils";

export function FilterBar() {
  const { state, dispatch } = useAppContext();
  const { filter, analytics } = state;
  if (!analytics) return null;

  const [isExpanded, setIsExpanded] = useState(true);

  const accountOptions = useMemo(
    () => analytics.accountIds.map((id) => ({ value: id, label: id })),
    [analytics.accountIds],
  );

  const listingOptions = useMemo(() => {
    const accountFilter =
      filter.selectedAccountIds.length > 0
        ? new Set(filter.selectedAccountIds)
        : null;

    return analytics.listings
      .filter((l) => !accountFilter || accountFilter.has(l.accountId))
      .map((l) => ({ value: l.listingId, label: l.listingName }));
  }, [analytics.listings, filter.selectedAccountIds]);

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

  // Build collapsed summary chips
  const filterSummary = useMemo(() => {
    const parts: string[] = [];
    const qt = quickTimeOptions.find((o) => o.key === activeQuickTime);
    if (qt) parts.push(qt.label);
    else if (filter.dateRange.start || filter.dateRange.end)
      parts.push(`${filter.dateRange.start ?? "..."} — ${filter.dateRange.end ?? "..."}`);
    if (filter.selectedAccountIds.length > 0)
      parts.push(`${filter.selectedAccountIds.length} account${filter.selectedAccountIds.length > 1 ? "s" : ""}`);
    if (filter.selectedListingIds.length > 0)
      parts.push(`${filter.selectedListingIds.length} listing${filter.selectedListingIds.length > 1 ? "s" : ""}`);
    if (filter.projection) parts.push("Projected");
    return parts;
  }, [activeQuickTime, quickTimeOptions, filter]);

  return (
    <div className="bg-background border-b px-6 py-2">
      {/* Collapse toggle row */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="font-medium">Filters</span>
          {isExpanded
            ? <ChevronDown className="h-3.5 w-3.5" />
            : <ChevronRight className="h-3.5 w-3.5" />
          }
        </button>

        {/* Show summary chips when collapsed */}
        {!isExpanded && filterSummary.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {filterSummary.map((s) => (
              <span key={s} className="px-2 py-0.5 text-xs rounded-md bg-accent text-accent-foreground">
                {s}
              </span>
            ))}
          </div>
        )}

        {/* View mode always visible, pushed right */}
        <div className="ml-auto">
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

      {/* Expanded filter content */}
      {isExpanded && (
        <div className="mt-2 space-y-2">
          {/* Row 1: Main filters */}
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
                className={`h-8 rounded-md border px-2 text-xs ${
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
                className={`h-8 rounded-md border px-2 text-xs ${
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
          </div>

          {/* Row 2: Quick actions */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {/* Time quick actions */}
            <div className="flex items-center gap-1.5">
              {quickTimeOptions.map((opt) => (
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

            {/* Account quick actions */}
            {analytics.accountIds.length > 1 && (
              <>
                <div className="h-5 w-px bg-border mx-1" />
                <div className="flex items-center gap-1.5">
                  {analytics.accountIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        dispatch({
                          type: "SET_FILTER",
                          filter: {
                            selectedAccountIds:
                              filter.selectedAccountIds.length === 1 && filter.selectedAccountIds[0] === id
                                ? []
                                : [id],
                            selectedListingIds: [],
                          },
                        })
                      }
                      className={`px-3 py-1 rounded-md border transition-colors ${
                        filter.selectedAccountIds.length === 1 && filter.selectedAccountIds[0] === id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      }`}
                    >
                      {id}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Listing quick actions */}
            {listingOptions.length > 1 && (
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
                  {listingOptions.map((opt) => (
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
      )}
    </div>
  );
}
