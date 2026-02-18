import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { useLocaleContext } from "@/i18n/LocaleProvider";
import type { ConfidenceTier } from "@rental-analytics/forecasting";

const TIER_STYLES: Record<ConfidenceTier, string> = {
  high: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-red-100 text-red-800 border-red-200",
};

interface ForecastConfidenceBadgeProps {
  tier: ConfidenceTier;
}

export function ForecastConfidenceBadge({ tier }: ForecastConfidenceBadgeProps) {
  const { locale } = useLocaleContext();
  const { t } = useTranslation("forecast", { lng: locale });

  return (
    <Badge variant="outline" className={TIER_STYLES[tier]}>
      {t(`confidence.${tier}`)}
    </Badge>
  );
}
