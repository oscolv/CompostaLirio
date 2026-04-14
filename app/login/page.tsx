"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LilyMark } from "@/components/ui/LilyMark";

export default function Login() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim() }),
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError("PIN incorrecto. Pide la clave al equipo.");
      }
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    }
    setLoading(false);
  }

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Cinta superior */}
      <div className="h-[3px] w-full bg-tinta-900" />
      <div className="h-[1px] w-full bg-ocre-400/70" />

      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[420px] animate-fade-in">
          {/* Masthead de bitácora */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2.5 text-tinta-900 mb-4">
              <LilyMark className="w-10 h-10" />
            </div>
            <div className="kicker justify-center mb-3">Estación de campo · Bojay</div>
            <h1 className="font-display text-[44px] font-black text-tinta-900 leading-[0.95] tracking-tight">
              CompostaLirio.
            </h1>
            <p className="text-[13.5px] text-tinta-600 mt-3 leading-relaxed max-w-[36ch] mx-auto">
              Bitácora comunitaria de monitoreo de composta de lirio acuático.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="page-card">
            <div className="flex items-baseline justify-between mb-4">
              <div className="kicker">Acceso</div>
              <div className="font-mono text-[10.5px] text-tinta-500 tabular-nums">PIN · {year}</div>
            </div>

            <label className="input-label" htmlFor="pin">
              Clave de acceso
            </label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="• • • • •"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="input-field text-center font-mono text-[22px] tracking-[0.4em] mb-4 py-4"
              autoFocus
            />

            {error && (
              <div className="text-[12px] font-semibold uppercase tracking-kicker text-arcilla-600 text-center mb-3 animate-fade-in">
                · {error}
              </div>
            )}

            <button type="submit" disabled={!pin.trim() || loading} className="btn-primary">
              {loading ? "Verificando…" : "Entrar a la bitácora"}
            </button>

            <p className="text-[12px] text-tinta-500 text-center mt-4 leading-snug">
              Si no tienes la clave, pídela a tu coordinador de equipo.
            </p>
          </form>

          <div className="mt-8 text-center text-[10.5px] uppercase tracking-kicker text-tinta-500 font-mono">
            UAM · Comunidad de San Francisco Bojay, Hidalgo
          </div>
        </div>
      </div>
    </div>
  );
}
