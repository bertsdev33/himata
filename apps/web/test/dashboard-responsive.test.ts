import { describe, expect, test } from "bun:test";
import {
  deriveQuickFilterRowVisibility,
  getNextCycledFocusIndex,
  shouldCycleFocus,
} from "../src/lib/dashboard-responsive";

describe("dashboard responsive helpers", () => {
  test("keeps quick rows collapsed when not expanded and nothing is pinned", () => {
    const visibility = deriveQuickFilterRowVisibility({
      isExpanded: false,
      hasAccountQuickFilters: true,
      hasListingQuickFilters: true,
      pinnedTime: false,
      pinnedAccounts: false,
      pinnedListings: false,
    });

    expect(visibility).toEqual({
      showTimeQuickRow: false,
      showAccountQuickRow: false,
      showListingQuickRow: false,
      showAnyQuickRows: false,
    });
  });

  test("keeps only pinned rows visible while collapsed", () => {
    const visibility = deriveQuickFilterRowVisibility({
      isExpanded: false,
      hasAccountQuickFilters: true,
      hasListingQuickFilters: false,
      pinnedTime: true,
      pinnedAccounts: true,
      pinnedListings: true,
    });

    expect(visibility).toEqual({
      showTimeQuickRow: true,
      showAccountQuickRow: true,
      showListingQuickRow: false,
      showAnyQuickRows: true,
    });
  });

  test("shows all eligible quick rows when expanded", () => {
    const visibility = deriveQuickFilterRowVisibility({
      isExpanded: true,
      hasAccountQuickFilters: true,
      hasListingQuickFilters: true,
      pinnedTime: false,
      pinnedAccounts: false,
      pinnedListings: false,
    });

    expect(visibility.showTimeQuickRow).toBe(true);
    expect(visibility.showAccountQuickRow).toBe(true);
    expect(visibility.showListingQuickRow).toBe(true);
    expect(visibility.showAnyQuickRows).toBe(true);
  });

  test("focus trap cycles from end to start on forward tab", () => {
    expect(
      shouldCycleFocus({
        currentIndex: 2,
        total: 3,
        shiftKey: false,
      }),
    ).toBe(true);

    expect(
      getNextCycledFocusIndex({
        currentIndex: 2,
        total: 3,
        shiftKey: false,
      }),
    ).toBe(0);
  });

  test("focus trap cycles from start to end on reverse tab", () => {
    expect(
      shouldCycleFocus({
        currentIndex: 0,
        total: 4,
        shiftKey: true,
      }),
    ).toBe(true);

    expect(
      getNextCycledFocusIndex({
        currentIndex: 0,
        total: 4,
        shiftKey: true,
      }),
    ).toBe(3);
  });

  test("focus trap enters correctly when active element is outside drawer", () => {
    expect(
      shouldCycleFocus({
        currentIndex: -1,
        total: 2,
        shiftKey: false,
      }),
    ).toBe(true);

    expect(
      getNextCycledFocusIndex({
        currentIndex: -1,
        total: 2,
        shiftKey: false,
      }),
    ).toBe(0);
  });
});
