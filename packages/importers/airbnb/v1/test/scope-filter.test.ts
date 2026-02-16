import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { importAirbnbV1Session } from "../src/index.js";
import type { ImportAirbnbV1Input } from "../src/index.js";
import {
  allocatePerformanceToMonths,
  computeMonthlyListingPerformance,
  computeMonthlyPortfolioPerformance,
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

describe("portfolio scope and filters", () => {
  it("default portfolio output equals all accounts combined", () => {
    const result = importAirbnbV1Session([
      makeInput("paid_a.csv", "account-a", "paid"),
      makeInput("paid_b.csv", "account-b", "paid"),
    ]);

    const realizedTxs = result.transactions.filter(
      (t) => t.datasetKind === "paid"
    );
    const allocations = allocatePerformanceToMonths(realizedTxs);
    const listingPerf = computeMonthlyListingPerformance(allocations);
    const portfolio = computeMonthlyPortfolioPerformance(listingPerf);

    expect(portfolio.length).toBeGreaterThan(0);

    for (const pp of portfolio) {
      const listingsInMonth = listingPerf.filter(
        (lp) => lp.month === pp.month && lp.currency === pp.currency
      );
      const listingTotal = listingsInMonth.reduce(
        (s, lp) => s + lp.netRevenueMinor,
        0
      );
      expect(pp.netRevenueMinor).toBe(listingTotal);
    }
  });

  it("filtering by account returns consistent subset", () => {
    const result = importAirbnbV1Session([
      makeInput("paid_a.csv", "account-a", "paid"),
      makeInput("paid_b.csv", "account-b", "paid"),
    ]);

    const realizedTxs = result.transactions.filter(
      (t) => t.datasetKind === "paid"
    );
    const allocations = allocatePerformanceToMonths(realizedTxs);
    const allListingPerf = computeMonthlyListingPerformance(allocations);

    const accountAPerf = allListingPerf.filter(
      (lp) => lp.accountId === "account-a"
    );
    const accountAPortfolio =
      computeMonthlyPortfolioPerformance(accountAPerf);

    const fullPortfolio = computeMonthlyPortfolioPerformance(allListingPerf);

    for (const ap of accountAPortfolio) {
      const fullEntry = fullPortfolio.find(
        (fp) => fp.month === ap.month && fp.currency === ap.currency
      );
      expect(fullEntry).toBeDefined();
      expect(ap.netRevenueMinor).toBeLessThanOrEqual(
        fullEntry!.netRevenueMinor
      );
    }
  });

  it("realized metrics exclude upcoming transactions", () => {
    const result = importAirbnbV1Session([
      makeInput("paid_a.csv", "account-a", "paid"),
      makeInput("upcoming_a.csv", "account-a", "upcoming"),
    ]);

    const realizedTxs = result.transactions.filter(
      (t) => t.datasetKind === "paid"
    );
    const allocations = allocatePerformanceToMonths(realizedTxs);
    const realizedPerf = computeMonthlyListingPerformance(allocations);

    const forecastTxs = result.transactions.filter(
      (t) => t.datasetKind === "upcoming"
    );
    const forecastAllocations = allocatePerformanceToMonths(forecastTxs);
    const forecastPerf = computeMonthlyListingPerformance(forecastAllocations);

    const totalRealized = realizedPerf.reduce(
      (s, lp) => s + lp.netRevenueMinor,
      0
    );
    const totalForecast = forecastPerf.reduce(
      (s, lp) => s + lp.netRevenueMinor,
      0
    );

    expect(totalRealized).toBeGreaterThan(0);
    expect(totalForecast).toBeGreaterThan(0);
  });

  it("realized cashflow excludes upcoming payout transactions", () => {
    const result = importAirbnbV1Session([
      makeInput("paid_a.csv", "account-a", "paid"),
      makeInput("upcoming_a.csv", "account-a", "upcoming"),
    ]);

    const realizedTxs = result.transactions.filter(
      (t) => t.datasetKind === "paid"
    );
    const cashflow = computeMonthlyCashflow(realizedTxs);

    expect(cashflow.length).toBeGreaterThan(0);
    const totalCashflow = cashflow.reduce((s, c) => s + c.payoutsMinor, 0);
    expect(totalCashflow).toBeGreaterThan(0);
  });
});
