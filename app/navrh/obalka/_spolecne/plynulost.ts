/* Pojistky plynulosti sdílené návrhy V2 a V3.

   1) will-change jen tehdy, když může přijít animace. Atribut
      data-pripraveno na kořeni obálky zapíná v CSS will-change. Platí, dokud
      je obálka v okně (nebo kousek před ním), během animace a při záměru
      (najetí myší, fokus, dotyk); jinak se chvíli po posledním důvodu vypne.
      Měřeno: kdyby se zapínal až klepnutím, prohlížeč zakládá a rasterizuje
      vrstvy v prvním snímku animace → jedno cuknutí 33 ms při studeném
      otevření (telefon, 4× pomalejší CPU). Zapnutý už v okně = 0 cuknutí.

   2) Předehřátí. Jakmile se obálka poprvé objeví v okně, počká se na písma
      a dekódování obrázků a na pár snímků se nastaví data-predehrev: CSS
      verze tím natočí skryté plochy (rub, schovaný dopis) k divákovi
      s krytím 1 %. Prohlížeč je vykreslí a rasterizuje hned — ne až
      v prvním snímku otevírání, kde by to byl záškub. */

const DOZVUK_MS = 1500; // jak dlouho po animaci ještě držet vrstvy

export type Pripravenost = {
  /* najetí/odjetí myší, fokus/blur, dotyk */
  zamer: (ano: boolean) => void;
  /* spuštěná animace — `ms` = jak dlouho poběží (u GSAP stačí konec()) */
  animace: (ms?: number) => void;
  konec: () => void;
  zrus: () => void;
};

export function vytvorPripravenost(el: HTMLElement): Pripravenost {
  let animuje = false;
  let zamer = false;
  let vOkne = false;
  let vypnuti = 0;
  let dobeh = 0;

  const zapni = () => {
    window.clearTimeout(vypnuti);
    if (el.dataset.pripraveno !== "true") el.dataset.pripraveno = "true";
  };
  const odloz = () => {
    window.clearTimeout(vypnuti);
    vypnuti = window.setTimeout(() => {
      if (!animuje && !zamer && !vOkne) delete el.dataset.pripraveno;
    }, DOZVUK_MS);
  };
  const io = new IntersectionObserver(
    (zaznamy) => {
      vOkne = zaznamy.some((z) => z.isIntersecting);
      if (vOkne) zapni();
      else odloz();
    },
    { rootMargin: "150px" },
  );
  io.observe(el);
  const konec = () => {
    window.clearTimeout(dobeh);
    animuje = false;
    odloz();
  };

  return {
    zamer(ano) {
      zamer = ano;
      if (ano) zapni();
      else odloz();
    },
    animace(ms) {
      animuje = true;
      zapni();
      window.clearTimeout(dobeh);
      if (ms) dobeh = window.setTimeout(konec, ms);
    },
    konec,
    zrus() {
      io.disconnect();
      window.clearTimeout(vypnuti);
      window.clearTimeout(dobeh);
    },
  };
}

const dalsiSnimek = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/* Spustí předehřátí, až bude obálka poprvé (skoro) vidět. Vrací úklid. */
export function predehrat(el: HTMLElement, obrazky: string[], pripravenost: Pripravenost): () => void {
  let zruseno = false;
  const io = new IntersectionObserver(
    async (zaznamy) => {
      if (!zaznamy.some((z) => z.isIntersecting)) return;
      io.disconnect();
      await Promise.all([
        document.fonts?.ready,
        ...obrazky.map((src) => {
          const img = new Image();
          img.src = src;
          return img.decode().catch(() => undefined);
        }),
      ]);
      // uživatel mezitím mohl obálku otevřít — pak už není co předehřívat
      if (zruseno || el.dataset.otevreno === "true") return;
      pripravenost.animace(); // vrstvy jako při animaci
      el.dataset.predehrev = "true";
      for (let i = 0; i < 3; i++) await dalsiSnimek();
      delete el.dataset.predehrev;
      pripravenost.konec();
    },
    { rootMargin: "200px" },
  );
  io.observe(el);
  return () => {
    zruseno = true;
    io.disconnect();
  };
}

/* Ovládání obálky bez Reactu: nativní posluchače a přepnutí rozložené do
   snímků. Klepnutí samo jen přepne aria-expanded/aria-label na tlačítku;
   animace se spustí až o dva snímky později (requestAnimationFrame ×2) a
   inert/aria-hidden dopisu se přepnou až po ní. Snímek s klepnutím tak nese
   jen zpracování vstupu (a třeba měřič plynulosti) a přepočet stylů přijde
   v dalším — při 4× zpomaleném CPU se obojí do jednoho snímku nevejde.
   Zpoždění 2 snímky (~33 ms) oko nepozná. */
export function pripojOvladani(o: {
  koren: HTMLElement;
  tlacitko: HTMLButtonElement;
  dopis: HTMLElement;
  popis: { zavreno: string; otevreno: string };
  pripravenost: Pripravenost;
  /* spustí animaci do daného stavu */
  spust: (otevrit: boolean) => void;
  /* délka animace v ms (pro vypnutí will-change); undefined = ohlásí konec sama */
  delka?: (otevrit: boolean) => number | undefined;
}): () => void {
  const { koren, tlacitko, dopis, popis, pripravenost } = o;
  let otevreno = koren.dataset.otevreno === "true";
  let snimek = 0;
  let aria = 0;

  const prepni = (nove: boolean) => {
    if (nove === otevreno) return;
    otevreno = nove;
    tlacitko.setAttribute("aria-expanded", String(nove));
    tlacitko.setAttribute("aria-label", nove ? popis.otevreno : popis.zavreno);
    delete koren.dataset.predehrev;
    pripravenost.animace(o.delka?.(nove));
    cancelAnimationFrame(snimek);
    snimek = requestAnimationFrame(() => {
      snimek = requestAnimationFrame(() => {
        koren.dataset.otevreno = String(nove);
        o.spust(nove);
      });
    });
    window.clearTimeout(aria);
    aria = window.setTimeout(() => {
      dopis.setAttribute("aria-hidden", String(!nove));
      dopis.inert = !nove;
    }, 300);
  };

  const naTlacitko = () => prepni(!otevreno);
  const naDopis = () => prepni(false);
  const zamerAno = () => pripravenost.zamer(true);
  const zamerNe = () => pripravenost.zamer(false);

  tlacitko.addEventListener("click", naTlacitko);
  tlacitko.addEventListener("focus", zamerAno);
  tlacitko.addEventListener("blur", zamerNe);
  dopis.addEventListener("click", naDopis);
  koren.addEventListener("pointerenter", zamerAno);
  koren.addEventListener("pointerleave", zamerNe);
  koren.addEventListener("pointerdown", zamerAno);
  return () => {
    cancelAnimationFrame(snimek);
    window.clearTimeout(aria);
    tlacitko.removeEventListener("click", naTlacitko);
    tlacitko.removeEventListener("focus", zamerAno);
    tlacitko.removeEventListener("blur", zamerNe);
    dopis.removeEventListener("click", naDopis);
    koren.removeEventListener("pointerenter", zamerAno);
    koren.removeEventListener("pointerleave", zamerNe);
    koren.removeEventListener("pointerdown", zamerAno);
  };
}
