import { describe, expect, test } from "bun:test";
import { buildPortfolio } from "@rental-analytics/forecasting";
import type { ForecastResult, ListingForecast } from "@rental-analytics/forecasting";
import { transformMlForecastForDisplay } from "../src/lib/ml-forecast-display-transform";

function listing(args: {
  listingId: string;
  listingName: string;
  accountId: string;
  targetMonth: string;
}): ListingForecast {
  return {
    listingId: args.listingId,
    listingName: args.listingName,
    accountId: args.accountId,
    targetMonth: args.targetMonth,
    currency: "USD",
    forecastGrossRevenueMinor: 100_000,
    maeMinor: 10_000,
    upperBandMinor: 110_000,
    lowerBandMinor: 90_000,
    confidence: "medium",
    trainingMonths: 12,
  };
}

function sampleForecast(): ForecastResult {
  const listings: ListingForecast[] = [
    listing({ listingId: "l1", listingName: "One", accountId: "a1", targetMonth: "2025-01" }),
    listing({ listingId: "l2", listingName: "Two", accountId: "a1", targetMonth: "2025-01" }),
    listing({ listingId: "l3", listingName: "Three", accountId: "a2", targetMonth: "2025-02" }),
    listing({ listingId: "l4", listingName: "Four", accountId: "a2", targetMonth: "2025-02" }),
    listing({ listingId: "l5", listingName: "Five", accountId: "a2", targetMonth: "2025-02" }),
  ];

  return {
    portfolio: buildPortfolio(listings.filter((l) => l.targetMonth === "2025-01")),
    listings,
    excluded: [
      { listingId: "ex-a1", listingName: "Excluded A1", accountId: "a1", reason: "too_few_months", monthsAvailable: 2 },
      { listingId: "ex-a2", listingName: "Excluded A2", accountId: "a2", reason: "too_few_months", monthsAvailable: 2 },
    ],
  };
}

describe("transformMlForecastForDisplay", () => {
  test("returns null when no listings match filters", () => {
    const transformed = transformMlForecastForDisplay({
      forecast: sampleForecast(),
      selectedAccountIds: ["missing"],
      selectedListingIds: [],
      dateRange: { start: null, end: null },
    });

    expect(transformed).toBeNull();
  });

  test("filters listings and excluded by selected account", () => {
    const transformed = transformMlForecastForDisplay({
      forecast: sampleForecast(),
      selectedAccountIds: ["a2"],
      selectedListingIds: [],
      dateRange: { start: null, end: null },
    });

    expect(transformed).not.toBeNull();
    expect(transformed!.listings.every((l) => l.accountId === "a2")).toBe(true);
    expect(transformed!.excluded.map((e) => e.accountId)).toEqual(["a2"]);
    expect(transformed!.portfolio.targetMonth).toBe("2025-02");
    expect(transformed!.portfolio.listingForecasts.length).toBe(3);
  });

  test("respects date range filter on target month", () => {
    const transformed = transformMlForecastForDisplay({
      forecast: sampleForecast(),
      selectedAccountIds: [],
      selectedListingIds: [],
      dateRange: { start: "2025-02", end: "2025-02" },
    });

    expect(transformed).not.toBeNull();
    expect(new Set(transformed!.listings.map((l) => l.targetMonth))).toEqual(new Set(["2025-02"]));
    expect(transformed!.portfolio.targetMonth).toBe("2025-02");
  });
});
