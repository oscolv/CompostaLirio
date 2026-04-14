"use client";

import { useCallback, useState } from "react";

export function useFotoModal() {
  const [url, setUrl] = useState<string | null>(null);
  const close = useCallback(() => setUrl(null), []);
  return { url, open: setUrl, close };
}
