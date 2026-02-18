import { describe, expect, it } from "bun:test";
import { groupByListing, rollingAverage, buildFeatureRows, nextMonth } from "../src/features.js";
import { generateSyntheticData } from "./helpers.js";

describe("groupByListing", () => {
  it("groups by listingId and sorts chronologically", () => {
    const data = [
      ...generateSyntheticData({ listingId: "A", months: 3, baseRevenue: 100000, startMonth: "2024-01" }),
      ...generateSyntheticData({ listingId: "B", months: 2, baseRevenue: 200000, startMonth: "2024-02" }),
    ];
    // Shuffle to test sorting
    data.sort(() => Math.random() - 0.5);

    const groups = groupByListing(data);
    expect(groups.length).toBe(2);

    const groupA = groups.find((g) => g.listingId === "A")!;
    expect(groupA.months.length).toBe(3);
    expect(groupA.months[0].month).toBe("2024-01");
    expect(groupA.months[1].month).toBe("2024-02");
    expect(groupA.months[2].month).toBe("2024-03");

    const groupB = groups.find((g) => g.listingId === "B")!;
    expect(groupB.months.length).toBe(2);
    expect(groupB.months[0].month).toBe("2024-02");
  });
});

describe("rollingAverage", () => {
  it("computes 3-month rolling average", () => {
    const values = [100, 200, 300, 400, 500];
    // At index 3, window 3: avg of indices 0,1,2 = (100+200+300)/3 = 200
    expect(rollingAverage(values, 3, 3)).toBe(200);
    // At index 4, window 3: avg of indices 1,2,3 = (200+300+400)/3 = 300
    expect(rollingAverage(values, 4, 3)).toBe(300);
  });

  it("handles window larger than available data", () => {
    const values = [100, 200];
    // At index 1, window 3: only index 0 available → 100
    expect(rollingAverage(values, 1, 3)).toBe(100);
  });

  it("returns 0 for index 0", () => {
    expect(rollingAverage([100, 200], 0, 3)).toBe(0);
  });
});

describe("buildFeatureRows", () => {
  it("3 months → 0 training rows + 1 prediction", () => {
    const data = generateSyntheticData({ months: 3, baseRevenue: 100000 });
    const result = buildFeatureRows(data);
    // With 3 months, training goes from index 2 to n-2 = 0, so range is empty: 0 training rows
    // Actually: indices 2..n-2 means i=2 to i<2, which is 0 rows
    // Wait: n=3, so range is i=2 to i<n-1=2, which is 0 rows
    expect(result.trainingRows.length).toBe(0);
    expect(result.predictionInputs.length).toBe(1);
    expect(result.excluded.length).toBe(0);
  });

  it("4 months → 1 training row + 1 prediction", () => {
    const data = generateSyntheticData({ months: 4, baseRevenue: 100000 });
    const result = buildFeatureRows(data);
    // n=4: training from i=2 to i<3 → 1 row
    expect(result.trainingRows.length).toBe(1);
    expect(result.predictionInputs.length).toBe(1);
  });

  it("12 months → 9 training rows", () => {
    const data = generateSyntheticData({ months: 12, baseRevenue: 100000 });
    const result = buildFeatureRows(data);
    // n=12: training from i=2 to i<11 → 9 rows
    expect(result.trainingRows.length).toBe(9);
    expect(result.predictionInputs.length).toBe(1);
  });

  it("listing with <3 months is excluded", () => {
    const data = generateSyntheticData({ months: 2, baseRevenue: 100000 });
    const result = buildFeatureRows(data);
    expect(result.excluded.length).toBe(1);
    expect(result.excluded[0].monthsAvailable).toBe(2);
    expect(result.predictionInputs.length).toBe(0);
    expect(result.trainingRows.length).toBe(0);
  });

  it("features have month_sin and month_cos in [-1, 1]", () => {
    const data = generateSyntheticData({ months: 12, baseRevenue: 100000 });
    const result = buildFeatureRows(data);
    for (const row of result.trainingRows) {
      expect(row.features[7]).toBeGreaterThanOrEqual(-1);
      expect(row.features[7]).toBeLessThanOrEqual(1);
      expect(row.features[8]).toBeGreaterThanOrEqual(-1);
      expect(row.features[8]).toBeLessThanOrEqual(1);
    }
  });

  it("trend feature increases monotonically", () => {
    const data = generateSyntheticData({ months: 12, baseRevenue: 100000, startMonth: "2024-01" });
    const result = buildFeatureRows(data);
    for (let i = 1; i < result.trainingRows.length; i++) {
      expect(result.trainingRows[i].features[9]).toBeGreaterThan(
        result.trainingRows[i - 1].features[9],
      );
    }
  });

  it("listing_months feature increases per training row (no leakage)", () => {
    const data = generateSyntheticData({ months: 12, baseRevenue: 100000 });
    const result = buildFeatureRows(data);
    // Feature 12 is listing_months (incremental: i+1)
    for (let i = 1; i < result.trainingRows.length; i++) {
      expect(result.trainingRows[i].features[12]).toBeGreaterThan(
        result.trainingRows[i - 1].features[12],
      );
    }
    // First training row is at index 2 → listing_months = 3
    expect(result.trainingRows[0].features[12]).toBe(3);
  });

  it("histMean feature uses only past data (no leakage)", () => {
    // Use varying revenues so histMean changes with more data
    const data = generateSyntheticData({ months: 8, baseRevenue: 100000, monthlyGrowth: 10000 });
    const result = buildFeatureRows(data);
    // Feature 10 is listing_hist_mean
    // Each subsequent training row should see a slightly different mean (as more data included)
    // With growth, the mean should be increasing since higher values get included
    for (let i = 1; i < result.trainingRows.length; i++) {
      // Just verify they are different (not computed from same global stat)
      expect(result.trainingRows[i].features[10]).not.toBe(
        result.trainingRows[0].features[10],
      );
    }
  });

  it("multiple listings produce combined training rows", () => {
    const data = [
      ...generateSyntheticData({ listingId: "A", months: 6, baseRevenue: 100000 }),
      ...generateSyntheticData({ listingId: "B", months: 8, baseRevenue: 200000 }),
    ];
    const result = buildFeatureRows(data);
    // A: 6 months → 3 training rows (i=2,3,4)
    // B: 8 months → 5 training rows (i=2,3,4,5,6)
    expect(result.trainingRows.length).toBe(3 + 5);
    expect(result.predictionInputs.length).toBe(2);
  });
});

describe("nextMonth", () => {
  it("increments within year", () => {
    expect(nextMonth("2026-02")).toBe("2026-03");
    expect(nextMonth("2026-11")).toBe("2026-12");
  });

  it("wraps year boundary", () => {
    expect(nextMonth("2026-12")).toBe("2027-01");
  });

  it("handles January", () => {
    expect(nextMonth("2026-01")).toBe("2026-02");
  });
});
