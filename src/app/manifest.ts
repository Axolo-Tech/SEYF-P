import type { MetadataRoute } from "next";

/* Manifest para instalar SEYF en la pantalla de inicio del celular (PWA).
   Abre directo en /app, a pantalla completa y con los colores de la app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SEYF — Tu dinero, siempre rindiendo",
    short_name: "SEYF",
    description: "Ahorra en dólares digitales sobre Stellar y pide un adelanto de tu rendimiento.",
    lang: "es-MX",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#08080D",
    theme_color: "#08080D",
    icons: [
      { src: "/brand/seyf-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/seyf-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/seyf-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
