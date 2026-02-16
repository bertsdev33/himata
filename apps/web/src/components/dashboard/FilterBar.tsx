import { useAppContext } from "@/app/state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select } from "@/components/ui/select";
import type { FilterScope, ViewMode } from "@/app/types";

export function FilterBar() {
  const { state, dispatch } = useAppContext();
  const { filter, analytics } = state;
  if (!analytics) return null;

  const accountOptions = [
    { value: "", label: "All Accounts" },
    ...analytics.accountIds.map((id) => ({ value: id, label: id })),
  ];

  const listingOptions = [
    { value: "", label: "All Listings" },
    ...analytics.listings
      .filter((l) => !filter.accountId || l.accountId === filter.accountId)
      .map((l) => ({ value: l.listingId, label: l.listingName })),
  ];

  const viewOptions: { value: ViewMode; label: string }[] = [
    { value: "realized", label: "Realized" },
    { value: "forecast", label: "Forecast" },
    { value: "all", label: "All" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4 border-b px-6 py-3">
      {/* Scope tabs */}
      <Tabs
        value={filter.scope}
        onValueChange={(v) =>
          dispatch({
            type: "SET_FILTER",
            filter: {
              scope: v as FilterScope,
              ...(v === "portfolio" ? { accountId: null, listingId: null } : {}),
              ...(v === "account" ? { listingId: null } : {}),
            },
          })
        }
      >
        <TabsList>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="listing">Listing</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Account selector */}
      {(filter.scope === "account" || filter.scope === "listing") && (
        <Select
          value={filter.accountId ?? ""}
          onChange={(e) =>
            dispatch({
              type: "SET_FILTER",
              filter: { accountId: e.target.value || null, listingId: null },
            })
          }
          options={accountOptions}
          className="w-48"
        />
      )}

      {/* Listing selector */}
      {filter.scope === "listing" && (
        <Select
          value={filter.listingId ?? ""}
          onChange={(e) =>
            dispatch({
              type: "SET_FILTER",
              filter: { listingId: e.target.value || null },
            })
          }
          options={listingOptions}
          className="w-64"
        />
      )}

      {/* Currency selector (shown when multiple currencies exist) */}
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

      {/* View mode */}
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
