import gsap from "gsap";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/* Dva zlaté prstýnky ležící na stole vedle menu. Stejné zlato i okolí jako
   prsten v úvodu webu (Ring3D.tsx): RoomEnvironment přes PMREM, ACES, barva
   0xd8b26e, plný kov. Větší prsten má i ten žhnoucí nápis — jen tlumeně.

   Kreslí se jen na požádání: jednou po načtení a pak jen během „záblesku“,
   kdy se při otevření či zavření knihy pootočí okolí a odlesky přejedou po
   zlatě. Mezi tím plátno stojí a GPU spí. */

export type Prstynky = {
  zablesk: () => void;
  viditelnost: (ano: boolean) => void;
  dispose: () => void;
};

const NAPIS =
  "Ash nazg durbatulûk · ash nazg gimbatul · ash nazg thrakatulûk · agh burzum-ishi krimpatul · ";

function texturaNapisu() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.font = "italic 600 38px Georgia, serif";
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.fillText(NAPIS, 4, c.height / 2);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.center.set(0.5, 0.5);
  t.rotation = Math.PI / 2;
  return t;
}

export async function vytvorPrstynky(
  el: HTMLElement,
  volby: { klid: boolean; signal: AbortSignal },
): Promise<Prstynky> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // Stíny se spočítají jednou — prstýnky se nehýbou, jen okolí.
  renderer.shadowMap.autoUpdate = false;
  const platno = renderer.domElement;
  platno.setAttribute("aria-hidden", "true");
  platno.style.cssText = "display:block;width:100%;height:100%;opacity:0;transition:opacity .8s ease";

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const okoli = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = okoli;

  const camera = new THREE.PerspectiveCamera(28, 1.5, 0.1, 20);
  camera.position.set(0.05, 2.25, 2.75);
  camera.lookAt(0.02, 0.16, 0);

  const zlato = new THREE.MeshStandardMaterial({ color: 0xd8b26e, metalness: 1, roughness: 0.12 });
  const napis = texturaNapisu();
  const zlatoNapis = new THREE.MeshStandardMaterial({
    color: 0xd8b26e,
    metalness: 1,
    roughness: 0.12,
    emissive: 0xff5a1a,
    emissiveMap: napis,
    emissiveIntensity: 0.35,
  });

  // Větší prsten leží na stole, menší se o něj opírá.
  const velky = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.085, 40, 128), zlatoNapis);
  velky.rotation.x = Math.PI / 2;
  velky.position.set(-0.3, 0.085, 0.04);
  const maly = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.07, 40, 128), zlato);
  maly.rotation.order = "YXZ";
  maly.rotation.y = -0.55;
  maly.rotation.x = 0.98;
  maly.position.set(0.3, 0.07 + 0.46 * Math.cos(0.98), -0.02);
  velky.castShadow = maly.castShadow = true;
  scene.add(velky, maly);

  const slunce = new THREE.DirectionalLight(0xffffff, 1.3);
  slunce.position.set(-1.4, 3, 1.2);
  slunce.castShadow = true;
  slunce.shadow.mapSize.set(1024, 1024);
  const sc = slunce.shadow.camera;
  sc.left = -1.6;
  sc.right = 1.6;
  sc.top = 1.6;
  sc.bottom = -1.6;
  sc.near = 0.5;
  sc.far = 8;
  slunce.shadow.radius = 8;
  slunce.shadow.bias = -0.0005;
  scene.add(slunce);

  const stolGeo = new THREE.PlaneGeometry(6, 6);
  stolGeo.rotateX(-Math.PI / 2);
  const stul = new THREE.Mesh(stolGeo, new THREE.ShadowMaterial({ color: "#3b2a1c", opacity: 0.28 }));
  stul.receiveShadow = true;
  scene.add(stul);

  let viditelne = true;
  let zniceno = false;
  let tw: gsap.core.Tween | null = null;

  const vykresli = () => {
    if (!zniceno) renderer.render(scene, camera);
  };

  function zmerit() {
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate = true;
    vykresli();
  }

  function dispose() {
    zniceno = true;
    tw?.kill();
    gsap.ticker.remove(vykresli);
    ro.disconnect();
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    napis.dispose();
    okoli.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    platno.remove();
  }

  const ro = new ResizeObserver(zmerit);
  zmerit();
  await renderer.compileAsync(scene, camera);
  if (volby.signal.aborted) {
    dispose();
    throw new DOMException("Zrušeno", "AbortError");
  }
  renderer.initTexture(napis);
  renderer.shadowMap.needsUpdate = true;
  vykresli();
  el.appendChild(platno);
  ro.observe(el);
  requestAnimationFrame(() => (platno.style.opacity = "1"));

  return {
    /** Odlesky přejedou po zlatě: pootočí se okolí, prstýnky stojí. */
    zablesk() {
      if (zniceno || volby.klid) return;
      tw?.kill();
      const cil = scene.environmentRotation.y + 1.1;
      gsap.ticker.add(vykresli);
      tw = gsap.to(scene.environmentRotation, {
        y: cil,
        duration: 1.9,
        ease: "power2.inOut",
        onComplete: () => {
          gsap.ticker.remove(vykresli);
          vykresli();
        },
      });
      if (!viditelne) gsap.ticker.remove(vykresli);
    },
    viditelnost(ano: boolean) {
      viditelne = ano;
      if (!ano) gsap.ticker.remove(vykresli);
      else if (tw?.isActive()) gsap.ticker.add(vykresli);
    },
    dispose,
  };
}
