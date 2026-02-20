"use client";

import * as React from "react";
import { Upload, FileText, X, ImageIcon, File, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  file?: File;
  preview?: string;
}

interface FileDropZoneProps {
  files: FileItem[];
  onFilesChange: (files: FileItem[]) => void;
  accept?: string;
  maxFiles?: number;
  maxSizeMB?: number;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  enableCamera?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
  if (type.includes("pdf")) return <FileText className="h-4 w-4" />;
  return <File className="h-4 w-4" />;
}

/**
 * File drop zone for attachments with optional camera capture for mobile.
 * When enableCamera is true, shows a camera button that opens device camera.
 */
export function FileDropZone({
  files,
  onFilesChange,
  accept = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png,.dwg",
  maxFiles = 10,
  maxSizeMB = 25,
  className,
  disabled = false,
  placeholder = "Drag & drop files here, or click to browse",
  enableCamera = false,
}: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragOver(true);
    },
    [disabled]
  );

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const processFiles = React.useCallback(
    (fileList: FileList) => {
      const newFiles: FileItem[] = [];
      const remaining = maxFiles - files.length;

      for (let i = 0; i < Math.min(fileList.length, remaining); i++) {
        const file = fileList[i];
        if (file && file.size <= maxSizeMB * 1024 * 1024) {
          const item: FileItem = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: file.name,
            size: file.size,
            type: file.type,
            file,
          };
          if (file.type.startsWith("image/")) {
            item.preview = URL.createObjectURL(file);
          }
          newFiles.push(item);
        }
      }

      if (newFiles.length > 0) {
        onFilesChange([...files, ...newFiles]);
      }
    },
    [files, onFilesChange, maxFiles, maxSizeMB]
  );

  // Cleanup object URLs on unmount
  React.useEffect(() => {
    return () => {
      files.forEach((f) => {
        if (f.preview) URL.revokeObjectURL(f.preview);
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (!disabled && e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [disabled, processFiles]
  );

  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
        // Reset input so same file can be selected again
        e.target.value = "";
      }
    },
    [processFiles]
  );

  const removeFile = React.useCallback(
    (id: string) => {
      onFilesChange(files.filter((f) => f.id !== id));
    },
    [files, onFilesChange]
  );

  const imageFiles = files.filter((f) => f.type.startsWith("image/"));
  const nonImageFiles = files.filter((f) => !f.type.startsWith("image/"));
  const atLimit = files.length >= maxFiles;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Camera + Drop zone row */}
      <div className={cn("flex gap-3", enableCamera && "flex-col sm:flex-row")}>
        {/* Camera button (mobile photo capture) */}
        {enableCamera && (
          <>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "flex items-center gap-2 min-h-[56px] border-2 border-dashed border-amber-500/50 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10",
                atLimit && "cursor-not-allowed opacity-50"
              )}
              onClick={() => !disabled && !atLimit && cameraInputRef.current?.click()}
              disabled={disabled || atLimit}
            >
              <Camera className="h-5 w-5 text-amber-500" />
              <span className="font-medium">Take Photo</span>
            </Button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleInputChange}
              className="hidden"
              disabled={disabled || atLimit}
            />
          </>
        )}

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!disabled) inputRef.current?.click();
            }
          }}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors cursor-pointer",
            isDragOver
              ? "border-amber-500 bg-amber-50 dark:bg-amber-900/10"
              : "border-muted-foreground/25 hover:border-amber-500/50 hover:bg-accent/30",
            disabled && "cursor-not-allowed opacity-50",
            atLimit && "cursor-not-allowed opacity-50"
          )}
        >
          <Upload className={cn("h-8 w-8", isDragOver ? "text-amber-500" : "text-muted-foreground")} />
          <div>
            <p className="text-sm font-medium text-muted-foreground">{placeholder}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Max {maxSizeMB}MB per file · {maxFiles - files.length} of {maxFiles} remaining
            </p>
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled || atLimit}
      />

      {/* Image thumbnail grid */}
      {imageFiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {imageFiles.map((file) => (
            <div
              key={file.id}
              className="relative group rounded-lg overflow-hidden border bg-accent/10 aspect-square animate-in fade-in-50"
            >
              {file.preview ? (
                <img
                  src={file.preview}
                  alt={file.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                <p className="text-xs text-white truncate">{file.name}</p>
              </div>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(file.id);
                }}
                disabled={disabled}
              >
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Remove {file.name}</span>
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Non-image file list */}
      {nonImageFiles.length > 0 && (
        <ul className="space-y-2">
          {nonImageFiles.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 rounded-md border bg-accent/20 px-3 py-2 text-sm animate-in fade-in-50 slide-in-from-top-1"
            >
              <span className="text-muted-foreground">{getFileIcon(file.type)}</span>
              <span className="flex-1 truncate font-medium">{file.name}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatFileSize(file.size)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(file.id);
                }}
                disabled={disabled}
              >
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Remove {file.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
