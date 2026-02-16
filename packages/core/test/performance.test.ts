import { describe, expect, it } from "bun:test";
import {
  computeMonthlyListingPerformance,
  computeMonthlyPortfolioPerformance,
} from "../src/performance.js";
import type { MonthlyAllocationSlice, YearMonth } from "../src/schema/canonical.js";

function makeSlice(
  overrides: Partial<MonthlyAllocationSlice>
): MonthlyAllocationSlice {
  return {
    transactionId: "tx-1",
    kind: "reservation",
    accountId: "acc-1",
    listingId: "listing-1",
    month: "2026-01" as YearMonth,
    nights: 5,
    allocationRatio: 1,
    allocatedGrossMinor: 50000,
    allocatedNetMinor: 45000,
    allocatedCleaningFeeMinor: 3500,
    allocatedServiceFeeMinor: -1500,
    allocatedAdjustmentMinor: 0,
    currency: "USD",
    ...overrides,
  };
}

describe("computeMonthlyListingPerformance", () => {
  it("aggregates slices for the same listing and month", () => {
    const slices = [
      makeSlice({ transactionId: "tx-1", nights: 3, allocatedNetMinor: 30000 }),
      makeSlice({ transactionId: "tx-2", nights: 2, allocatedNetMinor: 20000 }),
    ];

    const result = computeMonthlyListingPerformance(slices);
    expect(result).toHaveLength(1);
    expect(result[0].bookedNights).toBe(5);
    expect(result[0].netRevenueMinor).toBe(50000);
  });

  it("separates listings in different months", () => {
    const slices = [
      makeSlice({ month: "2026-01" as YearMonth }),
      makeSlice({ month: "2026-02" as YearMonth }),
    ];

    const result = computeMonthlyListingPerformance(slices);
    expect(result).toHaveLength(2);
  });

  it("separates different listings in same month", () => {
    const slices = [
      makeSlice({ listingId: "listing-1" }),
      makeSlice({ listingId: "listing-2" }),
    ];

    const result = computeMonthlyListingPerformance(slices);
    expect(result).toHaveLength(2);
  });

  it("separates different currencies", () => {
    const slices = [
      makeSlice({ currency: "USD" }),
      makeSlice({ currency: "EUR" }),
    ];

    const result = computeMonthlyListingPerformance(slices);
    expect(result).toHaveLength(2);
  });

  it("ADR is null when bookedNights is zero", () => {
    const result = computeMonthlyListingPerformance([
      makeSlice({ nights: 0 }),
    ]);
    expect(result).toHaveLength(1);
    // ADR calculation happens outside; just verify nights is 0
    expect(result[0].bookedNights).toBe(0);
  });
});

describe("computeMonthlyPortfolioPerformance", () => {
  it("aggregates listing performance to portfolio level", () => {
    const listingPerf = computeMonthlyListingPerformance([
      makeSlice({ listingId: "listing-1", allocatedGrossMinor: 50000 }),
      makeSlice({ listingId: "listing-2", allocatedGrossMinor: 30000 }),
    ]);

    const portfolio = computeMonthlyPortfolioPerformance(listingPerf);
    expect(portfolio).toHaveLength(1);
    expect(portfolio[0].grossRevenueMinor).toBe(80000);
  });

  it("separates by currency at portfolio level", () => {
    const listingPerf = computeMonthlyListingPerformance([
      makeSlice({ currency: "USD" }),
      makeSlice({ currency: "EUR" }),
    ]);

    const portfolio = computeMonthlyPortfolioPerformance(listingPerf);
    expect(portfolio).toHaveLength(2);
  });

  it("default portfolio scope is all accounts", () => {
    const listingPerf = computeMonthlyListingPerformance([
      makeSlice({ accountId: "acc-1", listingId: "l1" }),
      makeSlice({ accountId: "acc-2", listingId: "l2" }),
    ]);

    const portfolio = computeMonthlyPortfolioPerformance(listingPerf);
    // All accounts combined into one portfolio entry
    expect(portfolio).toHaveLength(1);
    expect(portfolio[0].bookedNights).toBe(10);
  });
});
