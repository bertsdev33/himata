import { describe, expect, it } from "bun:test";
import {
  allocatePerformanceToMonths,
  computeNightsPerMonth,
  largestRemainderDistribute,
} from "../src/allocation.js";
import type { CanonicalTransaction, YearMonth } from "../src/schema/canonical.js";

function makeTx(
  overrides: Partial<CanonicalTransaction>
): CanonicalTransaction {
  return {
    transactionId: "test-tx-1",
    source: "airbnb",
    sourceVersion: "v1",
    datasetKind: "paid",
    kind: "reservation",
    occurredDate: "2026-01-30",
    listing: {
      accountId: "acc-1",
      listingName: "Test Listing",
      normalizedListingName: "test listing",
      listingId: "acc-1-test-listing-abc12345",
    },
    stay: {
      checkInDate: "2026-01-29",
      checkOutDate: "2026-02-17",
      nights: 19,
    },
    netAmount: { currency: "USD", amountMinor: 124019 },
    grossAmount: { currency: "USD", amountMinor: 127855 },
    hostServiceFeeAmount: { currency: "USD", amountMinor: -3836 },
    cleaningFeeAmount: { currency: "USD", amountMinor: 3134 },
    adjustmentAmount: { currency: "USD", amountMinor: 0 },
    rawRowRef: { fileName: "test.csv", rowNumber: 2 },
    ...overrides,
  };
}

describe("computeNightsPerMonth", () => {
  it("splits a cross-month stay correctly", () => {
    // Jan 29 - Feb 17: 3 nights in Jan (29, 30, 31), 16 nights in Feb (1-16)
    const result = computeNightsPerMonth("2026-01-29", "2026-02-17", 19);
    expect(result.get("2026-01" as YearMonth)).toBe(3);
    expect(result.get("2026-02" as YearMonth)).toBe(16);
    expect([...result.values()].reduce((a, b) => a + b, 0)).toBe(19);
  });

  it("keeps a single-month stay in one month", () => {
    const result = computeNightsPerMonth("2026-01-15", "2026-01-20", 5);
    expect(result.get("2026-01" as YearMonth)).toBe(5);
    expect(result.size).toBe(1);
  });

  it("handles a multi-month stay spanning 3 months", () => {
    // Dec 15 - Feb 14: nights on Dec 15..31 (17), Jan 1..31 (31), Feb 1..13 (13) = 61 total
    const result = computeNightsPerMonth("2025-12-15", "2026-02-14", 61);
    expect(result.get("2025-12" as YearMonth)).toBe(17);
    expect(result.get("2026-01" as YearMonth)).toBe(31);
    expect(result.get("2026-02" as YearMonth)).toBe(13);
  });
});

