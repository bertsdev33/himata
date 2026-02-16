# Dashboard Specification

This document defines the analytics dashboard for the Rental Analytics web application. It serves as the single source of truth for what to build, how tabs are enabled, and what ships in Alpha vs Phase 2.

---

## 0. Data Detection & Page Enablement

The dashboard ingests two dataset kinds from CSV uploads:

| Dataset | Source Files | Key |
|---------|-------------|-----|
| **Paid** | `paid_*.csv` | `datasetKind = "paid"` |
| **Upcoming** | `upcoming_*.csv` | `datasetKind = "upcoming"` |

Tabs that require a missing dataset are rendered **greyed-out** with a one-line reason (e.g., *"Upload upcoming reservations CSV"*). They are never hidden — the user always sees the full tab bar so they know what's possible.

---

## 1. Global Layout

### 1.1 Header (`DashboardHeader`)

Kept as-is:
- Title: **"Rental Analytics"**
- Currency badge showing the active currency
- **"Upload New Files"** button (resets state, returns to upload flow)

### 1.2 Filter Bar (redesigned `FilterBar`)

Always visible, persistent across tab navigation, reactive to all tabs.

| Control | Type | Default | Behavior |
|---------|------|---------|----------|
| **Date Range** | Start/end month pickers | All available data (min–max from dataset) | Constrains every chart and KPI |
| **Account** | Multi-select dropdown with chips | All selected | Filters transactions to selected accounts |
| **Listing** | Multi-select dropdown with chips (searchable) | All selected | Options filtered by selected accounts; filters transactions to selected listings |
| **Currency** | Selector | First detected currency | Only shown when 2+ currencies exist in data |
| **View Mode** | Segmented tabs: `Realized` / `Forecast` / `All` | `Realized` | Controls which dataset kinds are included |
| **Projection** | Toggle switch, labeled "Project current month" | OFF | When ON, extends incomplete month with projected values (see Section 4) |
| **Revenue Basis** | Toggle: `Net` / `Gross` | `Net` | Controls which revenue metric charts emphasize; avoids showing both lines everywhere |

**Removed**: Portfolio / Account / Listing scope tabs. The multi-select dropdowns replace this UX entirely. All listings selected = portfolio view. One listing selected = listing detail view. The filter state drives tab enablement.

### 1.3 Warnings Panel (`WarningsPanel`)

Always visible at the top of every tab, below the filter bar. Shows duplicate alerts, data quality warnings, and import notices. Collapsible but visible by default.

### 1.4 Tab Navigation Bar

Horizontally scrollable tab strip. Tabs are conditionally enabled based on the table in Section 2.

---

## 2. Tabs & Enable Conditions

| Tab | Default? | Enable Condition | Disabled Reason |
|-----|----------|------------------|-----------------|
| **Portfolio Overview** | Yes (landing tab) | Any transactions exist in the filtered set | — |
| **Listing Comparison** | No | 2+ distinct listings in the filtered set | *"Select 2+ listings"* |
| **Listing Detail** | No | Exactly 1 listing in the filtered set | *"Filter to a single listing"* |
| **Cashflow** | No | View mode is not `Forecast` AND payout data exists | *"No payout data"* or *"Switch to Realized view"* |
| **Forecast / Pipeline** | No | Upcoming transactions exist (`datasetKind = "upcoming"`) | *"Upload upcoming reservations CSV"* |
| **Transactions Explorer** | No | Any transactions exist | — |
| **Data Quality** | No | Always enabled (shows import metadata even with no transactions) | — |

---

## 3. Tab Specifications

### 3.1 Portfolio Overview (default landing tab)

Answers: *"How is my business doing overall?"*

#### KPI Cards (top row — 6 cards)

| Card | Value | Subtext |
|------|-------|---------|
| **Total Net Revenue** | Sum of net revenue across filtered months | % change vs previous month + sparkline (last 6–12 months) |
| **Total Gross Revenue** | Sum of gross revenue across filtered months | % change vs previous month + sparkline |
| **Booked Nights** | Sum of booked nights across filtered months | — |
| **Avg. Daily Rate** | Gross revenue / booked nights | — |
| **Est. Occupancy** | Average occupancy rate across filtered months | Tooltip with calculation disclaimer |
| **MoM Change** | Net revenue delta % (latest month vs previous month) | Green (positive) / red (negative) coloring |

