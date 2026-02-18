import { describe, expect, it } from "bun:test";
import {
  computeScalerParams,
  trainRidgeModel,
  predict,
  getConfidenceTier,
} from "../src/model.js";
import { buildFeatureRows } from "../src/features.js";
import { generateSyntheticData } from "./helpers.js";
import type { FeatureRow } from "../src/types.js";

function makeRows(features: number[][], targets: number[]): FeatureRow[] {
  return features.map((f, i) => ({
    features: f,
    target: targets[i],
    listingId: "test",
    month: `2024-${String(i + 1).padStart(2, "0")}`,
  }));
}

describe("computeScalerParams", () => {
  it("computes correct mean and std", () => {
    // 13 features, 3 samples — simple test with first feature varying
    const rows = makeRows(
      [
        [10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ],
      [100, 200, 300],
    );

    const params = computeScalerParams(rows);
    expect(params.featureMeans[0]).toBeCloseTo(20, 10);
    // Population std of [10, 20, 30] = sqrt(((10-20)²+(20-20)²+(30-20)²)/3) = sqrt(200/3)
    expect(params.featureStds[0]).toBeCloseTo(Math.sqrt(200 / 3), 10);
    expect(params.targetMean).toBeCloseTo(200, 10);
    expect(params.targetStd).toBeCloseTo(Math.sqrt(20000 / 3), 10);
  });

  it("constant feature gets std = 1", () => {
    const rows = makeRows(
      [
        [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ],
      [100, 100, 100],
    );

    const params = computeScalerParams(rows);
    expect(params.featureStds[0]).toBe(1);
    expect(params.targetStd).toBe(1);
  });
});

describe("trainRidgeModel", () => {
  it("predictions within reasonable range on synthetic linear data", () => {
    // Generate enough data to train a meaningful model
    const data = generateSyntheticData({
      months: 24,
      baseRevenue: 100000,
      monthlyGrowth: 2000,
      noise: 5000,
    });

    const { trainingRows, predictionInputs } = buildFeatureRows(data);
    expect(trainingRows.length).toBeGreaterThanOrEqual(5);

    const model = trainRidgeModel(trainingRows);

    // Model should have reasonable alpha
    expect(model.alpha).toBeGreaterThan(0);
    expect(model.beta.length).toBe(13);

    // Predict for the last month
    const prediction = predict(model, predictionInputs[0].features);
    // Should be in a reasonable range (base ~100000 + 24*2000 = ~148000, with noise)
    expect(prediction).toBeGreaterThan(50000);
    expect(prediction).toBeLessThan(300000);
  });

  it("handles small dataset (< 5 samples, skips LOO)", () => {
    const data = generateSyntheticData({
      months: 5,
      baseRevenue: 100000,
    });

    const { trainingRows } = buildFeatureRows(data);
    // 5 months → 2 training rows (i=2,3)
    expect(trainingRows.length).toBe(2);

    // Should not throw even with very few samples
    const model = trainRidgeModel(trainingRows);
    expect(model.alpha).toBe(10); // default alpha when < 5 samples
  });
});

describe("predict", () => {
  it("returns non-negative values", () => {
    const data = generateSyntheticData({
      months: 12,
      baseRevenue: 100000,
    });

    const { trainingRows, predictionInputs } = buildFeatureRows(data);
    const model = trainRidgeModel(trainingRows);
    const pred = predict(model, predictionInputs[0].features);
    expect(pred).toBeGreaterThanOrEqual(0);
  });
});

describe("getConfidenceTier", () => {
  it("returns high for 18+ months", () => {
    expect(getConfidenceTier(18)).toBe("high");
    expect(getConfidenceTier(24)).toBe("high");
  });

  it("returns medium for 9-17 months", () => {
    expect(getConfidenceTier(9)).toBe("medium");
    expect(getConfidenceTier(17)).toBe("medium");
  });

  it("returns low for <9 months", () => {
    expect(getConfidenceTier(8)).toBe("low");
    expect(getConfidenceTier(3)).toBe("low");
  });
});
