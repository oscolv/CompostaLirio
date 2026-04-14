"use client";

import { useCallback, useState } from "react";
import { analizarImagen } from "@/lib/analizar";
import type { AnalizarRespuesta } from "@/lib/types";

export function useImageAnalysis() {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<AnalizarRespuesta | null>(null);

  const analizar = useCallback(async (file: File): Promise<AnalizarRespuesta | null> => {
    if (analyzing) return null;
    setAnalyzing(true);
    setError("");
    try {
      const res = await analizarImagen(file);
      setData(res);
      return res;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo analizar la imagen");
      return null;
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing]);

  const reset = useCallback(() => {
    setAnalyzing(false);
    setError("");
    setData(null);
  }, []);

  return { analyzing, error, data, analizar, reset, setError };
}
