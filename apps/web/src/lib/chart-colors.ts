/** Recharts color constants matching CSS variables in globals.css */
export const CHART_COLORS = {
  gross: "hsl(217, 91%, 60%)",       // Blue
  net: "hsl(142, 71%, 45%)",         // Green
  reservation: "hsl(217, 91%, 60%)", // Blue
  adjustment: "hsl(38, 92%, 50%)",   // Amber
  resolution: "hsl(280, 65%, 60%)",  // Purple
  cancellation: "hsl(0, 84%, 60%)",  // Red
  payout: "hsl(142, 71%, 45%)",      // Green
} as const;

export const CHART_COLORS_ARRAY = [
  CHART_COLORS.reservation,
  CHART_COLORS.adjustment,
  CHART_COLORS.resolution,
  CHART_COLORS.cancellation,
];
