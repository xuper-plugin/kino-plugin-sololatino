// Parsers for sololatino.net: listing cards, a title's own page (movie or series with its episodes) and the players an episode offers.

export const SITE = "https://sololatino.net";

/** Genres of the site's listings (slug, Spanish name). */
export const GENRES = [
  ["accion", "Acción"], ["animacion", "Animación"], ["aventura", "Aventura"], ["belica", "Bélica"], ["ciencia-ficcion", "Ciencia Ficción"],
  ["comedia", "Comedia"], ["crimen", "Crimen"], ["documental", "Documental"], ["drama", "Drama"], ["familia", "Familia"],
  ["fantasia", "Fantasía"], ["historia", "Historia"], ["misterio", "Misterio"], ["musica", "Música"], ["romance", "Romance"],
  ["suspense", "Suspense"], ["terror", "Terror"], ["western", "Western"],
];

/** TV networks and platforms the site groups titles by (slug, name). */
export const NETWORKS = [
  ["netflix", "Netflix"], ["amazon-prime-video", "Amazon Prime Video"], ["disney", "Disney+"], ["hbo-max", "HBO Max"], ["hbo", "HBO"],
  ["apple-tv", "Apple TV+"], ["hulu", "Hulu"], ["nbc", "NBC"],
];

const decode = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
const text = (s) => decode(String(s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** The cards of a listing: `{ slug, kind: "movie"|"series", badge, title, year, poster, rating }`. */
export function parseCards(html) {
  const out = [];
  const seen = new Set();
  for (const c of String(html || "").split('<div class="card">').slice(1)) {
    const href = /href="https:\/\/sololatino\.net\/(pelicula|serie)\/([^"\/?#]+)"/.exec(c);
    if (!href || seen.has(href[1] + href[2])) continue;
    seen.add(href[1] + href[2]);
    const title = /<p class="card__title">([\s\S]*?)<\/p>/.exec(c) || /<span class="card__title">([\s\S]*?)<\/span>/.exec(c);
    const img = /<img[^>]*?src="([^"]+)"/.exec(c);
    const year = /class="card__year">\s*(\d{4})/.exec(c);
    const badge = /badge card__badge badge-(\w+)">([^<]*)/.exec(c);
    const rating = /card__rating">[^\d]*([\d.]+)/.exec(c);
    out.push({
      slug: href[2], kind: href[1] === "pelicula" ? "movie" : "series", badge: badge ? text(badge[2]) : "", type: badge ? badge[1] : "",
      title: title ? text(title[1]) : href[2], year: year ? Number(year[1]) : undefined, poster: img ? img[1] : "", rating: rating ? Number(rating[1]) : undefined,
    });
  }
  return out;
}

const meta = (html, prop) => { const m = new RegExp(`<meta property="${prop}" content="([^"]*)"`).exec(html); return m ? decode(m[1]) : ""; };

/** A title's page: overview, year, genres, runtime, rating, cover and, for a series, its seasons and episodes. */
export function parseTitle(html) {
  const h = String(html || "");
  const t = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(h);
  if (!t) return null;
  const para = /<p class="text-sm leading-relaxed[^"]*"[^>]*>([\s\S]*?)<\/p>/.exec(h.slice(t.index));
  const head = h.slice(t.index, para ? t.index + para.index : t.index + 6000);
  const poster = /<img src="([^"]+)"[^>]*class="w-44/.exec(h);
  const back = /detail-hero__bg"[^>]*style="[^"]*url\('([^']+)'\)/.exec(h);
  const genres = [...new Set([...head.matchAll(/<a href="https:\/\/sololatino\.net\/genero\/[^"]+"[^>]*>\s*([^<]+?)\s*<\/a>/g)].map((m) => text(m[1])))];
  const spans = [...head.matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map((m) => text(m[1]));
  const year = spans.find((x) => /^\d{4}$/.test(x));
  const runtime = spans.find((x) => /^\d+h( \d+m)?$|^\d+ ?m(in)?$/.test(x));
  const rate = /([\d.]+)\/10/.exec(head) || /rating-badge__val">([\d.]+)/.exec(head);
  const seasons = [];
  for (const p of h.split('data-season-panel="').slice(1)) {
    const season = Number(p.slice(0, p.indexOf('"')));
    const eps = [];
    for (const e of p.split('<a href="https://sololatino.net/serie/').slice(1)) {
      const link = /^[^"\/]+\/temporada-(\d+)\/episodio-(\d+)"/.exec(e);
      if (!link) continue;
      const name = /<p class="text-sm font-semibold text-white leading-tight">([\s\S]*?)<\/p>/.exec(e);
      const thumb = /<img src="([^"]+)"/.exec(e);
      const plot = /<p class="text-xs mt-1 line-clamp-2"[^>]*>([\s\S]*?)<\/p>/.exec(e);
      eps.push({ season: Number(link[1]), number: Number(link[2]), title: name ? text(name[1]) : "", thumb: thumb ? thumb[1] : "", overview: plot ? text(plot[1]) : "" });
    }
    if (eps.length) seasons.push({ season, episodes: eps });
  }
  return {
    title: text(t[1]), overview: para ? text(para[1]) : "", year: year ? Number(year) : undefined, runtime: runtime || "", rating: rate ? Number(rate[1]) : undefined,
    genres, poster: poster ? poster[1] : meta(h, "og:image"), backdrop: back ? back[1] : "", seasons,
  };
}

/** The players of an episode or movie page: `{ lang, name, token }`; `lang` is the page's own group ("mx" for Latino). */
export function parsePlayers(html) {
  const out = [];
  for (const g of String(html || "").split('data-lang-group="').slice(1)) {
    const lang = g.slice(0, g.indexOf('"'));
    for (const b of g.matchAll(/data-player-token="([^"]+)"[^>]*>\s*([^<]*?)\s*<\/button>/g)) out.push({ lang, name: text(b[2]).replace(/^⭐\s*/, ""), token: b[1] });
  }
  return out;
}

/** `{ csrf }` is not needed: the XSRF cookie is. Kept for the plugin: the player address's IMDb id and, for an episode, its `SxE`. */
export const embedId = (url) => { const m = /\/f\/(tt\d+(?:-\d+x\d+)?)/.exec(String(url || "")); return m ? m[1] : null; };
