# Despliegue en Railway

> **Estado (2026-11-24): migración preparada, no ejecutada.** Producción sigue en
> Vercel. Este documento es el procedimiento para pasar `www.seyf.app` a Railway
> con una cuenta dedicada de Seyfert Labs. Al terminar el corte, actualiza la
> sección [Después del corte](#después-del-corte).

Fuentes consultadas el 2026-11-24: guía de Next.js de Railway
(railway.com/guides/nextjs), docs de variables, entornos, dominios,
healthchecks y cron (docs.railway.com), Railpack para Node
(railpack.com/languages/node) y la guía de self-hosting de Next 16 instalada
(`node_modules/next/dist/docs/01-app/02-guides/self-hosting.md`). Revalida si
pasa más de un mes.

## Qué cambia y qué no

- La app es un servidor Next.js (`npm run build` + `npm start`, que es
  `next start`). La guía de Next indica que un servidor Node soporta todas las
  funciones: proxy (`src/proxy.ts`), rewrites, headers y rutas dinámicas.
- `next start` escucha en `PORT` (Railway la inyecta) sobre `0.0.0.0`.
- No hace falta `output: "standalone"` ni tocar `package.json`.
- **El keeper no se mueve:** sigue en GitHub Actions (`.github/workflows/keeper.yml`).
- **El rate limit vive en Supabase** (`src/lib/seyf/guards.ts`), así que no depende de la plataforma.
- No hay server actions ni `next/image`: no se necesita
  `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` ni `sharp` mientras corra **una sola
  réplica**. Con varias réplicas, revisa "Multi-Server Deployments" en la guía de Next.

Cambios de código de este PR:

| Archivo | Cambio |
|---|---|
| `next.config.ts` | Redirige `seyf.app` → `https://www.seyf.app` (308) en la propia app. Antes lo hacía Vercel. |
| `src/app/layout.tsx` | Si falta `NEXT_PUBLIC_SITE_URL`, usa `RAILWAY_PUBLIC_DOMAIN` (y `VERCEL_URL` mientras Vercel siga). |
| `src/lib/etherfuse/config.ts` | El entorno se declara con `SEYF_DEPLOY_ENV`. `VERCEL_ENV` se sigue leyendo para el respaldo. |

**Config-as-code (`railway.json`/`railway.toml`) no se usa:** Railway lo marcó
como obsoleto y deja de funcionar para servicios existentes el 2026-12-01. La
configuración vive en el panel y se documenta aquí.

## 1. Cuenta y proyecto

1. Crea la cuenta de Railway con el correo de Seyfert Labs, no con uno personal.
   Plan Hobby (USD 5 al mes con USD 5 de uso) o Pro (USD 20 al mes por workspace).
   El trial solo permite un dominio, y se necesitan dos (`seyf.app` y `www`).
2. Conecta el repo `Seyfert-Labs/SEYF-P` con GitHub. Rama de producción: `main`
   o `meridian`, lo que decida el equipo. Debe ser la misma que hoy despliega Vercel.
3. Crea **un servicio** a partir del repo.

## 2. Ajustes del servicio (panel)

| Ajuste | Valor | Por qué |
|---|---|---|
| Builder | Railpack (por defecto) | Detecta Node y npm por `package-lock.json` |
| Variable `RAILPACK_NODE_VERSION` | `22` | Railpack lee `engines.node` (`>=20.0.0`) antes que `.nvmrc`. CI usa 22 |
| Start command | vacío (usa `npm start`) | `next start` en `PORT` |
| Healthcheck path | `/.well-known/stellar.toml` | 2xx estático; además comprueba que SEP-1 se sirve |
| Región | US East (Virginia) | La más cercana a México de las cuatro disponibles |
| Réplicas | 1 | Ver la nota de varias réplicas arriba |
| Serverless / sleep | apagado | Al despertar puede dar 502 en la primera petición |

## 3. Entornos y variables

**Producción (mainnet).** Copia los valores desde Vercel (Settings →
Environment Variables → Production). Las llaves de servidor van como **sealed**:
Railway no copia variables sealed a los entornos de PR.

| Grupo | Variables | Sealed |
|---|---|---|
| Plataforma | `SEYF_DEPLOY_ENV=production`, `NEXT_PUBLIC_SITE_URL=https://www.seyf.app`, `RAILPACK_NODE_VERSION=22` | no |
| Red | `NEXT_PUBLIC_STELLAR_NETWORK`, `NEXT_PUBLIC_POLLAR_STELLAR_NETWORK`, `NEXT_PUBLIC_HORIZON_URL`, `NEXT_PUBLIC_SOROBAN_RPC_URL` | no |
| Pollar | `NEXT_PUBLIC_POLLAR_API_KEY`, `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` | no (son públicas) |
| Contrato y vault | `NEXT_PUBLIC_STELLAR_ADVANCE_CONTRACT`, `NEXT_PUBLIC_DEFINDEX_VAULT_USDC`, `NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS`, `STELLAR_USDC_ISSUER` | no |
| Sponsor | `STELLAR_SPONSOR_SECRET` | **sí** |
| | `STELLAR_SPONSOR_MAX_FEE`, `STELLAR_SPONSOR_MAX_RESOURCE_FEE`, `SEYF_BETA_ALLOWLIST` | no |
| SEP-10 | `SEP10_SERVER_SECRET`, `SEYF_AUTH_JWT_SECRET` | **sí** |
| | `SEP10_HOME_DOMAIN`, `SEP10_WEB_AUTH_DOMAIN`, `SEYF_AUTH_TTL_SEC` | no |
| DeFindex, Soroswap | `DEFINDEX_API_KEY`, `SOROSWAP_API_KEY` | **sí** |
| | `DEFINDEX_BASE_URL`, `SOROSWAP_BASE_URL` | no |
| Supabase | `SUPABASE_SERVICE_ROLE_KEY` | **sí** |
| | `SUPABASE_URL`, `NEXT_PUBLIC_USE_SUPABASE`, `SEYF_DB_AUTH_MODE` | no |
| Banderas | `NEXT_PUBLIC_SPEI_ENABLED`, `SEYF_LEGACY_RAILS_ENABLED` (debe quedar ausente o `false`) | no |
| Etherfuse | las `ETHERFUSE_*` que existan en Vercel; `ETHERFUSE_API_KEY` y `ETHERFUSE_WEBHOOK_SECRET` como sealed | según el caso |

- Las `NEXT_PUBLIC_*` se incrustan al compilar: deben estar antes del primer
  build. Railway expone las variables del servicio durante el build.
- No copies variables de Juno, Bitso Business, Dynerox ni Privy. Esos rieles
  están retirados; el código que queda responde 404 en producción (`src/proxy.ts`).
- `.env.example` es la plantilla; su alineación con el código es el PR 4A del
  plan de limpieza.

**Staging (testnet), recomendado para probar PRs.** Crea un entorno persistente
`staging` con `NEXT_PUBLIC_STELLAR_NETWORK=testnet`, `SEYF_DEPLOY_ENV=preview`,
el contrato y el vault de testnet de `soroban/DEPLOYMENTS.md`, llaves de testnet
propias y su dominio `*.up.railway.app`.

**Entornos de PR: apagados al inicio.** Railway los crea al abrir un PR y los
borra al cerrarlo, pero no encontramos una protección con login como la de
Vercel: quedarían públicos. La doc no aclara de qué entorno heredan; solo dice
que las variables sealed no se copian. Si se activan, comprueba antes que un PR
de prueba arranca en **testnet** y sin ninguna llave de mainnet.

## 4. Prueba antes del corte (dominio `*.up.railway.app`)

Con producción configurada pero sin tocar el DNS:

```powershell
curl.exe -sI https://<servicio>.up.railway.app/.well-known/stellar.toml
curl.exe -sI https://<servicio>.up.railway.app/app
curl.exe -sI https://<servicio>.up.railway.app/retiro
curl.exe -sI https://<servicio>.up.railway.app/api/juno/health
```

Debe dar 200, 200, 200 y 404 (rieles heredados apagados). Revisa también en
el navegador el login con Pollar y que Inicio muestre saldos. **No firmes
transacciones de mainnet para probar.**

SEP-10 exige el dominio real (`SEP10_HOME_DOMAIN`), así que el login completo
con sesión solo se verifica después del corte.

## 5. Corte de DNS

1. **Antes:** baja el TTL de los registros de `seyf.app` y `www` (p. ej. a 300 s)
   al menos un día antes.
2. **Conserva el correo.** `src/config/legal.ts` publica buzones `@seyf.app`.
   No borres ni cambies los registros MX, SPF, DKIM ni DMARC del dominio.
3. En Railway → Settings → Domains agrega `www.seyf.app` y `seyf.app`. Cada uno
   pide un **CNAME y un TXT**; sin el TXT no verifica.
4. El dominio raíz (`seyf.app`) necesita CNAME flattening o ALIAS. Si el DNS
   actual no lo soporta, mueve los nameservers a Cloudflare (y vuelve a crear
   los MX allí). Con el proxy de Cloudflare activo, el modo SSL "Full (Strict)"
   no funciona como se espera, según Railway.
5. Railway emite el certificado de Let's Encrypt en menos de una hora tras el
   cambio. La propagación puede tardar hasta 72 h. **Deja Vercel encendido
   todo ese tiempo:** es el respaldo.

## 6. Verificación después del corte

```powershell
curl.exe -IL https://seyf.app/
curl.exe -sI https://www.seyf.app/.well-known/stellar.toml
curl.exe -s  https://www.seyf.app/.well-known/stellar.toml
curl.exe -sI https://www.seyf.app/api/juno/health
```

- `seyf.app` → 308 → `www.seyf.app` → 200.
- `stellar.toml` con `Access-Control-Allow-Origin: *` y el mismo `SIGNING_KEY`
  de `soroban/DEPLOYMENTS.md`.
- La ruta heredada responde 404.
- En el navegador: login con Pollar, sesión SEP-10 (las rutas `/api/db/*`
  responden sin 401), saldos y Movimientos, `/retiro`.
- El keeper sigue corriendo en GitHub Actions; no depende del hosting.

**Respaldo:** si algo falla, regresa los registros DNS a Vercel. Con TTL bajo,
el regreso tarda minutos.

## Después del corte

- Actualiza las menciones de Vercel en `soroban/DEPLOYMENTS.md` (dónde viven
  las llaves calientes), `docs/contracts.md`, `docs/mainnet-readiness.md` y el
  comentario de `.github/workflows/ci.yml`.
- Cambia el estado al inicio de este documento.
- Con Railway estable una semana, borra las variables de Vercel y apaga el
  proyecto. Quita entonces el respaldo `VERCEL_URL` / `VERCEL_ENV` del código
  (`src/app/layout.tsx`, `src/lib/etherfuse/config.ts` y su prueba).
