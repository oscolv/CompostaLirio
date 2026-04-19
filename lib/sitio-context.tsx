"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useSitios } from "@/hooks/useSitios";
import type { Sitio } from "@/lib/types";

const STORAGE_KEY = "composta.sitio_id";

type SitioCtx = {
  sitios: Sitio[];
  activos: Sitio[];
  sitioId: number | null;
  setSitioId: (id: number | null) => void;
  loading: boolean;
};

const Ctx = createContext<SitioCtx | null>(null);

export function SitioProvider({ children }: { children: ReactNode }) {
  const { sitios, activos, loading } = useSitios();
  const [sitioId, setSitioIdState] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const n = parseInt(raw, 10);
        if (Number.isFinite(n)) setSitioIdState(n);
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  const setSitioId = useCallback((id: number | null) => {
    setSitioIdState(id);
    try {
      if (id == null) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, String(id));
    } catch { /* ignore */ }
  }, []);

  // Reconciliación con la lista real: si el guardado ya no está activo, limpiarlo;
  // si no hay selección y solo hay un activo, adoptarlo.
  useEffect(() => {
    if (!hydrated || loading) return;
    if (activos.length === 0) return;
    if (sitioId != null && !activos.some((s) => s.id === sitioId)) {
      setSitioId(null);
      return;
    }
    if (sitioId == null && activos.length === 1) {
      setSitioId(activos[0].id);
    }
  }, [hydrated, loading, activos, sitioId, setSitioId]);

  return (
    <Ctx.Provider value={{ sitios, activos, sitioId, setSitioId, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSitio() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSitio debe usarse dentro de <SitioProvider>");
  return v;
}
