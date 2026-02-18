import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatPercent, formatMonth } from "@/lib/format";
import { useLocaleContext } from "@/i18n/LocaleProvider";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import type { EstimatedOccupancy, YearMonth } from "@rental-analytics/core";

interface OccupancyDisplayProps {
  data: EstimatedOccupancy[];
}

export function OccupancyDisplay({ data }: OccupancyDisplayProps) {
  const { locale } = useLocaleContext();
  const { t } = useTranslation("dashboard", { lng: locale });
  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("occupancy_display.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {data[0].label}: {data[0].disclaimer}
          </AlertDescription>
        </Alert>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {data.map((d) => (
            <div key={d.month} className="rounded-md border p-3 text-center">
              <p className="text-xs text-muted-foreground">
                {formatMonth(d.month as YearMonth, locale)}
              </p>
              <p className="text-xl font-bold mt-1">
                {formatPercent(d.estimatedOccupancyRate, locale)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("occupancy_display.breakdown", {
                  nights: d.bookedNights,
                  listings: d.listingsInService,
                })}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
