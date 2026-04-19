"use client";

import { useCallback, useEffect, useState } from "react";
import type { ComposteraInfo } from "@/lib/types";

export function useComposteras(sitioId?: number | null) {
  const [composteras, setComposteras] = useState<ComposteraInfo[]>([]);

  const fetchAll = useCallback(async () => {
    try {
      const url = sitioId
        ? `/api/sitios/${sitioId}/composteras`
        : "/api/composteras";
      const res = await fetch(url);
      const rows = await res.json();
      if (Array.isArray(rows)) setComposteras(rows);
    } catch { /* ignore */ }
  }, [sitioId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const activas = composteras.filter((c) => c.activa);
  return { composteras, activas, refetch: fetchAll };
}