describe("largestRemainderDistribute", () => {
  it("distributes evenly divisible amounts", () => {
    const result = largestRemainderDistribute(100, [0.5, 0.5]);
    expect(result).toEqual([50, 50]);
  });

  it("handles non-even distribution with remainder correction", () => {
    const result = largestRemainderDistribute(100, [1 / 3, 1 / 3, 1 / 3]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(100);
    // Each should be 33 or 34
    for (const v of result) {
      expect(v >= 33 && v <= 34).toBe(true);
    }
  });

  it("preserves total exactly for any ratio", () => {
    const result = largestRemainderDistribute(12345, [3 / 19, 16 / 19]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(12345);
  });

  it("handles single bucket", () => {
    expect(largestRemainderDistribute(42, [1])).toEqual([42]);
  });

  it("handles zero total", () => {
    expect(largestRemainderDistribute(0, [0.5, 0.5])).toEqual([0, 0]);
  });

  it("handles negative totals", () => {
    const result = largestRemainderDistribute(-100, [0.3, 0.7]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(-100);
  });
});

describe("allocatePerformanceToMonths", () => {
  it("allocates a cross-month reservation proportionally", () => {
    const tx = makeTx({
      stay: { checkInDate: "2026-01-29", checkOutDate: "2026-02-17", nights: 19 },
      netAmount: { currency: "USD", amountMinor: 124019 },
    });

    const slices = allocatePerformanceToMonths([tx]);
    expect(slices.length).toBe(2);

    const janSlice = slices.find((s) => s.month === "2026-01");
    const febSlice = slices.find((s) => s.month === "2026-02");

    expect(janSlice).toBeDefined();
    expect(febSlice).toBeDefined();
    expect(janSlice!.nights).toBe(3);
    expect(febSlice!.nights).toBe(16);

    // Total should reconcile exactly
    expect(janSlice!.allocatedNetMinor + febSlice!.allocatedNetMinor).toBe(124019);
  });

  it("allocates a single-month reservation to one month", () => {
    const tx = makeTx({
      stay: { checkInDate: "2026-02-02", checkOutDate: "2026-02-07", nights: 5 },
    });

    const slices = allocatePerformanceToMonths([tx]);
    expect(slices.length).toBe(1);
    expect(slices[0].month).toBe("2026-02");
    expect(slices[0].nights).toBe(5);
  });

  it("allocates adjustments to occurred-date month when no stay", () => {
    const tx = makeTx({
      kind: "adjustment",
      stay: undefined,
      netAmount: { currency: "USD", amountMinor: -9700 },
      adjustmentAmount: { currency: "USD", amountMinor: -9700 },
    });

    const slices = allocatePerformanceToMonths([tx]);
    expect(slices.length).toBe(1);
    expect(slices[0].month).toBe("2026-01");
  });

  it("allocates adjustments by stay overlap when stay dates exist", () => {
    const tx = makeTx({
      kind: "adjustment",
      stay: {
        checkInDate: "2025-10-25",
        checkOutDate: "2025-10-28",
        nights: 3,
      },
      occurredDate: "2025-10-31",
      netAmount: { currency: "USD", amountMinor: -9700 },
      adjustmentAmount: { currency: "USD", amountMinor: -9700 },
    });

    const slices = allocatePerformanceToMonths([tx]);
    // All nights in October, so one slice
    expect(slices.length).toBe(1);
    expect(slices[0].month).toBe("2025-10");
  });

  it("excludes payout transactions", () => {
    const tx = makeTx({
      kind: "payout",
      listing: undefined,
      stay: undefined,
    });

    const slices = allocatePerformanceToMonths([tx]);
    expect(slices).toHaveLength(0);
  });

  it("excludes transactions without listing", () => {
    const tx = makeTx({ listing: undefined });
    const slices = allocatePerformanceToMonths([tx]);
    expect(slices).toHaveLength(0);
  });

  it("largest-remainder reconciliation preserves source totals exactly", () => {
    // Test with a tricky ratio that would lose cents without correction
    const tx = makeTx({
      stay: { checkInDate: "2026-01-29", checkOutDate: "2026-02-17", nights: 19 },
      netAmount: { currency: "USD", amountMinor: 10001 }, // odd cents
      grossAmount: { currency: "USD", amountMinor: 10307 },
      hostServiceFeeAmount: { currency: "USD", amountMinor: -306 },
      cleaningFeeAmount: { currency: "USD", amountMinor: 3134 },
    });

    const slices = allocatePerformanceToMonths([tx]);
    const totalNet = slices.reduce((s, sl) => s + sl.allocatedNetMinor, 0);
    const totalGross = slices.reduce((s, sl) => s + sl.allocatedGrossMinor, 0);
    const totalCleaning = slices.reduce(
      (s, sl) => s + sl.allocatedCleaningFeeMinor,
      0
    );
    const totalService = slices.reduce(
      (s, sl) => s + sl.allocatedServiceFeeMinor,
      0
    );

    expect(totalNet).toBe(10001);
    expect(totalGross).toBe(10307);
    expect(totalCleaning).toBe(3134);
    expect(totalService).toBe(-306);
  });
});
