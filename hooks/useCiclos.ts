"use client";

import { useCallback, useEffect, useState } from "react";
import type { Ciclo } from "@/lib/types";

export function useCiclos(composteraId: number | null | undefined) {
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!composteraId) {
      setCiclos([]);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/composteras/${composteraId}/ciclos`);
      const rows = await res.json();
      if (Array.isArray(rows)) setCiclos(rows);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [composteraId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const activo = ciclos.find((c) => c.estado === "activo") ?? null;
  return { ciclos, activo, loading, refetch: fetchAll };
}
