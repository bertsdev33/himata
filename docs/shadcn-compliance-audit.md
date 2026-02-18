# Shadcn Compliance Audit

Date: 2026-02-17
Scope: `apps/web/src/components`

## Summary
This document tracks UI components that are not yet aligned with the shadcn/Radix requirement and should be migrated in a future pass.

## Priority 1 (Core UI Primitives)

1. Custom Tabs primitive
- File: `apps/web/src/components/ui/tabs.tsx:1`
- Issue: Custom context-based tabs implementation instead of Radix Tabs/shadcn Tabs.
- Impact: Used in core dashboard navigation and filter-mode switching.

2. Custom Select primitive
- File: `apps/web/src/components/ui/select.tsx:1`
- Issue: Native `<select>` wrapper instead of shadcn/Radix Select.
- Impact: Used in upload mapping and dashboard filters.

3. Custom MultiSelect primitive
- File: `apps/web/src/components/ui/multi-select.tsx:19`
- Issue: Fully custom dropdown behavior (manual open/close, outside click handler, absolute panel) instead of a shadcn-compatible composition.
- Impact: Used in account/listing filters; likely source of positioning and interaction inconsistencies.

## Priority 2 (Primitive Consistency)

4. Custom Separator primitive
- File: `apps/web/src/components/ui/separator.tsx:9`
- Issue: Custom separator element instead of Radix Separator/shadcn Separator.
- Impact: Low functional risk, but reduces consistency with the component system.

## Priority 3 (Tooltip Patterns)

5. Native browser title tooltips
- File: `apps/web/src/components/dashboard/tabs/SettingsTab.tsx:55`
- File: `apps/web/src/components/dashboard/tabs/SettingsTab.tsx:73`
- Issue: Uses `title` attribute instead of shadcn/Radix tooltip patterns.
- Impact: Inconsistent styling/behavior versus the rest of the UI.

6. Recharts chart tooltips (library-native)
- File: `apps/web/src/components/dashboard/RevenueTrendChart.tsx:92`
- File: `apps/web/src/components/dashboard/RevenueBreakdownChart.tsx:94`
- File: `apps/web/src/components/dashboard/NightsVsAdrChart.tsx:79`
- File: `apps/web/src/components/dashboard/MultiLineRevenueChart.tsx:125`
- File: `apps/web/src/components/dashboard/CashflowSection.tsx:71`
- File: `apps/web/src/components/dashboard/tabs/ForecastTab.tsx:196`
- Issue: Uses Recharts built-in tooltip layer, not shadcn tooltip.
- Note: This is often acceptable for chart interactions; a custom tooltip renderer can still be styled to align visually.

## Recommended Migration Order

1. Replace `ui/tabs.tsx` with shadcn/Radix Tabs.
2. Replace `ui/select.tsx` with shadcn/Radix Select.
3. Rework `ui/multi-select.tsx` on top of Radix primitives (e.g., Popover/Command or DropdownMenu pattern).
4. Swap `ui/separator.tsx` to Radix Separator.
5. Remove remaining native `title` tooltips in Settings.
6. Optionally standardize chart tooltip visuals for parity.
