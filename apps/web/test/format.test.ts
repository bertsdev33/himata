import { describe, expect, test } from "bun:test";
import type { Locale } from "@/i18n/config";
import { intlLocaleMap } from "@/i18n/config";
import {
  formatDeltaPercent,
  formatMoney,
  formatMoneyCompact,
  formatMonth,
  formatMonthShort,
  formatPercent,
} from "@/lib/format";

function localeTag(locale: Locale): string {
  return intlLocaleMap[locale];
}

describe("format helpers", () => {
  test("preserves existing defaults when locale is omitted", () => {
    expect(formatMoney(123456, "USD")).toBe("$1,234.56");
    expect(formatPercent(0.125)).toBe("12.5%");
    expect(formatDeltaPercent(0.125)).toBe("+12.5%");
    expect(formatMonth("2026-02")).toContain("2026");
    expect(formatMonthShort("2026-02")).toBe("Feb");
  });

  test("uses locale-aware formatting when locale is provided", () => {
    expect(formatMoney(123456, "USD", "fr")).toBe(
      new Intl.NumberFormat(localeTag("fr"), {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(1234.56),
    );

    expect(formatMoneyCompact(123456, "USD", "es")).toBe(
      new Intl.NumberFormat(localeTag("es"), {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(1234.56),
    );

    expect(formatPercent(0.125, "fr")).toBe(
      new Intl.NumberFormat(localeTag("fr"), {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(0.125),
    );
  });

  test("formats month labels using locale-specific month names", () => {
    const date = new Date(2026, 1);
    expect(formatMonth("2026-02", "fr")).toBe(
      date.toLocaleDateString(localeTag("fr"), { month: "short", year: "numeric" }),
    );
    expect(formatMonthShort("2026-02", "es")).toBe(
      date.toLocaleDateString(localeTag("es"), { month: "short" }),
    );
  });

  test("keeps explicit sign behavior for delta percentages", () => {
    expect(formatDeltaPercent(0, "en")).toBe("+0.0%");
    expect(formatDeltaPercent(-0.125, "en")).toBe("-12.5%");
    expect(formatDeltaPercent(null, "en")).toBe("N/A");
  });
});
