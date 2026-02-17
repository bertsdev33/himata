import { describe, expect, it } from "bun:test";
import { computeTrailingComparisons } from "../src/trailing.js";
import type { MonthlyListingPerformance, YearMonth } from "../src/schema/canonical.js";

function makePerf(
  month: string,
  netRevenueMinor: number,
  grossRevenueMinor?: number
): MonthlyListingPerformance {
  return {
    month: month as YearMonth,
    accountId: "acc-1",
    listingId: "listing-1",
    listingName: "Test Listing",
    currency: "USD",
    bookedNights: 10,
    grossRevenueMinor: grossRevenueMinor ?? netRevenueMinor,
    netRevenueMinor,
    cleaningFeesMinor: 0,
    serviceFeesMinor: 0,
    reservationRevenueMinor: netRevenueMinor,
    adjustmentRevenueMinor: 0,
    resolutionAdjustmentRevenueMinor: 0,
    cancellationFeeRevenueMinor: 0,
  };
}

describe("computeTrailingComparisons", () => {
  it("returns no comparisons when M < 3", () => {
    const perfs = [
      makePerf("2026-01", 50000),
      makePerf("2026-02", 60000),
    ];
    const result = computeTrailingComparisons(perfs);
    expect(result).toHaveLength(0);
  });

  it("uses trailing 3-month window when 3 <= M <= 5", () => {
    const perfs = [
      makePerf("2025-10", 40000),
      makePerf("2025-11", 50000),
      makePerf("2025-12", 60000),
      makePerf("2026-01", 70000),
    ];

    const result = computeTrailingComparisons(perfs);
    const jan2026 = result.filter((r) => r.month === "2026-01");

    expect(jan2026.length).toBeGreaterThan(0);
    expect(jan2026[0].trailingWindowMonths).toBe(3);
    expect(jan2026[0].label).toBe("vs trailing 3-month average");

    // Baseline = avg(Oct, Nov, Dec) = (40000 + 50000 + 60000) / 3 = 50000
    const netComp = jan2026.find((r) => r.metric === "netRevenueMinor");
    expect(netComp!.baselineMinor).toBe(50000);
    expect(netComp!.currentMinor).toBe(70000);
    expect(netComp!.deltaMinor).toBe(20000);
  });

  it("uses trailing 6-month window when 6 <= M <= 11", () => {
    const perfs = [];
    for (let i = 1; i <= 7; i++) {
      perfs.push(makePerf(`2025-${String(i).padStart(2, "0")}`, i * 10000));
    }

    const result = computeTrailingComparisons(perfs);
    const jul = result.filter((r) => r.month === "2025-07");
    expect(jul.length).toBeGreaterThan(0);
    expect(jul[0].trailingWindowMonths).toBe(6);
  });

  it("uses trailing 12-month window when M >= 12", () => {
    const perfs = [];
    for (let i = 0; i < 13; i++) {
      const month = i + 1;
      const year = month <= 12 ? 2025 : 2026;
      const m = month <= 12 ? month : month - 12;
      perfs.push(
        makePerf(`${year}-${String(m).padStart(2, "0")}`, (i + 1) * 10000)
      );
    }

    const result = computeTrailingComparisons(perfs);
    const jan2026 = result.filter((r) => r.month === "2026-01");
    expect(jan2026.length).toBeGreaterThan(0);
    expect(jan2026[0].trailingWindowMonths).toBe(12);
  });

  it("zero-fills missing months in trailing window", () => {
    // Months 1, 2, 3, 5 (skip 4)
    const perfs = [
      makePerf("2025-01", 30000),
      makePerf("2025-02", 40000),
      makePerf("2025-03", 50000),
      makePerf("2025-05", 60000),
    ];

    const result = computeTrailingComparisons(perfs);
    const may = result.filter(
      (r) => r.month === "2025-05" && r.metric === "netRevenueMinor"
    );

    // 3 historical months, so window = 3
    // Trailing 3 months before May = Feb, Mar, Apr
    // Feb=40000, Mar=50000, Apr=0 (zero-filled)
    expect(may.length).toBe(1);
    expect(may[0].baselineMinor).toBe(30000); // (40000+50000+0)/3 = 30000
  });

  it("deltaPct is null when baseline is zero", () => {
    const perfs = [
      makePerf("2025-01", 0),
      makePerf("2025-02", 0),
      makePerf("2025-03", 0),
      makePerf("2025-04", 50000),
    ];

    const result = computeTrailingComparisons(perfs);
    const apr = result.filter(
      (r) => r.month === "2025-04" && r.metric === "netRevenueMinor"
    );

    expect(apr.length).toBe(1);
    expect(apr[0].deltaPct).toBeNull();
  });
});
