# Airbnb Portfolio Analytics Alpha Plan (Planning Only)

## Summary
1. Build a canonical transaction model in `/Users/victornunez/dev/Aither/airbnb/packages/core` that supports both performance analytics and cashflow payouts.
2. Implement Airbnb v1 importer logic in `/Users/victornunez/dev/Aither/airbnb/packages/importers/airbnb/v1` with strict mapping rules, deterministic listing identity, and row-level warnings.
3. Treat `Portfolio` as all uploaded files in current session, default dashboard scope `Portfolio (All accounts)`, with optional `Account` and `Listing` filters.
4. Split realized vs forecast pipelines: `paid_*` contributes to realized performance + cashflow; `upcoming_*` contributes only to forecast/pipeline, labeled “Forecast – subject to change (not finalized payouts)”.
5. Use month allocation by stay-night overlap for reservation-like rows to avoid start-date bucketing errors.

## Constraints to Honor (from repo docs, priority applied)
1. Source-of-truth order: `/Users/victornunez/dev/Aither/airbnb/RULES.md` > `/Users/victornunez/dev/Aither/airbnb/TECH_STACK.md` > `/Users/victornunez/dev/Aither/airbnb/README.md`.
2. Security: validate/sanitize all external input, never log PII or raw spreadsheet contents, metadata-only analytics.
3. Quality gates: TypeScript strong typing, no `any` unless justified, modular/SOLID/no duplication, explicit error handling, lint/typecheck/tests required.
4. Workflow: Bun commands from repo root (`bun install`, `bun run dev:web`, `bun run lint`, `bun run typecheck`, `bun run test`), no bypassing hooks.
5. Architecture boundary: UI consumes canonical normalized models only; importer and KPI logic stay pure/testable in shared packages.
6. Product architecture: PostHog must be direct-to-PostHog from client, no Cloudflare proxy.