Each card: big formatted number, % change badge, optional sparkline.

#### Revenue Trend (enhanced `RevenueTrendChart`)

- **Chart type**: Line/AreaChart
- **X-axis**: Month (YYYY-MM)
- **Y-axis**: Revenue (formatted with currency)
- **Primary line**: Controlled by the Net/Gross toggle (shows one, not both)
- **Overlay**: Dotted trailing 6-month average line
- **Projection toggle**: When ON, the incomplete current month extends with a dashed line segment in a distinct lighter color (see Section 4)
- **Tooltip**: Formatted currency values per data point

#### Revenue Decomposition (kept `RevenueBreakdownChart`)

- **Chart type**: Stacked BarChart
- **X-axis**: Month
- **Y-axis**: Revenue
- **Stack segments**: Reservations, Adjustments, Resolution Adjustments, Cancellation Fees
- **Colors**: Existing chart color palette (blue, orange, green, red)
- Answers: *"Is growth driven by bookings or adjustments?"*

#### Top Movers Table (NEW)

Compact table showing listings with the biggest month-over-month changes. Quickly answers *"What changed this month?"*

| Column | Description |
|--------|-------------|
| Listing | Listing name |
| Revenue (current month) | Net revenue for the latest month |
| MoM Delta | Revenue change vs previous month (absolute + %) |
| vs Trailing Avg Delta | Revenue change vs trailing average (absolute + %) |
| Nights Delta | Change in booked nights vs previous month |
| ADR Delta | Change in ADR vs previous month |

Sorted by absolute MoM delta descending. Green/red coloring for positive/negative.

#### Trailing Comparisons (kept `TrailingComparisons`)

- Latest month vs trailing 3-month, 6-month, and 12-month averages
- Shown for both Net and Gross revenue
- Delta % with green/red coloring

#### Occupancy Display (kept `OccupancyDisplay`)

- Monthly occupancy grid with disclaimer alert
- Each cell: month label, occupancy %, nights/listings calculation

---

### 3.2 Listing Comparison (enabled when 2+ listings in filtered set)

Answers: *"Which properties are carrying the business?"*

#### Leaderboard Table (enhanced `ListingsTable`)

Sortable table. All columns clickable for sort toggle.

| Column | Source | Notes |
|--------|--------|-------|
| Listing | Listing name | — |
| Account | Account name | Shown as a small tag/badge |
| Nights | Booked nights (sum) | — |
| Gross Revenue | Sum | Formatted with currency |
| Net Revenue | Sum | Formatted with currency |
| ADR | Gross / Nights | — |
| Service Fees | Sum | Formatted with currency |
| Est. Occupancy | Average | With disclaimer |
| % vs Trailing Avg | Delta % | Up/down arrows, green/red coloring |
| Share of Portfolio % | Listing net / total portfolio net | — |
| Action | Button: **"Show only this listing"** | Sets the listing filter to this single listing, which reveals the Listing Detail tab |

Default sort: Net Revenue descending.

#### Multi-Line Revenue Chart (NEW)

- **Chart type**: LineChart
- **X-axis**: Month
- **Y-axis**: Revenue (controlled by Net/Gross toggle)
- **Lines**: One line per listing (distinct colors)
- **Toggle**: Top 5 only / Show All
- Reveals volatility, seasonality differences, and emerging winners across listings

---

### 3.3 Listing Detail (enabled when exactly 1 listing in filtered set)

Answers: *"How is this specific property performing?"*

This tab appears when the user filters to a single listing — either via the listing multi-select dropdown or by clicking "Show only this listing" in the Leaderboard Table.

#### Monthly Revenue Area Chart

- **Chart type**: AreaChart
- **Y-axis**: Revenue (controlled by Net/Gross toggle)
- **Trailing average overlay line** (dotted)
- **Projection toggle**: Incomplete month extends with dashed line (see Section 4)

