"use client";

/* SEYF — objetos 3D de la app (three.js, sin assets externos), con el mismo
   material del símbolo: laca perlada sobre relieve tipo espuma.
     - "coin":  moneda perla con el símbolo SEYF en relieve (ahorro, saldo).
     - "vault": bóveda violeta con perilla lima que gira al aparecer (bóvedas).
     - "bolt":  moneda lima con el rayo en relieve (adelanto).
   Entran con un rebote, flotan y se giran arrastrando el dedo de lado (el
   scroll vertical sigue libre). Solo pintan en pantalla y con la pestaña
   visible; con reduce-motion dejan un cuadro fijo. Sin WebGL no pintan nada. */
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { ARCS, LIME, VIOLET, buildArc, makeBumpTexture } from "./Symbol3D";

export type Brand3DKind = "coin" | "vault" | "bolt";

const PEARL = 0xefecf8;
const INK = 0x16112b;

function lacquer(color: number, bump: THREE.Texture, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.3,
    metalness: 0.05,
    bumpMap: bump,
    bumpScale: 0.45,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    iridescence: 0.3,
    iridescenceIOR: 1.4,
    iridescenceThicknessRange: [180, 420],
    sheen: 0.5,
    sheenRoughness: 0.4,
    sheenColor: new THREE.Color(0xffffff),
    ...extra,
  });
}

/** Moneda con canto biselado, eje hacia la cámara. Radio 1, grosor 0.24. */
function coinBody(mat: THREE.Material, lite: boolean) {
  const h = 0.12;
  const pts = [
    [0, -h], [0.9, -h], [0.97, -h + 0.02], [1, -h + 0.06],
    [1, h - 0.06], [0.97, h - 0.02], [0.9, h], [0, h],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.LatheGeometry(pts, lite ? 64 : 112);
  body.rotateX(Math.PI / 2);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(body, mat));
  // aro en relieve en ambas caras
  const rim = new THREE.TorusGeometry(0.86, 0.035, 16, lite ? 64 : 112);
  for (const z of [h, -h]) {
    const m = new THREE.Mesh(rim, mat);
    m.position.z = z;
    g.add(m);
  }
  return { group: g, face: h };
}

function buildCoin(bump: THREE.Texture, lite: boolean) {
  const { group, face } = coinBody(lacquer(PEARL, bump), lite);
  // el símbolo SEYF en relieve, al frente y atrás
  const s = 0.46;
  for (const side of [1, -1]) {
    const emblem = new THREE.Group();
    ARCS.forEach((a) => emblem.add(buildArc(a, lacquer(a.color, bump, { emissive: new THREE.Color(a.color), emissiveIntensity: 0.06 }), true)));
    emblem.scale.setScalar(s);
    emblem.position.z = side * face;
    if (side < 0) emblem.rotation.y = Math.PI;
    group.add(emblem);
  }
  return { root: group, fit: 1.05 };
}

function buildBolt(bump: THREE.Texture, lite: boolean) {
  const { group, face } = coinBody(lacquer(0xc2f53a, bump, { emissive: new THREE.Color(0x9fd420), emissiveIntensity: 0.08, iridescence: 0.1, sheen: 0.15 }), lite);
  const shape = new THREE.Shape();
  const P: [number, number][] = [[0.1, 0.62], [-0.42, -0.05], [-0.05, -0.05], [-0.15, -0.62], [0.42, 0.08], [0.05, 0.08]];
  shape.moveTo(P[0][0], P[0][1]);
  P.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 4 });
  geo.scale(0.95, 0.95, 1);
  const ink = lacquer(INK, bump, { bumpScale: 0.2, iridescence: 0.15 });
  for (const side of [1, -1]) {
    const m = new THREE.Mesh(geo, ink);
    m.position.z = side * (face - 0.01);
    if (side < 0) m.rotation.y = Math.PI;
    group.add(m);
  }
  return { root: group, fit: 1.05 };
}

function buildVault(bump: THREE.Texture, lite: boolean) {
  const g = new THREE.Group();
  const violet = lacquer(VIOLET, bump, { emissive: new THREE.Color(VIOLET), emissiveIntensity: 0.05 });
  const lime = lacquer(LIME, bump, { emissive: new THREE.Color(LIME), emissiveIntensity: 0.05 });
  const ink = lacquer(INK, bump, { bumpScale: 0.2, iridescence: 0.15 });
  const D = 1.3;
  g.add(new THREE.Mesh(new RoundedBoxGeometry(2, 2, D, lite ? 4 : 6, 0.32), violet));
  // puerta: placa redonda con perilla de tres brazos
  const plate = new THREE.CylinderGeometry(0.66, 0.66, 0.1, lite ? 48 : 80);
  plate.rotateX(Math.PI / 2);
  const door = new THREE.Mesh(plate, lime);
  door.position.z = D / 2 + 0.03;
  g.add(door);
  const dial = new THREE.Group();
  const spoke = new THREE.CapsuleGeometry(0.05, 0.78, 6, 12);
  for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
    const m = new THREE.Mesh(spoke, ink);
    m.rotation.z = a;
    dial.add(m);
  }
  dial.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), ink));
  dial.position.z = D / 2 + 0.14;
  g.add(dial);
  // bisagras y patas
  const hinge = new THREE.CapsuleGeometry(0.07, 0.24, 6, 12);
  for (const y of [0.55, -0.55]) {
    const m = new THREE.Mesh(hinge, ink);
    m.position.set(-1.0, y, D / 2 - 0.12);
    g.add(m);
  }
  const foot = new RoundedBoxGeometry(0.34, 0.16, 0.5, 3, 0.07);
  for (const x of [-0.62, 0.62]) {
    const m = new THREE.Mesh(foot, ink);
    m.position.set(x, -1.06, 0);
    g.add(m);
  }
  return { root: g, fit: 1.55, dial };
}

