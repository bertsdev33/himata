import { useState, useCallback } from "react";
import type { SettingsData } from "@/app/types";

const STORAGE_KEY = "rental-analytics-settings";

const defaultSettings: SettingsData = {
  version: 1,
  listingNames: {},
  accountNames: {},
  listingOrder: null,
  accountOrder: null,
  filterBarExpanded: true,
  mlForecastAutoRefresh: true,
  quickFilterPinnedTime: false,
  quickFilterPinnedAccounts: false,
  quickFilterPinnedListings: false,
  showAllQuickListings: false,
};

function loadSettings(): SettingsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1) return defaultSettings;
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
}

function saveSettings(settings: SettingsData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function useSettings() {
  const [settings, setSettingsState] = useState<SettingsData>(loadSettings);

  const update = useCallback((patch: Partial<SettingsData>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const getListingName = useCallback(
    (listingId: string, defaultName: string) =>
      settings.listingNames[listingId] || defaultName,
    [settings.listingNames],
  );

  const getAccountName = useCallback(
    (accountId: string) => settings.accountNames[accountId] || accountId,
    [settings.accountNames],
  );

  const setListingName = useCallback(
    (listingId: string, name: string) => {
      if (name) {
        update({ listingNames: { ...settings.listingNames, [listingId]: name } });
      } else {
        const copy = { ...settings.listingNames };
        delete copy[listingId];
        update({ listingNames: copy });
      }
    },
    [settings.listingNames, update],
  );

  const setAccountName = useCallback(
    (accountId: string, name: string) => {
      if (name) {
        update({ accountNames: { ...settings.accountNames, [accountId]: name } });
      } else {
        const copy = { ...settings.accountNames };
        delete copy[accountId];
        update({ accountNames: copy });
      }
    },
    [settings.accountNames, update],
  );

  const setListingOrder = useCallback(
    (order: string[] | null) => update({ listingOrder: order }),
    [update],
  );

  const setAccountOrder = useCallback(
    (order: string[] | null) => update({ accountOrder: order }),
    [update],
  );

  const setFilterBarExpanded = useCallback(
    (expanded: boolean) => update({ filterBarExpanded: expanded }),
    [update],
  );

  const setMlForecastAutoRefresh = useCallback(
    (enabled: boolean) => update({ mlForecastAutoRefresh: enabled }),
    [update],
  );

  const setQuickFilterPinnedTime = useCallback(
    (pinned: boolean) => update({ quickFilterPinnedTime: pinned }),
    [update],
  );

  const setQuickFilterPinnedAccounts = useCallback(
    (pinned: boolean) => update({ quickFilterPinnedAccounts: pinned }),
    [update],
  );

  const setQuickFilterPinnedListings = useCallback(
    (pinned: boolean) => update({ quickFilterPinnedListings: pinned }),
    [update],
  );

  const setShowAllQuickListings = useCallback(
    (show: boolean) => update({ showAllQuickListings: show }),
    [update],
  );

  const resetAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSettingsState(defaultSettings);
  }, []);

  return {
    settings,
    update,
    getListingName,
    getAccountName,
    setListingName,
    setAccountName,
    setListingOrder,
    setAccountOrder,
    setFilterBarExpanded,
    setMlForecastAutoRefresh,
    setQuickFilterPinnedTime,
    setQuickFilterPinnedAccounts,
    setQuickFilterPinnedListings,
    setShowAllQuickListings,
    resetAll,
  };
}

export type UseSettingsReturn = ReturnType<typeof useSettings>;
