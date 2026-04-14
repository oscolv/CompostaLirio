"use client";

import { useRef, useState, useCallback } from "react";
import { uploadFoto as doUpload } from "@/lib/foto";

export function usePhotoUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFoto(file);
    setFotoPreview(URL.createObjectURL(file));
  }, []);

  const clear = useCallback(() => {
    setFoto(null);
    setFotoPreview("");
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const open = useCallback(() => inputRef.current?.click(), []);

  const upload = useCallback(async (): Promise<string | null> => {
    if (!foto) return null;
    setUploading(true);
    try {
      return await doUpload(foto);
    } finally {
      setUploading(false);
    }
  }, [foto]);

  return { inputRef, foto, fotoPreview, uploading, handleSelect, clear, open, upload, setFoto };
}
