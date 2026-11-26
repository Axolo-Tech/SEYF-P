"use client";

/* SEYF — los dos anillos del símbolo, planos y gigantes, para el hero.
   Geometría y colores idénticos a seyf-brand-kit/04-seyf-symbol.svg.
   Al cargar, cada anillo se dibuja con su trazo. Con `progress` (scroll 0→1)
   parten separados y girados, y se acercan hasta enlazarse como en el logo;
   luego se encogen y se desvanecen para dar paso al símbolo 3D.
   Con reduce-motion se muestran ya enlazados y sin animación. */
import React from "react";
import { motion, useReducedMotion, useTransform, type MotionValue } from "motion/react";

const VIOLET = "#8357F5";
const LIME = "#CDFC4A";
const D_VIOLET = "M 274.71 288.69 A 75.4 75.4 0 1 1 221.50 364.67";
const D_LIME = "M 275.29 331.32 A 75.4 75.4 0 1 1 328.51 255.34";
const STROKE = 43.5;
const EASE = [0.22, 1, 0.36, 1] as const;

export default function BrandRings({ progress, className }: { progress: MotionValue<number>; className?: string }) {
  const reduce = useReducedMotion();
  // tramo del scroll: 0 → 0.22 se enlazan; 0.18 → 0.32 se encogen y se van
  const vx = useTransform(progress, [0, 0.22], [-96, 0]);
  const vy = useTransform(progress, [0, 0.22], [10, 0]);
  const vr = useTransform(progress, [0, 0.22], [-38, 0]);
  const lx = useTransform(progress, [0, 0.22], [96, 0]);
  const ly = useTransform(progress, [0, 0.22], [-10, 0]);
  const lr = useTransform(progress, [0, 0.22], [38, 0]);
  const scale = useTransform(progress, [0, 0.18, 0.32], [1, 1, 0.42]);
  const opacity = useTransform(progress, [0, 0.2, 0.3], [1, 1, 0]);

  const draw = (delay: number) =>
    reduce
      ? {}
      : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 1.4, delay, ease: EASE } };

  return (
    <motion.div className={className} style={reduce ? undefined : { scale, opacity }} aria-hidden>
      <svg viewBox="132.1 103.5 344.5 396" preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
        <defs>
          <clipPath id="seyf-rings-clip">
            <rect x="-1000" y="310" width="3000" height="2000" />
          </clipPath>
        </defs>
        {/* mismo orden que el SVG: violeta, lima y otra vez violeta recortado abajo, para que se crucen */}
        <g fill="none" strokeWidth={STROKE} strokeLinecap="round">
          <motion.g className="ring" style={reduce ? undefined : { x: vx, y: vy, rotate: vr }}>
            <motion.path d={D_VIOLET} stroke={VIOLET} {...draw(0.15)} />
          </motion.g>
          <motion.g className="ring" style={reduce ? undefined : { x: lx, y: ly, rotate: lr }}>
            <motion.path d={D_LIME} stroke={LIME} {...draw(0.35)} />
          </motion.g>
          <motion.g className="ring" style={reduce ? undefined : { x: vx, y: vy, rotate: vr }}>
            <motion.path d={D_VIOLET} stroke={VIOLET} clipPath="url(#seyf-rings-clip)" {...draw(0.15)} />
          </motion.g>
        </g>
      </svg>
    </motion.div>
  );
}
