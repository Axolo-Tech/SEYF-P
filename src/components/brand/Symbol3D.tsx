"use client";

/* SEYF — símbolo de marca en 3D (three.js, sin assets externos).
   Los dos arcos del logo (violeta + lima) se modelan como toros parciales con
   tapas redondas y se entrelazan en z, igual que el SVG. Iluminación con
   RoomEnvironment (PMREM) para reflejos tipo render de estudio.
   `progress` (0→1, p.ej. scroll) controla giro/escala; el mouse agrega parallax.
   Superficie con relieve suave (bump procedural, tipo espuma) y brillo perlado;
   con `intro`, los arcos entran desde lados opuestos y se entrelazan al cargar.
   Solo pinta cuando está en pantalla; con reduce-motion renderiza un cuadro fijo. */
import React, { useEffect, useRef } from "react";
import type { MotionValue } from "motion/react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const LIME = 0xcdfc4a;
const VIOLET = 0x8357f5;

// Geometría derivada de public/brand/seyf-symbol.svg (unidades SVG / 100, eje y hacia arriba).
const R = 0.754;
const TUBE = 0.2175;
const ARC = (284 * Math.PI) / 180;
const ARCS = [
  { color: VIOLET, cx: 0.218, cy: -0.508, start: (183 * Math.PI) / 180, lift: 1 },
  { color: LIME, cx: -0.218, cy: 0.508, start: (2.96 * Math.PI) / 180, lift: -1 },
];
// Desplazamiento en z que hace que los arcos se "crucen" en lugar de atravesarse.
const weave = (y: number, lift: number) => lift * 0.1 * Math.tanh(-y / 0.3);

