import { useState } from "react";
import { Sparkles, Loader2, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildSummary } from "@/lib/buildSummary";
import { sha256 } from "@/lib/hash";
import type { AnalyticsData } from "@/app/types";

interface InsightsResult {
  narrative: string;
  actions: string[];
  cached: boolean;
}

interface InsightsPanelProps {
  analytics: AnalyticsData;
}

export function InsightsPanel({ analytics }: InsightsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InsightsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const summary = buildSummary(analytics);
      const datasetHash = await sha256(
        JSON.stringify(analytics.transactions.map((t) => t.transactionId).sort()) +
          JSON.stringify(summary.dateRange),
      );

      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetHash, summary }),
      });

      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = (await res.json()) as InsightsResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Insights
        </CardTitle>
        {result?.cached && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle className="h-3 w-3" />
            cached
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!result && (
          <p className="text-sm text-muted-foreground">
            Generate a narrative summary and actionable recommendations based on your portfolio
            metrics.
          </p>
        )}

        <Button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          size="sm"
          variant={result ? "outline" : "default"}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Generating…
            </>
          ) : result ? (
            "Regenerate"
          ) : (
            "Generate Insights"
          )}
        </Button>

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {result && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed">{result.narrative}</p>
            {result.actions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Recommended Actions
                </p>
                <ul className="space-y-1.5">
                  {result.actions.map((action, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {i + 1}
                      </span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
