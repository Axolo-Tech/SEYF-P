"use client";

/* SEYF — tubo de espuma del hero (three.js, sin assets externos).
   Un tubo grueso y mate serpentea por toda la pantalla detrás del nombre. El
   color recorre la marca: violeta → azul → turquesa → lima.
   Al cargar se "dibuja" de punta a punta; con el scroll (`progress` 0→1 del hero)
   la cola se recoge siguiendo la curva hasta desaparecer. El mouse lo inclina.
   Solo pinta cuando está en pantalla; con reduce-motion queda un cuadro fijo. */
import React, { useEffect, useRef } from "react";
import type { MotionValue } from "motion/react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { makeBumpTexture } from "./Symbol3D";

// curva en forma de "S" acostada: entra por arriba a la izquierda y sale abajo a la derecha
const PATH = [
  [-9, 2.7, -1], [-4, 3.1, 0], [1.5, 2.6, 0.4], [4.8, 1.2, 0], [4.2, -0.5, -0.6],
  [0.5, -0.5, -1.2], [-3.6, -0.3, -0.6], [-5.2, -1.7, 0], [-2.8, -3.0, 0.5], [2.2, -2.7, 0], [9, -3.3, -1],
] as const;
const RADIUS = 0.56;
// el color avanza por el círculo cromático de violeta (h≈0.72) a lima (h≈0.21) pasando por azul y turquesa
const H0 = 0.72;
const H1 = 0.21;
const colorAt = (u: number, c = new THREE.Color()) => c.setHSL(H0 + (H1 - H0) * u, 0.82, 0.5 - 0.05 * Math.sin(u * Math.PI));

const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export default function FoamTube({ progress, className }: { progress?: MotionValue<number>; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return;
    }
    const lite = window.matchMedia("(max-width: 880px), (pointer: coarse)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, lite ? 1.5 : 2));
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 0.85;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block";

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    // reflejo de estudio bajo: con mucho, la espuma se ve lavada
    scene.environmentIntensity = 0.5;

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-3, 5, 6);
    scene.add(key);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9a4ff, 0.5));

    const curve = new THREE.CatmullRomCurve3(PATH.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, "centripetal");
    const SEG = lite ? 260 : 420;
    const RAD = lite ? 28 : 44;
    const geo = new THREE.TubeGeometry(curve, SEG, RADIUS, RAD, false);
    // color por vértice según el avance a lo largo del tubo
    const colors = new Float32Array(geo.attributes.position.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i <= SEG; i++) {
      colorAt(i / SEG, c);
      for (let j = 0; j <= RAD; j++) c.toArray(colors, (i * (RAD + 1) + j) * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const idxPerSeg = RAD * 6; // TubeGeometry ordena los índices tramo por tramo

    const bump = makeBumpTexture();
    bump.repeat.set(90, 3);
    // espuma: mate, con relieve marcado y un brillo suave en el borde
    const foam = {
      roughness: 0.62,
      metalness: 0,
      bumpMap: bump,
      bumpScale: 1.1,
      clearcoat: 0.25,
      clearcoatRoughness: 0.5,
      sheen: 0.35,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color(0xffffff),
    };
    const mat = new THREE.MeshPhysicalMaterial({ ...foam, vertexColors: true });
    const tube = new THREE.Mesh(geo, mat);

    // tapas redondas que siguen la punta y la cola mientras el tubo se dibuja o se recoge
    const capGeo = new THREE.SphereGeometry(RADIUS, RAD, Math.round(RAD * 0.7));
    const headMat = new THREE.MeshPhysicalMaterial({ ...foam });
    const tailMat = new THREE.MeshPhysicalMaterial({ ...foam });
    const head = new THREE.Mesh(capGeo, headMat);
    const tail = new THREE.Mesh(capGeo, tailMat);

    const rig = new THREE.Group();
    rig.add(tube, head, tail);
    scene.add(rig);

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const tan = Math.tan(((camera.fov / 2) * Math.PI) / 180);
      const portrait = camera.aspect < 1;
      // horizontal: cabe el alto de la "S" (~6.6 u); vertical: se gira 90° y se ajusta al ancho
      rig.rotation.z = portrait ? Math.PI / 2 : 0;
      camera.position.z = portrait ? 3.6 / (tan * camera.aspect) : Math.max(3.9 / tan, 5.4 / (tan * camera.aspect));
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

    const place = (a: number, b: number) => {
      // a = cola, b = punta (0..1 a lo largo del tubo)
      const s0 = Math.floor(a * SEG);
      const s1 = Math.ceil(b * SEG);
      geo.setDrawRange(s0 * idxPerSeg, Math.max(0, s1 - s0) * idxPerSeg);
      const show = b - a > 0.002;
      head.visible = tail.visible = show;
      head.position.copy(curve.getPointAt(s1 / SEG));
      tail.position.copy(curve.getPointAt(s0 / SEG));
      colorAt(s1 / SEG, headMat.color);
      colorAt(s0 / SEG, tailMat.color);
    };

    const clock = new THREE.Clock();
    let raf = 0;
    let growStart = -1;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      const t = clock.getElapsedTime();
      const p = progress?.get() ?? 0;
      const retract = Math.min(1, Math.max(0, p / 0.3));
      if (retract >= 1) {
        place(1, 1);
        return; // ya se recogió: no gastar GPU mientras sigue el hero
      }
      // se dibuja hasta que se levanta la cortina de entrada (si la hay)
      if (growStart < 0 && !document.querySelector(".lp .intro")) growStart = t;
      const grow = growStart < 0 ? 0 : easeInOut(Math.min(1, Math.max(0, (t - growStart - 0.25) / 1.9)));
      place(easeInOut(retract), grow);
      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      rig.rotation.y = mouse.x * 0.12 + Math.sin(t * 0.3) * 0.04;
      rig.rotation.x = mouse.y * 0.08;
      rig.position.y = retract * 1.2;
      renderer.render(scene, camera);
    };

    function dispose() {
      cancelAnimationFrame(raf);
      geo.dispose();
      capGeo.dispose();
      mat.dispose();
      headMat.dispose();
      tailMat.dispose();
      bump.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }

    if (reduced) {
      place(0, 1);
      renderer.render(scene, camera);
      ro.disconnect();
      const ro2 = new ResizeObserver(() => {
        resize();
        renderer.render(scene, camera);
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

    return () => {
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      dispose();
    };
  }, [progress]);

  return <div ref={hostRef} className={className} aria-hidden />;
}
