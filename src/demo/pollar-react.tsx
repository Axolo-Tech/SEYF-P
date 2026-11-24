"use client";

/* SOLO PARA GRABAR VIDEOS (SEYF_DEMO=1): reemplaza a @pollar/react con una sesión
   falsa y saldos de ejemplo. Nunca entra al build normal: next.config solo lo
   enlaza cuando SEYF_DEMO=1, y no firma ni envía nada a la red. */
import React, { createContext, useContext, useMemo } from "react";

export const DEMO_PUBLIC_KEY = "GBXD6HFNTTXDDZRCSDXDKZYEPHAUYT3UPNYHYCMSXEFQ5IAHNSCDBI5G";

const BALANCES = [
  { type: "native", code: "XLM", balance: "12.5000000", available: "10.0000000" },
  { type: "credit_alphanum4", code: "USDC", balance: "1840.2500000", available: "1840.2500000" },
  { type: "credit_alphanum12", code: "CETES", balance: "1250.0000000", available: "1250.0000000" },
  { type: "credit_alphanum12", code: "TESOURO", balance: "310.0000000", available: "310.0000000" },
  { type: "credit_alphanum12", code: "USTRY", balance: "95.0000000", available: "95.0000000" },
];

const ok = async () => ({ success: true, hash: "demo".padEnd(64, "0"), status: "SUCCESS" });
const client: Record<string, unknown> = new Proxy(
  {
    getAuthState: () => ({ step: "authenticated", session: { email: "demo@seyf.mx" } }),
    onAuthStateChange: () => () => {},
    onWalletBalanceChange: () => () => {},
    getWalletBalanceState: () => ({ step: "loaded", data: { balances: BALANCES } }),
    api: { use: () => {} },
    _session: { wallet: { address: DEMO_PUBLIC_KEY }, token: { accessToken: "demo" } },
    // "firma" sin llaves: devuelve el mismo XDR; las rutas de envío están simuladas en la grabación
    signTx: async (x: string) => ({ status: "signed", signedXdr: x }),
  },
  { get: (t, k) => (k in t ? (t as Record<string | symbol, unknown>)[k] : k === "then" ? undefined : ok) },
);

const value = {
  isAuthenticated: true,
  wallet: { address: DEMO_PUBLIC_KEY, type: "stellar" },
  walletBalance: { step: "loaded", data: { balances: BALANCES } },
  refreshWalletBalance: async () => {},
  openLoginModal: () => {},
  logout: () => {},
  getClient: () => client,
  signAndSubmitTx: ok,
  recoveryLocked: false,
  openRecoveryModal: () => {},
  recovery: { step: "idle" },
};

const Ctx = createContext(value);

export function PollarProvider({ children }: { children: React.ReactNode; client?: unknown }) {
  const v = useMemo(() => value, []);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function usePollar(): any {
  return useContext(Ctx);
}
