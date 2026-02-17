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
import { BrainCircuit, ChevronDown, ChevronRight } from "lucide-react";
import type { ForecastResult } from "@rental-analytics/forecasting";
import type { YearMonth } from "@rental-analytics/core";

interface MLForecastSectionProps {
  forecast: ForecastResult;
}

export function MLForecastSection({ forecast }: MLForecastSectionProps) {
  const { settings } = useSettingsContext();
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

  return (
    <div className="space-y-4">
      <Alert className="border-purple-200 bg-purple-50">
        <BrainCircuit className="h-4 w-4 text-purple-600" />
        <AlertDescription className="text-purple-800">
          Revenue predictions trained on your historical data using Ridge Regression.
          Confidence reflects months of training data available.
        </AlertDescription>
      </Alert>

      {/* Portfolio Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            ML Forecast — {formatMonth(portfolioMonth as YearMonth)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Predicted Gross Revenue</p>
              <p className="text-2xl font-bold">
                {formatMoney(portfolio.forecastGrossRevenueMinor, currency)}
              </p>
              {hasMultipleTargetMonths && (
                <p className="text-xs text-muted-foreground mt-1">
                  Total for {portfolio.listingForecasts.length} of {listings.length} listings targeting {formatMonth(portfolioMonth as YearMonth)}
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Confidence Range</p>
              <p className="text-lg font-medium">
                {formatMoney(portfolio.lowerBandMinor, currency)} –{" "}
                {formatMoney(portfolio.upperBandMinor, currency)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Listings Forecast</p>
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
            <CardTitle className="text-base">Per-Listing Forecasts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Listing</TableHead>
                  <TableHead className="text-right">Predicted Revenue</TableHead>
                  <TableHead className="text-right">Range</TableHead>
                  {hasMultipleTargetMonths && (
                    <TableHead>Target</TableHead>
                  )}
                  <TableHead className="text-center">Confidence</TableHead>
                  <TableHead className="text-right">Months</TableHead>
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
                        {formatMoney(listing.forecastGrossRevenueMinor, listing.currency)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatMoney(listing.lowerBandMinor, listing.currency)} –{" "}
                        {formatMoney(listing.upperBandMinor, listing.currency)}
                      </TableCell>
                      {hasMultipleTargetMonths && (
                        <TableCell className="text-sm">
                          {formatMonth(listing.targetMonth as YearMonth)}
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
            onClick={() => setShowExcluded(!showExcluded)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showExcluded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            {excluded.length} listing{excluded.length > 1 ? "s" : ""} excluded from forecast
          </button>
          {showExcluded && (
            <div className="mt-2 rounded-lg border p-3 text-sm">
              <ul className="space-y-1">
                {excluded.map((e) => (
                  <li key={e.listingId} className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {getDisplayName(e.listingId, e.listingName)}
                    </span>{" "}
                    — {e.reason}
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
