import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  FileImage,
  Loader2,
  RefreshCw,
  Replace,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  formatBytes,
  formatEta,
  formatSpeed,
  useFileUploadQueue,
} from "./useFileUploadQueue";

function typeBadge(mime, name) {
  const t = String(mime || "").toLowerCase();
  if (t.includes("png")) return "PNG";
  if (t.includes("jpeg") || t.includes("jpg")) return "JPG";
  if (t.includes("webp")) return "WEBP";
  if (t.includes("gif")) return "GIF";
  if (t.includes("svg")) return "SVG";
  const ext = String(name || "").split(".").pop();
  return (ext || "FILE").toUpperCase().slice(0, 5);
}

function describeHoverFiles(files) {
  const list = Array.from(files || []);
  if (!list.length) return null;
  if (list.length === 1) {
    const f = list[0];
    return `${f.name} · ${formatBytes(f.size)}`;
  }
  const total = list.reduce((s, f) => s + (f.size || 0), 0);
  return `${list.length} archivos · ${formatBytes(total)}`;
}

/**
 * Dropzone reactivo + cola por archivo (U2 / video 02).
 *
 * Props:
 * - onUploadFile(file, { onProgress }) => Promise
 * - accept, multiple, disabled, maxFiles, concurrency, className
 * - onFileDone(result, file) — callback al terminar cada archivo
 * - idleLabel / dropLabel — override Spanish copy
 * - compact — denser layout (edit dialog)
 * - hideQueueWhenEmpty
 */
