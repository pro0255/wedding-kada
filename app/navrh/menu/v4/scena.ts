import gsap from "gsap";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { KVETINY } from "./kvetiny";
import { kresliObalku, kresliOrizku, kresliSkvrnu, kresliStinKvetu, kresliStranu, nactiPisma } from "./textury";

/* 3D kniha menu — three.js bez frameworku, stejně jako prsten v úvodu
   (Ring3D.tsx): RoomEnvironment přes PMREM dává zlatu co odrážet, takže
   ražba na deskách je ze stejné rodiny jako prsten.

   Kniha je poskládaná z jednoduchých těles (žádný stažený model):
   - zadní deska a přední deska: kvádry se zaoblenými hranami,
   - blok listů: kvádr, nahoře dětské menu, z boků ořízka z proužků,
   - hřbet: půlválec; jeho osa je zároveň osa pantu.
   Přední deska se otáčí kolem osy hřbetu (ve výšce půl knihy), takže po
   otevření dopadne na stůl — jako u opravdové knihy, ne do výšky bloku.

   Text stran je nakreslený do <canvas> (textury.ts) v rozlišení obrazovky,
   s mipmapami a anizotropním filtrováním, aby byl ostrý i v náklonu.

   Animace drží GSAP (časová osa jde kdykoli obrátit) a vykresluje se v jeho
   tickeru, tedy ve stejném snímku, kdy se spočítají hodnoty. Když je scéna
   mimo obrazovku, nekreslí se vůbec. */

export type Volby = { klid: boolean; signal: AbortSignal };
export type Scena = {
  otevri: (ano: boolean) => void;
  predehra: () => void;
  strana: (i: number) => void;
  viditelnost: (ano: boolean) => void;
  dispose: () => void;
};

const TELEFON = "(max-width: 720px)";
const FOV = 28;

// rozměry knihy, jednotka = šířka desky
const W = 1;
const H = 1.42;
const T = 0.022; // tloušťka desky
const S = 0.045; // tloušťka bloku listů
const R = T + S / 2; // poloměr hřbetu = výška osy pantu nad stolem
const O = 0.016; // o kolik desky přesahují blok
const ZAOBLENI = 0.007;
const POMER_STRANY = (H - 2 * O) / (W - O);
const POMER_LICE = (H - 2.2 * ZAOBLENI) / (W - 2.2 * ZAOBLENI);

type Pohled = { x: number; y: number; z: number; d: number; el: number };

const rad = THREE.MathUtils.degToRad;
const smooth = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Prolnutí dvou pohledů do `cil` — bez nových objektů v každém snímku,
    ať se během animace nehromadí smetí pro garbage collector. */
const mezi = (a: Pohled, b: Pohled, t: number, cil: Pohled): Pohled => {
  cil.x = a.x + (b.x - a.x) * t;
  cil.y = a.y + (b.y - a.y) * t;
  cil.z = a.z + (b.z - a.z) * t;
  cil.d = a.d + (b.d - a.d) * t;
  cil.el = a.el + (b.el - a.el) * t;
  return cil;
};