## Public Interfaces and Types (Decision-Complete)
1. Create canonical types at `/Users/victornunez/dev/Aither/airbnb/packages/core/src/schema/canonical.ts`:
```ts
export type SourceSystem = "airbnb";
export type SourceVersion = "v1";
export type DatasetKind = "paid" | "upcoming";

export type TransactionKind =
  | "reservation"
  | "adjustment"
  | "resolution_adjustment"
  | "cancellation_fee"
  | "payout"
  | "resolution_payout";

export type PerformanceKind =
  | "reservation"
  | "adjustment"
  | "resolution_adjustment"
  | "cancellation_fee";

export type CashflowKind = "payout" | "resolution_payout";

export type YearMonth = `${number}-${string}`;

export interface Money {
  currency: string;      // ISO 4217, e.g. USD
  amountMinor: number;   // integer cents
}

export interface ListingRef {
  accountId: string;
  listingName: string;
  normalizedListingName: string;
  listingId: string; // `${accountId}-${slug(normalizedListingName)}-${shortHash(accountId + "::" + normalizedListingName)}`
}

export interface StayWindow {
  checkInDate: string;   // YYYY-MM-DD
  checkOutDate: string;  // YYYY-MM-DD exclusive
  nights: number;
}

export interface CanonicalTransaction {
  transactionId: string; // deterministic row fingerprint
  source: SourceSystem;
  sourceVersion: SourceVersion;
  datasetKind: DatasetKind; // paid vs upcoming
  kind: TransactionKind;
  occurredDate: string; // YYYY-MM-DD
  listing?: ListingRef;
  stay?: StayWindow;

  netAmount: Money;            // from Amount for non-payout rows; from Paid out for payout rows
  grossAmount: Money;          // Gross earnings fallback Amount + Service fee
  hostServiceFeeAmount: Money; // -Service fee (host-positive convention)
  cleaningFeeAmount: Money;    // signed
  adjustmentAmount: Money;     // signed adjustment component (for adjustment-like kinds)

  rawRowRef: { fileName: string; rowNumber: number };
}

export interface ImportWarning {
  code:
    | "MULTI_CURRENCY_PARTITIONED"
    | "MISSING_REQUIRED_FIELD"
    | "INVALID_DATE"
    | "INVALID_MONEY"
    | "UNKNOWN_TRANSACTION_TYPE"
    | "MISSING_LISTING_FOR_PERFORMANCE_ROW"
    | "DEDUPLICATED_ROW";
  message: string;
  fileName: string;
  rowNumber?: number;
}

export interface ImportResult {
  transactions: CanonicalTransaction[];
  warnings: ImportWarning[];
}

export interface MonthlyAllocationSlice {
  transactionId: string;
  accountId: string;
  listingId: string;
  month: YearMonth;
  nights: number;
  allocationRatio: number;
  allocatedGrossMinor: number;
  allocatedNetMinor: number;
  allocatedCleaningFeeMinor: number;
  allocatedServiceFeeMinor: number;
  allocatedAdjustmentMinor: number;
  currency: string;
}

export interface MonthlyListingPerformance {
  month: YearMonth;
  accountId: string;
  listingId: string;
  listingName: string;
  currency: string;
  bookedNights: number;
  grossRevenueMinor: number; // includes cancellation fees
  netRevenueMinor: number;
  cleaningFeesMinor: number;
  serviceFeesMinor: number;
  reservationRevenueMinor: number;
  adjustmentRevenueMinor: number;
  resolutionAdjustmentRevenueMinor: number;
  cancellationFeeRevenueMinor: number;
}

export interface MonthlyPortfolioPerformance {
  month: YearMonth;
  currency: string;
  grossRevenueMinor: number;
  netRevenueMinor: number;
  bookedNights: number;
  cleaningFeesMinor: number;
  serviceFeesMinor: number;
}

export interface MonthlyCashflow {
  month: YearMonth;
  currency: string;
  accountId?: string;
  listingId?: string;
  payoutsMinor: number; // payout + resolution_payout
}

export interface TrailingComparison {
  month: YearMonth;
  metric: "netRevenueMinor" | "grossRevenueMinor";
  trailingWindowMonths: 3 | 6 | 12;
  baselineMinor: number;
  currentMinor: number;
  deltaMinor: number;
  deltaPct: number | null;
  label: string; // e.g., "vs trailing 6-month average"
}

export interface EstimatedOccupancy {
  month: YearMonth;
  currency: string;
  bookedNights: number;
  daysInMonth: number;
  listingsInService: number;
  estimatedOccupancyRate: number | null;
  label: "Estimated Occupancy (Assumption-Based)";
  disclaimer: "booked nights / (days_in_month * listings_in_service); not true occupancy";
}
```

2. Create core API surface in `/Users/victornunez/dev/Aither/airbnb/packages/core/src/index.ts`:
```ts
export function allocatePerformanceToMonths(
  transactions: CanonicalTransaction[]
): MonthlyAllocationSlice[];

export function computeMonthlyListingPerformance(
  allocations: MonthlyAllocationSlice[]
): MonthlyListingPerformance[];

export function computeMonthlyPortfolioPerformance(
  listingPerf: MonthlyListingPerformance[]
): MonthlyPortfolioPerformance[];

export function computeMonthlyCashflow(
  transactions: CanonicalTransaction[]
): MonthlyCashflow[];

export function computeTrailingComparisons(
  monthlySeries: MonthlyListingPerformance[]
): TrailingComparison[];

export function computeEstimatedOccupancy(
  listingPerf: MonthlyListingPerformance[],
  listingServiceRanges: ListingServiceRange[]
): EstimatedOccupancy[];
```

3. Add importer interface in `/Users/victornunez/dev/Aither/airbnb/packages/importers/airbnb/v1/src/index.ts`:
```ts
export interface ImportAirbnbV1Input {
  fileName: string;
  csvText: string;
  accountId: string;      // explicit from upload flow
  datasetKind: "paid" | "upcoming";
}

export function importAirbnbV1(input: ImportAirbnbV1Input): ImportResult;
```

