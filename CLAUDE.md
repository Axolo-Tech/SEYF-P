@AGENTS.md
@SOUL.md
@docs/seyf-context.md

# SEYF: ahorro en USDC sobre Stellar mainnet

Guía de arranque para agentes. Describe el código de `meridian`. Antes de
construir, lee `SOUL.md` (principios), `docs/seyf-context.md` (los 4 checks de
Stellar) y `soroban/DEPLOYMENTS.md` (contrato, cuentas y evidencia de mainnet).
El producto público está en `README.md` (inglés) y `README.es.md`.

> **Direcciones `G…`/`C…`, parámetros y hashes: solo de `soroban/DEPLOYMENTS.md`.**
> Hay cuentas *look-alike* que envenenan el historial de transacciones. Nunca
> copies una dirección desde el historial.

## Qué hace el producto hoy

1. **Entrada con correo** mediante Pollar: cuenta Stellar cofirmada (Turnkey 2 de 2),
   sin seed phrase ni extensión.
2. **Sin XLM para el usuario:** el sponsor de SEYF paga reservas (CAP-33) y
   comisiones (fee-bump) de las operaciones permitidas.
3. **Ahorro en USDC** (Circle) en el vault DeFindex Meru, que presta en un pool de Blend.
4. **Adelanto de rendimiento** con el contrato propio `seyf_advance` (Soroban):
   bloquea acciones del vault y paga hoy, desde la tesorería del contrato, el
   rendimiento de 1 a 30 días. `repay` libera todo antes de tiempo; `settle`
   (keeper) cierra la posición cuando el rendimiento real cubre el adelanto.

Es una beta en mainnet con topes bajos y el contrato **sin auditar**: límites en
`docs/contracts.md` y parámetros vigentes en `soroban/DEPLOYMENTS.md`. La rampa
MXN por SPEI (Etherfuse) y los CETES tokenizados están integrados solo en
testnet; en mainnet la UI los muestra como "próximamente" (`NEXT_PUBLIC_SPEI_ENABLED`).

## Stack

- Next.js 16.2.6 (App Router), React 19.2, TypeScript 5.9, Tailwind v4.
- `@stellar/stellar-sdk` 14.6: Horizon para cuentas y envíos, Soroban RPC para contratos.
- Pollar (`@pollar/core`, `@pollar/react` 0.12): login y wallet embebida.
- DeFindex SDK 0.3: vault USDC (Meru). Blend se usa a través de DeFindex.
- Soroswap SDK 0.5 y SDEX: swaps y path payments.
- Supabase: metadatos (perfil, nombres de bóvedas, estado de KYC). Los saldos
  salen de la cadena, no de la BD.
- Contrato: `soroban/seyf_advance` (Rust, soroban-sdk 29.0.1, 17 pruebas).

## Arquitectura

