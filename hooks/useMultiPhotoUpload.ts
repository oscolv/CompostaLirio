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
// "Guardar" solo espera a que termine la cola; el INSERT a BD es inmediato
// porque las URLs ya están listas.
//
// Diseño: itemsRef es la fuente autoritativa, actualizada síncronamente
// con cada cambio. setItems solo refleja el ref en el render. Evita un
// bug de timing donde, después de await, React no había aplicado el
// re-render ni el useEffect que sincronizaba el ref con el state.
export function useMultiPhotoUpload(max = 10) {
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<MultiPhotoItem[]>([]);
  const [items, setItemsState] = useState<MultiPhotoItem[]>([]);

  // Cola serializada: cada nuevo item se encadena al final.
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  // Actualizador atómico: muta el ref y refleja al state en una sola operación.
  const setItems = useCallback((next: MultiPhotoItem[]) => {
    itemsRef.current = next;
    setItemsState(next);
  }, []);

  const patchItem = useCallback(
    (id: string, patch: Partial<MultiPhotoItem>) => {
      const next = itemsRef.current.map((p) => (p.id === id ? { ...p, ...patch } : p));
      itemsRef.current = next;
      setItemsState(next);
    },
    [],
  );

  // Liberar object URLs al desmontar.
  useEffect(() => {
    return () => {
      for (const it of itemsRef.current) {
        if (it.preview) URL.revokeObjectURL(it.preview);
      }
    };
  }, []);

  const open = useCallback(() => inputRef.current?.click(), []);

  // Sube un item y actualiza su estado. No relanza: el error se guarda
  // en el ref/state para que la UI lo muestre con botón "Reintentar".
  const uploadOne = useCallback(
    async (item: MultiPhotoItem) => {
      patchItem(item.id, { uploading: true, error: undefined });
      try {
        const url = await uploadFoto(item.file);
        patchItem(item.id, { uploading: false, url });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Error al subir";
        patchItem(item.id, { uploading: false, error: msg });
      }
    },
    [patchItem],
  );

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
      const slots = Math.max(0, max - itemsRef.current.length);
      const seleccionados = Array.from(files).slice(0, slots);
      const nuevos: MultiPhotoItem[] = seleccionados.map((file) => ({
        id: nextId(),
        file,
        preview: URL.createObjectURL(file),
        uploading: false,
      }));
      setItems([...itemsRef.current, ...nuevos]);
      if (inputRef.current) inputRef.current.value = "";
      for (const item of nuevos) enqueue(item);
    },
    [max, enqueue, setItems],
  );

  const remove = useCallback(
    (id: string) => {
      const target = itemsRef.current.find((it) => it.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      setItems(itemsRef.current.filter((it) => it.id !== id));
    },
    [setItems],
  );

  const retry = useCallback(
    (id: string) => {
      const item = itemsRef.current.find((it) => it.id === id);
      if (!item || item.uploading || item.url) return;
      enqueue(item);
    },
    [enqueue],
  );

  const clear = useCallback(() => {
    for (const it of itemsRef.current) {
      if (it.preview) URL.revokeObjectURL(it.preview);
    }
    setItems([]);
    if (inputRef.current) inputRef.current.value = "";
  }, [setItems]);

  // Espera a que termine la cola y devuelve las URLs leyendo itemsRef
  // directamente (no del state, que podría no estar aplicado todavía).
  const waitForUploads = useCallback(async (): Promise<string[]> => {
    await queueRef.current;
    const snapshot = itemsRef.current;
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
  }, []);

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
