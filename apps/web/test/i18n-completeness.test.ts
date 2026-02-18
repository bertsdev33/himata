import { describe, expect, test } from "bun:test";
import { locales, namespaces } from "@/i18n/config";
import { resources } from "@/i18n/resources";

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix].filter(Boolean);

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    if (typeof nested === "object" && nested !== null) {
      return flattenKeys(nested, nextPrefix);
    }
    return [nextPrefix];
  });
}

describe("translation completeness", () => {
  for (const namespace of namespaces) {
    const english = resources.en[namespace];
    const englishKeys = flattenKeys(english).sort();

    for (const locale of locales) {
      if (locale === "en") continue;
      test(`${locale}/${namespace} has all keys from en/${namespace}`, () => {
        const localized = resources[locale][namespace];
        const localizedKeys = flattenKeys(localized).sort();
        expect(localizedKeys).toEqual(englishKeys);
      });
    }
  }
});