#### Nights vs ADR Dual Axis Chart (NEW)

- **Chart type**: ComposedChart
- **Left Y-axis (bars)**: Booked Nights per month
- **Right Y-axis (line)**: ADR per month
- Immediately answers: *"Is revenue change from fewer nights or lower ADR?"*

#### Under/Over Indicator Panel

- Current month net revenue vs trailing average
- Delta % displayed prominently
- Label: **"Underperforming"** (red) or **"Outperforming"** (green)
- Explanation: *"Compared to trailing 6-month average."*

---

### 3.4 Cashflow (enabled when view mode is not `Forecast` AND payout data exists)

Answers: *"When did money actually hit the bank?"*

#### Monthly Payout Bar Chart (kept `CashflowSection`)

- **Chart type**: BarChart
- **X-axis**: Payout month
- **Y-axis**: Paid out amount (formatted with currency)
- Note: Payout month often differs from revenue/stay month

#### Payout Summary Table (NEW)

| Column | Description |
|--------|-------------|
| Month | Payout month |
| Total Paid Out | Sum of payouts for that month |
| Payout Event Count | Number of distinct payout events |

---

### 3.5 Forecast / Pipeline (enabled when upcoming transactions exist)

Answers: *"What revenue is in the pipeline?"*

#### Warning Banner

Always shown at top of this tab:
> **Forecast** — subject to change (not finalized payouts)

#### Forward Revenue Projection

- **Chart type**: BarChart
- **X-axis**: Future months
- **Y-axis**: Expected net revenue
- **Optional overlay**: Same month from the previous year (if historical data available)

#### Upcoming Nights by Month

- **Chart type**: BarChart
- **X-axis**: Future months
- **Y-axis**: Booked nights
- **Optional overlay**: Historical average nights for comparison

---

### 3.6 Transactions Explorer (NEW)

Searchable, filterable raw data table for auditing CSV imports.

#### Columns

Displays fields available in `CanonicalTransaction`:

| Column |
|--------|
| Date |
| Type |
| Account |
| Listing |
| Confirmation Code |
| Nights |
| Net Amount |
| Gross Amount |
| Service Fee |
| Cleaning Fee |
| Paid Out |

#### Features

- **Column sorting**: Click any column header to sort ascending/descending
- **Text search**: Search across listing name and confirmation code
- **Global filter integration**: Respects all active filters (date range, account, listing, currency, view mode)
- Paginated for performance

---

### 3.7 Data Quality

Answers: *"Can I trust this data?"*

Always enabled — shows import metadata even when the dataset is empty.

#### Import Summary Cards

| Card | Value |
|------|-------|
| Total Rows Imported | Count of all imported transaction rows |
| Transactions by Type | Breakdown: Reservations, Adjustments, Resolutions, Cancellations |
| Duplicates Removed | Count of duplicate rows detected and removed |
| Currency Partitions | List of currencies found in the data |
| Date Coverage | Min and max dates across the dataset |

#### Detailed Warnings List

Full `WarningsPanel` content with all import warnings, expandable for details. Includes:
- Duplicate transaction alerts
- Missing month gaps
- Suspicious values (e.g., occupancy > 100%)
- Multi-currency notices
- Listings with fewer than 3 months of history

---

## 4. Projection Toggle Behavior

- **Default**: OFF
- **When ON** and the current date falls within an incomplete month:
  - **Formula**: `projected = actual_so_far / day_of_month * days_in_month`
  - **Visual treatment**:
    - Revenue Trend chart: dashed line segment in a distinct lighter color for the projected portion; solid line for actual
    - Revenue Decomposition chart: hatched or lighter-opacity bars for the projected portion
    - KPI Cards: values show a "projected" label/badge when projection is active
  - **Affected components**: Revenue Trend, Revenue Decomposition, KPI Cards, Listing Detail Area Chart
- Charts always show both actual (solid) and projected (dashed/lighter) portions clearly so the user never confuses projected data with finalized data

---

## 5. Cross-Reference: Current Components

Every existing component has a defined home in this specification. Nothing is lost.

