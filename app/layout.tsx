import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Composta Lirio — San Francisco Bojay",
  description:
    "Agente de monitoreo de composta de lirio acuático para la comunidad de San Francisco Bojay",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="font-sans text-gray-900 antialiased">{children}</body>
    </html>
  );
}
