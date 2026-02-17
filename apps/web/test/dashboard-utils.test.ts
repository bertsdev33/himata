import { describe, test, expect } from "bun:test";
import { getPresetRange, projectMonthValue, applyProjection, filterCashflow } from "../src/lib/dashboard-utils";
import type { MonthlyPortfolioPerformance, MonthlyCashflow, YearMonth } from "@rental-analytics/core";

// --- getPresetRange ---

describe("getPresetRange", () => {
  test("returns null range for 'all' preset", () => {
    const result = getPresetRange("all", "2025-12");
    expect(result).toEqual({ start: null, end: null });
  });

  test("returns null range when maxMonth is empty", () => {
    expect(getPresetRange("3m", "")).toEqual({ start: null, end: null });
    expect(getPresetRange("6m", "")).toEqual({ start: null, end: null });
  });

  test("3m preset anchors to maxMonth, not today", () => {
    const result = getPresetRange("3m", "2024-06");
    // 3 months back from June = April
    expect(result).toEqual({ start: "2024-04", end: "2024-06" });
  });

  test("6m preset anchors to maxMonth", () => {
    const result = getPresetRange("6m", "2024-06");
    // 6 months back from June = January
    expect(result).toEqual({ start: "2024-01", end: "2024-06" });
  });

  test("12m preset anchors to maxMonth", () => {
    const result = getPresetRange("12m", "2024-06");
    // 12 months back from June = July of prior year
    expect(result).toEqual({ start: "2023-07", end: "2024-06" });
  });

  test("ytd preset uses January of maxMonth's year", () => {
    const result = getPresetRange("ytd", "2024-06");
    expect(result).toEqual({ start: "2024-01", end: "2024-06" });
  });

  test("3m preset handles year boundary", () => {
    const result = getPresetRange("3m", "2025-02");
    // 3 months back from Feb = December of prior year
    expect(result).toEqual({ start: "2024-12", end: "2025-02" });
  });

  test("6m preset handles year boundary", () => {
    const result = getPresetRange("6m", "2025-03");
    // 6 months back from March = October of prior year
    expect(result).toEqual({ start: "2024-10", end: "2025-03" });
  });
});

// --- projectMonthValue ---

describe("projectMonthValue", () => {
  test("returns original value for non-current month", () => {
    // Use a month far in the past — guaranteed not to be the current month
    expect(projectMonthValue(1000, "2020-01")).toBe(1000);
  });

  test("projects current month value", () => {
    const now = new Date();
    const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const actual = 1000;
    const expected = Math.round((actual / dayOfMonth) * daysInMonth);

    expect(projectMonthValue(actual, currentYm)).toBe(expected);
  });

  test("returns same value when month is complete (future month)", () => {
    expect(projectMonthValue(5000, "2020-06")).toBe(5000);
  });
});

// --- applyProjection ---

function makePortfolioPerf(month: string, netRevenueMinor: number): MonthlyPortfolioPerformance {
  return {
    month: month as YearMonth,
    currency: "USD",
    bookedNights: 10,
    grossRevenueMinor: netRevenueMinor * 1.2,
    netRevenueMinor,
    cleaningFeesMinor: 500,
    serviceFeesMinor: 300,
  };
}

describe("applyProjection", () => {
  test("returns empty array for empty input", () => {
    expect(applyProjection([])).toEqual([]);
  });

  test("does not modify historical months", () => {
    const data = [makePortfolioPerf("2020-01", 10000), makePortfolioPerf("2020-02", 20000)];
    const result = applyProjection(data);
    expect(result).toEqual(data);
  });

  test("scales current month values", () => {
    const now = new Date();
    const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const data = [makePortfolioPerf("2020-01", 10000), makePortfolioPerf(currentYm, 5000)];
    const result = applyProjection(data);

    // Historical month unchanged
    expect(result[0].netRevenueMinor).toBe(10000);

    // Current month should be scaled up
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const scale = daysInMonth / dayOfMonth;

    expect(result[1].netRevenueMinor).toBe(Math.round(5000 * scale));
    expect(result[1].grossRevenueMinor).toBe(Math.round(6000 * scale));
    expect(result[1].bookedNights).toBe(Math.round(10 * scale));
  });
});

// --- projectMonthValue: component-level projection patterns ---

