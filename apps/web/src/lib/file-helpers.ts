import type { DatasetKind } from "@rental-analytics/core";

/**
 * Attempt to prefill account ID from a filename.
 * Strips extension and common prefixes/suffixes.
 * e.g., "paid_a.csv" -> "a", "my-airbnb-account.csv" -> "my-airbnb-account"
 */
export function prefillAccountId(fileName: string): string {
  const base = fileName.replace(/\.csv$/i, "");
  // Strip common prefixes like "paid_", "upcoming_"
  const stripped = base.replace(/^(paid|upcoming)_/i, "");
  return stripped || base;
}

/**
 * Auto-detect dataset kind from filename.
 * Files with "upcoming" in the name -> "upcoming", else "paid".
 */
export function detectDatasetKind(fileName: string): DatasetKind {
  return /upcoming/i.test(fileName) ? "upcoming" : "paid";
}

/** Read a File object as text */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
