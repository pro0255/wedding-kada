/* Hudba na úvodní obrazovce: hraje, dokud host neklepne, pak postupně utichne.

   Prohlížeče zvuk bez gesta většinou nepustí (iPhone nikdy, Chrome jen na
   webu, kde už host něco pouštěl). Proto dvě cesty:
   - automatické spuštění vyšlo → po klepnutí hned doznívá (DOZNENI_MS);
   - nevyšlo → hudba začne až klepnutím, chvíli hraje k rozsvícenému úvodu
     (HRAJ_MS) a teprve pak doznívá.

   Na iPhonu nejde hlasitost <audio> měnit (volume je jen ke čtení), ztišuje
   se tam přes Web Audio — kontext vzniká až v klepnutí, dřív by zůstal
   uspaný a hudba němá. */
const ZDROJ = "/hudba/uvod.m4a";
// podklad, ne hlavní zvuk — tiše pod úvodní obrazovkou
const HLASITOST = 0.25;
const DOZNENI_MS = 5000;
const HRAJ_MS = 9000;
const KROK_MS = 50;

export type UvodniHudba = { utichni: () => void; zrus: () => void };

export function spustUvodniHudbu(): UvodniHudba {
  const audio = new Audio();
  audio.preload = "none";
  audio.loop = true;
  audio.src = ZDROJ;
  audio.volume = HLASITOST;
  // iPhone nastavení hlasitosti zahodí a dál hlásí 1
  const hlasitostJde = audio.volume === HLASITOST;

  let hralaSama = false;
  let utichla = false;
  let konec = false;
  let ctx: AudioContext | null = null;
  let zesilovac: GainNode | null = null;
  const casovace: ReturnType<typeof setTimeout>[] = [];
  let krokovac: ReturnType<typeof setInterval> | undefined;

  audio
    .play()
    .then(() => {
      hralaSama = true;
    })
    .catch(() => {});

  // schovaná záložka nemá hrát; po návratu pokračuje, pokud ještě nedozněla
  const viditelnost = () => {
    if (konec) return;
    if (document.hidden) audio.pause();
    else if (hralaSama || utichla) audio.play().catch(() => {});
  };
  document.addEventListener("visibilitychange", viditelnost);

  const zrus = () => {
    if (konec) return;
    konec = true;
    casovace.forEach(clearTimeout);
    clearInterval(krokovac);
    document.removeEventListener("visibilitychange", viditelnost);
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    ctx?.close().catch(() => {});
  };

  const doznivej = () => {
    if (konec) return;
    if (zesilovac && ctx) {
      const t = ctx.currentTime;
      zesilovac.gain.setValueAtTime(HLASITOST, t);
      zesilovac.gain.linearRampToValueAtTime(0, t + DOZNENI_MS / 1000);
    } else {
      const kroku = DOZNENI_MS / KROK_MS;
      let i = 0;
      krokovac = setInterval(() => {
        i += 1;
        // kvadraticky: ucho vnímá hlasitost logaritmicky, lineární pokles
        // by zněl, jako by hudba dlouho nic a pak naráz zmizela
        audio.volume = HLASITOST * Math.max(0, 1 - i / kroku) ** 2;
      }, KROK_MS);
    }
    casovace.push(setTimeout(zrus, DOZNENI_MS + 100));
  };

  /** Volat přímo z klepnutí — jen tam smí vzniknout zvukový kontext. */
  const utichni = () => {
    if (utichla || konec) return;
    utichla = true;
    if (!hlasitostJde) {
      try {
        ctx = new AudioContext();
        zesilovac = ctx.createGain();
        zesilovac.gain.value = HLASITOST;
        ctx.createMediaElementSource(audio).connect(zesilovac).connect(ctx.destination);
      } catch {
        ctx = null;
        zesilovac = null;
      }
    }
    const pockat = hralaSama ? 0 : HRAJ_MS;
    audio
      .play()
      .then(() => casovace.push(setTimeout(doznivej, pockat)))
      .catch(zrus);
  };

  return { utichni, zrus };
}
