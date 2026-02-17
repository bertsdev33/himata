/**
 * Deterministic listing identity generation.
 *
 * listingId = `${accountId}-${slug}-${shortHash}`
 * where slug = slugified normalizedListingName
 * and shortHash = first 8 hex chars of SHA-256(accountId + "::" + normalizedListingName)
 */

import type { ListingRef } from "@rental-analytics/core/schema/canonical.js";

/**
 * Normalize a listing name: trim, collapse whitespace, lowercase, normalize unicode.
 */
export function normalizeName(name: string): string {
  return name
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Create a URL-safe slug from a normalized listing name.
 * Keeps alphanumeric chars, replaces spaces/special chars with hyphens, collapses hyphens.
 */
export function slugify(normalizedName: string): string {
  return normalizedName
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Generate a short hash (first 8 hex chars) from a string using a simple
 * deterministic hash. We avoid crypto APIs for portability; this FNV-1a
 * variant is sufficient for dedup/identity purposes.
 */
export function shortHash(input: string): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) | 0; // FNV prime, keep 32-bit
  }
  // Convert to unsigned 32-bit hex, zero-padded to 8 chars
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Build a ListingRef from account ID and raw listing name.
 */
export function buildListingRef(accountId: string, listingName: string): ListingRef {
  const normalizedListingName = normalizeName(listingName);
  const slug = slugify(normalizedListingName);
  const hash = shortHash(`${accountId}::${normalizedListingName}`);
  const listingId = `${accountId}-${slug}-${hash}`;

  return {
    accountId,
    listingName,
    normalizedListingName,
    listingId,
  };
}