## Importer Mapping Plan (`/Users/victornunez/dev/Aither/airbnb/packages/importers/airbnb/v1`)
1. Header support:
- `paid` schema columns include `Paid out` and `Arriving by date`.
- `upcoming` schema omits `Paid out` and `Arriving by date`.
- Parser must accept both and normalize to one row model.

2. Filename/account rules:
- Fixtures use generic names: `paid_a.csv`, `paid_b.csv`, `paid_c.csv`, `upcoming_a.csv`.
- Tests pass `accountId` explicitly as metadata (not derived from fixture filename).
- App upload flow: prefill account label from filename stem; user can edit; importer always receives explicit `accountId`.

3. Transaction type mapping:
- `Reservation` -> `reservation`
- `Adjustment` -> `adjustment`
- `Resolution Adjustment` -> `resolution_adjustment`
- `Cancellation Fee` -> `cancellation_fee`
- `Payout` -> `payout`
- `Resolution Payout` -> `resolution_payout`

4. Money mapping rules (host-positive convention):
- `hostServiceFeeAmount = -Service fee`.
- `netAmount`:
  - non-payout kinds: from `Amount`.
  - payout kinds: from `Paid out` (since `Amount` is blank).
- `grossAmount`:
  - use `Gross earnings` when present.
  - fallback `Amount + Service fee`.
- `cleaningFeeAmount` from `Cleaning fee` (default 0 when empty).
- `adjustmentAmount` populated for adjustment-like kinds, else 0.
- Convert all money to minor units with deterministic rounding.

5. Listing identity:
- `normalizedListingName = normalize(listingName)` (trim, collapse spaces, lowercase, normalize unicode).
- `listingId = ${accountId}-${slug(normalizedListingName)}-${shortHash(accountId + "::" + normalizedListingName)}`.
- For payout rows with no listing, leave `listing` undefined.

6. Date and nights handling:
- Parse `Date`, `Start date`, `End date` (`MM/DD/YYYY` -> `YYYY-MM-DD`).
- `nights` from CSV, cross-validated with date difference when both dates exist.
- Stay-based rows carry `StayWindow`.
- Payout rows have no stay window.

7. Dedup policy (session-level):
- Deduplicate exact duplicate rows across all uploaded files using stable row fingerprint hash.
- Fingerprint input: accountId + fileName + canonicalized row field payload (excluding volatile whitespace).
- Emit `DEDUPLICATED_ROW` warnings for dropped duplicates.

8. Currency policy:
- Do not fail on multi-currency.
- Partition all aggregations by currency.
- Emit `MULTI_CURRENCY_PARTITIONED` warning once per import/session if >1 currency detected.

9. Realized vs forecast split:
- `datasetKind = "paid"` rows feed realized performance + cashflow.
- `datasetKind = "upcoming"` rows excluded from realized metrics and cashflow; used only for forecast/pipeline outputs.

## Allocation and KPI Computation Rules
1. Monthly allocation for stay-based performance rows:
- Apply to `reservation` and `cancellation_fee`.
- For `adjustment` and `resolution_adjustment`:
  - default bucket by `occurredDate` month.
  - if valid stay dates exist, allow proportional night allocation by stay overlap.
- `allocationRatio = nightsInTargetMonth / totalNights`.
- Allocate all money components by ratio with largest-remainder correction so monthly minor totals reconcile exactly to source totals.

2. KPI definitions (first release):
- `bookedNights = sum(allocated nights)`.
- `grossRevenue = sum(allocated gross)` including cancellation fees.
- `netRevenue = sum(allocated net)` including all performance kinds.
- `cleaningFees = sum(allocated cleaning fee)`.
- `serviceFees = sum(allocated host service fee)` (negative in host-positive convention).
- `ADR = grossRevenue / bookedNights` when `bookedNights > 0`, else `null`.
- Breakdown metrics:
  - reservations, adjustments, resolution adjustments, cancellation fees as separate totals.
- `seasonality`:
  - for each listing+currency+month-of-year, compare current month against historical average of same month-of-year.
