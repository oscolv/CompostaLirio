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

export function useMultiPhotoUpload(max = 10) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MultiPhotoItem[]>([]);
  const [uploading, setUploading] = useState(false);

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

  const handleSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      setItems((prev) => {
        const slots = Math.max(0, max - prev.length);
        const seleccionados = Array.from(files).slice(0, slots);
        const nuevos: MultiPhotoItem[] = seleccionados.map((file) => ({
          id: nextId(),
          file,
          preview: URL.createObjectURL(file),
          uploading: false,
        }));
        return [...prev, ...nuevos];
      });
      if (inputRef.current) inputRef.current.value = "";
    },
    [max],
  );

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((it) => it.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    setItems((prev) => {
      for (const it of prev) {
        if (it.preview) URL.revokeObjectURL(it.preview);
      }
      return [];
    });
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  // Sube los items pendientes en serie (no paralelo) para no saturar el celular.
  // Devuelve las URLs en el mismo orden que items.
  const uploadAll = useCallback(async (): Promise<string[]> => {
    setUploading(true);
    try {
      const urls: string[] = [];
      const snapshot = items;
      for (const it of snapshot) {
        if (it.url) {
          urls.push(it.url);
          continue;
        }
        setItems((prev) =>
          prev.map((p) => (p.id === it.id ? { ...p, uploading: true, error: undefined } : p)),
        );
        try {
          const url = await uploadFoto(it.file);
          urls.push(url);
          setItems((prev) =>
            prev.map((p) => (p.id === it.id ? { ...p, uploading: false, url } : p)),
          );
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Error al subir";
          setItems((prev) =>
            prev.map((p) => (p.id === it.id ? { ...p, uploading: false, error: msg } : p)),
          );
          throw e;
        }
      }
      return urls;
    } finally {
      setUploading(false);
    }
  }, [items]);

  return {
    items,
    inputRef,
    uploading,
    open,
    handleSelect,
    remove,
    clear,
    uploadAll,
    canAddMore: items.length < max,
    count: items.length,
    max,
  };
}
