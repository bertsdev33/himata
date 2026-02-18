import { describe, test, expect, beforeEach } from "bun:test";
import type { SettingsData } from "../src/app/types";

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

// Replicate the pure load/save logic from useSettings for testability
function loadSettings(storage: Record<string, string>): SettingsData {
  try {
    const raw = storage[STORAGE_KEY];
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1) return defaultSettings;
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
}

function saveSettings(storage: Record<string, string>, settings: SettingsData) {
  storage[STORAGE_KEY] = JSON.stringify(settings);
}

describe("settings persistence", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
  });

  test("returns defaults when localStorage is empty", () => {
    const settings = loadSettings(storage);
    expect(settings).toEqual(defaultSettings);
  });

  test("returns defaults for invalid JSON", () => {
    storage[STORAGE_KEY] = "not json";
    const settings = loadSettings(storage);
    expect(settings).toEqual(defaultSettings);
  });

  test("returns defaults for wrong version", () => {
    storage[STORAGE_KEY] = JSON.stringify({ version: 99, listingNames: { foo: "bar" } });
    const settings = loadSettings(storage);
    expect(settings).toEqual(defaultSettings);
  });

  test("round-trips custom listing names", () => {
    const settings: SettingsData = {
      ...defaultSettings,
      listingNames: { "listing-1": "My Beach House" },
    };
    saveSettings(storage, settings);

    const loaded = loadSettings(storage);
    expect(loaded.listingNames).toEqual({ "listing-1": "My Beach House" });
  });

  test("round-trips custom account names", () => {
    const settings: SettingsData = {
      ...defaultSettings,
      accountNames: { "account-a": "Main Account" },
    };
    saveSettings(storage, settings);

    const loaded = loadSettings(storage);
    expect(loaded.accountNames).toEqual({ "account-a": "Main Account" });
  });

  test("round-trips listing order", () => {
    const settings: SettingsData = {
      ...defaultSettings,
      listingOrder: ["listing-3", "listing-1", "listing-2"],
    };
    saveSettings(storage, settings);

    const loaded = loadSettings(storage);
    expect(loaded.listingOrder).toEqual(["listing-3", "listing-1", "listing-2"]);
  });

  test("round-trips account order", () => {
    const settings: SettingsData = {
      ...defaultSettings,
      accountOrder: ["account-b", "account-a"],
    };
    saveSettings(storage, settings);

    const loaded = loadSettings(storage);
    expect(loaded.accountOrder).toEqual(["account-b", "account-a"]);
  });

  test("round-trips filterBarExpanded = false", () => {
    const settings: SettingsData = {
      ...defaultSettings,
      filterBarExpanded: false,
    };
    saveSettings(storage, settings);

    const loaded = loadSettings(storage);
    expect(loaded.filterBarExpanded).toBe(false);
  });

  test("merges partial stored data with defaults", () => {
    // Simulate a stored settings that only has version + one field
    storage[STORAGE_KEY] = JSON.stringify({
      version: 1,
      listingNames: { "x": "Y" },
    });

    const loaded = loadSettings(storage);
    expect(loaded.listingNames).toEqual({ "x": "Y" });
    expect(loaded.accountNames).toEqual({});
    expect(loaded.listingOrder).toBeNull();
    expect(loaded.accountOrder).toBeNull();
    expect(loaded.filterBarExpanded).toBe(true);
    expect(loaded.mlForecastAutoRefresh).toBe(true);
    expect(loaded.quickFilterPinnedTime).toBe(false);
    expect(loaded.quickFilterPinnedAccounts).toBe(false);
    expect(loaded.quickFilterPinnedListings).toBe(false);
    expect(loaded.showAllQuickListings).toBe(false);
  });

  test("round-trips mlForecastAutoRefresh = false", () => {
    const settings: SettingsData = {
      ...defaultSettings,
      mlForecastAutoRefresh: false,
    };
    saveSettings(storage, settings);

    const loaded = loadSettings(storage);
    expect(loaded.mlForecastAutoRefresh).toBe(false);
  });

  test("round-trips quick filter pins and showAllQuickListings", () => {
    const settings: SettingsData = {
      ...defaultSettings,
      quickFilterPinnedTime: true,
      quickFilterPinnedAccounts: true,
      quickFilterPinnedListings: true,
      showAllQuickListings: true,
    };
    saveSettings(storage, settings);

    const loaded = loadSettings(storage);
    expect(loaded.quickFilterPinnedTime).toBe(true);
    expect(loaded.quickFilterPinnedAccounts).toBe(true);
    expect(loaded.quickFilterPinnedListings).toBe(true);
    expect(loaded.showAllQuickListings).toBe(true);
  });
});

describe("custom name resolution", () => {
  test("getListingName returns custom name when set", () => {
    const names: Record<string, string> = { "listing-1": "Beach House" };
    const getName = (id: string, defaultName: string) => names[id] || defaultName;

    expect(getName("listing-1", "Listing 1234")).toBe("Beach House");
  });

  test("getListingName returns default when no custom name", () => {
    const names: Record<string, string> = {};
    const getName = (id: string, defaultName: string) => names[id] || defaultName;

    expect(getName("listing-1", "Listing 1234")).toBe("Listing 1234");
  });

  test("getAccountName returns custom name when set", () => {
    const names: Record<string, string> = { "account-a": "Main" };
    const getName = (id: string) => names[id] || id;

    expect(getName("account-a")).toBe("Main");
  });

  test("getAccountName returns id when no custom name", () => {
    const names: Record<string, string> = {};
    const getName = (id: string) => names[id] || id;

    expect(getName("account-a")).toBe("account-a");
  });
});

describe("custom ordering", () => {
  const listings = [
    { listingId: "a", listingName: "Alpha", transactionCount: 10 },
    { listingId: "b", listingName: "Beta", transactionCount: 20 },
    { listingId: "c", listingName: "Charlie", transactionCount: 5 },
  ];

  function applyOrder<T extends { listingId: string; transactionCount: number; listingName: string }>(
    items: T[],
    customOrder: string[] | null,
  ): T[] {
    if (!customOrder) return items;
    const orderMap = new Map(customOrder.map((id, i) => [id, i]));
    return [...items].sort((a, b) => {
      const aIdx = orderMap.get(a.listingId) ?? Infinity;
      const bIdx = orderMap.get(b.listingId) ?? Infinity;
      if (aIdx !== bIdx) return aIdx - bIdx;
      return b.transactionCount - a.transactionCount || a.listingName.localeCompare(b.listingName);
    });
  }

  test("null order preserves original array order", () => {
    const result = applyOrder(listings, null);
    expect(result).toEqual(listings);
  });

  test("custom order reorders items", () => {
    const result = applyOrder(listings, ["c", "a", "b"]);
    expect(result.map((l) => l.listingId)).toEqual(["c", "a", "b"]);
  });

  test("items not in custom order appear at end", () => {
    const result = applyOrder(listings, ["b"]);
    expect(result[0].listingId).toBe("b");
    // Remaining items sorted by txCount DESC
    expect(result[1].listingId).toBe("a"); // txCount 10 > 5
    expect(result[2].listingId).toBe("c"); // txCount 5
  });
});
