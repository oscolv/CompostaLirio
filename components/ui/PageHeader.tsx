"use client";

import Link from "next/link";
import { LilyMark } from "./LilyMark";

type NavItem = { href: string; label: string; active?: boolean };

type Props = {
  /** Kicker editorial — "Bitácora · Sección" */
  kicker?: string;
  /** Título grande, serif */
  title: string;
  /** Subtítulo breve, en texto tinta */
  subtitle?: string;
  /** Items de navegación en la barra superior */
  nav?: NavItem[];
  /** Botón ghost a la derecha (usado para logout) */
  onLogout?: () => void | Promise<void>;
  /** Folio opcional (ej. "EXP. 04 · 2026") */
  folio?: string;
  /** Si la página es secundaria, enlace a inicio */
  backHref?: string;
  backLabel?: string;
};

export function PageHeader({
  kicker,
  title,
  subtitle,
  nav,
  onLogout,
  folio,
  backHref,
  backLabel = "Volver al índice",
}: Props) {
  return (
    <header className="relative border-b border-tinta-900/15 bg-papel-50/60 backdrop-blur-[2px]">
      {/* Barra de estación — línea superior muy delgada */}
      <div className="h-[3px] w-full bg-tinta-900" />
      <div className="h-[1px] w-full bg-ocre-400/70" />

      {/* Barra de nav / meta */}
      <div className="max-w-[960px] mx-auto px-5 md:px-8 pt-3 pb-2 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 text-tinta-900 group">
          <LilyMark className="w-6 h-6 text-tinta-900 transition-transform group-hover:-rotate-6" />
          <div className="leading-none">
            <div className="font-display font-black text-[15px] tracking-tight">
              CompostaLirio
            </div>
            <div className="text-[9px] uppercase tracking-kicker text-tinta-500 mt-0.5">
              Est. Bojay · Hidalgo
            </div>
          </div>
        </Link>

        {nav && nav.length > 0 && (
          <nav className="hidden sm:flex items-center gap-5 text-[12px] font-medium text-tinta-600">
            {nav.map((item, i) => (
              <Link
                key={i}
                href={item.href}
                className={`transition-colors hover:text-tinta-900 ${
                  item.active ? "text-tinta-900 font-semibold" : ""
                }`}
              >
                {item.label}
              </Link>
            ))}
            {onLogout && (
              <button
                onClick={onLogout}
                className="text-tinta-500 hover:text-arcilla-600 transition-colors"
              >
                Salir
              </button>
            )}
          </nav>
        )}
        {(!nav || nav.length === 0) && backHref && (
          <Link
            href={backHref}
            className="text-[11px] font-semibold uppercase tracking-kicker text-tinta-600 hover:text-tinta-900 transition-colors"
          >
            ← {backLabel}
          </Link>
        )}
      </div>

      {/* Nav móvil: scroll horizontal */}
      {nav && nav.length > 0 && (
        <nav className="sm:hidden max-w-[960px] mx-auto px-5 pb-2 flex items-center gap-4 overflow-x-auto text-[12px] text-tinta-600 no-scrollbar">
          {nav.map((item, i) => (
            <Link
              key={i}
              href={item.href}
              className={`whitespace-nowrap transition-colors ${
                item.active ? "text-tinta-900 font-semibold" : "hover:text-tinta-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
          {onLogout && (
            <button
              onClick={onLogout}
              className="whitespace-nowrap text-tinta-500 hover:text-arcilla-600"
            >
              Salir
            </button>
          )}
        </nav>
      )}

      {/* Masthead editorial */}
      <div className="max-w-[960px] mx-auto px-5 md:px-8 pt-6 pb-7 md:pt-10 md:pb-10 relative">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            {kicker && (
              <div className="kicker text-tinta-600 mb-3">
                {kicker}
              </div>
            )}
            <h1 className="section-title text-[40px] sm:text-[52px] md:text-[64px]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-3 max-w-[52ch] text-[14px] leading-relaxed text-tinta-700">
                {subtitle}
              </p>
            )}
          </div>

          {folio && (
            <div className="hidden md:flex flex-col items-end text-right flex-shrink-0">
              <div className="text-[9.5px] uppercase tracking-kicker text-tinta-500">Folio</div>
              <div className="font-mono text-[13px] text-tinta-800 mt-1 tabular-nums">
                {folio}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Regla de pie de masthead */}
      <div className="max-w-[960px] mx-auto px-5 md:px-8">
        <div className="rule" />
      </div>
    </header>
  );
}
