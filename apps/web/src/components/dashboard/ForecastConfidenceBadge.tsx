import { Badge } from "@/components/ui/badge";
import type { ConfidenceTier } from "@rental-analytics/forecasting";

const TIER_STYLES: Record<ConfidenceTier, string> = {
  high: "bg-green-100 text-green-800 border-green-200",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
  low: "bg-red-100 text-red-800 border-red-200",
};

const TIER_LABELS: Record<ConfidenceTier, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

interface ForecastConfidenceBadgeProps {
  tier: ConfidenceTier;
}

export function ForecastConfidenceBadge({ tier }: ForecastConfidenceBadgeProps) {
  return (
    <Badge variant="outline" className={TIER_STYLES[tier]}>
      {TIER_LABELS[tier]}
    </Badge>
  );
}