/** Relieve procedural: puntos suaves repetibles, para que la luz "rasque" la superficie. */
function makeBumpTexture(size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.fillStyle = "#808080";
  g.fillRect(0, 0, size, size);
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 1 + rnd() * 3.2;
    const v = rnd() > 0.5 ? 255 : 0;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${v},${v},${v},0.5)`);
    grd.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = grd;
    // repite en los bordes para que el patrón empalme
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      g.beginPath();
      g.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 2);
  return t;
}

const easeOutBack = (x: number) => {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

function buildArc(a: (typeof ARCS)[number], mat: THREE.Material, lite = false) {
  const g = new THREE.Group();
  const torus = lite ? new THREE.TorusGeometry(R, TUBE, 32, 140, ARC) : new THREE.TorusGeometry(R, TUBE, 48, 220, ARC);
  torus.rotateZ(a.start);
  torus.translate(a.cx, a.cy, 0);
  const pos = torus.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) + weave(pos.getY(i), a.lift));
  torus.computeVertexNormals();
  g.add(new THREE.Mesh(torus, mat));
  // tapas redondas (stroke-linecap: round)
  const cap = lite ? new THREE.SphereGeometry(TUBE, 28, 20) : new THREE.SphereGeometry(TUBE, 40, 28);
  for (const ang of [a.start, a.start + ARC]) {
    const x = a.cx + R * Math.cos(ang);
    const y = a.cy + R * Math.sin(ang);
    const m = new THREE.Mesh(cap, mat);
    m.position.set(x, y, weave(y, a.lift));
    g.add(m);
  }
  return g;
}

export default function Symbol3D({
  progress,
  className,
  style,
  scale = 1,
  spin = true,
  intro = false,
}: {
  progress?: MotionValue<number>;
  className?: string;
  style?: React.CSSProperties;
  scale?: number;
  spin?: boolean;
  /** Ensamblado al montar: cada arco entra desde un lado y se entrelaza. */
  intro?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return; // sin WebGL: el contenedor queda con su fondo/fallback CSS
    }
    // celular: 1.5x basta y cuesta casi la mitad de píxeles que 2x
    const lite = window.matchMedia("(max-width: 880px), (pointer: coarse)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, lite ? 1.5 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block";

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 100);
    camera.position.set(0, 0, 10.9);

    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rimV = new THREE.PointLight(VIOLET, 18, 12);
    rimV.position.set(-3, -1.5, -1.5);
    scene.add(rimV);
    const rimL = new THREE.PointLight(LIME, 10, 12);
    rimL.position.set(3, 2, -1);
    scene.add(rimL);

    const bump = makeBumpTexture();
    const mats = ARCS.map(
      (a) =>
        new THREE.MeshPhysicalMaterial({
          color: a.color,
          roughness: 0.32,
          metalness: 0.05,
          // relieve suave en la base; la laca de arriba queda lisa y brillante
          bumpMap: bump,
          bumpScale: 0.6,
          clearcoat: 1,
          clearcoatRoughness: 0.12,
          // brillo perlado: el tono cambia un poco según el ángulo
          iridescence: 0.35,
          iridescenceIOR: 1.4,
          iridescenceThicknessRange: [180, 420],
          sheen: 0.6,
          sheenRoughness: 0.4,
          sheenColor: new THREE.Color(0xffffff),
          emissive: new THREE.Color(a.color),
          emissiveIntensity: 0.06,
        }),
    );

    const symbol = new THREE.Group();
    const arcs = ARCS.map((a, i) => buildArc(a, mats[i], lite));
    arcs.forEach((g) => symbol.add(g));
    const rig = new THREE.Group(); // rig = mouse/scroll; symbol = idle
    rig.add(symbol);
    scene.add(rig);

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // en pantallas angostas (verticales) alejamos la cámara para que el símbolo
      // (~3.2 u de ancho) quepa a lo ancho y no se corte
      const fitWidth = 1.7 / (Math.tan(((camera.fov / 2) * Math.PI) / 180) * camera.aspect);
      camera.position.z = Math.max(10.9, fitWidth) / scale;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
    io.observe(host);

    const clock = new THREE.Clock();
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      const t = clock.getElapsedTime();
      const p = progress?.get() ?? 0;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;

      if (intro) {
        // 0→1 en ~1.5 s tras una pausa breve; los arcos llegan girando desde lados opuestos
        const k = Math.min(1, Math.max(0, (t - 0.25) / 1.5));
        const e = easeOutBack(k);
        arcs.forEach((g, i) => {
          const side = i === 0 ? 1 : -1;
          g.position.set(side * (1 - e) * 3.2, -side * (1 - e) * 1.2, (1 - e) * -2);
          g.rotation.z = side * (1 - e) * Math.PI * 0.9;
          g.scale.setScalar(0.6 + 0.4 * Math.min(1, e));
        });
      }
      if (spin) {
        symbol.rotation.y = Math.sin(t * 0.5) * 0.22;
        symbol.rotation.x = Math.sin(t * 0.37) * 0.12;
        symbol.position.y = Math.sin(t * 0.9) * 0.06;
      }
      // scroll: un giro completo + leve acercamiento y salida hacia arriba
      // scroll: gira de frente (eje z) con un balanceo leve en y — nunca de canto, para que no se deforme
      rig.rotation.z = -p * Math.PI;
      rig.rotation.y = Math.sin(p * Math.PI * 2) * 0.32 + mouse.x * 0.25;
      rig.rotation.x = mouse.y * 0.16;
      renderer.render(scene, camera);
    };

    if (reduced) {
      renderer.render(scene, camera);
      const rerender = () => renderer.render(scene, camera);
      ro.disconnect();
      const ro2 = new ResizeObserver(() => {
        resize();
        rerender();
      });
      ro2.observe(host);
      return () => {
        ro2.disconnect();
        io.disconnect();
        window.removeEventListener("pointermove", onMove);
        dispose();
      };
    }
    frame();

    function dispose() {
      cancelAnimationFrame(raf);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      envTex.dispose();
      bump.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }

    return () => {
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      dispose();
    };
  }, [progress, scale, spin, intro]);

  return <div ref={hostRef} className={className} style={style} aria-hidden />;
}
