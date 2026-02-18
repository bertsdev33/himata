import { describe, expect, test } from "bun:test";
import {
  buildLocaleNavigationUrl,
  buildLocalePath,
  getLocaleAgnosticPath,
} from "@/i18n/routing";

describe("i18n routing helpers", () => {
  test("getLocaleAgnosticPath strips locale prefixes", () => {
    expect(getLocaleAgnosticPath("/")).toBe("/");
    expect(getLocaleAgnosticPath("/es")).toBe("/");
    expect(getLocaleAgnosticPath("/fr/reports")).toBe("/reports");
    expect(getLocaleAgnosticPath("/reports")).toBe("/reports");
  });

  test("buildLocalePath preserves non-locale path segments", () => {
    expect(buildLocalePath("/", "es")).toBe("/es");
    expect(buildLocalePath("/es", "en")).toBe("/");
    expect(buildLocalePath("/es/forecast", "fr")).toBe("/fr/forecast");
    expect(buildLocalePath("/dashboard", "zh")).toBe("/zh/dashboard");
    expect(buildLocalePath("/zh/transactions/123", "en")).toBe("/transactions/123");
  });

  test("buildLocaleNavigationUrl preserves search and hash", () => {
    expect(
      buildLocaleNavigationUrl(
        { pathname: "/es/forecast", search: "?range=3m&mode=all", hash: "#chart" },
        "fr",
      ),
    ).toBe("/fr/forecast?range=3m&mode=all#chart");
  });
});