| Current Component | New Location |
|---|---|
| `DashboardHeader` | Kept as-is (Section 1.1) |
| `FilterBar` | Redesigned with multi-select, date range, revenue toggle, projection toggle (Section 1.2) |
| `WarningsPanel` | Always visible at top of every tab (Section 1.3) + detailed in Data Quality tab (Section 3.7) |
| `KPISummaryCards` | Portfolio Overview — KPI Cards, expanded from 4 to 6 (Section 3.1) |
| `RevenueTrendChart` | Portfolio Overview — Revenue Trend, enhanced with trailing average + projection (Section 3.1) |
| `RevenueBreakdownChart` | Portfolio Overview — Revenue Decomposition (Section 3.1) |
| `ListingsTable` | Listing Comparison — Leaderboard Table, enhanced with new columns + action button (Section 3.2) |
| `CashflowSection` | Cashflow tab — Monthly Payout Bar Chart (Section 3.4) |
| `TrailingComparisons` | Portfolio Overview — Trailing Comparisons (Section 3.1) |
| `OccupancyDisplay` | Portfolio Overview — Occupancy Display (Section 3.1) |

---

## 6. Phase 2 (Future — Not Alpha)

The following are documented for future development. None of these ship in Alpha.

### Phase 2 Visualizations

| Visualization | Description | Planned Tab |
|---------------|-------------|-------------|
| Bubble Chart: ADR vs Nights | X=ADR, Y=Nights, bubble size=Revenue, color=Account | Listing Comparison |
| Seasonality Heatmap | Calendar grid (rows=Year, columns=Month, color=Revenue intensity) | Listing Detail |
| Revenue Volatility Index | 3-month rolling standard deviation line chart | Portfolio Overview |
| Revenue Change Attribution Waterfall | MoM waterfall: base + nights effect + ADR effect + adjustments = current | Portfolio Overview |
| Month-of-Year Average Chart | Jan–Dec average revenue with current year overlay | Portfolio Overview |
| Fee Ratio Chart | Stacked percentage bar: service fee %, cleaning %, net margin % | Data Quality |
| Calendar Heatmap | Booked nights by day (requires reservation start/end dates) | Listing Detail |

### Phase 2 Pages

| Page | Description |
|------|-------------|
| Accounts Dashboard | Account-level KPI table, account share trend (stacked area), payout lag analysis |
| Cancellations & Adjustments | Impact over time, "problem listings" table, adjustment explorer |
| Booking & Demand Analytics | Lead time distribution, length-of-stay histogram, booking cohort matrix (booking month x stay month) |
| Payout Reconciliation | Paid-out vs line-item totals per payout date with drill-down |

### Phase 2 Features

| Feature | Description |
|---------|-------------|
| Time basis toggle | Transaction month vs stay month (nightly allocation switch) |
| Download filtered CSV | Export from Transactions Explorer |
| Portfolio Diversification Index | Herfindahl index based on revenue share by listing |
| AI Insight Cards | Natural language insights (e.g., *"August revenue driven by nights, not ADR"*) |
| Reservation Rollup view | Group by confirmation code to avoid double-counting across payout events |

---

## 7. PROMPT.md Feedback Resolution

| User Feedback | How It's Addressed |
|---|---|
| Always see filter selection for accounts/listings | Multi-select dropdowns always visible on every tab — no scope dependency (Section 1.2) |
| Multi-select for accounts and listings | Multi-select dropdowns with "all selected" default, shown as chips (Section 1.2) |
| Projection for incomplete months | Projection toggle with dashed/lighter visual distinction (Section 1.2 + Section 4) |
| Think about all possible analytics | 7 Alpha tabs + comprehensive Phase 2 section (Sections 3 + 6) |
| Tabs dependent on data | Enable conditions per tab with greyed-out disabled reason (Section 2) |
| Keep totals/averages at top | KPI cards remain at top of Portfolio Overview (Section 3.1) |
| Keep warnings visible | WarningsPanel always visible on every tab + detailed in Data Quality (Sections 1.3 + 3.7) |
| Timeline graph per listing per month | Multi-Line Revenue Chart in Listing Comparison (Section 3.2) |
