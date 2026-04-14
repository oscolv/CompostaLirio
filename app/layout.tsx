import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CompostaLirio · Bitácora · San Francisco Bojay",
  description:
    "Bitácora comunitaria de monitoreo de composta de lirio acuático — estación de campo de San Francisco Bojay, Hidalgo.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f1a11",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="font-sans antialiased text-tinta-900 selection:bg-tinta-800 selection:text-papel-50">
        {children}
      </body>
    </html>
  );
}
