import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "@/app/state";
import { computeAnalytics } from "@/app/compute-analytics";
import { prefillAccountId, detectDatasetKind } from "@/lib/file-helpers";
import { useLocaleContext } from "@/i18n/LocaleProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileDropzone } from "./FileDropzone";
import { FileEntryRow } from "./FileEntryRow";
import type { FileEntry } from "@/app/types";

let fileIdCounter = 0;

export function UploadPage() {
  const { state, dispatch } = useAppContext();
  const { locale } = useLocaleContext();
  const { t } = useTranslation(["common", "upload"], { lng: locale });

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
        error: err instanceof Error ? err.message : t("errors.unexpected", { ns: "common" }),
      });
    }
  }, [state.files, dispatch, t]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-10">
        <div className="mb-4 flex justify-end">
          <LocaleSwitcher />
        </div>
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">{t("app.title", { ns: "common" })}</h1>
          <p className="text-muted-foreground mt-3 text-lg">
            {t("subtitle", { ns: "upload" })}
          </p>
        </div>
      </div>

      <FileDropzone
        onFilesSelected={handleFilesSelected}
        onError={(msg) => dispatch({ type: "SET_ERROR", error: msg })}
      />

      {state.files.length > 0 && (
        <div className="mt-6 space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            {t("files_count", { ns: "upload", count: state.files.length })}
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
                {t("actions.analyzing", { ns: "upload" })}
              </>
            ) : (
              t("actions.analyze", { ns: "upload" })
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