const easeOutBack = (x: number) => 1 + 2.5 * Math.pow(x - 1, 3) + 1.5 * Math.pow(x - 1, 2);

export default function Brand3D({
  kind,
  className,
  style,
  float = true,
}: {
  kind: Brand3DKind;
  className?: string;
  style?: React.CSSProperties;
  /** Flotar y balancearse solo (además del giro con el dedo). */
  float?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lite = window.matchMedia("(max-width: 880px), (pointer: coarse)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, lite ? 1.75 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rimV = new THREE.PointLight(VIOLET, 16, 12);
    rimV.position.set(-3, -1.5, -1.5);
    scene.add(rimV);
    const rimL = new THREE.PointLight(LIME, 9, 12);
    rimL.position.set(3, 2, -1);
    scene.add(rimL);

    const bump = makeBumpTexture();
    const built = kind === "vault" ? buildVault(bump, lite) : kind === "bolt" ? buildBolt(bump, lite) : buildCoin(bump, lite);
    const dial: THREE.Group | null = "dial" in built ? (built.dial as THREE.Group) : null;
    const idle = new THREE.Group(); // flotar
    const rig = new THREE.Group(); // dedo + entrada
    idle.add(built.root);
    rig.add(idle);
    scene.add(rig);
    // pose de reposo: un poco de tres cuartos para que se lea el volumen
    built.root.rotation.set(kind === "vault" ? -0.16 : -0.28, kind === "vault" ? -0.5 : -0.62, kind === "vault" ? 0 : 0.08);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const half = Math.tan(((camera.fov / 2) * Math.PI) / 180);
      // cabe a lo alto y a lo ancho, con aire para el rebote
      camera.position.z = (built.fit * 1.12) / (half * Math.min(1, camera.aspect));
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) renderer.render(scene, camera);
    });
    ro.observe(host);

    // girar con el dedo: solo el arrastre horizontal (touch-action: pan-y deja el scroll)
    const drag = { on: false, x: 0, vel: 0, rot: 0, moved: 0 };
    const onDown = (e: PointerEvent) => {
      drag.on = true;
      drag.x = e.clientX;
      drag.vel = 0;
      drag.moved = 0;
      host.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag.on) return;
      const dx = e.clientX - drag.x;
      drag.x = e.clientX;
      drag.moved += Math.abs(dx);
      drag.vel = dx * 0.012;
      drag.rot += drag.vel;
    };
    // si el objeto está dentro de un botón, girarlo no debe contar como toque
    const swallowClick = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
    };
    const onUp = () => {
      drag.on = false;
      if (drag.moved > 6) {
        host.addEventListener("click", swallowClick, { capture: true, once: true });
        setTimeout(() => host.removeEventListener("click", swallowClick, { capture: true }), 0);
      }
    };
    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerup", onUp);
    host.addEventListener("pointercancel", onUp);

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
    io.observe(host);

    const clock = new THREE.Clock();
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      const t = clock.getElapsedTime();
      // entrada: crece con rebote y da una vuelta
      const k = Math.min(1, t / 0.9);
      rig.scale.setScalar(Math.max(0.001, easeOutBack(k)));
      const introSpin = (1 - easeOutBack(Math.min(1, t / 1.1))) * Math.PI * 1.2;
      // inercia del dedo: frena poco a poco y regresa suave a su pose
      if (!drag.on) {
        drag.rot += drag.vel;
        drag.vel *= 0.94;
        if (Math.abs(drag.vel) < 0.002) drag.rot *= 0.96;
      }
      rig.rotation.y = drag.rot + introSpin;
      if (float) {
        idle.position.y = Math.sin(t * 1.3) * 0.06;
        idle.rotation.y = Math.sin(t * 0.6) * 0.18;
        idle.rotation.x = Math.sin(t * 0.45) * 0.06;
      }
      // la perilla de la bóveda gira al abrir y luego se mece
      if (dial) dial.rotation.z = (1 - Math.min(1, t / 1.4)) * Math.PI * 2 + Math.sin(t * 0.8) * 0.15;
      renderer.render(scene, camera);
    };

    if (reduced) {
      rig.scale.setScalar(1);
      renderer.render(scene, camera);
    } else {
      frame();
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerup", onUp);
      host.removeEventListener("pointercancel", onUp);
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
    };
  }, [kind, float]);

  return <div ref={hostRef} className={className} style={{ touchAction: "pan-y", ...style }} aria-hidden />;
}