describe("projectMonthValue – component projection patterns", () => {
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const scale = daysInMonth / dayOfMonth;

  test("CashflowSection pattern: projects current-month payouts", () => {
    const payoutsMinor = 150000; // $1,500
    const projected = projectMonthValue(payoutsMinor, currentYm);
    expect(projected).toBe(Math.round(payoutsMinor * scale));
  });

  test("CashflowSection pattern: no-op for historical month payouts", () => {
    const payoutsMinor = 150000;
    expect(projectMonthValue(payoutsMinor, "2023-06")).toBe(payoutsMinor);
  });

  test("NightsVsAdrChart pattern: projects both nights and gross for current month", () => {
    const nights = 8;
    const gross = 200000;
    const projectedNights = projectMonthValue(nights, currentYm);
    const projectedGross = projectMonthValue(gross, currentYm);
    expect(projectedNights).toBe(Math.round(nights * scale));
    expect(projectedGross).toBe(Math.round(gross * scale));
    // ADR is derived from projected values
    const adr = projectedGross / projectedNights;
    expect(adr).toBeGreaterThan(0);
  });

  test("NightsVsAdrChart pattern: historical months unchanged", () => {
    expect(projectMonthValue(8, "2020-03")).toBe(8);
    expect(projectMonthValue(200000, "2020-03")).toBe(200000);
  });

  test("ListingDetail indicator: projects current-month net revenue for comparison", () => {
    const currentNet = 45000;
    const trailingAvg = 60000;
    const projectedNet = projectMonthValue(currentNet, currentYm);
    // Projected value should be larger than raw value (since month is incomplete)
    if (dayOfMonth < daysInMonth) {
      expect(projectedNet).toBeGreaterThan(currentNet);
    }
    // Delta calculation uses projected value
    const delta = (projectedNet - trailingAvg) / trailingAvg;
    expect(typeof delta).toBe("number");
    expect(Number.isFinite(delta)).toBe(true);
  });

  test("ListingDetail indicator: no projection for historical data month", () => {
    const net = 45000;
    expect(projectMonthValue(net, "2023-12")).toBe(net);
  });

  test("zero value projects to zero (no division error)", () => {
    expect(projectMonthValue(0, currentYm)).toBe(0);
    expect(projectMonthValue(0, "2020-01")).toBe(0);
  });

  test("current month projects even when future months exist in dataset", () => {
    // Regression: projection should fire for the current month even when
    // the dataset includes forecast months beyond it (e.g., in "all" view mode).
    const futureMonth = `${now.getFullYear() + 1}-01`;
    const currentVal = 50000;
    const futureVal = 80000;

    // Current month should still be projected
    const projectedCurrent = projectMonthValue(currentVal, currentYm);
    if (dayOfMonth < daysInMonth) {
      expect(projectedCurrent).toBeGreaterThan(currentVal);
    }
    expect(projectedCurrent).toBe(Math.round(currentVal * scale));

    // Future month should not be affected
    expect(projectMonthValue(futureVal, futureMonth)).toBe(futureVal);
  });
});

// --- filterCashflow ---

function makeCashflow(opts: Partial<MonthlyCashflow> & { month: string }): MonthlyCashflow {
  return {
    month: opts.month as YearMonth,
    currency: opts.currency ?? "USD",
    accountId: opts.accountId,
    listingId: opts.listingId,
    payoutsMinor: opts.payoutsMinor ?? 1000,
  };
}

describe("filterCashflow", () => {
  const base = { currency: "USD", selectedAccountIds: [] as string[], selectedListingIds: [] as string[], dateRange: { start: null, end: null } as { start: string | null; end: string | null } };

  test("filters by currency", () => {
    const data = [
      makeCashflow({ month: "2024-01", currency: "USD" }),
      makeCashflow({ month: "2024-01", currency: "EUR" }),
    ];
    const result = filterCashflow(data, { ...base, currency: "USD" });
    expect(result).toHaveLength(1);
    expect(result[0].currency).toBe("USD");
  });

  test("excludes unattributed rows when account filter is active", () => {
    const data = [
      makeCashflow({ month: "2024-01", accountId: "acc-1", listingId: "l-1" }),
      makeCashflow({ month: "2024-01", accountId: undefined, listingId: undefined }), // unattributed payout
      makeCashflow({ month: "2024-01", accountId: "acc-2", listingId: "l-2" }),
    ];
    const result = filterCashflow(data, { ...base, selectedAccountIds: ["acc-1"] });
    expect(result).toHaveLength(1);
    expect(result[0].accountId).toBe("acc-1");
  });

  test("excludes unattributed rows when listing filter is active", () => {
    const data = [
      makeCashflow({ month: "2024-01", accountId: "acc-1", listingId: "l-1" }),
      makeCashflow({ month: "2024-01", accountId: undefined, listingId: undefined }),
      makeCashflow({ month: "2024-01", accountId: "acc-1", listingId: "l-2" }),
    ];
    const result = filterCashflow(data, { ...base, selectedListingIds: ["l-1"] });
    expect(result).toHaveLength(1);
    expect(result[0].listingId).toBe("l-1");
  });

  test("includes all rows (including unattributed) when no account/listing filter", () => {
    const data = [
      makeCashflow({ month: "2024-01", accountId: "acc-1", listingId: "l-1" }),
      makeCashflow({ month: "2024-01", accountId: undefined, listingId: undefined }),
    ];
    const result = filterCashflow(data, base);
    expect(result).toHaveLength(2);
  });

  test("filters by date range", () => {
    const data = [
      makeCashflow({ month: "2024-01" }),
      makeCashflow({ month: "2024-03" }),
      makeCashflow({ month: "2024-06" }),
    ];
    const result = filterCashflow(data, { ...base, dateRange: { start: "2024-02", end: "2024-04" } });
    expect(result).toHaveLength(1);
    expect(result[0].month).toBe("2024-03");
  });
});
