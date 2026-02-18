import { defaultLocale, locales, type Locale } from "./config";

export interface LocationLike {
  pathname: string;
  search?: string;
  hash?: string;
}

/** Remove any leading locale segment and return a stable app-relative path. */
export function getLocaleAgnosticPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const firstSegment = segments[0] as Locale | undefined;
  const baseSegments = firstSegment && locales.includes(firstSegment)
    ? segments.slice(1)
    : segments;
  return baseSegments.length > 0 ? `/${baseSegments.join("/")}` : "/";
}

/** Build a locale-prefixed path while preserving the non-locale part of the route. */
export function buildLocalePath(pathname: string, locale: Locale): string {
  const basePath = getLocaleAgnosticPath(pathname);
  if (locale === defaultLocale) return basePath;
  return basePath === "/" ? `/${locale}` : `/${locale}${basePath}`;
}

/** Build a full in-app URL (path + query + hash) for locale navigation. */
export function buildLocaleNavigationUrl(locationLike: LocationLike, locale: Locale): string {
  const path = buildLocalePath(locationLike.pathname, locale);
  return `${path}${locationLike.search ?? ""}${locationLike.hash ?? ""}`;
}
