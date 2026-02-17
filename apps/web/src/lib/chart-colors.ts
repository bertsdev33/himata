/** Recharts color constants matching CSS variables in globals.css */
export const CHART_COLORS = {
  gross: "hsl(217, 91%, 60%)",       // Blue
  net: "hsl(142, 71%, 45%)",         // Green
  reservation: "hsl(217, 91%, 60%)", // Blue
  adjustment: "hsl(38, 92%, 50%)",   // Amber
  resolution: "hsl(280, 65%, 60%)",  // Purple
  cancellation: "hsl(0, 84%, 60%)",  // Red
  payout: "hsl(142, 71%, 45%)",      // Green
  trailingAvg: "hsl(220, 14%, 50%)", // Gray
  forecast: "hsl(45, 93%, 47%)",         // Gold
  mlForecast: "hsl(280, 65%, 60%)",      // Purple
  mlConfidenceBand: "hsl(280, 65%, 85%)", // Light purple
} as const;

export const CHART_COLORS_ARRAY = [
  CHART_COLORS.reservation,
  CHART_COLORS.adjustment,
  CHART_COLORS.resolution,
  CHART_COLORS.cancellation,
];

/** Extended palette for multi-line charts (12 distinct colors) */
export const MULTI_LINE_COLORS = [
  "hsl(217, 91%, 60%)",  // Blue
  "hsl(142, 71%, 45%)",  // Green
  "hsl(38, 92%, 50%)",   // Amber
  "hsl(280, 65%, 60%)",  // Purple
  "hsl(0, 84%, 60%)",    // Red
  "hsl(180, 65%, 45%)",  // Teal
  "hsl(325, 70%, 55%)",  // Pink
  "hsl(60, 70%, 45%)",   // Yellow-green
  "hsl(200, 80%, 50%)",  // Sky blue
  "hsl(15, 80%, 55%)",   // Orange
  "hsl(260, 55%, 55%)",  // Indigo
  "hsl(160, 60%, 40%)",  // Emerald
] as const;
