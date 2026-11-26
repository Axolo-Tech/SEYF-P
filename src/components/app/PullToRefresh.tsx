"use client";

/* Jalar para actualizar, como en una app nativa: con el scroll arriba, jalar
   hacia abajo más de THRESHOLD px y soltar llama a `onRefresh`. El indicador se
   mueve con estilos directos (sin estado de React) para no volver a pintar la
   pantalla entera en cada movimiento del dedo. Solo responde a toques. */
import React, { useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/haptics";

const THRESHOLD = 64;
const MAX_PULL = 96;

export function usePullToRefresh(
  scrollRef: React.RefObject<HTMLElement | null>,
  onRefresh: () => Promise<unknown>,
) {
  const indicatorRef = useRef<HTMLDivElement>(null);
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);
  const refreshRef = useRef(onRefresh);
  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let startY: number | null = null;
    let pull = 0;

    const paint = (px: number, settle = false) => {
      const ind = indicatorRef.current;
      if (!ind) return;
      ind.style.transition = settle ? "transform .25s, opacity .25s" : "none";
      ind.style.transform = `translate(-50%, ${px - 44}px) rotate(${px * 3}deg)`;
      ind.style.opacity = String(Math.min(px / THRESHOLD, 1));
      ind.dataset.ready = px >= THRESHOLD ? "1" : "0";
    };

    const onStart = (e: TouchEvent) => {
      startY = !busy.current && el.scrollTop <= 0 ? e.touches[0].clientY : null;
      pull = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (startY == null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) return;
      pull = Math.min(dy * 0.5, MAX_PULL);
      paint(pull);
    };
    const onEnd = async () => {
      if (startY == null) return;
      startY = null;
      if (pull < THRESHOLD) return paint(0, true);
      busy.current = true;
      haptic();
      setRefreshing(true);
      paint(THRESHOLD, true);
      try {
        await refreshRef.current();
      } finally {
        busy.current = false;
        setRefreshing(false);
        paint(0, true);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [scrollRef]);

  return { indicatorRef, refreshing };
}

export function PullIndicator({
  indicatorRef,
  refreshing,
}: {
  indicatorRef: React.RefObject<HTMLDivElement | null>;
  refreshing: boolean;
}) {
  return (
    <div ref={indicatorRef} className={`ptr-ind${refreshing ? " spinning" : ""}`} aria-hidden>
      <span className="spin" />
    </div>
  );
}
