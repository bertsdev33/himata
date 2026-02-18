import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useAppContext } from "@/app/state";
import { computeAnalytics } from "@/app/compute-analytics";
import { prefillAccountId, detectDatasetKind } from "@/lib/file-helpers";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileDropzone } from "./FileDropzone";
import { FileEntryRow } from "./FileEntryRow";
import type { FileEntry } from "@/app/types";

let fileIdCounter = 0;

export function UploadPage() {
  const { state, dispatch } = useAppContext();

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      const entries: FileEntry[] = files.map((file) => ({
        id: String(++fileIdCounter),
        file,
        accountId: prefillAccountId(file.name),
        datasetKind: detectDatasetKind(file.name),
      }));
      dispatch({ type: "ADD_FILES", files: entries });
    },
    [dispatch]
  );

  const handleUpdate = useCallback(
    (id: string, updates: Partial<Pick<FileEntry, "accountId" | "datasetKind">>) => {
      dispatch({ type: "UPDATE_FILE", id, updates });
    },
    [dispatch]
  );

  const handleRemove = useCallback(
    (id: string) => {
      dispatch({ type: "REMOVE_FILE", id });
    },
    [dispatch]
  );

  const handleAnalyze = useCallback(async () => {
    dispatch({ type: "SET_PROCESSING", isProcessing: true });
    try {
      const analytics = await computeAnalytics(state.files, {
        // Always defer ML forecast compute to the dashboard refresh controller
        // so manual mode never auto-runs on initial load.
        computeMlForecasts: false,
      });
      dispatch({ type: "SET_ANALYTICS", analytics });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        error: err instanceof Error ? err.message : "An unexpected error occurred",
      });
    }
  }, [state.files, dispatch]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold tracking-tight">Rental Analytics</h1>
        <p className="text-muted-foreground mt-3 text-lg">
          Upload your Airbnb CSV exports to analyze rental performance
        </p>
      </div>

      <FileDropzone
        onFilesSelected={handleFilesSelected}
        onError={(msg) => dispatch({ type: "SET_ERROR", error: msg })}
      />

      {state.files.length > 0 && (
        <div className="mt-6 space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Files ({state.files.length})
          </h2>
          {state.files.map((entry) => (
            <FileEntryRow
              key={entry.id}
              id={entry.id}
              fileName={entry.file.name}
              accountId={entry.accountId}
              datasetKind={entry.datasetKind}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {state.error && (
        <Alert variant="destructive" className="mt-6">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state.files.length > 0 && (
        <div className="mt-8 flex justify-center">
          <Button
            size="lg"
            onClick={handleAnalyze}
            disabled={state.isProcessing || state.files.length === 0}
          >
            {state.isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              "Analyze"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
