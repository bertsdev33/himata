export interface QuickFilterRowVisibilityInput {
  isExpanded: boolean;
  hasAccountQuickFilters: boolean;
  hasListingQuickFilters: boolean;
  pinnedTime: boolean;
  pinnedAccounts: boolean;
  pinnedListings: boolean;
}

export interface QuickFilterRowVisibility {
  showTimeQuickRow: boolean;
  showAccountQuickRow: boolean;
  showListingQuickRow: boolean;
  showAnyQuickRows: boolean;
}

export function deriveQuickFilterRowVisibility(
  input: QuickFilterRowVisibilityInput,
): QuickFilterRowVisibility {
  const showTimeQuickRow = input.isExpanded || input.pinnedTime;
  const showAccountQuickRow =
    input.hasAccountQuickFilters && (input.isExpanded || input.pinnedAccounts);
  const showListingQuickRow =
    input.hasListingQuickFilters && (input.isExpanded || input.pinnedListings);

  return {
    showTimeQuickRow,
    showAccountQuickRow,
    showListingQuickRow,
    showAnyQuickRows: showTimeQuickRow || showAccountQuickRow || showListingQuickRow,
  };
}

export interface FocusTrapInput {
  currentIndex: number;
  total: number;
  shiftKey: boolean;
}

export function shouldCycleFocus({ currentIndex, total, shiftKey }: FocusTrapInput): boolean {
  if (total <= 0) return false;
  if (currentIndex < 0) return true;
  if (shiftKey) return currentIndex === 0;
  return currentIndex === total - 1;
}

export function getNextCycledFocusIndex({
  currentIndex,
  total,
  shiftKey,
}: FocusTrapInput): number {
  if (total <= 0) return -1;
  if (currentIndex < 0) return shiftKey ? total - 1 : 0;
  if (shiftKey) return currentIndex === 0 ? total - 1 : currentIndex - 1;
  return currentIndex === total - 1 ? 0 : currentIndex + 1;
}
