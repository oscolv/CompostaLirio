"use client";

import { SitioProvider } from "@/lib/sitio-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SitioProvider>{children}</SitioProvider>;
}
