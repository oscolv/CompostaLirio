"use client";

import { useCallback, useEffect, useState } from "react";
import type { ComposteraInfo } from "@/lib/types";

export function useComposteras() {
  const [composteras, setComposteras] = useState<ComposteraInfo[]>([]);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/composteras");
      const rows = await res.json();
      if (Array.isArray(rows)) setComposteras(rows);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const activas = composteras.filter((c) => c.activa);
  return { composteras, activas, refetch: fetchAll };
}
