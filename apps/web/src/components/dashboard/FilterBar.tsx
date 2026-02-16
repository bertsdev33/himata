import { useMemo } from "react";
import { useAppContext, initialFilter } from "@/app/state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import type { ViewMode, RevenueBasis } from "@/app/types";
import { getPresetRange, type DatePreset } from "@/lib/dashboard-utils";

export function FilterBar() {
  const { state, dispatch } = useAppContext();
  const { filter, analytics } = state;
  if (!analytics) return null;

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

  // Detect active preset
  const activePreset = useMemo<DatePreset | null>(() => {
    if (!filter.dateRange.start && !filter.dateRange.end) return "all";
    for (const p of ["3m", "6m", "12m", "ytd"] as DatePreset[]) {
      const range = getPresetRange(p, monthBounds.max);
      if (range.start === filter.dateRange.start && range.end === filter.dateRange.end) return p;
    }
    return null;
  }, [filter.dateRange, monthBounds.max]);

  const handlePreset = (preset: DatePreset) => {
    const range = getPresetRange(preset, monthBounds.max);
    dispatch({ type: "SET_FILTER", filter: { dateRange: range } });
  };

  const presets: { value: DatePreset; label: string }[] = [
    { value: "3m", label: "3M" },
    { value: "6m", label: "6M" },
    { value: "12m", label: "12M" },
    { value: "ytd", label: "YTD" },
    { value: "all", label: "All" },
  ];

  return (
    <div className="sticky top-0 z-40 bg-background flex flex-wrap items-center gap-3 border-b px-6 py-3">
      {/* Date range presets */}
      <div className="flex items-center gap-1">
        {presets.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => handlePreset(p.value)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              activePreset === p.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

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
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
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
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        />
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

      {/* Revenue basis toggle */}
      <Tabs
        value={filter.revenueBasis}
        onValueChange={(v) =>
          dispatch({
            type: "SET_FILTER",
            filter: { revenueBasis: v as RevenueBasis },
          })
        }
      >
        <TabsList>
          <TabsTrigger value="both">Both</TabsTrigger>
          <TabsTrigger value="net">Net</TabsTrigger>
          <TabsTrigger value="gross">Gross</TabsTrigger>
        </TabsList>
      </Tabs>

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

      {/* View mode (pushed right) */}
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
  );
}
