/**
 * Monthly cashflow aggregation from payout-like transactions.
 */

import type {
  CanonicalTransaction,
  MonthlyCashflow,
  YearMonth,
} from "./schema/canonical.js";
import { isCashflowKind } from "./schema/canonical.js";
import { toYearMonth } from "./allocation.js";

/**
 * Compute monthly cashflow from payout and resolution_payout transactions.
 * Groups by (month, currency, accountId, listingId).
 * Unattributed payouts (no listing) aggregate without listingId.
 */
export function computeMonthlyCashflow(
  transactions: CanonicalTransaction[]
): MonthlyCashflow[] {
  const groups = new Map<string, MonthlyCashflow>();

  for (const tx of transactions) {
    if (!isCashflowKind(tx.kind)) continue;

    const month = toYearMonth(tx.occurredDate);
    const currency = tx.netAmount.currency;
    const accountId = tx.listing?.accountId;
    const listingId = tx.listing?.listingId;

    const key = `${month}|${currency}|${accountId ?? ""}|${listingId ?? ""}`;

    let group = groups.get(key);
    if (!group) {
      group = {
        month,
        currency,
        accountId,
        listingId,
        payoutsMinor: 0,
      };
      groups.set(key, group);
    }

    group.payoutsMinor += tx.netAmount.amountMinor;
  }

  return [...groups.values()].sort((a, b) =>
    a.month.localeCompare(b.month) || a.currency.localeCompare(b.currency)
  );
}
