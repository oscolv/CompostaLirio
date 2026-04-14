"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  url: string | null;
  onClose: () => void;
  /** Si es true, muestra link "Abrir original". */
  showOpenOriginal?: boolean;
};

export function FotoModal({ url, onClose, showOpenOriginal = false }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [url, onClose]);

  if (!url || !mounted) return null;

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white text-2xl flex items-center justify-center hover:bg-white/20 transition-colors"
        aria-label="Cerrar"
      >
        &times;
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Foto ampliada"
        className="object-contain rounded-lg"
        style={{ maxWidth: "95vw", maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      />
      {showOpenOriginal && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/10 text-white text-[12px] font-semibold hover:bg-white/20 transition-colors"
        >
          Abrir original
        </a>
      )}
    </div>,
    document.body,
  );
}
