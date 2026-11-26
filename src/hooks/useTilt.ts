"use client";

/* Inclinación 3D con brillo, como una tarjeta física: el elemento se ladea
   hacia el dedo o el cursor y un reflejo lo sigue. Escribe variables CSS
   (--rx, --ry, --gx, --gy) que usa la clase `.tilt`; no re-renderiza React.
   Con reduce-motion no hace nada. */
import { useEffect, useRef } from "react";

const MAX_DEG = 7;

export function useTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const set = (x: number, y: number) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const px = Math.min(1, Math.max(0, (x - r.left) / r.width));
        const py = Math.min(1, Math.max(0, (y - r.top) / r.height));
        el.style.setProperty("--ry", `${(px - 0.5) * 2 * MAX_DEG}deg`);
        el.style.setProperty("--rx", `${(0.5 - py) * 2 * MAX_DEG}deg`);
        el.style.setProperty("--gx", `${px * 100}%`);
        el.style.setProperty("--gy", `${py * 100}%`);
        el.dataset.tilting = "1";
      });
    };
    const reset = () => {
      cancelAnimationFrame(raf);
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
      delete el.dataset.tilting;
    };
    const onMove = (e: PointerEvent) => {
      // con el dedo solo mientras está apoyado; con mouse, al pasar encima
      if (e.pointerType === "touch" && e.buttons === 0 && e.type === "pointermove") return;
      set(e.clientX, e.clientY);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", onMove);
    el.addEventListener("pointerleave", reset);
    el.addEventListener("pointerup", reset);
    el.addEventListener("pointercancel", reset);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onMove);
      el.removeEventListener("pointerleave", reset);
      el.removeEventListener("pointerup", reset);
      el.removeEventListener("pointercancel", reset);
    };
  }, []);
  return ref;
}
