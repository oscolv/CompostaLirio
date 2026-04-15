"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

  return (
    <div className="min-h-screen bg-crema-100 flex items-center justify-center px-4">
      <div className="w-full max-w-[360px]">
        <div className="text-center mb-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-verde-600 mb-1.5">
            San Francisco Bojay
          </div>
          <h1 className="font-display text-[28px] font-black text-verde-900 leading-tight">
            Agente de Composta
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="page-card">
          <label className="input-label" htmlFor="pin">
            Clave de acceso
          </label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Ingresa el PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="input-field text-center text-[18px] tracking-[0.3em] mb-4"
            autoFocus
          />

          {error && (
            <div className="text-[13px] font-medium text-red-600 text-center mb-3 animate-fade-in">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!pin.trim() || loading}
            className="btn-primary"
          >
            {loading ? "Verificando..." : "Entrar"}
          </button>

          <p className="text-[12px] text-gray-400 text-center mt-4 leading-snug">
            Si no tienes la clave, pídela a tu coordinador de equipo.
          </p>
        </form>
      </div>
    </div>
  );
}
