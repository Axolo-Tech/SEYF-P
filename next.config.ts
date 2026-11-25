import type { NextConfig } from "next";
import path from "path";

const demo = process.env.SEYF_DEMO === "1";

const nextConfig: NextConfig = {
  // Fija la raíz del workspace a este proyecto (evita que Next infiera un
  // lockfile externo cuando hay varios package-lock.json en el sistema).
  turbopack: {
    root: path.join(__dirname),
    // SEYF_DEMO=1: sesión y saldos falsos para grabar videos de la app (src/demo).
    ...(demo ? { resolveAlias: { "@pollar/react": "./src/demo/pollar-react.tsx" } } : {}),
  },
  // el servidor demo compila aparte para no pisar el .next del servidor normal
  ...(demo ? { distDir: ".next-demo" } : {}),
  // La entrada pública es https://seyf.app y el sitio canónico vive en www (SEP-1
  // y SEP-10 apuntan a www.seyf.app). Hasta ahora esa redirección la hacía la
  // plataforma; aquí no depende de ella. 308, como antes. El healthcheck de
  // Railway (host healthcheck.railway.app) y los dominios *.up.railway.app no
  // se redirigen.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "seyf.app" }],
        destination: "https://www.seyf.app/:path*",
        permanent: true,
      },
    ];
  },
  // Clientes con JS en caché aún llaman /api/soroswap/*; los mandamos al agregador
  // nativo /api/swap/* (antes apuntaban a /api/sdex/{quote,build}, que ya no existen → 404).
  async rewrites() {
    return [
      { source: "/api/soroswap/quote", destination: "/api/swap/quote" },
      { source: "/api/soroswap/build", destination: "/api/swap/build" },
      { source: "/api/soroswap/send", destination: "/api/swap/send" },
    ];
  },
  // SEP-1: el stellar.toml debe servirse con CORS abierto para que wallets y
  // anclas puedan leerlo desde otro origen, y como text/plain (docs de Stellar,
  // "Publishing asset info"). Sin el Content-Type explícito, `next start` lo
  // sirve como application/octet-stream.
  async headers() {
    return [
      {
        source: "/.well-known/stellar.toml",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Content-Type", value: "text/plain; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
