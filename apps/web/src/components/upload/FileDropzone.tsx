import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocaleContext } from "@/i18n/LocaleProvider";

/** Maximum file size: 50 MB */
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  onError?: (message: string) => void;
}

export function FileDropzone({ onFilesSelected, onError }: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { locale } = useLocaleContext();
  const { t } = useTranslation("upload", { lng: locale });

  const filterValidFiles = useCallback((files: File[]): File[] => {
    const valid: File[] = [];
    const rejected: string[] = [];

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        rejected.push(t("errors.not_csv", { name: file.name }));
      } else if (file.size > MAX_FILE_SIZE_BYTES) {
        rejected.push(
          t("errors.too_large", {
            name: file.name,
            maxMb: 50,
            sizeMb: (file.size / 1024 / 1024).toFixed(1),
          }),
        );
      } else {
        valid.push(file);
      }
    }

    if (rejected.length > 0 && onError) {
      onError(t("errors.rejected_prefix", { files: rejected.join("; ") }));
    }

    return valid;
  }, [onError, t]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    const files = filterValidFiles(Array.from(event.dataTransfer.files));
    if (files.length > 0) onFilesSelected(files);
  }, [filterValidFiles, onFilesSelected]);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = filterValidFiles(Array.from(event.target.files ?? []));
    if (files.length > 0) onFilesSelected(files);
    event.target.value = "";
  }, [filterValidFiles, onFilesSelected]);

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-12
        transition-colors
        ${isDragOver
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
        }
      `}
    >
      <Upload className="h-10 w-10 text-muted-foreground" />
      <div className="text-center">
        <p className="text-lg font-medium">{t("dropzone.title")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("dropzone.hint", { maxMb: 50 })}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        multiple
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
