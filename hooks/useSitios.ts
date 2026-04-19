"use client";

import { useCallback, useEffect, useState } from "react";
import type { Sitio } from "@/lib/types";

export function useSitios() {
  const [sitios, setSitios] = useState<Sitio[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/sitios");
      const rows = await res.json();
      if (Array.isArray(rows)) setSitios(rows);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const activos = sitios.filter((s) => s.activo);
  return { sitios, activos, loading, refetch: fetchAll };
}
