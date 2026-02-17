import { describe, expect, it } from "bun:test";
import { computeRevenueForecast } from "../src/forecast.js";
import { generateSyntheticData } from "./helpers.js";

describe("computeRevenueForecast", () => {
  it("returns empty result for empty input", () => {
    const result = computeRevenueForecast([]);
    expect(result.listings.length).toBe(0);
    expect(result.excluded.length).toBe(0);
    expect(result.portfolio.forecastGrossRevenueMinor).toBe(0);
  });

  it("all listings <3 months → all excluded", () => {
    const data = generateSyntheticData({ listingId: "A", months: 2, baseRevenue: 100000 });
    const result = computeRevenueForecast(data);
    expect(result.listings.length).toBe(0);
    expect(result.excluded.length).toBe(1);
  });

  it("insufficient training rows → listings moved to excluded", () => {
    // 3 months gives 0 training rows, so all get excluded
    const data = generateSyntheticData({ listingId: "A", months: 3, baseRevenue: 100000 });
    const result = computeRevenueForecast(data);
    // 0 training rows < 3, so prediction inputs become excluded
    expect(result.listings.length).toBe(0);
    expect(result.excluded.length).toBeGreaterThan(0);
  });

  it("24 months trending data → directionally correct forecast", () => {
    const data = generateSyntheticData({
      months: 24,
      baseRevenue: 100000,
      monthlyGrowth: 3000,
      noise: 2000,
    });
    const result = computeRevenueForecast(data);

    expect(result.listings.length).toBe(1);
    expect(result.excluded.length).toBe(0);

    const listing = result.listings[0];
    // With growth, forecast should be higher than the base
    expect(listing.forecastGrossRevenueMinor).toBeGreaterThan(100000);
    // Should predict next month
    expect(listing.targetMonth).toBe("2026-01");
  });

  it("confidence bands: lower ≤ forecast ≤ upper, lower ≥ 0", () => {
    const data = generateSyntheticData({
      months: 24,
      baseRevenue: 150000,
      noise: 10000,
    });
    const result = computeRevenueForecast(data);

    for (const listing of result.listings) {
      expect(listing.lowerBandMinor).toBeLessThanOrEqual(listing.forecastGrossRevenueMinor);
      expect(listing.forecastGrossRevenueMinor).toBeLessThanOrEqual(listing.upperBandMinor);
      expect(listing.lowerBandMinor).toBeGreaterThanOrEqual(0);
    }
  });

  it("portfolio sums listing forecasts", () => {
    const data = [
      ...generateSyntheticData({ listingId: "A", months: 12, baseRevenue: 100000 }),
      ...generateSyntheticData({ listingId: "B", months: 12, baseRevenue: 200000 }),
    ];
    const result = computeRevenueForecast(data);

    expect(result.listings.length).toBe(2);
    const sumForecast = result.listings.reduce((s, l) => s + l.forecastGrossRevenueMinor, 0);
    expect(result.portfolio.forecastGrossRevenueMinor).toBe(sumForecast);

    const sumMae = result.listings.reduce((s, l) => s + l.maeMinor, 0);
    expect(result.portfolio.totalMaeMinor).toBe(sumMae);
  });

  it("confidence tier matches training months", () => {
    const data = generateSyntheticData({
      months: 24,
      baseRevenue: 100000,
    });
    const result = computeRevenueForecast(data);
    // 24 months → high confidence
    expect(result.listings[0].confidence).toBe("high");
  });

  it("mixed listings: some excluded, some forecast", () => {
    const data = [
      ...generateSyntheticData({ listingId: "A", months: 12, baseRevenue: 100000 }),
      ...generateSyntheticData({ listingId: "B", months: 2, baseRevenue: 200000 }),
    ];
    const result = computeRevenueForecast(data);

    // A should produce a forecast, B should be excluded
    expect(result.listings.length).toBe(1);
    expect(result.listings[0].listingId).toBe("A");
    expect(result.excluded.length).toBe(1);
    expect(result.excluded[0].listingId).toBe("B");
  });

  it("portfolio only includes listings with matching targetMonth", () => {
    // Two listings with different history lengths ending at different months
    const data = [
      ...generateSyntheticData({ listingId: "A", months: 12, baseRevenue: 100000, startMonth: "2024-01" }),
      ...generateSyntheticData({ listingId: "B", months: 12, baseRevenue: 100000, startMonth: "2024-01" }),
      ...generateSyntheticData({ listingId: "C", months: 10, baseRevenue: 100000, startMonth: "2024-01" }),
    ];
    const result = computeRevenueForecast(data);

    // All portfolio listings should share the same targetMonth
    const portfolioMonth = result.portfolio.targetMonth;
    for (const l of result.portfolio.listingForecasts) {
      expect(l.targetMonth).toBe(portfolioMonth);
    }

    // Total listings array may have listings with different targetMonths
    expect(result.listings.length).toBe(3);
  });
});
