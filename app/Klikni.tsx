/* Pokyn ke klepnutí: ručně psaný nápis v oblouku a pod ním šipka.

   Stojí ve vlastním souboru, protože ho používá obálka v úvodu i zavřené
   svatební menu — a obě ho mají vypadat stejně. Umístění si řídí volající
   přes vlastní třídu, rozměry uvnitř jsou v procentech šířky wrapperu, takže
   celý pokyn drží poměr, ať je veliký jakkoli. */

/* `id` musí být na stránce jedinečné: textPath se na dráhu odkazuje přes něj
   a dvě stejná id by druhý nápis posadila na dráhu toho prvního. */
export default function Klikni({ id, trida = "" }: { id: string; trida?: string }) {
  return (
    <span className={"klikni-wrap " + trida} aria-hidden="true">
      <svg className="klikni-text" viewBox="0 0 200 96" focusable="false">
        {/* Dráha je oblouk prohnutý dolů — písmo po něm sedí jako podpis
            nad kresbou a drží se zakřivení šipky pod sebou. */}
        <path id={id} d="M 6 26 C 48 96, 152 96, 194 26" fill="none" />
        <text>
          <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
            klikni
          </textPath>
        </text>
      </svg>
      <img className="klikni-sipka" src="/obalka/sipka.webp" alt="" />
    </span>
  );
}
