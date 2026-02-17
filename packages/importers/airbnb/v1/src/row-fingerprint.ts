/**
 * Deterministic row fingerprint for deduplication.
 * Uses a stable hash of the canonical row fields (excluding volatile whitespace).
 */

import { shortHash } from "./listing-identity.js";

/**
 * Build a deterministic fingerprint for a CSV row.
 * Input: accountId + canonical field values (trimmed, whitespace-collapsed).
 */
export function buildRowFingerprint(
  accountId: string,
  fields: Record<string, string>
): string {
  // Sort keys for determinism, join trimmed values
  const keys = Object.keys(fields).sort();
  const canonicalized = keys
    .map((k) => `${k}=${fields[k].trim().replace(/\s+/g, " ")}`)
    .join("|");

  const input = `${accountId}|${canonicalized}`;
  // Use two rounds of hashing for a longer fingerprint
  const h1 = shortHash(input);
  const h2 = shortHash(input + h1);
  return `${h1}${h2}`;
}
