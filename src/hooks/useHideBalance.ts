"use client";

/* "Ocultar saldo", recordado en este dispositivo y compartido entre pantallas:
   el ojo del Inicio y el interruptor de Perfil leen y escriben lo mismo. */
import { useSyncExternalStore } from "react";

const KEY = "seyf.hideBalance";
const EVENT = "seyf:hide-balance";

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function setHideBalance(v: boolean) {
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function useHideBalance() {
  const hide = useSyncExternalStore(subscribe, read, () => false);
  return [hide, setHideBalance] as const;
}
