import { useCallback, useEffect, useRef, useState } from "react";

function uid() {
  return `upl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function formatBytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatSpeed(bps) {
  if (!bps || bps <= 0) return null;
  if (bps < 1024) return `${Math.round(bps)} B/s`;
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(1)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(1)} MB/s`;
}

export function formatEta(seconds) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 1) return "<1 s";
  if (seconds < 60) return `${Math.ceil(seconds)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m}m ${s}s`;
}

async function readImageDims(file) {
  if (!file || !String(file.type || "").startsWith("image/")) {
    return { width: null, height: null };
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth || null, height: img.naturalHeight || null };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: null, height: null });
    };
    img.src = url;
  });
}

/**
 * Cola de subida independiente por archivo (U2 / video 02).
 * onUploadFile(file, { onProgress }) => Promise<result>
 * onProgress({ loaded, total }) desde axios onUploadProgress / XHR.
 */
export function useFileUploadQueue({
  onUploadFile,
  maxFiles,
  concurrency = 2,
  onFileDone,
} = {}) {
  const [items, setItems] = useState([]);
  const itemsRef = useRef(items);
  const runningRef = useRef(new Set());
  const concurrencyRef = useRef(concurrency);
  const onUploadRef = useRef(onUploadFile);
  const onDoneRef = useRef(onFileDone);
  const pumpRef = useRef(() => {});

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    onUploadRef.current = onUploadFile;
  }, [onUploadFile]);

  useEffect(() => {
    onDoneRef.current = onFileDone;
  }, [onFileDone]);

  useEffect(() => {
    concurrencyRef.current = concurrency;
  }, [concurrency]);

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((it) => {
        if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
      });
    };
  }, []);

  const patchItem = useCallback((id, patch) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
  }, []);

  const runUpload = useCallback(
    async (id) => {
      const item = itemsRef.current.find((it) => it.id === id);
      if (!item || !item.file) return;
      if (runningRef.current.has(id)) return;

      const uploadFn = onUploadRef.current;
      if (typeof uploadFn !== "function") {
        patchItem(id, {
          status: "error",
          error: "No hay manejador de subida",
          progress: 0,
        });
        return;
      }

      runningRef.current.add(id);
      const startedAt = performance.now();
      patchItem(id, {
        status: "uploading",
        progress: 0,
        loaded: 0,
        total: item.file.size || 0,
        speedBps: 0,
        etaSeconds: null,
        error: null,
      });

      try {
        const result = await uploadFn(item.file, {
          onProgress: ({ loaded, total }) => {
            const tot = total || item.file.size || 0;
            const lod = loaded || 0;
            const elapsed = (performance.now() - startedAt) / 1000;
            const speed = elapsed > 0.05 ? lod / elapsed : 0;
            const remaining = tot > lod && speed > 0 ? (tot - lod) / speed : null;
            const pct = tot > 0 ? Math.min(100, Math.round((lod / tot) * 100)) : 0;
            patchItem(id, {
              progress: pct,
              loaded: lod,
              total: tot,
              speedBps: speed,
              etaSeconds: remaining,
            });
          },
        });

        patchItem(id, {
          status: "done",
          progress: 100,
          result,
          uploadedAt: Date.now(),
          error: null,
          speedBps: 0,
          etaSeconds: 0,
        });
        if (typeof onDoneRef.current === "function") {
          try {
            onDoneRef.current(result, item.file);
          } catch {
            /* parent handles */
          }
        }
      } catch (err) {
        const detail = err?.response?.data?.detail;
        const msg =
          (typeof detail === "string" && detail) ||
          err?.message ||
          "Error de conexión";
        patchItem(id, {
          status: "error",
          error: msg,
        });
      } finally {
        runningRef.current.delete(id);
        pumpRef.current();
      }
    },
    [patchItem]
  );

  pumpRef.current = () => {
    const maxConc = Math.max(1, Number(concurrencyRef.current) || 1);
    const current = itemsRef.current;
    const active = runningRef.current.size;
    const slots = maxConc - active;
    if (slots <= 0) return;
    const queued = current.filter(
      (it) => it.status === "queued" && !runningRef.current.has(it.id)
    );
    queued.slice(0, slots).forEach((it) => {
      runUpload(it.id);
    });
  };

  useEffect(() => {
    pumpRef.current();
  }, [items]);

  const addFiles = useCallback(
    async (fileList) => {
      const incoming = Array.from(fileList || []).filter(Boolean);
      if (!incoming.length) return;

      let room = Infinity;
      if (maxFiles != null) {
        room = Math.max(0, maxFiles - itemsRef.current.length);
      }
      const accepted = incoming.slice(0, room);
      if (!accepted.length) return;

      const built = await Promise.all(
        accepted.map(async (file) => {
          const previewUrl = URL.createObjectURL(file);
          const dims = await readImageDims(file);
          return {
            id: uid(),
            file,
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size || 0,
            previewUrl,
            width: dims.width,
            height: dims.height,
            status: "queued",
            progress: 0,
            loaded: 0,
            total: file.size || 0,
            speedBps: 0,
            etaSeconds: null,
            error: null,
            result: null,
            uploadedAt: null,
          };
        })
      );

      setItems((prev) => [...prev, ...built]);
    },
    [maxFiles]
  );

  const retry = useCallback(
    (id) => {
      const item = itemsRef.current.find((it) => it.id === id);
      if (!item || !item.file) return;
      patchItem(id, {
        status: "queued",
        progress: 0,
        loaded: 0,
        error: null,
        speedBps: 0,
        etaSeconds: null,
        result: null,
        uploadedAt: null,
      });
    },
    [patchItem]
  );

  const remove = useCallback((id) => {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((it) => it.id !== id);
    });
  }, []);

  const replaceFile = useCallback(async (id, file) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    const dims = await readImageDims(file);
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
        return {
          ...it,
          file,
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size || 0,
          previewUrl,
          width: dims.width,
          height: dims.height,
          status: "queued",
          progress: 0,
          loaded: 0,
          total: file.size || 0,
          speedBps: 0,
          etaSeconds: null,
          error: null,
          result: null,
          uploadedAt: null,
        };
      })
    );
  }, []);

  const clearDone = useCallback(() => {
    setItems((prev) => {
      prev.forEach((it) => {
        if (it.status === "done" && it.previewUrl) {
          URL.revokeObjectURL(it.previewUrl);
        }
      });
      return prev.filter((it) => it.status !== "done");
    });
  }, []);

  const clearAll = useCallback(() => {
    setItems((prev) => {
      prev.forEach((it) => {
        if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
      });
      return [];
    });
  }, []);

  const doneCount = items.filter((it) => it.status === "done").length;
  const errorCount = items.filter((it) => it.status === "error").length;
  const busy = items.some((it) => it.status === "uploading" || it.status === "queued");

  return {
    items,
    addFiles,
    retry,
    remove,
    replaceFile,
    clearDone,
    clearAll,
    doneCount,
    errorCount,
    totalCount: items.length,
    busy,
    formatBytes,
    formatSpeed,
    formatEta,
  };
}
