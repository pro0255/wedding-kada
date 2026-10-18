"use client";

import { useEffect, useId, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import gsap from "gsap";
import { PRIBEH } from "../_spolecne/pribeh";
import { pripojOvladani, type Pripravenost } from "../_spolecne/plynulost";
import s from "./obalka3d.module.css";

/* V1 — three.js se skutečným 3D modelem obálky.

   MODEL: „Envelope“ od reyshapes, Poly Pizza — https://poly.pizza/m/M9mVmRXHif
   Licence CC0 1.0 (public domain), uvedení autora není povinné, ale uvádíme.
   Soubor: public/navrh/obalka/obalka-reyshapes-cc0.glb (7 kB, 86 trojúhelníků,
   vertex colors s „AO“ ve švech). Model má chlopeň trvale otevřenou a není
   rozdělený — při načtení ho rozřízneme podle osy pantu na tělo a chlopeň,
   chlopeň pověsíme na pivot v pantu a otáčíme jí.

   TEXTURA: ambientCG „Paper002“ (CC0) — https://ambientcg.com/view?id=Paper002,
   jako bump mapa (zrno papíru) na obálce i dopisu.
   PEČEŤ: public/obalka/vosk.webp (fotka z webu), rozdělená na dvě poloviny.
   ANIMACE: GSAP timeline (gsap.com, licence „GSAP Standard“, zdarma).

   Výkon: kreslí se jen během animace / naklánění (render on demand) a nikdy
   mimo okno (IntersectionObserver); pixel ratio ≤ 2, jedna stínová mapa
   1024². Shadery se zkompilují předem (compileAsync), textury nahrají při
   prvním snímku. Adaptivní kvalita: když je při první animaci medián snímku
   nad 20 ms, spadne pixel ratio na 1 a stínová mapa se přestane přepočítávat.
   Klik nesahá na React stav (stejné ovládání jako V2/V3, _spolecne/plynulost.ts). */

const W = 7.9; // šířka těla obálky po přeškálování (svět)
const H = 5.04;
const LW = W * 0.88; // dopis
const LH = H * 0.86; // výška jedné půlky přeloženého dopisu
// kolik světa ukazuje plátno (musí sedět s CSS: left -16 %, šířka 132 %, top -128.57 %, výška 261.9 %)
const SVET = { x0: -0.66 * W, x1: 0.66 * W, y0: -4.2, y1: 9.0 };

const MODRA = new THREE.Color("#c2d3e4");
const PAPIR = new THREE.Color("#fbf9f4");

function cssFont(promenna: string, zalozni: string) {
  const v = getComputedStyle(document.body).getPropertyValue(promenna).trim();
  return v ? `${v}, ${zalozni}` : zalozni;
}

/* Celý dopis (obě půlky pod sebou) do jednoho plátna.
   `velke` = telefon: dopis je tam úzký, písmo musí být relativně větší. */
async function texturaDopisu(px: number, velke: boolean) {
  const serif = cssFont("--serif", "Georgia, serif");
  const sans = cssFont("--sans", "system-ui, sans-serif");
  const ruka = cssFont("--rukopis", "cursive");
  await Promise.all([
    document.fonts.load(`500 40px ${serif}`, "Jak to"),
    document.fonts.load(`400 40px ${serif}`, "Pět"),
    document.fonts.load(`400 40px ${sans}`, "NÁŠ"),
    document.fonts.load(`400 40px ${ruka}`, "Káťa"),
  ]).catch(() => undefined);

  const c = document.createElement("canvas");
  c.width = px;
  c.height = Math.round((px * (2 * LH)) / LW);
  const g = c.getContext("2d")!;
  const k = px / 1000; // měřítko: návrh v 1000 px šířky
  g.fillStyle = "#fbf9f4";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#3f342b";
  g.textBaseline = "alphabetic";

  const okraj = (velke ? 80 : 92) * k;
  const pismo = (velke ? 50 : 40) * k; // základní písmo (návrh v 1000 px šířky)
  const krok = (velke ? 71 : 60) * k;
  const sirka = px - 2 * okraj;

  // 1) zalomit text do řádků
  g.font = `400 ${pismo}px ${serif}`;
  const radky: string[] = [];
  let radek = "";
  for (const slovo of PRIBEH.text.split(" ")) {
    const zkus = radek ? radek + " " + slovo : slovo;
    if (g.measureText(zkus).width > sirka && radek) {
      radky.push(radek);
      radek = slovo;
    } else radek = zkus;
  }
  radky.push(radek);

  // 2) celý blok svisle na střed listu (přehyb pak vede textem jako u skutečného dopisu)
  const vyskaBloku = 82 * k + 82 * k + (radky.length - 1) * krok + 110 * k;
  let y = (c.height - vyskaBloku) / 2;
  g.globalAlpha = 0.65;
  g.font = `400 ${26 * k}px ${sans}`;
  g.letterSpacing = `${6 * k}px`;
  g.fillText(PRIBEH.eyebrow.toUpperCase(), okraj, y);
  g.letterSpacing = "0px";
  g.globalAlpha = 1;
  y += 82 * k;
  g.font = `500 ${68 * k}px ${serif}`;
  g.fillText(PRIBEH.nadpis, okraj, y);
  y += 82 * k;
  g.font = `400 ${pismo}px ${serif}`;
  for (const r of radky) {
    g.fillText(r, okraj, y);
    y += krok;
  }
  y += 110 * k - krok;
  g.font = `400 ${58 * k}px ${ruka}`;
  g.fillStyle = "#8a6d3b";
  g.textAlign = "right";
  g.fillText(PRIBEH.podpis, px - okraj, y);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function texturaMonogramu() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = Math.round((512 * LH) / LW);
  const g = c.getContext("2d")!;
  g.fillStyle = "#f7f3ea";
  g.fillRect(0, 0, c.width, c.height);
  g.translate(c.width / 2, c.height / 2);
  g.rotate(Math.PI); // rub spodní půlky je po přeložení vzhůru nohama
  g.font = `italic 500 64px ${cssFont("--serif", "Georgia, serif")}`;
  g.fillStyle = "#a68a55";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("K & J", 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Rovinné UV podle světových x/y — model žádné UV nemá. */
function rovinneUV(geo: THREE.BufferGeometry, meritko: number) {
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) / meritko;
    uv[i * 2 + 1] = p.getY(i) / meritko;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

/* Rozřízne geometrii modelu na tělo a chlopeň podle pantu (y > pant). */
function rozriznout(geo: THREE.BufferGeometry, pantY: number) {
  const src = geo.index ? geo.toNonIndexed() : geo;
  const pos = src.attributes.position;
  const col = src.attributes.color;
  const telo: number[] = [], teloC: number[] = [], chl: number[] = [], chlC: number[] = [];
  for (let t = 0; t < pos.count; t += 3) {
    let cy = 0;
    for (let v = 0; v < 3; v++) cy += pos.getY(t + v) / 3;
    const [P, C] = cy > pantY + 0.02 ? [chl, chlC] : [telo, teloC];
    for (let v = 0; v < 3; v++) {
      P.push(pos.getX(t + v), pos.getY(t + v), pos.getZ(t + v));
      if (col) C.push(col.getX(t + v), col.getY(t + v), col.getZ(t + v));
    }
  }
  const udelej = (P: number[], C: number[]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    if (C.length) g.setAttribute("color", new THREE.Float32BufferAttribute(C, 3));
    g.computeVertexNormals();
    rovinneUV(g, 2.2);
    return g;
  };
  return { telo: udelej(telo, teloC), chlopen: udelej(chl, chlC) };
}

const POPIS = { zavreno: "Otevřít obálku s naším příběhem", otevreno: "Zavřít dopis" };
// plátno nemá CSS vrstvy na předehřívání — pojistky will-change tu nejsou potřeba
const BEZ_PRIPRAVY: Pripravenost = { zamer: () => {}, animace: () => {}, konec: () => {}, zrus: () => {} };

export default function Obalka3D() {
  const [pripraveno, setPripraveno] = useState(false);
  const rawId = useId();
  const idDopisu = "d" + rawId.replace(/[^a-zA-Z0-9]/g, "");
  const slotRef = useRef<HTMLDivElement>(null);
  const platnoRef = useRef<HTMLDivElement>(null);
  const tlacitkoRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = platnoRef.current, slot = slotRef.current, tlacitko = tlacitkoRef.current, text = textRef.current;
    if (!host || !slot || !tlacitko || !text) return;
    let zruseno = false;
    const uklid: (() => void)[] = [];

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    const uzke = window.matchMedia("(max-width: 700px)").matches;
    // ≤ 2: text dopisu je textura a na telefonu by při 1.5 byl rozmazaný;
    // kreslí se jen při animaci, takže větší plocha nevadí
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; // radius = měkký okraj
    host.appendChild(renderer.domElement);
    uklid.push(() => {
      renderer.dispose();
      renderer.domElement.remove();
    });

    const scena = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(28, 1, 1, 100);
    const stredY = (SVET.y0 + SVET.y1) / 2;
    const vyska = SVET.y1 - SVET.y0;
    const vzdalenost = vyska / 2 / Math.tan(THREE.MathUtils.degToRad(14));
    kamera.position.set(0, stredY, vzdalenost);
    kamera.lookAt(0, stredY, 0);

    scena.add(new THREE.HemisphereLight("#ffffff", "#e8e4dc", 2.1));
    const slunce = new THREE.DirectionalLight("#ffffff", 1.5);
    slunce.position.set(-6, 10, 14);
    slunce.target.position.set(0, 1, 0);
    slunce.castShadow = true;
    slunce.shadow.mapSize.set(1024, 1024);
    slunce.shadow.radius = 6;
    slunce.shadow.bias = -0.0005;
    Object.assign(slunce.shadow.camera, { left: -8, right: 8, top: 11, bottom: -6, near: 1, far: 40 });
    scena.add(slunce, slunce.target);

    // podložka jen pro stín (průhledná, stín padá na fotky pod plátnem)
    const podlozka = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.16 }));
    podlozka.position.z = -0.2;
    podlozka.receiveShadow = true;
    scena.add(podlozka);

    const svet = new THREE.Group(); // naklánění myší
    const obalka = new THREE.Group(); // +4° (ve three je kladné z proti směru hodin)
    obalka.rotation.z = THREE.MathUtils.degToRad(-4);
    svet.add(obalka);
    scena.add(svet);

    // nikdy nekreslit mimo okno; co se mezitím změnilo, dokreslí se po návratu
    let vidim = true;
    let dluh = false;
    const render = () => {
      if (!vidim) {
        dluh = true;
        return;
      }
      renderer.render(scena, kamera);
    };
    const io = new IntersectionObserver(([z]) => {
      vidim = z.isIntersecting;
      if (vidim && dluh) {
        dluh = false;
        renderer.render(scena, kamera);
      }
    });
    io.observe(host);
    uklid.push(() => io.disconnect());

    const velikost = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      kamera.aspect = w / h;
      // šířka světa je daná CSS (120 % slotu) — doladíme fov podle skutečné výšky
      kamera.updateProjectionMatrix();
      render();
    };
    const ro = new ResizeObserver(velikost);
    ro.observe(host);
    uklid.push(() => ro.disconnect());

    const nacitac = new THREE.TextureLoader();
    const zrno = nacitac.load("/navrh/obalka/papir.webp", render);
    zrno.wrapS = zrno.wrapT = THREE.RepeatWrapping;
    const vosk = nacitac.load("/obalka/vosk.webp", render);
    vosk.colorSpace = THREE.SRGBColorSpace;

    (async () => {
      const [gltf, textDopisu] = await Promise.all([
        new GLTFLoader().loadAsync("/navrh/obalka/obalka-reyshapes-cc0.glb"),
        texturaDopisu(uzke ? 1280 : 1536, uzke),
      ]);
      if (zruseno) return;

      // --- model: najít mesh, otočit do roviny XY (líc ke kameře), přeškálovat ---
      let zdroj: THREE.BufferGeometry | null = null;
      gltf.scene.traverse((o) => {
        if (!zdroj && (o as THREE.Mesh).isMesh) zdroj = (o as THREE.Mesh).geometry.clone();
      });
      if (!zdroj) return;
      const geo = zdroj as THREE.BufferGeometry;
      // model: X = výška (chlopeň k +X), Z = šířka, Y = tloušťka (kapsa k +Y)
      // svět:  Y = výška, X = šířka (×1.2 na poměr 1.57), Z = ke kameře (×0.35 — tenčí papír)
      const TL = 0.35;
      geo.applyMatrix4(new THREE.Matrix4().set(0, 0, 1.2, 0, 1, 0, 0, 0, 0, TL, 0, 0, 0, 0, 0, 1));
      const pantY = 2.51; // horní okraj těla v modelu (ověřeno rozborem vrcholů)
      const { telo, chlopen } = rozriznout(geo, pantY);
      telo.computeBoundingBox();
      const tb = telo.boundingBox!;
      const posun = -(tb.min.y + tb.max.y) / 2; // vycentrovat tělo na y = 0
      telo.translate(0, posun, 0);
      const horniHrana = pantY + posun;

      const papirObalky = (barva: THREE.Color) =>
        new THREE.MeshStandardMaterial({
          color: barva,
          vertexColors: true,
          roughness: 0.92,
          metalness: 0,
          bumpMap: zrno,
          bumpScale: 0.22,
          side: THREE.DoubleSide,
        });

      const teloMesh = new THREE.Mesh(telo, papirObalky(MODRA));
      teloMesh.castShadow = teloMesh.receiveShadow = true;
      obalka.add(teloMesh);

      // chlopeň: geometrii posuneme tak, aby pant byl v počátku pivotu
      // Pant leží nad nejvyšším bodem kapsy (cípy jsou v modelu vyvýšené),
      // jinak by jimi zavřená chlopeň prorůstala.
      const pantZ = 0.067 * TL;
      const PANT_NAD = 0.5 * TL;
      chlopen.translate(0, -pantY, -pantZ); // pant do počátku pivotu
      const pivot = new THREE.Group();
      pivot.position.set(0, horniHrana, PANT_NAD);
      const chlopenMesh = new THREE.Mesh(chlopen, papirObalky(MODRA.clone().offsetHSL(0, 0, 0.03)));
      chlopenMesh.castShadow = chlopenMesh.receiveShadow = true;
      pivot.add(chlopenMesh);
      obalka.add(pivot);
      // zavřená: přes kapsu, mírně skloněná na vyvýšené boční cípy
      const ZAVRENO = Math.PI - 0.06;
      const OTEVRENO = -0.12; // trochu zakloněná dozadu, ať dopis jde před ní
      pivot.rotation.x = ZAVRENO;

      // --- dopis: kořen v přehybu, horní půlka nahoru, spodní na pivotu ---
      const matPapir = (t?: THREE.Texture) =>
        new THREE.MeshStandardMaterial({ color: t ? 0xffffff : PAPIR, map: t ?? null, roughness: 0.95, bumpMap: zrno, bumpScale: 0.25 });
      const horniUV = new THREE.PlaneGeometry(LW, LH);
      const dolniUV = new THREE.PlaneGeometry(LW, LH);
      const preUV = (g: THREE.PlaneGeometry, v0: number) => {
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setY(i, v0 + uv.getY(i) * 0.5);
      };
      preUV(horniUV, 0.5);
      preUV(dolniUV, 0);
      const dopis = new THREE.Group();
      const horni = new THREE.Mesh(horniUV, matPapir(textDopisu));
      horni.position.y = LH / 2;
      horni.castShadow = horni.receiveShadow = true;
      const dolniPivot = new THREE.Group();
      dolniPivot.position.z = 0.004;
      const dolni = new THREE.Mesh(dolniUV, matPapir(textDopisu));
      dolni.position.y = -LH / 2;
      dolni.castShadow = dolni.receiveShadow = true;
      const rub = new THREE.Mesh(new THREE.PlaneGeometry(LW, LH), matPapir(texturaMonogramu()));
      rub.rotation.y = Math.PI;
      rub.position.set(0, -LH / 2, -0.001);
      dolniPivot.add(dolni, rub);
      dolniPivot.rotation.x = Math.PI; // přeloženo dopředu přes horní půlku
      dopis.add(horni, dolniPivot);
      const DOPIS_DOLE = -H / 2 + 0.12;
      dopis.position.set(0, DOPIS_DOLE, 0);
      obalka.add(dopis);

      // --- pečeť ze dvou půlek (UV půlky fotky vosku) ---
      const pecet = new THREE.Group();
      const VEL = 1.35;
      const pul = (strana: 0 | 1) => {
        const g = new THREE.PlaneGeometry(VEL / 2, VEL * 1.06);
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setX(i, strana * 0.5 + uv.getX(i) * 0.5);
        const m = new THREE.Mesh(
          g,
          new THREE.MeshStandardMaterial({ map: vosk, transparent: true, alphaTest: 0.02, roughness: 0.35, metalness: 0.35 }),
        );
        m.position.x = (strana ? 1 : -1) * (VEL / 4);
        m.castShadow = true;
        return m;
      };
      const pecetL = pul(0), pecetP = pul(1);
      pecet.add(pecetL, pecetP);
      // špička zavřené chlopně
      obalka.updateMatrixWorld(true);
      chlopen.computeBoundingBox();
      const delka = chlopen.boundingBox!.max.y - chlopen.boundingBox!.min.y;
      pecet.position.set(0, horniHrana - delka * Math.cos(Math.PI - ZAVRENO) + 0.35, PANT_NAD + delka * Math.sin(Math.PI - ZAVRENO) + 0.05);
      obalka.add(pecet);

      // --- snítka v rohu obálky: skutečné svatební květiny (výřezy s průhledností).
      // MeshBasicMaterial = přesné barvy fotky bez vlivu světel; stín ale vrhají
      // (alphaTest → stínová mapa respektuje průhlednost), takže leží NA obálce.
      const kvetina = (src: string, sirka: number, pomer: number, x: number, y: number, z: number, rot: number) => {
        const t = nacitac.load(src, render);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(sirka, sirka / pomer),
          new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.35, toneMapped: false }),
        );
        m.position.set(x, y, z);
        m.rotation.z = rot;
        m.castShadow = true;
        obalka.add(m);
      };
      kvetina("/kytky/07_hermanek.webp", 1.9, 442 / 560, 3.79, -2.18, 0.55, THREE.MathUtils.degToRad(-22));
      kvetina("/kytky/3_krasenka_modra.webp", 1.03, 443 / 448, 2.8, -2.6, 0.62, 0);

      // shadery předem (paralelně, mimo hlavní vlákno, kde to GPU umí)
      await renderer.compileAsync(scena, kamera).catch(() => undefined);
      if (zruseno) return;
      setPripraveno(true);
      render();

      // --- timeline ---
      const tl = gsap.timeline({ paused: true, onUpdate: render, onComplete: render, onReverseComplete: render });
      const mL = pecetL.material as THREE.MeshStandardMaterial;
      const mP = pecetP.material as THREE.MeshStandardMaterial;
      tl.to(pecetL.position, { x: -1.1, y: -0.9, z: 0.6, duration: 0.6, ease: "power2.out" }, 0)
        .to(pecetL.rotation, { z: 0.55, y: -0.6, duration: 0.6, ease: "power2.out" }, 0)
        .to(pecetP.position, { x: 1.0, y: -1.2, z: 0.5, duration: 0.6, ease: "power2.out" }, 0.03)
        .to(pecetP.rotation, { z: -0.45, y: 0.5, duration: 0.6, ease: "power2.out" }, 0.03)
        .to([mL, mP], { opacity: 0, duration: 0.3 }, 0.28)
        .to(pivot.rotation, { x: OTEVRENO, duration: 0.85, ease: "power2.inOut" }, 0.25)
        // pant sjede z „nad kapsou“ k zadní stěně, ať je otevřená chlopeň celá za dopisem
        .to(pivot.position, { z: -0.03, duration: 0.85, ease: "power2.inOut" }, 0.25)
        .to(dopis.position, { y: H / 2 + 0.25, duration: 0.7, ease: "power3.out" }, 1.0)
        .to(dopis.position, { z: 0.9, y: 4.25, duration: 0.75, ease: "back.out(1.4)" }, 1.62)
        .to(dopis.rotation, { z: THREE.MathUtils.degToRad(4), duration: 0.75, ease: "power2.out" }, 1.62)
        .to(dopis.scale, { x: 1.03, y: 1.03, duration: 0.75, ease: "power2.out" }, 1.62)
        .to(dolniPivot.rotation, { x: 0, duration: 0.9, ease: "power3.out" }, 1.95);
      // předehřátí: tweeny si načtou výchozí hodnoty a GPU jednou vykreslí i
      // otevřený stav (stíny dopisu nad obálkou) — obojí v jedné úloze, na
      // plátně zůstane jen poslední, tedy zavřený snímek
      tl.progress(1).progress(0);

      // naklánění (jen myš, zavřená obálka)
      const qx = gsap.quickTo(svet.rotation, "y", { duration: 0.6, ease: "power3.out", onUpdate: render });
      const qy = gsap.quickTo(svet.rotation, "x", { duration: 0.6, ease: "power3.out", onUpdate: render });

      // adaptivní kvalita: první sekunda animace rozhodne, jestli to GPU zvládá
      let snizeno = false;
      let merim = false;
      const hlidejKvalitu = () => {
        if (snizeno || merim) return;
        merim = true;
        const snimky: number[] = [];
        let minule = 0;
        const zacatek = performance.now();
        const krok = (t: number) => {
          if (minule) snimky.push(t - minule);
          minule = t;
          if (t - zacatek < 1000) return void requestAnimationFrame(krok);
          merim = false;
          snimky.sort((a, b) => a - b);
          const median = snimky[Math.floor(snimky.length / 2)] ?? 0;
          if (median > 20) {
            snizeno = true;
            renderer.setPixelRatio(1);
            renderer.shadowMap.autoUpdate = false; // stín zůstane z posledního přepočtu
            renderer.shadowMap.needsUpdate = true;
            velikost();
          }
        };
        requestAnimationFrame(krok);
      };

      const zrusOvladani = pripojOvladani({
        koren: slot,
        tlacitko,
        dopis: text,
        popis: POPIS,
        pripravenost: BEZ_PRIPRAVY,
        spust: (otevrit) => {
          qx(0);
          qy(0);
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            tl.pause().progress(otevrit ? 1 : 0);
            render();
            return;
          }
          hlidejKvalitu();
          if (otevrit) tl.timeScale(1).play();
          else tl.timeScale(1.6).reverse();
        },
      });
      // klepnutí do otevřeného dopisu (na plátně) ho zavře
      const naPlatno = () => {
        if (slot.dataset.otevreno === "true") tlacitko.click();
      };
      const pohyb = (e: PointerEvent) => {
        if (slot.dataset.otevreno === "true" || e.pointerType !== "mouse") return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const r = tlacitko.getBoundingClientRect();
        qx(((e.clientX - r.left) / r.width - 0.5) * 0.25);
        qy(((e.clientY - r.top) / r.height - 0.5) * 0.2);
      };
      const pryc = () => {
        qx(0);
        qy(0);
      };
      host.addEventListener("click", naPlatno);
      tlacitko.addEventListener("pointermove", pohyb);
      tlacitko.addEventListener("pointerleave", pryc);
      uklid.push(() => {
        zrusOvladani();
        host.removeEventListener("click", naPlatno);
        tlacitko.removeEventListener("pointermove", pohyb);
        tlacitko.removeEventListener("pointerleave", pryc);
        tl.kill();
      });
    })();

    return () => {
      zruseno = true;
      uklid.forEach((f) => f());
    };
  }, []);

  return (
    <div ref={slotRef} className={s.slot} data-otevreno="false" data-pripraveno={pripraveno}>
      <div ref={platnoRef} className={s.platno} aria-hidden="true" />
      {/* text dopisu pro čtečky (na plátně je jen obrázek) */}
      <div ref={textRef} id={idDopisu} className={s.srOnly} aria-hidden="true" inert>
        <p>{PRIBEH.eyebrow}</p>
        <h2>{PRIBEH.nadpis}</h2>
        <p>{PRIBEH.text}</p>
        <p>{PRIBEH.podpis}</p>
      </div>
      <button
        ref={tlacitkoRef}
        type="button"
        className={s.tlacitko}
        aria-expanded="false"
        aria-controls={idDopisu}
        aria-label={POPIS.zavreno}
      />
    </div>
  );
}
