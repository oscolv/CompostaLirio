type Props = {
  className?: string;
  title?: string;
};

/**
 * Marca tipográfica de CompostaLirio: un lirio acuático estilizado
 * trazado a mano, pensado para funcionar como monograma de ~24–40px.
 */
export function LilyMark({ className = "w-7 h-7", title = "CompostaLirio" }: Props) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label={title}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Tallo / agua */}
      <path d="M24 42 C 24 34, 22 30, 19 26" strokeWidth="1.4" opacity="0.55" />
      <path d="M10 42 C 18 40, 30 40, 38 42" strokeWidth="1" opacity="0.35" />
      {/* Pétalos exteriores */}
      <path
        d="M24 26
           C 14 24, 9 16, 14 8
           C 20 11, 24 18, 24 26 Z"
        strokeWidth="1.6"
      />
      <path
        d="M24 26
           C 34 24, 39 16, 34 8
           C 28 11, 24 18, 24 26 Z"
        strokeWidth="1.6"
      />
      {/* Pétalo central */}
      <path
        d="M24 26
           C 22 18, 22 10, 24 4
           C 26 10, 26 18, 24 26 Z"
        strokeWidth="1.6"
      />
      {/* Corazón */}
      <circle cx="24" cy="24" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
