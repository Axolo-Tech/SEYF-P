import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fuentes servidas desde el repo (variables, subconjunto latin, licencia OFL):
// next/font/google descarga en cada build y en Vercel falla de forma intermitente.
const manrope = localFont({
  variable: "--font-sans",
  src: "./fonts/Manrope-latin.woff2",
  weight: "200 800",
  display: "swap",
});

const spaceGrotesk = localFont({
  variable: "--font-display",
  src: "./fonts/SpaceGrotesk-latin.woff2",
  weight: "300 700",
  display: "swap",
});

// letra condensada para titulares tipo póster de la landing; solo se descarga donde se usa
const anton = localFont({
  variable: "--font-poster",
  src: "./fonts/Anton-latin.woff2",
  weight: "400",
  display: "swap",
  preload: false,
});

// URL pública para metadatos (OG, canonical). En producción se fija con
// NEXT_PUBLIC_SITE_URL; si falta, se usa el dominio que inyecta la plataforma
// (Railway: RAILWAY_PUBLIC_DOMAIN; Vercel: VERCEL_URL, mientras siga activo).
const platformDomain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.VERCEL_URL;
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (platformDomain ? `https://${platformDomain}` : "http://localhost:3000");

const title = "SEYF — Super app de finanzas";
const description =
  "Pesos digitales, bonos de gobierno y bóvedas de ahorro. Integración Bitso Business / Juno (MXNB).";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  appleWebApp: { capable: true, title: "SEYF", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/brand/seyf-favicon.svg", type: "image/svg+xml" }],
    // iOS no usa SVG para el ícono de la pantalla de inicio
    apple: [{ url: "/brand/seyf-apple-touch-180.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    siteName: "SEYF",
    title,
    description,
    locale: "es_MX",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#08080D",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-scroll-behavior="smooth" className={`${manrope.variable} ${spaceGrotesk.variable} ${anton.variable}`}>
      <body>{children}</body>
    </html>
  );
}