export async function vytvorScenu(kontejner: HTMLElement, volby: Volby): Promise<Scena> {
  const { signal } = volby;
  const zrusit = () => {
    if (signal.aborted) {
      dispose();
      throw new DOMException("Scéna zrušena", "AbortError");
    }
  };

  /* ---------- renderer, světlo, okolí ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // Neutral (Khronos PBR Neutral) drží barvu papíru i květin, ACES by je zašpinil.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x000000, 0);
  const platno = renderer.domElement;
  platno.setAttribute("aria-hidden", "true");
  platno.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity .8s ease";

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const okoli = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = okoli;
  scene.environmentIntensity = 0.62;

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.3, 30);

  const telefonNaZacatku = matchMedia(TELEFON).matches;
  const slunce = new THREE.DirectionalLight("#fffaf0", 1.1);
  slunce.position.set(-1.7, 3.4, 1.4);
  slunce.castShadow = true;
  const rozliseniStinu = telefonNaZacatku ? 1024 : 2048;
  slunce.shadow.mapSize.set(rozliseniStinu, rozliseniStinu);
  const sc = slunce.shadow.camera;
  sc.left = -2.1;
  sc.right = 2.1;
  sc.top = 1.8;
  sc.bottom = -1.8;
  sc.near = 0.5;
  sc.far = 9;
  slunce.shadow.bias = -0.0005;
  slunce.shadow.normalBias = 0.01;
  slunce.shadow.radius = 7;
  scene.add(slunce, slunce.target);

  const textury: THREE.Texture[] = [];
  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), telefonNaZacatku ? 8 : 16);
  const textura = (cv: HTMLCanvasElement, barevna = true) => {
    const t = new THREE.CanvasTexture(cv);
    if (barevna) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    textury.push(t);
    return t;
  };

  // Květiny se začnou stahovat hned, souběžně s písmy a kreslením stran.
  const nacitac = new THREE.TextureLoader();
  const kvetinyNacteni = Promise.all(
    KVETINY.map((k) => nacitac.loadAsync(`/kytky/${encodeURIComponent(k.soubor)}`).catch(() => null)),
  );

  /* ---------- stav, smyčka, úklid (definované dřív než první await) ---------- */
  const st = { uhel: 0, zdvih: 0, kamera: 0, strana: 0 };
  // Náklon za kurzorem: x/y cíl, cx/cy vyhlazená hodnota, sila = jak moc se
  // kniha vznáší (1 když je nad ní myš, jinak se pomalu usadí na stůl).
  const kurzor = { x: 0, y: 0, cx: 0, cy: 0, sila: 0, nad: false };
  let cas = 0;
  let viditelne = true;
  let bezi = false;
  let zniceno = false;
  let tl: gsap.core.Timeline | null = null;
  let tlStrany: gsap.core.Tween | null = null;
  let cilOtevreno = false;
  let ro: ResizeObserver | undefined;
  let vykresli = () => {};

  // Podle průběhu, ne isActive(): čerstvě založená osa je „neaktivní“, dokud
  // ji GSAP poprvé nevykreslí — a smyčka by se pak vůbec nerozběhla.
  const bezi1 = (a: gsap.core.Animation | null) => !!a && (a.reversed() ? a.progress() > 0 : a.progress() < 1);
  // Předehra: smyčka se rozběhne už při stisku prstu, ne až při puštění.
  // Probuzení kreslení z klidu tak proběhne dřív, než se deska pohne.
  let predehraDo = 0;
  const animuje = () => bezi1(tl) || bezi1(tlStrany) || performance.now() < predehraDo;
  const usazeno = () =>
    !kurzor.nad && Math.abs(kurzor.cx) < 0.002 && Math.abs(kurzor.cy) < 0.002 && kurzor.sila < 0.004;

  /* Kreslí se jen tehdy, když se něco hýbe: běží časová osa, nebo se kniha
     naklání za myší či se po ní teprve usazuje. Jinak GPU i baterie spí. */
  function snimek(_t: number, dtMs: number) {
    const dt = Math.min(dtMs / 1000, 0.05);
    cas += dt;
    if (!volby.klid) {
      const k = 1 - Math.exp(-dt * 3);
      kurzor.cx += ((kurzor.nad ? kurzor.x : 0) - kurzor.cx) * k;
      kurzor.cy += ((kurzor.nad ? kurzor.y : 0) - kurzor.cy) * k;
      kurzor.sila += ((kurzor.nad ? 1 : 0) - kurzor.sila) * k;
    }
    vykresli();
    if (!animuje() && usazeno()) smycka();
  }

  function smycka() {
    const chci = !zniceno && viditelne && (animuje() || (!volby.klid && !usazeno()));
    if (chci && !bezi) {
      gsap.ticker.add(snimek);
      bezi = true;
    } else if (!chci && bezi) {
      gsap.ticker.remove(snimek);
      bezi = false;
    }
  }

  // Jen myš: na dotykovém displeji kniha leží v klidu a hýbe se jen při otevírání.
  const naPohyb = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const r = kontejner.getBoundingClientRect();
    kurzor.x = THREE.MathUtils.clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
    kurzor.y = THREE.MathUtils.clamp(((e.clientY - r.top) / r.height - 0.5) * 2, -1, 1);
    if (!kurzor.nad) {
      kurzor.nad = true;
      smycka();
    }
  };
  const naOdchod = () => {
    kurzor.nad = false;
    smycka();
  };

  function dispose() {
    zniceno = true;
    tl?.kill();
    tlStrany?.kill();
    gsap.ticker.remove(snimek);
    kontejner.removeEventListener("pointermove", naPohyb);
    kontejner.removeEventListener("pointerleave", naOdchod);
    ro?.disconnect();
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
    });
    textury.forEach((t) => t.dispose());
    okoli.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    platno.remove();
  }

  /* ---------- kamera ---------- */
  let telefon = telefonNaZacatku;
  let pZavreno: Pohled = { x: 0, y: 0, z: 0, d: 4, el: 1 };
  let pOtevreno = pZavreno;
  let pLeva = pZavreno;
  let pPrava = pZavreno;

  function zaramuj(x: number, y: number, z: number, sirka: number, hloubka: number, el: number, aspect: number): Pohled {
    const tan = Math.tan(rad(FOV) / 2);
    const vyska = hloubka * Math.sin(el) + 0.12 * Math.cos(el);
    const d = Math.max(vyska / (2 * tan), sirka / (2 * tan * aspect));
    return { x, y, z, d, el };
  }

  function spocitejPohledy(aspect: number) {
    telefon = matchMedia(TELEFON).matches;
    if (telefon) {
      pZavreno = zaramuj(0.5, 0.04, 0.03, 1.34, 1.66, rad(62), aspect);
      // Střed záběru o kus blíž k divákovi: strana se posune nahoru a dole
      // zbude místo pro přepínač Menu / Pro děti.
      pLeva = zaramuj(-0.49, 0.02, 0.08, 1.12, 1.6, rad(80), aspect);
      pPrava = zaramuj(0.49, 0.06, 0.08, 1.12, 1.6, rad(80), aspect);
      pOtevreno = pLeva;
    } else {
      pZavreno = zaramuj(0.5, 0.04, 0.05, 2.6, 2.3, rad(58), aspect);
      pOtevreno = zaramuj(-0.02, 0.03, 0.02, 2.6, 1.9, rad(77), aspect);
    }
  }

  const pomocny1: Pohled = { x: 0, y: 0, z: 0, d: 0, el: 0 };
  const pomocny2: Pohled = { x: 0, y: 0, z: 0, d: 0, el: 0 };
  function nastavKameru() {
    const otevreno = telefon ? mezi(pLeva, pPrava, st.strana, pomocny1) : pOtevreno;
    const p = mezi(pZavreno, otevreno, st.kamera, pomocny2);
    camera.position.set(p.x, p.y + p.d * Math.sin(p.el), p.z + p.d * Math.cos(p.el));
    camera.lookAt(p.x, p.y, p.z);
  }

  function rozmer() {
    const w = Math.max(1, kontejner.clientWidth);
    const h = Math.max(1, kontejner.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    spocitejPohledy(w / h);
  }

  /** Kolik pixelů zařízení bude mít strana na šířku, až bude kniha otevřená.
      Textura stran se kreslí přesně v tomhle rozlišení (+10 %): menší by se
      roztahovala, větší by se zmenšovala přes mipmapy a tenké tahy písma by
      zešedly. */
  function potrebnaSirkaStrany() {
    const p = telefon ? pPrava : pOtevreno;
    camera.position.set(p.x, p.y + p.d * Math.sin(p.el), p.z + p.d * Math.cos(p.el));
    camera.lookAt(p.x, p.y, p.z);
    camera.updateMatrixWorld();
    const y = 2 * R - T;
    const a = new THREE.Vector3(0, y, 0).project(camera);
    const b = new THREE.Vector3(W - O, y, 0).project(camera);
    const px = (Math.abs(b.x - a.x) / 2) * kontejner.clientWidth * renderer.getPixelRatio();
    return THREE.MathUtils.clamp(Math.round(px * 1.1), 512, 2048);
  }

  /* ---------- textury stran a desek ---------- */
  const pisma = await nactiPisma();
  zrusit();
  rozmer();
  let sirkaStrany = potrebnaSirkaStrany();
  const texDeti = textura(kresliStranu("deti", pisma, sirkaStrany, POMER_STRANY));
  await new Promise(requestAnimationFrame);
  const texDospeli = textura(kresliStranu("dospeli", pisma, sirkaStrany, POMER_STRANY));
  await new Promise(requestAnimationFrame);
  const lice = kresliObalku(pisma, sirkaStrany, POMER_LICE);
  const texLic = textura(lice.barva);
  const texOrm = textura(lice.orm, false);
  const texRelief = textura(lice.relief, false);
  const texOrizka = textura(kresliOrizku());
  const texSkvrna = textura(kresliSkvrnu());
  zrusit();

  /* ---------- materiály ---------- */
  const papirDesky = new THREE.MeshStandardMaterial({ color: "#f3ede3", roughness: 0.8 });
  const orizka = new THREE.MeshStandardMaterial({ map: texOrizka, roughness: 0.95 });
  const deti = new THREE.MeshStandardMaterial({ map: texDeti, roughness: 0.92 });
  const dospeli = new THREE.MeshStandardMaterial({ map: texDospeli, roughness: 0.92 });
  // Líc: papír s lehkým lakem (přes desku přejede široký odlesk) a ražba
  // jako opravdový kov — zlato z prstenu (0xd8b26e), jen matnější.
  const lic = new THREE.MeshPhysicalMaterial({
    map: texLic,
    roughnessMap: texOrm,
    metalnessMap: texOrm,
    roughness: 1,
    metalness: 1,
    bumpMap: texRelief,
    bumpScale: 1.6,
    clearcoat: 0.22,
    clearcoatRoughness: 0.5,
  });

  /* ---------- kniha ---------- */
  // vznos: náklon za kurzorem; otáčí se kolem středu zavřené knihy
  const vznos = new THREE.Group();
  vznos.position.set(W / 2, 0, 0);
  const kniha = new THREE.Group();
  kniha.position.set(-W / 2, 0, 0);
  vznos.add(kniha);
  scene.add(vznos);

  const stin = (m: THREE.Mesh, vrha = true) => {
    m.castShadow = vrha;
    m.receiveShadow = true;
    return m;
  };

  const zadni = stin(new THREE.Mesh(new RoundedBoxGeometry(W, T, H, 2, ZAOBLENI), papirDesky));
  zadni.position.set(W / 2, T / 2, 0);

  // Skupiny BoxGeometry: +x ořízka, −x u hřbetu, +y horní strana, −y spodek, +z, −z.
  const blok = stin(
    new THREE.Mesh(new THREE.BoxGeometry(W - O, S, H - 2 * O), [orizka, orizka, deti, orizka, orizka, orizka]),
  );
  blok.position.set((W - O) / 2, T + S / 2, 0);

  const hrbetGeo = new THREE.CylinderGeometry(R, R, H, 40, 1, false, Math.PI, Math.PI);
  hrbetGeo.rotateX(Math.PI / 2);
  const hrbet = stin(new THREE.Mesh(hrbetGeo, papirDesky));
  hrbet.position.set(0, R, 0);

  // Pant: osa hřbetu. Deska se kolem ní otočí o 180° a dopadne na stůl.
  const pant = new THREE.Group();
  pant.position.set(0, R, 0);
  const deska = stin(new THREE.Mesh(new RoundedBoxGeometry(W, T, H, 2, ZAOBLENI), papirDesky));
  deska.position.set(W / 2, R - T / 2, 0);
  const licGeo = new THREE.PlaneGeometry(W - 2.2 * ZAOBLENI, H - 2.2 * ZAOBLENI);
  licGeo.rotateX(-Math.PI / 2);
  const licMesh = stin(new THREE.Mesh(licGeo, lic), false);
  licMesh.position.set(W / 2, R + 0.0004, 0);
  // Rub desky = levá strana menu. Otočená tak, aby se po odklopení četla rovně.
  const rubGeo = new THREE.PlaneGeometry(W - O, H - 2 * O);
  rubGeo.rotateX(Math.PI / 2);
  rubGeo.rotateY(Math.PI);
  const rub = stin(new THREE.Mesh(rubGeo, dospeli), false);
  rub.position.set((W - O) / 2, R - T - 0.0004, 0);
  pant.add(deska, licMesh, rub);

  kniha.add(zadni, blok, hrbet, pant);

  /* ---------- stůl: stíny ---------- */
  // Měkká skvrna pod knihou (kontaktní stín) — rozmazaný obdélník.
  const skvrnaGeo = new THREE.PlaneGeometry((W + 0.03) / 0.6875, (H + 0.03) / 0.6875);
  skvrnaGeo.rotateX(-Math.PI / 2);
  const skvrnaMat = (opacity: number) =>
    new THREE.MeshBasicMaterial({ map: texSkvrna, transparent: true, opacity, depthWrite: false, toneMapped: false });
  const skvrnaKnihy = new THREE.Mesh(skvrnaGeo, skvrnaMat(0.4));
  skvrnaKnihy.position.set(W / 2 + 0.02, 0.0006, 0.02);
  skvrnaKnihy.renderOrder = -2;
  const skvrnaDesky = new THREE.Mesh(skvrnaGeo, skvrnaMat(0));
  skvrnaDesky.position.set(-W / 2 - 0.01, 0.0006, 0.02);
  skvrnaDesky.renderOrder = -2;
  scene.add(skvrnaKnihy, skvrnaDesky);

  // Vržený stín od slunce. Rovina leží těsně nad květinami, takže stín knihy
  // padá i na ně; jinde je průhledná.
  const stinStoluGeo = new THREE.PlaneGeometry(9, 9);
  stinStoluGeo.rotateX(-Math.PI / 2);
  const stinStolu = new THREE.Mesh(
    stinStoluGeo,
    new THREE.ShadowMaterial({ color: "#3b2a1c", opacity: 0.2, depthWrite: false }),
  );
  stinStolu.position.y = 0.016;
  stinStolu.receiveShadow = true;
  stinStolu.renderOrder = 50;
  scene.add(stinStolu);

  /* ---------- květiny ---------- */
  const kvetinyTex = await kvetinyNacteni;
  zrusit();
  KVETINY.forEach((k, i) => {
    const t = kvetinyTex[i];
    if (!t) return;
    textury.push(t);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    const obr = t.image as HTMLImageElement;
    const pomer = obr.height / obr.width;

    // Neosvětlený materiál bez tónování: barva květu je přesně barva fotky.
    const geo = new THREE.PlaneGeometry(k.sirka, k.sirka * pomer);
    geo.rotateX(-Math.PI / 2);
    const kvet = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }),
    );
    kvet.position.set(k.x, 0.002 + k.vrstva * 0.001, k.z);
    kvet.rotation.y = k.uhel;
    kvet.renderOrder = 10 + k.vrstva;

    const { platno: cvStin, presah } = kresliStinKvetu(obr);
    const stinGeo = new THREE.PlaneGeometry(k.sirka * presah, (k.sirka * presah * cvStin.height) / cvStin.width);
    stinGeo.rotateX(-Math.PI / 2);
    const stinKvetu = new THREE.Mesh(
      stinGeo,
      new THREE.MeshBasicMaterial({
        map: textura(cvStin),
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    // Slunce svítí zleva zpředu, stín tedy padá doprava dozadu.
    stinKvetu.position.set(k.x + 0.012 * k.vyska, 0.0012, k.z - 0.009 * k.vyska);
    stinKvetu.rotation.y = k.uhel;
    stinKvetu.renderOrder = 5;
    scene.add(stinKvetu, kvet);
  });

  vykresli = () => {
    // náklon a vznášení: za kurzorem, při otevření slábne, ať se dobře čte
    const tlum = volby.klid ? 0 : 1 - 0.75 * st.kamera;
    vznos.rotation.x = kurzor.cy * 0.045 * tlum;
    vznos.rotation.z = -kurzor.cx * 0.045 * tlum;
    vznos.position.y = (0.007 + Math.sin(cas * 1.1) * 0.004) * kurzor.sila * tlum;

    pant.rotation.z = st.uhel;
    pant.position.y = R + st.zdvih;
    skvrnaDesky.material.opacity = 0.36 * smooth(2.2, Math.PI, st.uhel);
    skvrnaKnihy.material.opacity = 0.4 - vznos.position.y * 6;
    nastavKameru();
    renderer.render(scene, camera);
  };

  function zmerit() {
    rozmer();
    // Okno se hodně změnilo: strany překreslit v novém rozlišení.
    const potreba = potrebnaSirkaStrany();
    if (potreba > sirkaStrany * 1.35 || potreba < sirkaStrany * 0.6) prekresliStrany(potreba);
    if (!bezi) vykresli();
  }

  function prekresliStrany(sirka: number) {
    sirkaStrany = sirka;
    const vymen = (tex: THREE.CanvasTexture, cv: HTMLCanvasElement) => {
      tex.image = cv;
      tex.dispose();
      tex.needsUpdate = true;
    };
    vymen(texDeti, kresliStranu("deti", pisma, sirka, POMER_STRANY));
    vymen(texDospeli, kresliStranu("dospeli", pisma, sirka, POMER_STRANY));
  }

  /* ---------- časové osy ---------- */
  // Otevření: deska se odlepí, zvedne přes hřbet (nahoře se na okamžik
  // zastaví, jak ji pustí ruka), padá se zrychlením a dvakrát dosedne.
  function osaOtevreni() {
    return gsap
      .timeline()
      .to(st, { uhel: 0.16, zdvih: 0.012, duration: 0.34, ease: "power2.out" }, 0)
      .to(st, { uhel: 1.74, duration: 0.62, ease: "sine.inOut" }, 0.34)
      .to(st, { zdvih: 0, duration: 0.8, ease: "power1.inOut" }, 0.5)
      .to(st, { uhel: Math.PI, duration: 0.42, ease: "power2.in" }, 0.96)
      .to(st, { uhel: Math.PI - 0.05, duration: 0.13, ease: "power2.out" }, 1.38)
      .to(st, { uhel: Math.PI, duration: 0.16, ease: "power2.in" }, 1.51)
      .to(st, { uhel: Math.PI - 0.012, duration: 0.07, ease: "power1.out" }, 1.67)
      .to(st, { uhel: Math.PI, duration: 0.09, ease: "power1.in" }, 1.74)
      // Kamera se začne zvedat hned, ať se zvednutá deska vejde do záběru.
      .to(st, { kamera: 1, duration: 2, ease: "power2.out" }, 0);
  }

  function osaZavreni() {
    return gsap
      .timeline()
      .to(st, { uhel: Math.PI - 0.16, zdvih: 0.012, duration: 0.32, ease: "power2.out" }, 0)
      .to(st, { uhel: 1.42, duration: 0.6, ease: "sine.inOut" }, 0.32)
      .to(st, { uhel: 0, duration: 0.42, ease: "power2.in" }, 0.92)
      .to(st, { zdvih: 0, duration: 0.5, ease: "power1.in" }, 0.84)
      .to(st, { uhel: 0.04, duration: 0.12, ease: "power2.out" }, 1.34)
      .to(st, { uhel: 0, duration: 0.15, ease: "power2.in" }, 1.46)
      .to(st, { kamera: 0, strana: 0, duration: 1.6, ease: "power2.inOut" }, 0.05);
  }

  function otevri(ano: boolean) {
    if (ano === cilOtevreno || zniceno) return;
    cilOtevreno = ano;
    // Klik v půlce: běžící osa se jen obrátí, nic neskočí.
    if (tl && bezi1(tl)) {
      tl.reversed(!tl.reversed());
      smycka();
      return;
    }
    tl?.kill();
    tl = (ano ? osaOtevreni() : osaZavreni()).eventCallback("onComplete", smycka);
    tl.eventCallback("onReverseComplete", smycka);
    if (volby.klid) {
      tl.progress(1);
      vykresli();
    }
    smycka();
  }

  function predehra() {
    if (zniceno) return;
    predehraDo = performance.now() + 700;
    smycka();
  }

  function strana(i: number) {
    if (zniceno) return;
    tlStrany?.kill();
    if (volby.klid) {
      st.strana = i;
      vykresli();
      return;
    }
    tlStrany = gsap.to(st, { strana: i, duration: 0.75, ease: "power2.inOut", onComplete: smycka });
    smycka();
  }

  function viditelnost(ano: boolean) {
    viditelne = ano;
    smycka();
    if (ano && !bezi) vykresli();
  }

  /** Zahřátí: 40 snímků naprázdno (plátno je ještě průhledné). Když je
      medián snímku nad 20 ms, telefon nestíhá — kreslí se v hustotě 1×. */
  async function zahrat() {
    const casy: number[] = [];
    let minule = 0;
    await new Promise<void>((hotovo) => {
      const krok = (t: number) => {
        if (zniceno) return hotovo();
        if (minule) casy.push(t - minule);
        minule = t;
        vykresli();
        if (casy.length < 40) requestAnimationFrame(krok);
        else hotovo();
      };
      requestAnimationFrame(krok);
    });
    casy.sort((a, b) => a - b);
    const median = casy[Math.floor(casy.length / 2)] ?? 0;
    if (median > 20 && renderer.getPixelRatio() > 1) {
      renderer.setPixelRatio(1);
      zmerit();
      textury.forEach((t) => renderer.initTexture(t));
      vykresli();
    }
  }

  /* ---------- příprava: zkompilovat, nahrát, ukázat ----------
     Všechno drahé se udělá dřív, než jde na knihu klepnout: shadery se
     zkompilují, textury nahrají do GPU, otevřený stav se jednou vykreslí
     naprázdno a GSAP si osahá obě osy. První otevření pak nic nového
     nepřipravuje a nemá čím cuknout. */
  rozmer();
  nastavKameru();
  await renderer.compileAsync(scene, camera);
  zrusit();
  textury.forEach((t) => renderer.initTexture(t));
  for (const nanecisto of [osaOtevreni(), osaZavreni()]) nanecisto.progress(1).progress(0).kill();
  Object.assign(st, { uhel: Math.PI, kamera: 1, strana: 1 });
  vykresli();
  Object.assign(st, { uhel: 0, zdvih: 0, kamera: 0, strana: 0 });
  vykresli();
  kontejner.appendChild(platno);
  await zahrat();
  zrusit();
  requestAnimationFrame(() => (platno.style.opacity = "1"));

  ro = new ResizeObserver(zmerit);
  ro.observe(kontejner);
  kontejner.addEventListener("pointermove", naPohyb, { passive: true });
  kontejner.addEventListener("pointerleave", naOdchod, { passive: true });
  smycka();

  return { otevri, predehra, strana, viditelnost, dispose };
}
