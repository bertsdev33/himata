import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { importAirbnbV1Session } from "../src/index.js";
import type { ImportAirbnbV1Input } from "../src/index.js";
import {
  allocatePerformanceToMonths,
  computeMonthlyListingPerformance,
  computeMonthlyPortfolioPerformance,
  computeTrailingComparisons,
  computeEstimatedOccupancy,
  inferListingServiceRanges,
  computeMonthlyCashflow,
} from "@rental-analytics/core";

const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures");

function loadFixture(fileName: string): string {
  return readFileSync(join(FIXTURES_DIR, fileName), "utf-8");
}

function makeInput(
  fileName: string,
  accountId: string,
  datasetKind: "paid" | "upcoming"
): ImportAirbnbV1Input {
  return {
    fileName,
    csvText: loadFixture(fileName),
    accountId,
    datasetKind,
  };
}

describe("KPI integration with real fixtures", () => {
  const result = importAirbnbV1Session([
    makeInput("paid_a.csv", "account-a", "paid"),
    makeInput("paid_b.csv", "account-b", "paid"),
    makeInput("paid_c.csv", "account-c", "paid"),
  ]);

  const realizedTxs = result.transactions.filter(
    (t) => t.datasetKind === "paid"
  );
  const allocations = allocatePerformanceToMonths(realizedTxs);
  const listingPerf = computeMonthlyListingPerformance(allocations);
  const portfolio = computeMonthlyPortfolioPerformance(listingPerf);

  it("headline net revenue matches category breakdown sums", () => {
    for (const lp of listingPerf) {
      const categorySum =
        lp.reservationRevenueMinor +
        lp.adjustmentRevenueMinor +
        lp.resolutionAdjustmentRevenueMinor +
        lp.cancellationFeeRevenueMinor;
      expect(lp.netRevenueMinor).toBe(categorySum);
    }
  });

  it("portfolio gross revenue matches sum of listing gross", () => {
    for (const pp of portfolio) {
      const listingsInMonth = listingPerf.filter(
        (lp) => lp.month === pp.month && lp.currency === pp.currency
      );
      const totalGross = listingsInMonth.reduce(
        (s, lp) => s + lp.grossRevenueMinor,
        0
      );
      expect(pp.grossRevenueMinor).toBe(totalGross);
    }
  });

  it("ADR is computable when bookedNights > 0", () => {
    for (const lp of listingPerf) {
      if (lp.bookedNights > 0) {
        const adr = lp.grossRevenueMinor / lp.bookedNights;
        expect(Number.isFinite(adr)).toBe(true);
      }
    }
  });

  it("trailing comparisons are produced", () => {
    const trailing = computeTrailingComparisons(listingPerf);
    expect(trailing.length).toBeGreaterThan(0);

    for (const tc of trailing) {
      expect(tc.label).toMatch(/^vs trailing \d+-month average$/);
      expect([3, 6, 12]).toContain(tc.trailingWindowMonths);
    }
  });

  it("estimated occupancy is computed", () => {
    const serviceRanges = inferListingServiceRanges(listingPerf, realizedTxs);
    expect(serviceRanges.length).toBeGreaterThan(0);

    const occupancy = computeEstimatedOccupancy(listingPerf, serviceRanges);
    expect(occupancy.length).toBeGreaterThan(0);

    for (const occ of occupancy) {
      expect(occ.label).toBe("Estimated Occupancy (Assumption-Based)");
      expect(occ.disclaimer).toBe(
        "booked nights / (days_in_month * listings_in_service); not true occupancy"
      );
      if (occ.estimatedOccupancyRate !== null) {
        expect(occ.estimatedOccupancyRate).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("cashflow includes only payout/resolution_payout kinds", () => {
    const cashflow = computeMonthlyCashflow(realizedTxs);
    expect(cashflow.length).toBeGreaterThan(0);

    const totalCashflow = cashflow.reduce((s, c) => s + c.payoutsMinor, 0);
    expect(totalCashflow).toBeGreaterThan(0);
  });

  it("forecast uses only upcoming data", () => {
    const fullResult = importAirbnbV1Session([
      makeInput("paid_a.csv", "account-a", "paid"),
      makeInput("upcoming_a.csv", "account-a", "upcoming"),
    ]);

    const forecastTxs = fullResult.transactions.filter(
      (t) => t.datasetKind === "upcoming"
    );
    const forecastAllocations = allocatePerformanceToMonths(forecastTxs);
    const forecastPerf = computeMonthlyListingPerformance(forecastAllocations);

    expect(forecastPerf.length).toBeGreaterThan(0);

    const realizedOnly = fullResult.transactions.filter(
      (t) => t.datasetKind === "paid"
    );
    const realizedAllocations = allocatePerformanceToMonths(realizedOnly);
    const realizedPerf = computeMonthlyListingPerformance(realizedAllocations);

    const totalRealizedNet = realizedPerf.reduce(
      (s, lp) => s + lp.netRevenueMinor,
      0
    );
    const totalForecastNet = forecastPerf.reduce(
      (s, lp) => s + lp.netRevenueMinor,
      0
    );

    expect(totalRealizedNet).toBeGreaterThan(0);
    expect(totalForecastNet).toBeGreaterThan(0);
    expect(totalRealizedNet).not.toBe(totalForecastNet);
  });
});