- `under/over vs trailing average`:
  - adaptive by available historical months `M` (per listing+currency):
  - `M < 3`: no comparison.
  - `3 <= M <= 5`: trailing window 3.
  - `6 <= M <= 11`: trailing window 6.
  - `M >= 12`: trailing window 12.
  - use contiguous calendar months with zero-fill for gaps.
  - always label window used: `vs trailing {N}-month average`.

3. Estimated Occupancy (assumption-based):
- Formula: `bookedNights / (daysInMonth * listingsInService)`.
- `listingsInService` rule: lifecycle range per listing from first observed stay start to last observed stay end; listing counts in every month in that range.
- Required label/disclaimer in outputs:
  - Label: `Estimated Occupancy (Assumption-Based)`.
  - Disclaimer: `booked nights / (days_in_month * listings_in_service); not true occupancy`.

4. Portfolio default aggregation:
- Default dashboard and KPIs are global across all accounts in session (`Portfolio (All accounts)`).
- `Account` and `Listing` filters are optional secondary drill-downs.

## Forecast/Pipeline View Plan
1. Create separate forecast computation path from `datasetKind = "upcoming"` only.
2. Compute forward-looking nights and projected gross/net with same allocation logic.
3. Never merge forecast into realized headline KPIs or cashflow.
4. UI labels must clearly state:
- `Forecast – subject to change (not finalized payouts)`.

## Test Plan (Fixtures + Core)
1. Fixture input tests in `/Users/victornunez/dev/Aither/airbnb/packages/importers/airbnb/v1/test`:
- `paid_a.csv`, `paid_b.csv`, `paid_c.csv`, `upcoming_a.csv` parse successfully.
- All known Airbnb types map correctly.
- Money/sign mapping validates:
  - `hostServiceFeeAmount = -serviceFee`.
  - gross fallback `amount + serviceFee`.
  - payout net from `Paid out`.
- Deterministic `listingId` format and stability across files for same account+listing name.
- Missing listing allowed for payout kinds, warned for performance kinds.

2. Allocation tests in `/Users/victornunez/dev/Aither/airbnb/packages/core/test`:
- Cross-month and multi-month reservations split by night overlap correctly.
- Adjustments default to occurred-date month unless stay dates provided.
- Largest-remainder minor-unit reconciliation preserves source totals exactly.

3. KPI tests:
- Headline totals include cancellation fees and match category breakdown sums.
- ADR null when nights is zero.
- Trailing window adaptation and labels are correct for `M` buckets.
- Zero-fill behavior for missing months in trailing baseline.
- Seasonality baseline computed only when comparable month-of-year history exists.

4. Cashflow tests:
- `payout` + `resolution_payout` included in monthly cashflow.
- Unattributed payouts aggregate without listing id.
- `upcoming` rows excluded from realized cashflow.

5. Multi-currency tests:
- Currency partition outputs are separate.
- Warning emitted without hard failure.

6. Portfolio scope/filter tests:
- Default output equals all accounts combined.
- Filtering by account or listing returns consistent subset totals.

7. Snapshot tests:
- Canonical normalized transaction snapshots per fixture.
- Monthly performance/cashflow snapshots per fixture and combined session.

## Acceptance Criteria
1. Any reservation spanning months contributes nights and revenue proportionally to each month by overlap, not by start date.
2. Realized dashboard excludes all `upcoming` dataset rows.
3. Forecast/pipeline view uses only `upcoming` rows and has required warning label.
4. Global portfolio KPIs are default view; account/listing drill-downs are optional.
5. Multi-currency uploads compute correctly by partition and emit warning.
6. All tests pass under Bun scripts and type/lint gates remain clean.

## Assumptions and Defaults Locked
1. `accountId` is provided explicitly to importer by upload flow (prefilled from filename convention).
2. CSV date format is `MM/DD/YYYY`; normalized storage format is `YYYY-MM-DD`.
3. Nights are exclusive of checkout date.
4. Dedup is exact-row fingerprint based, not confirmation-code collapse.
5. Trailing comparisons use contiguous calendar months with zero-fill.
6. Listings-in-service for estimated occupancy uses inferred lifecycle range from observed stays.
7. Portfolio equals all files uploaded in current browser session for Alpha.
