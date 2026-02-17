import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";
import { computeAnalyticsFromInputs } from "../src/app/compute-analytics";
import type { ImportAirbnbV1Input } from "@rental-analytics/importer-airbnb-v1";

const FIXTURES = resolve(import.meta.dir, "../../../packages/importers/airbnb/v1/fixtures");

function loadFixture(name: string, accountId: string, datasetKind: "paid" | "upcoming"): ImportAirbnbV1Input {
  return {
    fileName: name,
    csvText: readFileSync(resolve(FIXTURES, name), "utf-8"),
    accountId,
    datasetKind,
  };
}

describe("computeAnalyticsFromInputs", () => {
  const paid = loadFixture("paid_a.csv", "account-a", "paid");
  const upcoming = loadFixture("upcoming_a.csv", "account-a", "upcoming");

  describe("view-mode partitioning", () => {
    test("realized view excludes upcoming transactions", () => {
      const result = computeAnalyticsFromInputs([paid, upcoming]);

      const realizedView = result.views.realized;
      const allView = result.views.all;

      // Realized should only have paid data — fewer or equal listings/months
      expect(realizedView.listingPerformance.length).toBeGreaterThan(0);
      expect(realizedView.cashflow.length).toBeGreaterThan(0);

      // All view should have at least as much data as realized
      expect(allView.listingPerformance.length).toBeGreaterThanOrEqual(
        realizedView.listingPerformance.length
      );
    });

    test("forecast view excludes paid transactions", () => {
      const result = computeAnalyticsFromInputs([paid, upcoming]);

      const forecastView = result.views.forecast;

      // Forecast should only have upcoming data
      expect(forecastView.listingPerformance.length).toBeGreaterThan(0);

      // Forecast should have no cashflow (upcoming has no payouts)
      expect(forecastView.cashflow.length).toBe(0);
    });

    test("realized and forecast are disjoint subsets of all", () => {
      const result = computeAnalyticsFromInputs([paid, upcoming]);

      const allNet = result.views.all.portfolioPerformance.reduce(
        (s, p) => s + p.netRevenueMinor, 0
      );
      const realizedNet = result.views.realized.portfolioPerformance.reduce(
        (s, p) => s + p.netRevenueMinor, 0
      );
      const forecastNet = result.views.forecast.portfolioPerformance.reduce(
        (s, p) => s + p.netRevenueMinor, 0
      );

      // The "all" net should equal realized + forecast
      // (since transactions are partitioned by datasetKind, no overlap)
      expect(allNet).toBe(realizedNet + forecastNet);
    });

    test("paid-only input produces empty forecast view", () => {
      const result = computeAnalyticsFromInputs([paid]);

      expect(result.views.forecast.listingPerformance.length).toBe(0);
      expect(result.views.forecast.cashflow.length).toBe(0);
      expect(result.views.realized.listingPerformance.length).toBeGreaterThan(0);
    });

    test("upcoming-only input produces empty realized view", () => {
      const result = computeAnalyticsFromInputs([upcoming]);

      expect(result.views.realized.listingPerformance.length).toBe(0);
      expect(result.views.realized.cashflow.length).toBe(0);
      expect(result.views.forecast.listingPerformance.length).toBeGreaterThan(0);
    });
  });

  describe("currency handling", () => {
    test("primary currency is set correctly", () => {
      const result = computeAnalyticsFromInputs([paid]);

      expect(result.currency).toBe("USD");
      expect(result.currencies).toContain("USD");
    });

    test("all listing performance entries have a currency field", () => {
      const result = computeAnalyticsFromInputs([paid, upcoming]);

      for (const lp of result.views.all.listingPerformance) {
        expect(lp.currency).toBeTruthy();
      }
    });

    test("all cashflow entries have a currency field", () => {
      const result = computeAnalyticsFromInputs([paid]);

      for (const cf of result.views.all.cashflow) {
        expect(cf.currency).toBeTruthy();
      }
    });

    test("all occupancy entries have a currency field", () => {
      const result = computeAnalyticsFromInputs([paid]);

      for (const occ of result.views.all.occupancy) {
        expect(occ.currency).toBeTruthy();
      }
    });
  });

  describe("scope filtering support", () => {
    test("cashflow entries have accountId for scope filtering", () => {
      const paidB = loadFixture("paid_b.csv", "account-b", "paid");
      const result = computeAnalyticsFromInputs([paid, paidB]);

      // Cashflow from different accounts should be distinguishable
      const accounts = new Set(
        result.views.all.cashflow
          .filter((cf) => cf.accountId)
          .map((cf) => cf.accountId)
      );
      expect(accounts.size).toBeGreaterThanOrEqual(1);
    });

    test("listing performance can be filtered by account", () => {
      const paidB = loadFixture("paid_b.csv", "account-b", "paid");
      const result = computeAnalyticsFromInputs([paid, paidB]);

      const accountAPerf = result.views.all.listingPerformance.filter(
        (lp) => lp.accountId === "account-a"
      );
      const accountBPerf = result.views.all.listingPerformance.filter(
        (lp) => lp.accountId === "account-b"
      );

      expect(accountAPerf.length).toBeGreaterThan(0);
      expect(accountBPerf.length).toBeGreaterThan(0);
      expect(accountAPerf.length + accountBPerf.length).toBe(
        result.views.all.listingPerformance.length
      );
    });

    test("currencies array exposes all available currencies", () => {
      const result = computeAnalyticsFromInputs([paid]);

      // All fixture data is USD
      expect(result.currencies).toEqual(["USD"]);
      // Primary currency matches
      expect(result.currency).toBe("USD");
    });
  });

  describe("metadata extraction", () => {
    test("extracts account IDs", () => {
      const result = computeAnalyticsFromInputs([paid]);

      expect(result.accountIds).toContain("account-a");
    });

    test("extracts listing names", () => {
      const result = computeAnalyticsFromInputs([paid]);

      expect(result.listingNames.size).toBeGreaterThan(0);
      expect(result.listings.length).toBeGreaterThan(0);
    });

    test("collects warnings", () => {
      const result = computeAnalyticsFromInputs([paid, upcoming]);

      // Should have at least some deduplicated row warnings when paid+upcoming overlap
      expect(result.warnings).toBeInstanceOf(Array);
    });
  });

  describe("listing priority (transaction count)", () => {
    test("listings include transactionCount field", () => {
      const result = computeAnalyticsFromInputs([paid]);

      for (const listing of result.listings) {
        expect(typeof listing.transactionCount).toBe("number");
        expect(listing.transactionCount).toBeGreaterThan(0);
      }
    });

    test("listings are sorted by transactionCount DESC", () => {
      const result = computeAnalyticsFromInputs([paid]);

      for (let i = 1; i < result.listings.length; i++) {
        const prev = result.listings[i - 1];
        const curr = result.listings[i];
        // Higher or equal count should come first
        expect(prev.transactionCount).toBeGreaterThanOrEqual(curr.transactionCount);
      }
    });

    test("multi-account listings are sorted by transactionCount DESC", () => {
      const paidB = loadFixture("paid_b.csv", "account-b", "paid");
      const result = computeAnalyticsFromInputs([paid, paidB]);

      for (let i = 1; i < result.listings.length; i++) {
        const prev = result.listings[i - 1];
        const curr = result.listings[i];
        if (prev.transactionCount === curr.transactionCount) {
          // Alphabetical tiebreaker
          expect(prev.listingName.localeCompare(curr.listingName)).toBeLessThanOrEqual(0);
        } else {
          expect(prev.transactionCount).toBeGreaterThan(curr.transactionCount);
        }
      }
    });
  });
});