export function FileUploadQueue({
  onUploadFile,
  onFileDone,
  onItemRemove,
  accept = "image/*",
  multiple = true,
  disabled = false,
  maxFiles,
  concurrency = 2,
  className,
  idleLabel = "Suelta las imágenes aquí",
  idleHint = "o haz clic para elegir",
  dropLabel = "Suelta para subir",
  compact = false,
  testId = "file-upload-queue",
}) {
  const inputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const replaceTargetRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [hoverMeta, setHoverMeta] = useState(null);
  const dragDepth = useRef(0);

  const queue = useFileUploadQueue({
    onUploadFile,
    onFileDone,
    maxFiles,
    concurrency,
  });

  const {
    items,
    addFiles,
    retry,
    remove,
    replaceFile,
    doneCount,
    totalCount,
    busy,
  } = queue;

  const onDragEnter = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      dragDepth.current += 1;
      setDragging(true);
      const meta = describeHoverFiles(e.dataTransfer?.files);
      // files often empty on dragenter; try items count
      if (meta) {
        setHoverMeta(meta);
      } else if (e.dataTransfer?.items?.length) {
        const n = e.dataTransfer.items.length;
        setHoverMeta(n === 1 ? "1 archivo" : `${n} archivos`);
      }
    },
    [disabled]
  );

  const onDragOver = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      e.dataTransfer.dropEffect = "copy";
      setDragging(true);
      const meta = describeHoverFiles(e.dataTransfer?.files);
      if (meta) setHoverMeta(meta);
    },
    [disabled]
  );

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) {
      setDragging(false);
      setHoverMeta(null);
    }
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepth.current = 0;
      setDragging(false);
      setHoverMeta(null);
      if (disabled) return;
      const files = e.dataTransfer?.files;
      if (files?.length) addFiles(files);
    },
    [disabled, addFiles]
  );

  const onPick = useCallback(
    (e) => {
      const files = e.target.files;
      if (files?.length) addFiles(files);
      e.target.value = "";
    },
    [addFiles]
  );

  const openPicker = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const openReplace = useCallback((id) => {
    replaceTargetRef.current = id;
    replaceInputRef.current?.click();
  }, []);

  const onReplacePick = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      const id = replaceTargetRef.current;
      if (file && id) {
        const prev = items.find((it) => it.id === id);
        if (prev && typeof onItemRemove === "function") onItemRemove(prev);
        replaceFile(id, file);
      }
      replaceTargetRef.current = null;
      e.target.value = "";
    },
    [replaceFile, items, onItemRemove]
  );

  const summary = useMemo(() => {
    if (!totalCount) return null;
    return `${doneCount} de ${totalCount} listos`;
  }, [doneCount, totalCount]);

  return (
    <div className={cn("space-y-3", className)} data-testid={testId}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        onClick={openPicker}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "relative flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed",
          "bg-muted/20 backdrop-blur-sm transition-all duration-200 select-none",
          compact ? "p-4 text-sm" : "p-6 text-sm",
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "cursor-pointer hover:border-primary/50 hover:bg-muted/35",
          dragging &&
            !disabled &&
            "border-solid border-primary bg-primary/10 shadow-[0_0_0_3px_rgba(59,130,246,0.18),0_0_24px_rgba(59,130,246,0.22)] scale-[1.01]"
        )}
        data-testid={`${testId}-dropzone`}
        data-dragging={dragging ? "true" : "false"}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          className="hidden"
          onChange={onPick}
          data-testid={`${testId}-input`}
        />
        <input
          ref={replaceInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={onReplacePick}
        />

        {dragging ? (
          <>
            <Upload className="h-6 w-6 text-primary animate-pulse" />
            <span className="font-semibold text-primary">{dropLabel}</span>
            {hoverMeta ? (
              <span className="text-xs text-muted-foreground">{hoverMeta}</span>
            ) : null}
          </>
        ) : (
          <>
            {busy ? (
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            ) : (
              <Upload className="h-5 w-5 text-primary" />
            )}
            <span className="font-medium">{idleLabel}</span>
            <span className="text-xs text-muted-foreground">{idleHint}</span>
          </>
        )}
      </div>

      {totalCount > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium px-0.5">
            <span>{summary}</span>
            {busy ? <span className="text-primary">Subiendo…</span> : null}
          </div>

          <ul className="space-y-2" data-testid={`${testId}-queue`}>
            {items.map((item) => (
              <QueueItem
                key={item.id}
                item={item}
                compact={compact}
                onRetry={() => retry(item.id)}
                onRemove={() => {
                  if (typeof onItemRemove === "function") onItemRemove(item);
                  remove(item.id);
                }}
                onReplace={() => openReplace(item.id)}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function QueueItem({ item, compact, onRetry, onRemove, onReplace }) {
  const isError = item.status === "error";
  const isDone = item.status === "done";
  const isUploading = item.status === "uploading";
  const isQueued = item.status === "queued";
  const speed = formatSpeed(item.speedBps);
  const eta = formatEta(item.etaSeconds);
  const dims =
    item.width && item.height ? `${item.width}×${item.height}` : null;

  return (
    <li
      className={cn(
        "group flex gap-3 rounded-xl border bg-card/60 backdrop-blur-sm p-2.5",
        "shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300",
        isDone && "animate-in fade-in zoom-in-95 border-emerald-500/30 bg-emerald-500/5",
        isError && "border-destructive/50 bg-destructive/5",
        isUploading && "border-primary/30",
        compact && "p-2"
      )}
      data-status={item.status}
    >
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-lg border bg-muted/40",
          compact ? "h-12 w-12" : "h-14 w-14"
        )}
      >
        {item.previewUrl && String(item.type || "").startsWith("image/") ? (
          <img
            src={item.previewUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <FileImage className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-tight" title={item.name}>
              {item.name}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <Badge
                variant="secondary"
                className="h-4 px-1.5 text-[9px] font-semibold tracking-wide"
              >
                {typeBadge(item.type, item.name)}
              </Badge>
              <span>{formatBytes(item.size)}</span>
              {dims ? <span>· {dims}</span> : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            {isDone ? (
              <>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  title="Reemplazar"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReplace();
                  }}
                >
                  <Replace className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  title="Quitar"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="Quitar"
                disabled={isUploading}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Progress / status lane */}
        {isQueued ? (
          <p className="text-[11px] text-muted-foreground">En cola…</p>
        ) : null}

        {(isUploading || (isError && item.progress > 0)) && (
          <div className="space-y-1">
            <div
              className={cn(
                "relative h-1.5 w-full overflow-hidden rounded-full",
                isError ? "bg-destructive/20" : "bg-primary/20"
              )}
              role="progressbar"
              aria-valuenow={item.progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-200 ease-out",
                  isError ? "bg-destructive" : "bg-primary"
                )}
                style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              <span className={cn("font-semibold tabular-nums", isError && "text-destructive")}>
                {item.progress}%
              </span>
              {isUploading && speed ? <span>{speed}</span> : null}
              {isUploading && eta ? <span>· ETA {eta}</span> : null}
              {isUploading ? <span className="text-primary">Subiendo…</span> : null}
            </div>
          </div>
        )}

        {isError ? (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className="text-[11px] font-medium text-destructive">
              Error al subir
              {item.error ? `: ${item.error}` : ""}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[11px] border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Reintentar
            </Button>
          </div>
        ) : null}

        {isDone ? (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Listo · Subido hace un momento</span>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export default FileUploadQueue;
