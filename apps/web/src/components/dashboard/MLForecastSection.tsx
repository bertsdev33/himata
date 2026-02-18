import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ForecastConfidenceBadge } from "./ForecastConfidenceBadge";
import { formatMoney, formatMonth } from "@/lib/format";
import { useSettingsContext } from "@/app/settings-context";
import { useLocaleContext } from "@/i18n/LocaleProvider";
import { useTranslation } from "react-i18next";
import { BrainCircuit, ChevronDown, ChevronRight } from "lucide-react";
import type { ForecastResult } from "@rental-analytics/forecasting";
import type { YearMonth } from "@rental-analytics/core";

interface MLForecastSectionProps {
  forecast: ForecastResult;
}

export function MLForecastSection({ forecast }: MLForecastSectionProps) {
  const { settings } = useSettingsContext();
  const { locale } = useLocaleContext();
  const { t } = useTranslation("forecast", { lng: locale });
  const [showExcluded, setShowExcluded] = useState(false);
  const { portfolio, listings, excluded } = forecast;

  // Use currency from the portfolio (already scoped to a single currency)
  const currency = portfolio.currency;
  const portfolioMonth = portfolio.targetMonth;

  // Check if any listings target a different month than the portfolio
  const hasMultipleTargetMonths = listings.some((l) => l.targetMonth !== portfolioMonth);

  const getDisplayName = (listingId: string, defaultName: string): string => {
    return settings.listingNames[listingId] || defaultName;
  };

  const getExcludedReason = (reason: {
    reasonCode?: string;
    reasonParams?: Record<string, string | number>;
    reason?: string;
  }) =>
    reason.reasonCode
      ? t(`ml.excluded.reasons.${reason.reasonCode}`, {
          ...(reason.reasonParams ?? {}),
          defaultValue: reason.reason ?? reason.reasonCode,
        })
      : (reason.reason ?? "");

  return (
    <div className="space-y-4">
      <Alert className="border-purple-200 bg-purple-50">
        <BrainCircuit className="h-4 w-4 text-purple-600" />
        <AlertDescription className="text-purple-800">
          {t("ml.alert.description")}
        </AlertDescription>
      </Alert>

      {/* Portfolio Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t("ml.summary.title", {
              month: formatMonth(portfolioMonth as YearMonth, locale),
            })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{t("ml.summary.predicted_gross_revenue")}</p>
              <p className="text-2xl font-bold">
                {formatMoney(portfolio.forecastGrossRevenueMinor, currency, locale)}
              </p>
              {hasMultipleTargetMonths && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t("ml.summary.total_for_subset", {
                    included: portfolio.listingForecasts.length,
                    total: listings.length,
                    month: formatMonth(portfolioMonth as YearMonth, locale),
                  })}
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("ml.summary.confidence_range")}</p>
              <p className="text-lg font-medium">
                {formatMoney(portfolio.lowerBandMinor, currency, locale)} –{" "}
                {formatMoney(portfolio.upperBandMinor, currency, locale)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("ml.summary.listings_forecast")}</p>
              <p className="text-lg font-medium">
                {listings.length} of {listings.length + excluded.length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Listing Table */}
      {listings.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("ml.table.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("ml.table.columns.listing")}</TableHead>
                  <TableHead className="text-right">{t("ml.table.columns.predicted_revenue")}</TableHead>
                  <TableHead className="text-right">{t("ml.table.columns.range")}</TableHead>
                  {hasMultipleTargetMonths && (
                    <TableHead>{t("ml.table.columns.target")}</TableHead>
                  )}
                  <TableHead className="text-center">{t("ml.table.columns.confidence")}</TableHead>
                  <TableHead className="text-right">{t("ml.table.columns.months")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...listings]
                  .sort((a, b) => b.forecastGrossRevenueMinor - a.forecastGrossRevenueMinor)
                  .map((listing) => (
                    <TableRow key={listing.listingId}>
                      <TableCell className="font-medium">
                        {getDisplayName(listing.listingId, listing.listingName)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(listing.forecastGrossRevenueMinor, listing.currency, locale)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatMoney(listing.lowerBandMinor, listing.currency, locale)} –{" "}
                        {formatMoney(listing.upperBandMinor, listing.currency, locale)}
                      </TableCell>
                      {hasMultipleTargetMonths && (
                        <TableCell className="text-sm">
                          {formatMonth(listing.targetMonth as YearMonth, locale)}
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                        <ForecastConfidenceBadge tier={listing.confidence} />
                      </TableCell>
                      <TableCell className="text-right">{listing.trainingMonths}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Excluded Listings */}
      {excluded.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowExcluded(!showExcluded)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showExcluded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            {t("ml.excluded.toggle", { count: excluded.length })}
          </button>
          {showExcluded && (
            <div className="mt-2 rounded-lg border p-3 text-sm">
              <ul className="space-y-1">
                {excluded.map((e) => (
                  <li key={e.listingId} className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {getDisplayName(e.listingId, e.listingName)}
                    </span>{" "}
                    — {getExcludedReason(e)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
