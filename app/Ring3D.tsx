"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/* Jeden prsten — hladký zlatý band se žhnoucím nápisem v Černé řeči + zlatý prach */

const INSCRIPTION =
  "Ash nazg durbatulûk · ash nazg gimbatul · ash nazg thrakatulûk · agh burzum-ishi krimpatul · ";

function makeInscriptionTexture() {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.font = "italic 600 74px 'Cormorant Garamond', Georgia, serif";
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(INSCRIPTION, 8, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // UV torusu: u jde kolem trubice, v po obvodu — text otočíme po obvodu
  tex.center.set(0.5, 0.5);
  tex.rotation = Math.PI / 2;
  tex.anisotropy = 4;
  return tex;
}

function makeDustSprite() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,225,160,1)");
  g.addColorStop(0.4, "rgba(220,178,110,.55)");
  g.addColorStop(1, "rgba(220,178,110,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export default function Ring3D() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const size = Math.min(el.clientWidth || 260, 320);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    /* Na telefonu strop 1.5, ne 2. Prsten je vykreslený na 170 px, takže vyšší
       hustota nic nepřidá, ale plocha k vykreslení roste s druhou mocninou. */
    const uzke = window.matchMedia("(max-width: 700px)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, uzke ? 1.5 : 2));
    renderer.setSize(size, size);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.style.opacity = "0";
    renderer.domElement.style.transition = "opacity .6s ease";
    el.appendChild(renderer.domElement);
    requestAnimationFrame(() => (renderer.domElement.style.opacity = "1"));

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
    camera.position.set(0, 0, 3.4);

    // hladký band jako Jeden prsten
    const inscription = makeInscriptionTexture();
    const gold = new THREE.MeshStandardMaterial({
      color: 0xd8b26e,
      metalness: 1,
      roughness: 0.1,
      emissive: 0xff5a1a, // ohnivý žár nápisu
      emissiveMap: inscription,
      emissiveIntensity: 0.9,
    });
    /* 96 × 220 segmentů dělalo přes 42 tisíc trojúhelníků na kroužek velký
       170 px — telefon to vytížil tak, že klepnutí na prsten nemělo kdy projít
       a host se nedostal dovnitř. 40 × 96 je pod 8 tisíc a na téhle velikosti
       je hrana pořád hladká. */
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.2, 40, 96), gold);
    scene.add(ring);

    // zlatý poletující prach
    const N = 130;
    const pos = new Float32Array(N * 3);
    const speed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 5;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 3 - 0.5;
      speed[i] = 0.15 + Math.random() * 0.35;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        map: makeDustSprite(),
        size: 0.09,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    scene.add(dust);

    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      ring.rotation.y = t * 0.00055;
      ring.rotation.x = 0.5 + Math.sin(t * 0.0004) * 0.2;
      // žár nápisu dýchá
      gold.emissiveIntensity = 0.7 + Math.sin(t * 0.0016) * 0.45;
      // prach stoupá a vlní se
      const p = dustGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < N; i++) {
        p[i * 3 + 1] += speed[i] * dt;
        p[i * 3] += Math.sin(t * 0.0006 + i) * 0.0012;
        if (p[i * 3 + 1] > 2.6) p[i * 3 + 1] = -2.6;
      }
      dustGeo.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      pmrem.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={ref} className="loader-ring3d" />;
}
