"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { uploadFoto } from "@/lib/foto";

export type MultiPhotoItem = {
  id: string;
  file: File;
  preview: string;
  url?: string;
  uploading: boolean;
  error?: string;
};

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Sube fotos de forma progresiva en serie a medida que se seleccionan.
// El usuario ve el progreso de cada foto (subiendo → ✓ / error con reintento).
// "Guardar bitácora" solo espera a que termine la cola; el INSERT a BD es
// inmediato porque las URLs ya están listas.
export function useMultiPhotoUpload(max = 10) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MultiPhotoItem[]>([]);

  // Cola serializada: cada nuevo item se encadena al final.
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  // Liberar object URLs al desmontar.
  useEffect(() => {
    return () => {
      for (const it of items) {
        if (it.preview) URL.revokeObjectURL(it.preview);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = useCallback(() => inputRef.current?.click(), []);

  // Sube un item y actualiza su estado. No relanza: el error se guarda
  // en el state para que la UI lo muestre con botón "Reintentar".
  const uploadOne = useCallback(async (item: MultiPhotoItem) => {
    setItems((prev) =>
      prev.map((p) => (p.id === item.id ? { ...p, uploading: true, error: undefined } : p)),
    );
    try {
      const url = await uploadFoto(item.file);
      setItems((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, uploading: false, url } : p)),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al subir";
      setItems((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, uploading: false, error: msg } : p)),
      );
    }
  }, []);

  // Encola un item al final de la cola serializada.
  const enqueue = useCallback(
    (item: MultiPhotoItem) => {
      queueRef.current = queueRef.current.then(() => uploadOne(item));
    },
    [uploadOne],
  );

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const nuevos: MultiPhotoItem[] = [];
      setItems((prev) => {
        const slots = Math.max(0, max - prev.length);
        const seleccionados = Array.from(files).slice(0, slots);
        for (const file of seleccionados) {
          nuevos.push({
            id: nextId(),
            file,
            preview: URL.createObjectURL(file),
            uploading: false,
          });
        }
        return [...prev, ...nuevos];
      });
      if (inputRef.current) inputRef.current.value = "";
      // Dispara la subida automática de cada nuevo item.
      for (const item of nuevos) enqueue(item);
    },
    [max, enqueue],
  );

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((it) => it.id !== id);
    });
  }, []);

  const retry = useCallback(
    (id: string) => {
      const item = items.find((it) => it.id === id);
      if (!item || item.uploading || item.url) return;
      enqueue(item);
    },
    [items, enqueue],
  );

  const clear = useCallback(() => {
    setItems((prev) => {
      for (const it of prev) {
        if (it.preview) URL.revokeObjectURL(it.preview);
      }
      return [];
    });
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  // Espera a que termine la cola actual y devuelve las URLs.
  // Si alguna foto quedó en error, lanza para que el caller no guarde.
  const waitForUploads = useCallback(async (): Promise<string[]> => {
    await queueRef.current;
    const snapshot = items;
    const conError = snapshot.filter((it) => it.error);
    if (conError.length > 0) {
      throw new Error(
        `${conError.length} foto(s) no se subieron. Reintenta o quítalas antes de guardar.`,
      );
    }
    const pendientes = snapshot.filter((it) => !it.url);
    if (pendientes.length > 0) {
      throw new Error("Aún hay fotos sin subir. Espera a que terminen.");
    }
    return snapshot.map((it) => it.url!);
  }, [items]);

  const pendingCount = items.filter((it) => it.uploading).length;
  const failedCount = items.filter((it) => it.error).length;
  const readyCount = items.filter((it) => !!it.url).length;
  const busy = pendingCount > 0;

  return {
    items,
    inputRef,
    open,
    handleSelect,
    remove,
    retry,
    clear,
    waitForUploads,
    canAddMore: items.length < max,
    count: items.length,
    max,
    pendingCount,
    failedCount,
    readyCount,
    busy,
  };
}
