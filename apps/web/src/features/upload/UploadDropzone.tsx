import { useCallback, useState } from "react";

interface UploadDropzoneProps {
  onFile: (file: File) => void;
  uploading?: boolean;
}

export default function UploadDropzone({ onFile, uploading }: UploadDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex h-full min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed text-center transition-colors ${
        dragOver ? "border-orange-400 bg-orange-50" : "border-gray-300 bg-gray-50"
      }`}
    >
      {uploading ? (
        <p className="text-sm text-gray-500">Uploading…</p>
      ) : (
        <>
          <p className="text-sm text-gray-600">Drag and drop a wireframe sketch, or</p>
          <label className="mt-2 cursor-pointer rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
            Choose file
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFile(file);
              }}
            />
          </label>
          <p className="mt-2 text-xs text-gray-400">PNG, JPEG or WebP, up to 15MB</p>
        </>
      )}
    </div>
  );
}