```
src/
  app/
    app/                    # /app: la app (SeyfApp)
    retiro/                 # /retiro: flujo enfocado de ahorro + adelanto (RetiroApp)
    (legal)/                # páginas legales
    api/auth/sep10/         # challenge y token SEP-10 (firma seyf-sep10-hot)
    api/vault/*             # XDR de depósito/retiro del vault DeFindex; posición
    api/defindex/*          # saldos, estrategias, prepare/submit de DeFindex
    api/advance/*           # quote, position, history, activity y build (open/repay/settle)
    api/stellar/sponsor/*   # crear cuenta, trustline USDC, submit con fee-bump
    api/stellar/pay/, api/sdex/, api/swap/   # envíos y swaps
    api/prices/*            # precios en MXN (Reflector; /api/prices/mxn aún usa Bitso de respaldo)
    api/seyf/*, api/webhooks/etherfuse       # Etherfuse: KYC, rampa SPEI, CETES (testnet)
    api/db/*                # Supabase con service_role, detrás de la sesión SEP-10
  components/
    app/SeyfApp.tsx         # shell + router interno por estado (`route`), no el router de Next
    app/screens/            # core (Inicio, Movimientos), invest (bóvedas), advance,
                            #   account, kyc, login, asset-detail
    retiro/                 # pantallas de /retiro
    providers/              # SeyfPollarProvider, SeyfAuthBridge (sesión SEP-10)
    wallet/                 # WalletContext + PollarBridge (sesión Pollar → contexto)
    landing/, legal/, brand/
  lib/
    stellar/                # red, SEP-10, JWT, sponsor, Reflector, USDC, path payments
    advance/                # config y cliente de seyf_advance, eventos, checkpoint de actividad
    defindex/               # cliente, catálogo de vaults, preparación de XDR
    pollar/                 # sesión y API cliente de Pollar
    etherfuse/, seyf/       # rampa MXN/CETES (testnet) y helpers de la wallet Stellar
    supabase/server.ts      # único cliente Supabase (service_role)
    supabase/db.ts          # funciones de datos server-side
    store.ts                # Supabase (/api/db/*) o localStorage
    rails.ts                # IS_MAINNET, SPEI_ENABLED
  proxy.ts                  # apaga en producción las rutas heredadas (ver abajo)
soroban/                    # contrato seyf_advance + DEPLOYMENTS.md
scripts/keeper.mjs          # settle de adelantos cubiertos (.github/workflows/keeper.yml, cada 10 min)
scripts/check-mainnet.mjs   # verificador de configuración (npm run check:mainnet)
database/schema.sql         # esquema de Supabase
public/.well-known/stellar.toml   # SEP-1
```

**Flujo de firma:** el servidor arma y simula la transacción → Pollar la muestra
y el usuario firma → el servidor la envuelve en un fee-bump del sponsor y la
envía → resultado final.

## Reglas de desarrollo

- **Secretos solo en el servidor**, nunca bajo `NEXT_PUBLIC_*` ni en el repo:
  `STELLAR_SPONSOR_SECRET`, `SEP10_SERVER_SECRET`, `SEYF_AUTH_JWT_SECRET`,
  `SUPABASE_SERVICE_ROLE_KEY`, `DEFINDEX_API_KEY`, `SOROSWAP_API_KEY`,
  `ETHERFUSE_API_KEY`. `KEEPER_SECRET` vive en GitHub Actions. La llave admin
  del contrato nunca va a un servidor.
- Las rutas que gastan al sponsor o tocan Supabase exigen sesión SEP-10
  (`requireSession` / `requireDbAccess`); las del sponsor, además, rate limit.
  Una ruta nueva de ese tipo hace lo mismo.
- El sponsor solo cubre las operaciones permitidas en `src/lib/stellar/sponsor.ts`
  (contrato del adelanto, vault USDC, SAC de USDC y trustline de USDC), con
  `resourceFee` topado. Ampliar esa lista es una decisión de seguridad, no un detalle.
- Red, passphrase, Horizon y RPC salen solo de `src/lib/stellar/network.ts`.
  SDF no corre RPC público de mainnet: el proveedor se elige por env.
- Soroban: `simulateTransaction` + `assembleTransaction` antes de enviar, y
  `pollTransaction` tras el `PENDING`. Nada se firma en mainnet sin simular.
- Supabase: el cliente vive solo en `lib/supabase/server.ts` y las funciones en
  `lib/supabase/db.ts`. `store.ts` es el único lugar que decide Supabase o localStorage.
- Las pantallas de `/app` son componentes dentro de `SeyfApp.tsx`; se navega con
  el estado `route`, no con el router de Next.
- Los flujos con firma se prueban en testnet o con fixtures, no en mainnet.

## Código heredado EVM: no construir encima

La versión anterior (Arbitrum, MXNB, Privy, Juno/Bitso Business, Dynerox) ya no
opera y solo usó fondos de prueba. Sigue en el árbol mientras se retira por
partes. No le agregues funciones ni la tomes como referencia de arquitectura.

- `src/app/api/{juno,bitso,dynerox,convert,treasury}`: `src/proxy.ts` responde
  404 en producción salvo con `SEYF_LEGACY_RAILS_ENABLED=true`.
