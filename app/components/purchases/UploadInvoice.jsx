/* eslint-disable react/prop-types */
"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import imageCompression from "browser-image-compression";

const bytesToSize = (bytes = 0) => {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i ? 1 : 0)} ${sizes[i]}`;
};

export default function UploadInvoice({
  file,
  onChange,
  /** External upload progress: 0..100 (from your uploader) */
  progress = 0,
  /** Validation (MB) for raw file before compression */
  maxFileSizeMB = 20,
  /** Compression opts (only for images) */
  compressMaxSizeMB = 0.6,
  compressMaxWidthOrHeight = 1600,
  /** Allow camera capture button on mobile */
  allowCamera = true,
}) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [localError, setLocalError] = useState("");
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const dropRef = useRef(null);

  /* ---------- helpers ---------- */
  const resetLocal = () => {
    setLocalError("");
  };

  const setPreviewSafely = (url) => {
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return url || null;
    });
  };

  const validateFile = (f) => {
    if (!f) return "No file selected.";
    const isImage = f.type?.startsWith("image/");
    const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
    if (!isImage && !isPdf) {
      return "Unsupported file. Please select a PDF or image.";
    }
    const tooBig = f.size / (1024 * 1024) > maxFileSizeMB;
    if (tooBig) {
      return `File is too large. Max ${maxFileSizeMB} MB.`;
    }
    return null;
  };

  const processImage = async (f) => {
    const options = {
      maxSizeMB: compressMaxSizeMB,
      maxWidthOrHeight: compressMaxWidthOrHeight,
      useWebWorker: true,
    };
    const compressed = await imageCompression(f, options);
    // Show preview of compressed image
    setPreviewSafely(URL.createObjectURL(compressed));
    return compressed;
  };

  const handleFileInternal = useCallback(
    async (f) => {
      resetLocal();
      if (!f) return;

      const err = validateFile(f);
      if (err) {
        setLocalError(err);
        return;
      }

      try {
        let processed = f;
        const isImage = f.type?.startsWith("image/");
        if (isImage) {
          processed = await processImage(f);
        } else {
          // PDF
          setPreviewSafely(null);
        }
        onChange?.(processed);
      } catch (e) {
        // fallback to original file if compression fails
        console.error("Image processing error:", e);
        setPreviewSafely(null);
        onChange?.(f);
      }
    },
    [onChange, compressMaxSizeMB, compressMaxWidthOrHeight, maxFileSizeMB]
  );

  /* ---------- input handlers ---------- */
  const onInput = async (e) => {
    const f = e.target.files?.[0];
    await handleFileInternal(f);
    // Reset input value so selecting the same file again re-triggers change
    e.target.value = "";
  };

  const onDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.remove("ring-2", "ring-mint-400");
    const f = e.dataTransfer?.files?.[0];
    await handleFileInternal(f);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.add("ring-2", "ring-mint-400");
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.remove("ring-2", "ring-mint-400");
  };

  // Paste (Ctrl/Cmd+V) images directly
  useEffect(() => {
    const onPaste = async (e) => {
      if (!e.clipboardData?.items) return;
      const item = Array.from(e.clipboardData.items).find((it) =>
        it.type.startsWith("image/")
      );
      if (!item) return;
      const blob = item.getAsFile();
      if (blob) await handleFileInternal(blob);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFileInternal]);

  // Clear preview when parent resets file to null (e.g. after save)
  useEffect(() => {
    if (!file) {
      setPreviewSafely(null);
      setLocalError("");
    }
  }, [file]);

  // Revoke old object URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const removeFile = () => {
    onChange?.(null);
    setPreviewSafely(null);
    resetLocal();
  };

  /* ---------- UI ---------- */
  const isImageSelected = !!previewUrl;
  const hasFile = !!file;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-600">
        Invoice (PDF or Image)
      </label>

      {/* Drop zone / picker */}
      <div
        ref={dropRef}
        className="rounded-xl border border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors p-3 sm:p-4"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            fileInputRef.current?.click();
          }
        }}
        aria-label="Upload invoice by clicking or dropping a file"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-mint-100 hover:bg-mint-200 rounded-lg text-mint-700 font-medium"
            >
              Choose File
            </button>
            {allowCamera && (
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="px-4 py-2 bg-white border rounded-lg lg:hidden hover:bg-gray-50 text-gray-700"
                title="Use camera"
              >
                Use Camera
              </button>
            )}
          </div>

          <div className="text-xs sm:text-sm text-gray-600">
            Drag & drop a PDF or image, or paste an image.
            <div className="text-[11px] sm:text-xs text-gray-500">
              Max {maxFileSizeMB} MB. Images auto-compressed.
            </div>
          </div>
        </div>

        {/* Hidden pickers */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={onInput}
        />
        {allowCamera && (
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onInput}
          />
        )}
      </div>

      {/* Selected file info / preview */}
      {hasFile && !isImageSelected && (
        <div className="text-xs sm:text-sm text-gray-700">
          Selected: <span className="font-medium break-all">{file?.name}</span>{" "}
          <span className="text-gray-500">({bytesToSize(file?.size)})</span>
        </div>
      )}

      {isImageSelected && (
        <img
          src={previewUrl}
          alt="Invoice preview"
          className="mt-1 w-full max-w-xs rounded-lg border object-cover"
        />
      )}

      {/* External upload progress (from parent) */}
      {progress > 0 && progress < 100 && (
        <div className="w-full bg-gray-200 rounded-full h-2" aria-hidden>
          <div
            className="h-2 rounded-full bg-mint-500 transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Actions under selection */}
      <div className="flex items-center gap-2">
        {hasFile && (
          <button
            type="button"
            onClick={removeFile}
            className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm"
          >
            Remove
          </button>
        )}
        {localError && (
          <span className="text-xs text-red-600">{localError}</span>
        )}
      </div>
    </div>
  );
}
