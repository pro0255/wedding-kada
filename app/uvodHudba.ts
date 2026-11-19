/* Hudba na úvodní obrazovce: z ticha pomalu zesílí, po klepnutí na prsten
   se krátce vzedme a pak pod stránkou postupně utichne. Žádný zvuk klepnutí
   navíc — cinknutí tu bylo a rušilo.

   Prohlížeče zvuk bez gesta většinou nepustí (iPhone nikdy, Chrome jen na
   webu, kde už host něco pouštěl). Proto dvě cesty:
   - automatické spuštění vyšlo → hudba nabíhá hned s úvodní obrazovkou
     a klepnutí ji vzedme a nechá doznít;
   - nevyšlo → hudba začne až klepnutím, nabíhá k rozsvícenému úvodu,
     chvíli hraje (HRAJ_MS od klepnutí) a teprve pak doznívá.

   Do klepnutí se hlasitost řídí přímo na <audio>. V klepnutí vzniká zvukový
   kontext (dřív by zůstal uspaný a hudba němá) a hudba se přes něj přepojí:
   jde tak ztišit i na iPhonu, kde je volume jen ke čtení, a při doznívání
   se dá přivřít filtr, takže hudba neslábne jen hlasitostí, ale i odchází
   do dálky. */
const ZDROJ = "/hudba/uvod.m4a";
/* Úrovně jsou „jak hlasitě to zní“ (0–1), do zesílení jdou na druhou: ucho
   vnímá hlasitost logaritmicky, lineární změna by zněla, jako by hudba
   dlouho nic a pak naráz naskočila nebo zmizela. */
// podklad, ne hlavní zvuk — tiše pod úvodní obrazovkou (zesílení 0,25)
const UROVEN = 0.5;
// vzedmutí po klepnutí (zesílení ~0,42)
const VRCHOL = 0.65;
const NABEH_MS = 4000;
const VZEDMUTI_MS = 700;
// jak dlouho vzedmutí podrží, než začne doznívat
const VYDRZ_MS = 500;
const DOZNENI_MS = 6000;
const HRAJ_MS = 9000;
const KROK_MS = 50;
// při doznívání se filtr přivře až sem — zůstanou jen hloubky
const FILTR_DOLE_HZ = 600;
export type UvodniHudba = {
  utichni: () => void;
  zrus: () => void;
  ztlum: (ticho: boolean) => void;
};

export function spustUvodniHudbu(): UvodniHudba {
  const audio = new Audio();
  audio.preload = "none";
  audio.loop = true;
  audio.src = ZDROJ;
  audio.volume = 0.5;
  // iPhone nastavení hlasitosti zahodí a dál hlásí 1
  const hlasitostJde = audio.volume === 0.5;
  audio.volume = 0;

  let uroven = 0;
  let ticho = false;
  let hralaSama = false;
  let utichla = false;
  let konec = false;
  let ctx: AudioContext | null = null;
  let zesilovac: GainNode | null = null;
  let filtr: BiquadFilterNode | null = null;
  const casovace: ReturnType<typeof setTimeout>[] = [];
  let krokovac: ReturnType<typeof setInterval> | undefined;

  const nastav = (u: number) => {
    uroven = u;
    // ztlumení je hradlo navrch: nájezdy i doznívání běží dál, jen se nic
    // neozve — po zrušení ticha hudba pokračuje tam, kde právě je
    const hlasitost = ticho ? 0 : u ** 2;
    // krátké dotažení místo skoku — schody po 50 ms by jinak byly slyšet
    if (zesilovac && ctx) zesilovac.gain.setTargetAtTime(hlasitost, ctx.currentTime, 0.03);
    else audio.volume = hlasitost;
  };

  /** Plynule z aktuální úrovně na cílovou; nový nájezd nahradí rozdělaný. */
  const najed = (cil: number, ms: number) => {
    clearInterval(krokovac);
    const z = uroven;
    const kroku = Math.max(1, Math.round(ms / KROK_MS));
    let i = 0;
    krokovac = setInterval(() => {
      i += 1;
      nastav(z + ((cil - z) * i) / kroku);
      if (i >= kroku) clearInterval(krokovac);
    }, KROK_MS);
  };

  audio
    .play()
    .then(() => {
      // klepnutí bylo rychlejší než spuštění — hlasitost už řídí utichni()
      if (utichla || konec) return;
      hralaSama = true;
      najed(UROVEN, NABEH_MS);
    })
    .catch(() => {
      /* prohlížeč zvuk bez gesta nepustil — začne až klepnutím */
    });

  // schovaná záložka nemá hrát; po návratu pokračuje, pokud ještě nedozněla
  const viditelnost = () => {
    if (konec) return;
    if (document.hidden) audio.pause();
    else if (hralaSama || utichla) {
      audio.play().catch(() => {
        /* nepustil-li prohlížeč zvuk, zůstane ticho */
      });
    }
  };
  document.addEventListener("visibilitychange", viditelnost);

  const zrus = () => {
    if (konec) return;
    konec = true;
    for (const c of casovace) clearTimeout(c);
    clearInterval(krokovac);
    document.removeEventListener("visibilitychange", viditelnost);
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    ctx?.close().catch(() => {
      /* kontext už je zavřený */
    });
  };

  const doznivej = () => {
    if (konec) return;
    najed(0, DOZNENI_MS);
    if (filtr && ctx) {
      filtr.frequency.setTargetAtTime(FILTR_DOLE_HZ, ctx.currentTime, DOZNENI_MS / 3000);
    }
    casovace.push(setTimeout(zrus, DOZNENI_MS + 200));
  };

  /** Volat přímo z klepnutí — jen tam smí vzniknout zvukový kontext. */
  const utichni = () => {
    if (utichla || konec) return;
    utichla = true;
    try {
      ctx = new AudioContext();
      filtr = ctx.createBiquadFilter();
      filtr.type = "lowpass";
      filtr.frequency.value = 20_000;
      zesilovac = ctx.createGain();
      zesilovac.gain.value = uroven ** 2;
      ctx
        .createMediaElementSource(audio)
        .connect(filtr)
        .connect(zesilovac)
        .connect(ctx.destination);
      // hlasitost odteď drží zesilovač; nejdřív on, pak <audio> naplno,
      // ať přepojení na okamžik nezesílí
      if (hlasitostJde) audio.volume = 1;
    } catch {
      // bez kontextu zůstane řízení na <audio>
      ctx = null;
      zesilovac = null;
      filtr = null;
    }
    audio
      .play()
      .then(() => {
        if (hralaSama) {
          najed(VRCHOL, VZEDMUTI_MS);
          casovace.push(setTimeout(doznivej, VZEDMUTI_MS + VYDRZ_MS));
        } else {
          najed(UROVEN, NABEH_MS);
          casovace.push(setTimeout(doznivej, HRAJ_MS));
        }
      })
      .catch(zrus);
  };

  /** Tlačítko v rohu úvodní obrazovky. Zrušení ticha je gesto hosta, takže
   *  se smí pustit i hudba, kterou prohlížeč sám nepustil. */
  const ztlum = (nove: boolean) => {
    if (konec) return;
    ticho = nove;
    nastav(uroven);
    if (!nove && audio.paused) {
      audio.play().catch(() => {
        /* nepustil-li prohlížeč zvuk, zůstane ticho */
      });
    }
  };

  return { utichni, zrus, ztlum };
}
