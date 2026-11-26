"use client";

/* Bóveda "Ship It" (reto exprés, TESTNET).
   El contrato `seyf_boveda` guarda XLM de testnet y lo suelta completo a quien
   presente el código. Esta pantalla conecta Freighter, simula `claim`, pide la
   firma y envía. Todo es testnet a propósito: la red no sale del env de la app. */
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import {
  getNetworkDetails,
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";
import "./boveda.css";

const Brand3D = dynamic(() => import("@/components/brand/Brand3D"), { ssr: false });

// Testnet fijo. Fuente: soroban/DEPLOYMENTS.md § Bóveda Ship It.
export const BOVEDA_CONTRACT = "CC4IIPUIBFRGNLWM5XGPJP4OQWBFR5MUGALOFWXHBKPL357HMK5AIIJ2";
const RPC_URL = "https://soroban-testnet.stellar.org";
const PASSPHRASE = Networks.TESTNET;
// Cuenta existente que solo sirve de origen para simular lecturas (no firma nada).
const READ_SOURCE = "GCXIDWJ7UYKT5OL55MFMXVLBDLT6Y5FEZOBUCK5LJODQ64HRX6O4XUPK";
const EXPERT = "https://stellar.expert/explorer/testnet";

const server = new rpc.Server(RPC_URL);
const contract = new Contract(BOVEDA_CONTRACT);

type Status =
  | { k: "idle" }
  | { k: "busy"; msg: string }
  | { k: "ok"; hash: string; amount: bigint }
  | { k: "err"; msg: string };

const fmtXlm = (stroops: bigint) =>
  (Number(stroops) / 1e7).toLocaleString("es-MX", { maximumFractionDigits: 7 });

function contractError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/Error\(Contract, #1\)/.test(m)) return "Código incorrecto. Revisa mayúsculas y espacios.";
  if (/Error\(Contract, #2\)/.test(m)) return "La bóveda ya está vacía: alguien la reclamó primero.";
  if (/User declined|rejected/i.test(m)) return "Cancelaste la firma en Freighter.";
  return m.length > 180 ? m.slice(0, 180) + "…" : m;
}

async function readBalance(): Promise<bigint> {
  const tx = new TransactionBuilder(new Account(READ_SOURCE, "0"), { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(contract.call("balance"))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error);
  return BigInt(scValToNative(sim.result!.retval));
}

export default function BovedaClaim() {
  const [balance, setBalance] = useState<bigint | null>(null);
  const [addr, setAddr] = useState<string | null>(null);
  const [netWarn, setNetWarn] = useState<string | null>(null);
  const [hasFreighter, setHasFreighter] = useState<boolean | null>(null);
  const [needsFunding, setNeedsFunding] = useState(false);
  const [code, setCode] = useState("");
  const [st, setSt] = useState<Status>({ k: "idle" });

  const refresh = useCallback(async () => {
    try {
      setBalance(await readBalance());
    } catch {
      setBalance(null);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura inicial de la cadena
    refresh();
    isConnected().then((r) => setHasFreighter(!!r.isConnected && !r.error)).catch(() => setHasFreighter(false));
  }, [refresh]);

  const checkAccount = useCallback(async (a: string) => {
    try {
      await server.getAccount(a);
      setNeedsFunding(false);
    } catch {
      setNeedsFunding(true);
    }
  }, []);

  const connect = async () => {
    setSt({ k: "idle" });
    const r = await requestAccess();
    if (r.error || !r.address) {
      setSt({ k: "err", msg: r.error?.message ?? "No se pudo conectar Freighter." });
      return;
    }
    setAddr(r.address);
    const net = await getNetworkDetails();
    setNetWarn(net.networkPassphrase && net.networkPassphrase !== PASSPHRASE
      ? `Freighter está en ${net.network}. Cámbialo a Testnet para reclamar.`
      : null);
    checkAccount(r.address);
  };

  const fund = async () => {
    if (!addr) return;
    setSt({ k: "busy", msg: "Pidiendo XLM de prueba a Friendbot…" });
    try {
      const res = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(addr)}`);
      if (!res.ok && res.status !== 400) throw new Error(`Friendbot respondió ${res.status}`);
      await checkAccount(addr);
      setSt({ k: "idle" });
    } catch (e) {
      setSt({ k: "err", msg: contractError(e) });
    }
  };

  const claim = async () => {
    if (!addr) return;
    const clean = code.trim();
    if (!clean) return;
    try {
      setSt({ k: "busy", msg: "Simulando el reclamo…" });
      const source = await server.getAccount(addr);
      const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
        .addOperation(
          contract.call(
            "claim",
            new Address(addr).toScVal(),
            nativeToScVal(new TextEncoder().encode(clean), { type: "bytes" }),
          ),
        )
        .setTimeout(120)
        .build();
      const prepared = await server.prepareTransaction(tx); // simula + ensambla
      setSt({ k: "busy", msg: "Firma en Freighter…" });
      const signed = await signTransaction(prepared.toXDR(), { networkPassphrase: PASSPHRASE, address: addr });
      if (signed.error) throw new Error(signed.error.message);
      setSt({ k: "busy", msg: "Enviando a testnet…" });
      const sent = await server.sendTransaction(TransactionBuilder.fromXDR(signed.signedTxXdr, PASSPHRASE));
      if (sent.status === "ERROR") throw new Error("La red rechazó la transacción.");
      const final = await server.pollTransaction(sent.hash, { attempts: 30 });
      if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) throw new Error(`Transacción ${final.status}`);
      const amount = final.returnValue ? BigInt(scValToNative(final.returnValue)) : 0n;
      setSt({ k: "ok", hash: sent.hash, amount });
      refresh();
    } catch (e) {
      setSt({ k: "err", msg: contractError(e) });
    }
  };

  const busy = st.k === "busy";
  const short = (a: string) => `${a.slice(0, 5)}…${a.slice(-5)}`;

  return (
    <main className="bv">
      <div className="bv-card">
        <span className="bv-chip">Testnet · Reto exprés</span>
        <Brand3D kind="vault" className="bv-3d" />
        <h1>Bóveda Ship It</h1>
        <p className="bv-lede">
          Un contrato de SEYF guarda XLM de prueba y los entrega completos a quien escriba el código correcto.
        </p>

        <div className="bv-bal">
          <span>En la bóveda</span>
          <b>{balance == null ? "—" : `${fmtXlm(balance)} XLM`}</b>
        </div>

        {hasFreighter === false && (
          <p className="bv-note">
            Necesitas la extensión <a href="https://www.freighter.app/" target="_blank" rel="noreferrer">Freighter</a> en modo Testnet.
          </p>
        )}

        {!addr ? (
          <button className="bv-btn" onClick={connect} disabled={hasFreighter === false}>
            Conectar wallet de testnet
          </button>
        ) : (
          <>
            <p className="bv-addr">Conectada: <code>{short(addr)}</code></p>
            {netWarn && <p className="bv-warn">{netWarn}</p>}
            {needsFunding && (
              <p className="bv-warn">
                Tu cuenta aún no existe en testnet.{" "}
                <button className="bv-link" onClick={fund} disabled={busy}>Fondear con Friendbot</button>
              </p>
            )}
            <label className="bv-label" htmlFor="bv-code">Código</label>
            <input
              id="bv-code"
              className="bv-input"
              placeholder="Escribe el código"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && claim()}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="go"
            />
            <button className="bv-btn" onClick={claim} disabled={busy || !code.trim() || !!netWarn}>
              {busy ? st.msg : "Reclamar XLM"}
            </button>
          </>
        )}

        {st.k === "ok" && (
          <div className="bv-ok">
            <b>¡Listo! Recibiste {fmtXlm(st.amount)} XLM.</b>
            <a href={`${EXPERT}/tx/${st.hash}`} target="_blank" rel="noreferrer">Ver transacción ↗</a>
          </div>
        )}
        {st.k === "err" && <p className="bv-err">{st.msg}</p>}

        <a className="bv-contract" href={`${EXPERT}/contract/${BOVEDA_CONTRACT}`} target="_blank" rel="noreferrer">
          Contrato {short(BOVEDA_CONTRACT)} en stellar.expert ↗
        </a>
      </div>
    </main>
  );
}
