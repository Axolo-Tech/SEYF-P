import { FIX, PK } from "./mocks.mjs";
const now = Date.now();
const day = 86400000;
const U = (n) => String(Math.round(n * 1e7)); // USDC/activos Stellar: 7 decimales
// bóvedas del usuario (montos en MXN)
export const OPTS = { vaults: "full" };
FIX.push({ api: /^\/api\/db\/vaults$/, body: () => ({ vaults: OPTS.vaults === "usdc" ? [
  { id: "v2", nm: "Fondo de emergencia", goal: 30000, bal: 21780.5, apy: 6.4, color: "#8357F5", createdAt: now - 200 * day, planId: "moderado", strategyId: "usdc", updatedAt: now - 60000 },
] : [
  { id: "v1", nm: "Viaje a Japón", goal: 60000, bal: 38450.12, apy: 9.1, color: "#C8FF4D", createdAt: now - 120 * day, planId: "conservador", strategyId: "cetes", updatedAt: now - 60000 },
  { id: "v2", nm: "Fondo de emergencia", goal: 30000, bal: 21780.5, apy: 6.4, color: "#8357F5", createdAt: now - 200 * day, planId: "moderado", strategyId: "usdc", updatedAt: now - 60000 },
] }) });
FIX.push({ api: /^\/api\/db\/conversions$/, body: () => ({ conversions: [] }) });
FIX.push({ api: /^\/api\/db\/profile$/, body: () => ({ profile: { wallet: PK, fullName: "Ana", riskProfile: "moderado", email: "ana@seyf.mx" }, ok: true }) });
FIX.push({ api: /^\/api\/seyf\/kyc\/status$/, body: () => ({ ok: true, kyc: { status: "approved", approvedAt: new Date(now - 90 * day).toISOString(), customerId: "demo", walletPublicKey: PK } }) });
FIX.push({ api: /^\/api\/prices\/mxn$/, body: () => ({ prices: { USDC: 17.42, XLM: 6.1, CETES: 10.86, TESOURO: 3.21, USTRY: 18.9, GILTS: 23.4, EUROB: 20.2 }, sources: {}, at: Date.now() }) });
FIX.push({ api: /^\/api\/vault\/position$/, body: () => ({ shares: U(1795.3), value: U(1840.25), asset: "USDC", decimals: 7 }) });
FIX.push({ api: /^\/api\/advance\/position$/, body: () => ({ position: null, unlockStatus: null,
  params: { apyBps: 800, maxAdvanceBps: 9000, minTermDays: 7, maxTermDays: 1095, perUserCap: U(5000), globalCap: U(100000), allowlistOn: false }, treasury: U(250000) }) });
FIX.push({ api: /^\/api\/advance\/quote$/, body: (u) => {
  const shares = Number(u.searchParams.get("shares")) / 1e7; const term = Number(u.searchParams.get("termDays"));
  const value = shares * 1.025; return { value: U(value), advance: U(Math.round(value * 0.08 * (term / 365) * 0.9 * 100) / 100) };
} });
FIX.push({ api: /^\/api\/(advance|vault)\/build$/, body: () => ({ xdr: "AAAA" }) });
FIX.push({ api: /^\/api\/stellar\/sponsor\/submit$/, body: () => ({ txHash: "7f3c9a1e".repeat(8) }) });
FIX.push({ api: /^\/api\/advance\/activity$/, body: () => ({ activity: null }) });
// Horizon: cuenta con saldos y operaciones recientes
const bal = (code, b) => ({ balance: b, asset_type: "credit_alphanum12", asset_code: code, asset_issuer: "GCRYUGD5NVARGXT56XEZI5CIFCQETYHAPQQTHO2O3IQZTHDH4LATMYWC" });
FIX.push({ horizon: /\/accounts\/[A-Z0-9]+$/, body: () => ({ id: PK, account_id: PK, sequence: "1", subentry_count: 4,
  balances: [bal("CETES", "1250.0000000"), bal("TESOURO", "310.0000000"), bal("USTRY", "95.0000000"),
    { balance: "1840.2500000", asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
    { balance: "12.5000000", asset_type: "native" }] }) });
// saldos DeFindex por plan (en unidades del activo: CETES o USDC)
const DF = { conservador: 3540.53, moderado: 1250.31 };
FIX.push({ api: /^\/api\/defindex\/balance$/, body: (u) => {
  const planId = u.searchParams.get("planId"); const b = DF[planId] ?? 0;
  return { dfTokens: b * 1e7, underlyingBalance: b, underlyingRaw: b * 1e7, planId, vaultAddress: "CDEMO" };
} });
