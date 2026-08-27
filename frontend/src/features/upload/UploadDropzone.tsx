import { useCallback, useState } from "react";
import { cn } from "../../components/cn.js";

// Phase 2K QA pass — this file was never touched across 2A–2J (it's only shown in
// the empty-workspace state, so no earlier phase's own scope reached it) and still
// carried its original gray-*/orange-*/red-* classes. Restyled onto tokens; the
// `<input type="file">` element e2e/golden-path.spec.ts locates via
// `input[type="file"]` is unchanged.

interface UploadDropzoneProps {
  onFile: (file: File) => void;
  uploading?: boolean;
  /** Surfaced by the parent after a failed upload (e.g. server-side rejection). */
  error?: string | null;
}

// Mirrors backend/src/modules/assets/assets.routes.ts's ALLOWED_MIME/MAX_SIZE_BYTES.
// This is a UX-layer fast-fail only — the server re-validates type (by magic bytes,
// not just the claimed mimetype) and size regardless, per Rule 6/F18.
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_SIZE_BYTES = 15 * 1024 * 1024;

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Unsupported file type. Use PNG, JPEG or WebP.";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max is 15MB.`;
  }
  return null;
}

export default function UploadDropzone({ onFile, uploading, error }: UploadDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function pick(file: File) {
    const invalid = validateFile(file);
    setLocalError(invalid);
    if (!invalid) onFile(file);
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) pick(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onFile]
  );

  const shownError = localError ?? error;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "flex h-full min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed text-center transition-colors duration-fast",
        dragOver ? "border-selection bg-selection-subtle" : "border-border bg-surface-sunken"
      )}
    >
      {uploading ? (
        <p className="text-sm text-text-muted">Uploading…</p>
      ) : (
        <>
          <p className="text-sm text-text-secondary">Drag and drop a wireframe sketch, or</p>
          <label className="mt-xs cursor-pointer rounded-sm bg-primary px-lg py-sm text-sm font-medium text-text-inverse transition-colors duration-fast hover:bg-primary-hover">
            Choose file
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) pick(file);
                // Reset so re-selecting the same (e.g. previously-rejected) file
                // still fires onChange.
                e.target.value = "";
              }}
            />
          </label>
          <p className="mt-xs text-xs text-text-muted">PNG, JPEG or WebP, up to 15MB</p>
        </>
      )}
      {shownError && !uploading && (
        <p className="mt-sm max-w-xs text-xs text-error">{shownError}</p>
      )}
    </div>
  );
}
