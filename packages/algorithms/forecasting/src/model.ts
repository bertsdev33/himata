import type { FeatureRow, TrainedModel, ConfidenceTier } from "./types.js";
import { solveRidge, dot } from "./linalg.js";

const ALPHA_CANDIDATES = [0.1, 1, 10, 100];
const DEFAULT_ALPHA = 10;
const MIN_SAMPLES_FOR_LOO = 5;
const NUM_FEATURES = 13;

export interface ScalerParams {
  featureMeans: number[];
  featureStds: number[];
  targetMean: number;
  targetStd: number;
}

/** Compute mean and population std for each feature column and for targets. */
export function computeScalerParams(rows: FeatureRow[]): ScalerParams {
  const m = rows.length;
  const n = NUM_FEATURES;

  // Feature means
  const featureMeans = new Array(n).fill(0);
  for (const row of rows) {
    for (let j = 0; j < n; j++) {
      featureMeans[j] += row.features[j];
    }
  }
  for (let j = 0; j < n; j++) {
    featureMeans[j] /= m;
  }

  // Feature stds (population)
  const featureStds = new Array(n).fill(0);
  for (const row of rows) {
    for (let j = 0; j < n; j++) {
      const d = row.features[j] - featureMeans[j];
      featureStds[j] += d * d;
    }
  }
  for (let j = 0; j < n; j++) {
    featureStds[j] = Math.sqrt(featureStds[j] / m);
    if (featureStds[j] === 0) featureStds[j] = 1; // avoid div by zero
  }

  // Target mean and std
  let targetMean = 0;
  for (const row of rows) targetMean += row.target;
  targetMean /= m;

  let targetVar = 0;
  for (const row of rows) {
    const d = row.target - targetMean;
    targetVar += d * d;
  }
  let targetStd = Math.sqrt(targetVar / m);
  if (targetStd === 0) targetStd = 1;

  return { featureMeans, featureStds, targetMean, targetStd };
}

/** Scale features to zero mean, unit variance. Returns flat m×n array. */
export function scaleFeatures(
  rows: FeatureRow[],
  means: number[],
  stds: number[],
): number[] {
  const m = rows.length;
  const n = NUM_FEATURES;
  const scaled = new Array(m * n);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      scaled[i * n + j] = (rows[i].features[j] - means[j]) / stds[j];
    }
  }
  return scaled;
}

/** Scale a single feature vector. */
export function scaleSingleFeatures(
  features: number[],
  means: number[],
  stds: number[],
): number[] {
  const n = features.length;
  const scaled = new Array(n);
  for (let j = 0; j < n; j++) {
    scaled[j] = (features[j] - means[j]) / stds[j];
  }
  return scaled;
}

/** Scale targets to zero mean, unit variance. */
export function scaleTargets(rows: FeatureRow[], mean: number, std: number): number[] {
  return rows.map((r) => (r.target - mean) / std);
}

/** Unscale a predicted value back to original units. */
export function unscaleTarget(pred: number, mean: number, std: number): number {
  return pred * std + mean;
}

/**
 * Leave-One-Out cross-validation for alpha selection.
 * Each fold re-scales using only the training subset (no held-out leakage).
 * Returns { bestAlpha, bestMae } where MAE is in original target units.
 */
function looCrossValidation(
  rows: FeatureRow[],
): { bestAlpha: number; bestMae: number } {
  const m = rows.length;
  const n = NUM_FEATURES;

  let bestAlpha = DEFAULT_ALPHA;
  let bestMae = Infinity;

  for (const alpha of ALPHA_CANDIDATES) {
    let totalError = 0;

    for (let i = 0; i < m; i++) {
      // Build LOO subset excluding row i
      const looRows: FeatureRow[] = [];
      for (let k = 0; k < m; k++) {
        if (k !== i) looRows.push(rows[k]);
      }

      // Compute scaler from LOO subset only (no leakage)
      const params = computeScalerParams(looRows);
      const X_loo = scaleFeatures(looRows, params.featureMeans, params.featureStds);
      const y_loo = scaleTargets(looRows, params.targetMean, params.targetStd);

      const beta = solveRidge(X_loo, m - 1, n, y_loo, alpha);

      // Scale held-out sample with LOO scaler
      const scaledHeldOut = scaleSingleFeatures(
        rows[i].features,
        params.featureMeans,
        params.featureStds,
      );
      const scaledPred = dot(beta, scaledHeldOut);
      const pred = unscaleTarget(scaledPred, params.targetMean, params.targetStd);

      // Error in original units
      totalError += Math.abs(rows[i].target - pred);
    }

    const mae = totalError / m;
    if (mae < bestMae) {
      bestMae = mae;
      bestAlpha = alpha;
    }
  }

  return { bestAlpha, bestMae };
}

/**
 * Train a Ridge Regression model from feature rows.
 * Uses LOO CV for alpha selection when enough samples, else default alpha.
 */
export function trainRidgeModel(rows: FeatureRow[]): TrainedModel {
  const m = rows.length;
  const n = NUM_FEATURES;

  // Alpha selection (LOO CV operates on raw rows, handles its own scaling)
  let alpha: number;
  let looMae: number;

  if (m >= MIN_SAMPLES_FOR_LOO) {
    const cv = looCrossValidation(rows);
    alpha = cv.bestAlpha;
    looMae = cv.bestMae; // already in original units
  } else {
    alpha = DEFAULT_ALPHA;
    // Estimate MAE with full training error (biased but safe)
    const params = computeScalerParams(rows);
    const X_flat = scaleFeatures(rows, params.featureMeans, params.featureStds);
    const y = scaleTargets(rows, params.targetMean, params.targetStd);
    const betaTemp = solveRidge(X_flat, m, n, y, alpha);
    let totalError = 0;
    for (let i = 0; i < m; i++) {
      let scaledPred = 0;
      for (let j = 0; j < n; j++) {
        scaledPred += betaTemp[j] * X_flat[i * n + j];
      }
      const pred = unscaleTarget(scaledPred, params.targetMean, params.targetStd);
      totalError += Math.abs(rows[i].target - pred);
    }
    looMae = totalError / m;
  }

  // Train final model on all data
  const params = computeScalerParams(rows);
  const X_flat = scaleFeatures(rows, params.featureMeans, params.featureStds);
  const y = scaleTargets(rows, params.targetMean, params.targetStd);
  const beta = solveRidge(X_flat, m, n, y, alpha);

  return {
    beta,
    intercept: 0,
    featureMeans: params.featureMeans,
    featureStds: params.featureStds,
    targetMean: params.targetMean,
    targetStd: params.targetStd,
    alpha,
    looMae,
  };
}

/** Predict using a trained model. Returns value floored at 0. */
export function predict(model: TrainedModel, features: number[]): number {
  const scaled = scaleSingleFeatures(features, model.featureMeans, model.featureStds);
  const scaledPred = dot(model.beta, scaled);
  const pred = unscaleTarget(scaledPred, model.targetMean, model.targetStd);
  return Math.max(0, pred);
}

/** Determine confidence tier based on months of training data. */
export function getConfidenceTier(trainingMonths: number): ConfidenceTier {
  if (trainingMonths >= 18) return "high";
  if (trainingMonths >= 9) return "medium";
  return "low";
}