- `src/lib/{juno,bitso,dynerox}`, `src/lib/chain.ts` (Arbitrum),
  `src/services/junoService.ts`, `src/types/{juno,dynerox}.ts`, `src/hooks/useJuno.ts`,
  `src/hooks/useOnchain.ts`, `src/components/wallet/PrivyBridge.tsx` y `contracts/` (Foundry).
- `WalletContext` conserva nombres de la etapa EVM (`sendMXNB`, `smartAddress`,
  `balance` comentado como MXNB). `PollarBridge` lo llena con la cuenta Stellar
  y el saldo en USDC, y las operaciones EVM lanzan error.
- `package.json` aún declara `@privy-io/react-auth`, `viem`, `ox` y `permissionless`.

## Variables de entorno

Plantilla: `.env.example`. Nombres que lee el código Stellar:

| Grupo | Variables |
|---|---|
| Red | `NEXT_PUBLIC_STELLAR_NETWORK`, `NEXT_PUBLIC_POLLAR_STELLAR_NETWORK`, `NEXT_PUBLIC_HORIZON_URL`, `NEXT_PUBLIC_SOROBAN_RPC_URL` |
| Pollar | `NEXT_PUBLIC_POLLAR_API_KEY`, `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` |
| Contrato y vault | `NEXT_PUBLIC_STELLAR_ADVANCE_CONTRACT`, `NEXT_PUBLIC_DEFINDEX_VAULT_USDC`, `NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS`, `STELLAR_USDC_ISSUER` |
| Sponsor (server) | `STELLAR_SPONSOR_SECRET`, `STELLAR_SPONSOR_MAX_FEE`, `STELLAR_SPONSOR_MAX_RESOURCE_FEE`, `SEYF_BETA_ALLOWLIST` |
| SEP-10 (server) | `SEP10_SERVER_SECRET`, `SEP10_HOME_DOMAIN`, `SEP10_WEB_AUTH_DOMAIN`, `SEYF_AUTH_JWT_SECRET`, `SEYF_AUTH_TTL_SEC` |
| DeFindex (server) | `DEFINDEX_API_KEY`, `DEFINDEX_BASE_URL` |
| Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server), `NEXT_PUBLIC_USE_SUPABASE`, `SEYF_DB_AUTH_MODE` |
| Keeper (GitHub Actions) | `KEEPER_SECRET`, `KEEPER_DRY_RUN`, `KEEPER_START_LEDGER`, `SOROBAN_RPC_URL` |
| Banderas | `NEXT_PUBLIC_SPEI_ENABLED`, `SEYF_LEGACY_RAILS_ENABLED` |

Etherfuse y los rieles heredados tienen sus propias variables (`ETHERFUSE_*`,
`BITSO_*`, `JUNO_*`, `DYNEROX_*`); búscalas en su módulo.

## Comandos

```bash
npm run dev             # http://localhost:3000/app
npm run build           # typecheck + build (gate de CI)
npm run lint            # ESLint; en CI es informativo por deuda heredada
npm run check:mainnet   # verifica la configuración de mainnet

cd soroban && cargo test --locked    # 17 pruebas del contrato
stellar contract build --locked      # wasm (Stellar CLI 28.1)
```

No hay script de pruebas JS todavía: las suites de `src/lib/etherfuse/__tests__/`
importan Vitest, que no está instalado.

CI: `.github/workflows/ci.yml` (build y lint), `contracts.yml` (pruebas y wasm
del contrato) y `keeper.yml` (cron del keeper).

Despliegue: hoy en Vercel; la migración a Railway está preparada en
`docs/deploy-railway.md`. El entorno se declara con `SEYF_DEPLOY_ENV`.

## Degradación

Sin Supabase (`NEXT_PUBLIC_USE_SUPABASE` distinto de `"true"`), `store.ts` usa
localStorage con la misma interfaz. Sin el contrato o el vault configurados,
las rutas de adelanto responden con un error de configuración (`ConfigError`
en `src/lib/advance/config.ts`, traducido en `src/lib/advance/http.ts`).
