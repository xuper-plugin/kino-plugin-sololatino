// src/sololatino.js
var SITE = "https://sololatino.net";
var GENRES = [
  ["accion", "Acci\xF3n"],
  ["animacion", "Animaci\xF3n"],
  ["aventura", "Aventura"],
  ["belica", "B\xE9lica"],
  ["ciencia-ficcion", "Ciencia Ficci\xF3n"],
  ["comedia", "Comedia"],
  ["crimen", "Crimen"],
  ["documental", "Documental"],
  ["drama", "Drama"],
  ["familia", "Familia"],
  ["fantasia", "Fantas\xEDa"],
  ["historia", "Historia"],
  ["misterio", "Misterio"],
  ["musica", "M\xFAsica"],
  ["romance", "Romance"],
  ["suspense", "Suspense"],
  ["terror", "Terror"],
  ["western", "Western"]
];
var NETWORKS = [
  ["netflix", "Netflix"],
  ["amazon-prime-video", "Amazon Prime Video"],
  ["disney", "Disney+"],
  ["hbo-max", "HBO Max"],
  ["hbo", "HBO"],
  ["apple-tv", "Apple TV+"],
  ["hulu", "Hulu"],
  ["nbc", "NBC"]
];
var decode = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
var text = (s) => decode(String(s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
function parseCards(html) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
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
      slug: href[2],
      kind: href[1] === "pelicula" ? "movie" : "series",
      badge: badge ? text(badge[2]) : "",
      type: badge ? badge[1] : "",
      title: title ? text(title[1]) : href[2],
      year: year ? Number(year[1]) : void 0,
      poster: img ? img[1] : "",
      rating: rating ? Number(rating[1]) : void 0
    });
  }
  return out;
}
var meta = (html, prop) => {
  const m = new RegExp(`<meta property="${prop}" content="([^"]*)"`).exec(html);
  return m ? decode(m[1]) : "";
};
function parseTitle(html) {
  const h = String(html || "");
  const t3 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(h);
  if (!t3) return null;
  const para = /<p class="text-sm leading-relaxed[^"]*"[^>]*>([\s\S]*?)<\/p>/.exec(h.slice(t3.index));
  const head = h.slice(t3.index, para ? t3.index + para.index : t3.index + 6e3);
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
    title: text(t3[1]),
    overview: para ? text(para[1]) : "",
    year: year ? Number(year) : void 0,
    runtime: runtime || "",
    rating: rate ? Number(rate[1]) : void 0,
    genres,
    poster: poster ? poster[1] : meta(h, "og:image"),
    backdrop: back ? back[1] : "",
    seasons
  };
}
function parsePlayers(html) {
  const out = [];
  for (const g of String(html || "").split('data-lang-group="').slice(1)) {
    const lang = g.slice(0, g.indexOf('"'));
    for (const b of g.matchAll(/data-player-token="([^"]+)"[^>]*>\s*([^<]*?)\s*<\/button>/g)) out.push({ lang, name: text(b[2]).replace(/^⭐\s*/, ""), token: b[1] });
  }
  return out;
}
var embedId = (url) => {
  const m = /\/f\/(tt\d+(?:-\d+x\d+)?)/.exec(String(url || ""));
  return m ? m[1] : null;
};

// src/anubis.js
var API = "/.within.website/x/cmd/anubis/api/pass-challenge";
function anubisChallenge(html) {
  const m = /<script id="anubis_challenge"[^>]*>([\s\S]*?)<\/script>/.exec(String(html || ""));
  if (!m) return null;
  let j;
  try {
    j = JSON.parse(m[1]);
  } catch (_) {
    return null;
  }
  const c = j && j.challenge, r = j && j.rules;
  if (!c || typeof c.randomData !== "string" || typeof c.id !== "string" || !r) return null;
  const difficulty = Number(r.difficulty);
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 6) return null;
  return { data: c.randomData, id: c.id, difficulty };
}
function solveAnubis(kino2, data, difficulty) {
  const zeros = "0".repeat(difficulty);
  for (let nonce = 0; nonce < 2e7; nonce++) {
    const hash = kino2.crypto.hash("sha256", data + nonce);
    if (hash.startsWith(zeros)) return { hash, nonce };
  }
  return null;
}
async function getThroughAnubis(kino2, req, url, opts) {
  const started = Date.now();
  let r = await req(url, opts);
  if (!r.ok) return null;
  let html = await r.text();
  const ch = anubisChallenge(html);
  if (!ch) return html;
  const sol = solveAnubis(kino2, ch.data, ch.difficulty);
  if (!sol) return html;
  const origin = new URL(url).origin;
  const elapsed = Math.max(1e3, Date.now() - started);
  const pass = `${origin}${API}?id=${encodeURIComponent(ch.id)}&response=${sol.hash}&nonce=${sol.nonce}&redir=${encodeURIComponent(url)}&elapsedTime=${elapsed}`;
  try {
    const rp = await req(pass, opts);
    if (rp && typeof rp.text === "function") await rp.text();
  } catch (_) {
  }
  const r2 = await req(url, opts);
  if (!r2 || !r2.ok) return html;
  return r2.text();
}

// src/embed69.js
var SITE2 = "https://embed69.org";
function decryptLink(kino2, keyHex, b64) {
  const raw = atob(b64);
  let ivHex = "";
  for (let i = 0; i < 16; i++) ivHex += raw.charCodeAt(i).toString(16).padStart(2, "0");
  return kino2.crypto.decrypt("aes-256-cbc", { key: keyHex, keyEncoding: "hex", iv: ivHex, ivEncoding: "hex", data: btoa(raw.slice(16)) });
}
var quoted = (html, name) => {
  const m = new RegExp(name + "\\s*=\\s*'([^']*)'").exec(html);
  return m ? m[1] : null;
};
function serversOf(kino2, html) {
  const data = /let\s+dataLink\s*=\s*(\[.+\]);/.exec(html);
  const challenge = quoted(html, "LINK_CHALLENGE"), salt = quoted(html, "LINK_SALT");
  if (!data || !challenge || salt == null) return [];
  let langs;
  try {
    langs = JSON.parse(data[1]);
  } catch (_) {
    return [];
  }
  const keyHex = kino2.crypto.hash("sha256", challenge + salt);
  const rows = [];
  for (const l of langs) {
    for (const e of l && l.sortedEmbeds || []) {
      if (!e || e.servername === "download" || typeof e.link !== "string") continue;
      try {
        rows.push({ lang: String(l.video_language || ""), server: String(e.servername || ""), url: decryptLink(kino2, keyHex, e.link).replace(/`/g, "").trim() });
      } catch (_) {
      }
    }
  }
  return rows;
}
async function servers(kino2, req, id) {
  const html = await getThroughAnubis(kino2, req, `${SITE2}/f/${id}`, { headers: { Referer: "https://sololatino.net/" } });
  return html ? serversOf(kino2, html) : [];
}

// src/extractors/index.js
var INLINE_HOSTS = [
  "embedwish.com",
  "hlswish.com",
  "streamwish.com",
  "streamwish.to",
  "strwish.com",
  "wishembed.com",
  "filelions.com",
  "hglink.to",
  "vibuxer.com",
  "vidhide.com",
  "vidhidepro.com",
  "vidhideplus.com",
  "vidhidefast.com",
  "dintezuvio.com",
  "minochinos.com",
  "filelions.to",
  "morencius.com",
  "callistanise.com",
  "voe.sx"
];
function extractorFor(embedUrl) {
  let host;
  try {
    host = new URL(embedUrl).hostname.replace(/^www\./, "");
  } catch (_) {
    return null;
  }
  return INLINE_HOSTS.some((h) => host === h || host.endsWith("." + h)) ? { name: "resolver" } : null;
}

// src/util/http.js
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
var REQUEST_MS = 8e3;
var MIN_MS = 1500;
function makeReq(kino2, { deadline }) {
  const req = async (url, opts = {}) => {
    const left = deadline - Date.now();
    if (left < MIN_MS) throw kino2.error("timeout", "no time left for " + new URL(url).hostname);
    return kino2.fetch(url, { headers: { "User-Agent": UA, ...opts.headers || {} }, method: opts.method, body: opts.body, timeoutMs: Math.min(REQUEST_MS, left) });
  };
  req.left = () => Math.max(0, deadline - Date.now());
  return req;
}

// src/browse/model.js
var TAB_IDS = ["inicio"];
var MAX_SLIDES = 6;
var MAX_RAILS = 8;
var MAX_RAIL_ITEMS = 20;
var MAX_SLIDE_TEXT = 160;
var HTTPS = /^https:\/\//;
function cardOf(item) {
  const out = { id: item.id, ref: item.ref, title: item.title, kind: item.kind };
  if (item.poster && HTTPS.test(item.poster)) out.poster = item.poster;
  if (item.backdrop && HTTPS.test(item.backdrop)) out.backdrop = item.backdrop;
  if (item.badges) out.badges = item.badges;
  if (item.rating !== void 0) out.rating = item.rating;
  if (item.year !== void 0) out.year = item.year;
  if (item.ids && item.ids.tmdb) out.ids = { tmdb: item.ids.tmdb };
  if (item.lang) out.lang = item.lang;
  if (item.adult === true) out.adult = true;
  return out;
}
function slidesOf(rows) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const row of rows) {
    for (const item of row.items) {
      if (out.length >= MAX_SLIDES) return out;
      if (item.adult === true || seen.has(item.id) || !item.backdrop || !HTTPS.test(item.backdrop)) continue;
      const text2 = typeof item.overview === "string" ? item.overview.trim() : "";
      if (text2 === "") continue;
      seen.add(item.id);
      out.push({
        id: item.id,
        ref: item.ref,
        kind: item.kind,
        title: item.title,
        image: item.backdrop,
        text: text2.length <= MAX_SLIDE_TEXT ? text2 : `${text2.slice(0, MAX_SLIDE_TEXT - 1).trimEnd()}\u2026`
      });
    }
  }
  return out;
}
function railsOf(rows) {
  return rows.filter((r) => r.items && r.items.length > 0).slice(0, MAX_RAILS).map((r) => ({
    id: r.id,
    title: r.title,
    ...r.ref ? { ref: r.ref } : {},
    items: r.items.slice(0, MAX_RAIL_ITEMS).map(cardOf)
  }));
}
function tabOf(page) {
  const rows = page && Array.isArray(page.rows) ? page.rows : [];
  const rails = railsOf(rows);
  if (rails.length === 0) return null;
  return { slides: slidesOf(rows), rails };
}
function playedKey(ref) {
  const m = /^(?:m|s|e):(\d{1,10})(?::|$)/.exec(String(ref || ""));
  return m ? `t:${m[1]}` : String(ref || "");
}
function recentOf(keys, tabs) {
  if (keys.length === 0) return [];
  const byKey = /* @__PURE__ */ new Map();
  for (const data of tabs) {
    for (const rail2 of data.rails) {
      for (const card of rail2.items) {
        const ks = [card.ref];
        if (card.ids && card.ids.tmdb) ks.push(`t:${card.ids.tmdb}`);
        for (const k of ks) if (!byKey.has(k)) byKey.set(k, card);
      }
    }
  }
  const out = [];
  const used = /* @__PURE__ */ new Set();
  for (const key of keys) {
    const card = byKey.get(key);
    if (card && !used.has(card.id)) {
      used.add(card.id);
      out.push(card);
    }
  }
  return out;
}

// src/i18n.js
var WORDS = {
  es: {
    notFound: "No encontr\xE9 este t\xEDtulo en espa\xF1ol.",
    seasonMissing: "Latino todav\xEDa no tiene la temporada {season} de {title} en espa\xF1ol.",
    episodeMissing: "Latino todav\xEDa no tiene el cap\xEDtulo {episode} de la temporada {season} de {title} en espa\xF1ol.",
    notInSpanish: "no disponible en espa\xF1ol",
    sourcesDown: "Las fuentes en espa\xF1ol no responden ahora.",
    tmdbDown: "TMDB no responde ahora. Intenta de nuevo en un rato.",
    noPlayable: "Encontr\xE9 el t\xEDtulo, pero ninguna copia abri\xF3. Intenta de nuevo en un rato.",
    needResolver: "Para reproducir, abre Latino desde el men\xFA e instala el motor de reproducci\xF3n que te pedir\xE1.",
    copyFailed: "Esta copia no abri\xF3. Prueba con otro servidor.",
    lat: "Latino",
    esp: "Castellano",
    sub: "Subtitulado",
    direct: "Directo",
    keepOneSource: "Deja al menos una fuente encendida.",
    healthOk: "ok",
    healthFail: "falla",
    healthNone: "sin datos",
    healthOff: "apagada",
    probeDone: "Prob\xE9 las fuentes con un t\xEDtulo de prueba: {ok} responden, {fail} fallan.",
    probeNoTmdb: "No pude consultar TMDB para la prueba. Intenta de nuevo en un rato.",
    probeNone: "No hay fuentes encendidas para probar.",
    cacheCleared: "Listo: borr\xE9 {n} datos guardados.",
    cacheClearedOne: "Listo: borr\xE9 1 dato guardado.",
    prefsReset: "Restablec\xED tus preferencias.",
    rowMovies: "Estrenos en latino",
    rowSeries: "Series en latino",
    rowHackstore: "Reci\xE9n agregadas",
    rowHackstoreSeries: "Series reci\xE9n agregadas",
    panelTitle: "Latino",
    tabCopy: "Esta copia",
    tabSummary: "Resumen",
    tabAvail: "Disponibilidad",
    tabPrefs: "Preferencias",
    tabFail: "Si falla",
    tabError: "No se pudo cargar esta pesta\xF1a",
    nowPlaying: "Reproduciendo ahora",
    copyLang: "Idioma: {v}",
    copyQuality: "Calidad: {v}",
    copyServer: "Servidor: {v}",
    copySite: "Fuente: {v}",
    copyManual: "Cambiaste de copia: la elegida sola era {v}",
    copyChosen: "Elegida entre {n} copias",
    copyChosenOne: "Elegida entre 1 copia",
    copyNoInfo: "Todav\xEDa no s\xE9 qu\xE9 copia suena.",
    statResolution: "Imagen {v}",
    statNetwork: "Red {v}",
    statStalls: "Cortes en esta sesi\xF3n: {v}",
    netWifi: "Wi-Fi",
    netEthernet: "cable",
    netCellular: "datos m\xF3viles",
    netOther: "otra red",
    availNoTmdb: "Este t\xEDtulo no tiene ficha para revisar",
    availPartial: "Respuesta parcial: algunas fuentes no contestaron",
    availSeasons: "Temporadas sin versi\xF3n en espa\xF1ol: {v}",
    availNone: "Ninguna fuente contest\xF3 con copias de este t\xEDtulo",
    prefPreferred: "Idioma preferido",
    prefMaxQuality: "Calidad m\xE1xima",
    langLat: "Latino",
    langEsp: "Castellano",
    langSub: "Subtitulado",
    qAuto: "Autom\xE1tica",
    qUpTo: "Hasta {v}",
    qUpTo480: "Hasta 480p (ahorra datos)",
    prefAvoid: "Evitar {v}",
    prefAvoidHint: "Pasa al final de la lista, no se borra",
    prefReset: "Restablecer preferencias",
    prefResetConfirm: "\xBFVolver a tus ajustes de siempre?",
    prefApplies: "Se aplica al abrir la pr\xF3xima copia",
    prefSaved: "Listo: se aplica en la pr\xF3xima copia",
    nextEp: "Siguiente: T{s} \xB7 E{e}{tail}",
    nextSeason: "Siguiente: temporada {s}, E{e}{tail}",
    nextEnd: "Fin de la temporada {s}",
    nextSpanish: "en espa\xF1ol en {v}",
    nextSubOnly: "solo subtitulado",
    nextNone: "no encontrado en espa\xF1ol",
    nextChecking: "comprobando\u2026",
    prefNow: "Ahora: {v}",
    prefFirst: "{v} primero",
    prefUpTo: "hasta {v}",
    prefAutoQ: "calidad autom\xE1tica",
    prefAvoidList: "evitar: {v}",
    failTips: "Si una copia no abre: prueba otra desde el men\xFA Servidor, revisa tu Wi-Fi o int\xE9ntalo m\xE1s tarde.",
    availNoEpisode: "sin este cap\xEDtulo",
    availNoTitle: "sin esta pel\xEDcula",
    availSeasonGone: "Esta temporada no tiene versi\xF3n en espa\xF1ol",
    prefWins: "Lo que cambies aqu\xED manda sobre Ajustes hasta que uses Restablecer (abajo)",
    failAllGood: "Todo bien: en esta sesi\xF3n no ha fallado ninguna copia",
    failTimeout: "El servidor tard\xF3 en contestar",
    failNetwork: "No hubo conexi\xF3n con el servidor",
    failNotFound: "El servidor ya no tiene esta copia",
    failUnavailable: "El servidor no est\xE1 disponible ahora",
    failGeneric: "La copia no abri\xF3",
    failTried: "Copias probadas: {v}",
    failHowTo: "Abre el men\xFA Servidor del reproductor para elegir otra copia",
    failReport: "Avisar de esta copia",
    failReportConfirm: "Se enviar\xE1 un aviso t\xE9cnico sin datos personales",
    failReported: "Listo: se env\xEDa el aviso si tienes los reportes activados",
    failAlready: "Ya avis\xE9 de esta copia en las \xFAltimas 12 horas",
    failReportOff: "El aviso no est\xE1 activo en Ajustes",
    stallsHint: "Se ha cortado {n} veces: mira la pesta\xF1a Si falla",
    sumRating: "Calificaci\xF3n {v}",
    sumCast: "Reparto: {v}",
    tabHome: "Inicio",
    tabMovies: "Pel\xEDculas",
    tabSeries: "Series",
    brWatch: "Ver",
    dEpisodeN: "Episodio {n}",
    dSeasonN: "Temporada {n}",
    dSeasonsN: "{n} temporadas",
    dSeriesGo: "Ver episodios",
    dMore: "M\xE1s opciones",
    dCreators: "Creaci\xF3n: {v}",
    dDirector: "Direcci\xF3n: {v}",
    dCast: "Reparto",
    dEpisodes: "Episodios",
    dSimilar: "M\xE1s como esto",
    dSeeInKino: "Ver en Kino",
    brMore: "Ver m\xE1s",
    brInfo: "M\xE1s informaci\xF3n",
    brRecent: "Continuar viendo",
    brSearch: "Buscar",
    brSearchHint: "Buscar en Latino",
    brSearchTitle: "Buscar",
    brSearchedBefore: "Buscado recientemente",
    brNoResults: "No encontramos nada con esas palabras.",
    brSearchFailed: "No se pudo buscar. Revisa tu conexi\xF3n e int\xE9ntalo de nuevo.",
    brFailed: "No se pudo cargar esta secci\xF3n. Revisa tu conexi\xF3n e int\xE9ntalo de nuevo.",
    brRetry: "Reintentar",
    brEmpty: "A\xFAn no hay nada aqu\xED.",
    brBack: "Atr\xE1s",
    brClose: "Cerrar",
    brSettings: "Configuraci\xF3n",
    seriesGenre: "Series de {g}",
    badge_2160p: "4K",
    g_accion: "Acci\xF3n",
    g_comedia: "Comedia",
    g_drama: "Drama",
    g_terror: "Terror",
    g_suspense: "Suspenso",
    g_animacion: "Animaci\xF3n",
    g_crimen: "Crimen",
    g_aventura: "Aventura",
    g_romance: "Romance",
    g_familia: "Familia",
    g_misterio: "Misterio",
    "g_ciencia-ficcion": "Ciencia ficci\xF3n",
    g_fantasia: "Fantas\xEDa",
    "g_sci-fi-fantasy": "Ciencia ficci\xF3n y fantas\xEDa",
    "g_action-adventure": "Acci\xF3n y aventura",
    g_documental: "Documental",
    g_historia: "Historia",
    g_musica: "M\xFAsica",
    g_belica: "B\xE9lica",
    g_western: "Del Oeste",
    g_kids: "Infantil",
    "g_war-politics": "Guerra y pol\xEDtica",
    g_reality: "Reality"
  },
  en: {
    notFound: "I couldn't find this title in Spanish.",
    seasonMissing: "Latino doesn't have season {season} of {title} in Spanish yet.",
    episodeMissing: "Latino doesn't have episode {episode} of season {season} of {title} in Spanish yet.",
    notInSpanish: "not available in Spanish",
    sourcesDown: "The Spanish sources aren't answering right now.",
    tmdbDown: "TMDB isn't answering right now. Try again in a while.",
    noPlayable: "I found the title, but no copy opened. Try again in a while.",
    needResolver: "To play, open Latino from the menu and install the playback engine it asks for.",
    copyFailed: "This copy didn't open. Try another server.",
    lat: "Latin Spanish",
    esp: "Spain Spanish",
    sub: "Subtitled",
    direct: "Direct",
    keepOneSource: "Keep at least one source on.",
    healthOk: "ok",
    healthFail: "fails",
    healthNone: "no data",
    healthOff: "off",
    probeDone: "Tested the sources with a sample title: {ok} answer, {fail} fail.",
    probeNoTmdb: "I couldn't reach TMDB for the test. Try again in a while.",
    probeNone: "No sources are on to test.",
    cacheCleared: "Done: cleared {n} saved items.",
    cacheClearedOne: "Done: cleared 1 saved item.",
    prefsReset: "Your preferences are back to the defaults.",
    rowMovies: "New in Latin Spanish",
    rowSeries: "Series in Latin Spanish",
    rowHackstore: "Just added",
    rowHackstoreSeries: "Series just added",
    panelTitle: "Latino",
    tabCopy: "This copy",
    tabSummary: "Summary",
    tabAvail: "Availability",
    tabPrefs: "Preferences",
    tabFail: "If it fails",
    tabError: "This tab couldn't load",
    nowPlaying: "Playing now",
    copyLang: "Language: {v}",
    copyQuality: "Quality: {v}",
    copyServer: "Server: {v}",
    copySite: "Source: {v}",
    copyManual: "You switched copies: the automatic pick was {v}",
    copyChosen: "Chosen from {n} copies",
    copyChosenOne: "Chosen among 1 copy",
    copyNoInfo: "I don't know yet which copy is playing.",
    statResolution: "Picture {v}",
    statNetwork: "Network {v}",
    statStalls: "Stalls this session: {v}",
    netWifi: "Wi-Fi",
    netEthernet: "wired",
    netCellular: "mobile data",
    netOther: "other network",
    availNoTmdb: "This title has no page to check",
    availPartial: "Partial answer: some sources did not reply",
    availSeasons: "Seasons without a Spanish version: {v}",
    availNone: "No source answered with copies of this title",
    prefPreferred: "Preferred language",
    prefMaxQuality: "Maximum quality",
    langLat: "Latin Spanish",
    langEsp: "Castilian",
    langSub: "Subtitled",
    qAuto: "Automatic",
    qUpTo: "Up to {v}",
    qUpTo480: "Up to 480p (saves data)",
    prefAvoid: "Avoid {v}",
    prefAvoidHint: "Moves to the end of the list, never removed",
    prefReset: "Reset preferences",
    prefResetConfirm: "Go back to your usual settings?",
    prefApplies: "Applies when the next copy opens",
    prefSaved: "Done: applies on the next copy",
    nextEp: "Next: S{s} \xB7 E{e}{tail}",
    nextSeason: "Next: season {s}, E{e}{tail}",
    nextEnd: "End of season {s}",
    nextSpanish: "in Spanish on {v}",
    nextSubOnly: "subtitled only",
    nextNone: "not found in Spanish",
    nextChecking: "checking\u2026",
    prefNow: "Now: {v}",
    prefFirst: "{v} first",
    prefUpTo: "up to {v}",
    prefAutoQ: "automatic quality",
    prefAvoidList: "avoid: {v}",
    failTips: "If a copy won't open: try another from the Server menu, check your Wi-Fi or try again later.",
    availNoEpisode: "no copy of this episode",
    availNoTitle: "no copy of this film",
    availSeasonGone: "This season has no Spanish version",
    prefWins: "What you change here beats Settings until you use Reset (below)",
    failAllGood: "All good: no copy has failed in this session",
    failTimeout: "The server took too long to answer",
    failNetwork: "There was no connection to the server",
    failNotFound: "The server no longer has this copy",
    failUnavailable: "The server isn't available right now",
    failGeneric: "The copy didn't open",
    failTried: "Copies tried: {v}",
    failHowTo: "Open the player's Server menu to pick another copy",
    failReport: "Report this copy",
    failReportConfirm: "A technical notice with no personal data will be sent",
    failReported: "Done: the notice is sent if you have reports turned on",
    failAlready: "I already reported this copy in the last 12 hours",
    failReportOff: "Reporting isn't turned on in Settings",
    stallsHint: 'Playback has stalled {n} times: see the "If it fails" tab',
    sumRating: "Rating {v}",
    sumCast: "Cast: {v}",
    tabHome: "Home",
    tabMovies: "Movies",
    tabSeries: "Series",
    brWatch: "Watch",
    dEpisodeN: "Episode {n}",
    dSeasonN: "Season {n}",
    dSeasonsN: "{n} seasons",
    dSeriesGo: "Watch episodes",
    dMore: "More options",
    dCreators: "Created by: {v}",
    dDirector: "Directed by: {v}",
    dCast: "Cast",
    dEpisodes: "Episodes",
    dSimilar: "More like this",
    dSeeInKino: "Open in Kino",
    brMore: "See more",
    brInfo: "More info",
    brRecent: "Continue watching",
    brSearch: "Search",
    brSearchHint: "Search Latino",
    brSearchTitle: "Search",
    brSearchedBefore: "Recently searched",
    brNoResults: "Nothing matched those words.",
    brSearchFailed: "The search failed. Check your connection and try again.",
    brFailed: "This section could not be loaded. Check your connection and try again.",
    brRetry: "Retry",
    brEmpty: "Nothing here yet.",
    brBack: "Back",
    brClose: "Close",
    brSettings: "Settings",
    seriesGenre: "{g} series",
    badge_2160p: "4K",
    g_accion: "Action",
    g_comedia: "Comedy",
    g_drama: "Drama",
    g_terror: "Horror",
    g_suspense: "Thriller",
    g_animacion: "Animation",
    g_crimen: "Crime",
    g_aventura: "Adventure",
    g_romance: "Romance",
    g_familia: "Family",
    g_misterio: "Mystery",
    "g_ciencia-ficcion": "Science fiction",
    g_fantasia: "Fantasy",
    "g_sci-fi-fantasy": "Sci-fi and fantasy",
    "g_action-adventure": "Action and adventure",
    g_documental: "Documentary",
    g_historia: "History",
    g_musica: "Music",
    g_belica: "War",
    g_western: "Western",
    g_kids: "Kids",
    "g_war-politics": "War and politics",
    g_reality: "Reality"
  }
};
function langOf(kino2 = globalThis.kino) {
  return String(kino2 && kino2.lang || "").toLowerCase().startsWith("en") ? "en" : "es";
}
function t(key, kino2 = globalThis.kino) {
  const words = WORDS[langOf(kino2)];
  return words[key] ?? WORDS.es[key] ?? key;
}
function tf(key, vars, kino2 = globalThis.kino) {
  return t(key, kino2).replace(/\{(\w+)\}/g, (m, k) => vars && vars[k] != null ? String(vars[k]) : m);
}
var both = (key, vars) => {
  const one = (lang) => tf(key, vars && Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, typeof v === "function" ? v(lang) : v])), { lang });
  return { es: one("es"), en: one("en") };
};
var KEYS = { es: Object.keys(WORDS.es), en: Object.keys(WORDS.en) };

// src/browse/detail.js
var HTTPS2 = /^https:\/\//;
var MAX_EPISODES = 80;
var MAX_CAST = 12;
var LEAD_MAX = 140;
var TMDB_IMG = "https://image.tmdb.org/t/p/w342";
var twin = (key, field = "text", vars) => {
  const w = both(key, vars);
  return { [field]: w.es, [field + "En"]: w.en };
};
var same = (text2) => ({ text: text2, textEn: text2 });
var num = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
};
var https = (v) => typeof v === "string" && HTTPS2.test(v) && v.length <= 2048 ? v : void 0;
function titleRefOf(ref) {
  const m = /^([ms]):(\d{1,10})$/.exec(String(ref || ""));
  return m ? { kind: m[1] === "m" ? "movie" : "series", id: Number(m[2]) } : null;
}
var opensPage = (card) => !!card && (card.kind === "movie" || card.kind === "series") && typeof card.ref === "string" && card.ref.length < 600 && typeof card.id === "string";
var cardNode = (card, size, scope) => ({
  type: "titleCard",
  key: `${scope}-${card.id}`,
  size,
  item: card,
  ...opensPage(card) ? { onTap: { event: "openTitle", arg: JSON.stringify(openArgs(card)) } } : {}
});
var cardRow = (items, key, size) => ({ type: "SingleChildScrollView", key: key + "-s", direction: "horizontal", children: [{ type: "Row", key: key + "-r", gap: 12, children: items.map((c) => cardNode(c, size, key)) }] });
var cardGrid = (items, key) => ({ type: "GridView", key, columns: { compact: 3, expanded: 6 }, children: items.map((c) => cardNode(c, "medium", key)) });
function pushOf(arg) {
  let a = null;
  try {
    a = JSON.parse(String(arg));
  } catch (_) {
    a = null;
  }
  if (!a || typeof a.open !== "string" || typeof a.i !== "string" || a.k !== "movie" && a.k !== "series") return null;
  return { push: "detail", params: { open: a.open, i: a.i, t: typeof a.t === "string" ? a.t.slice(0, 100) : "", k: a.k, d: Number(a.d) || 0, y: Number(a.y) || 0 } };
}
function backdropsOf(images, first) {
  const base = "https://image.tmdb.org/t/p/w780";
  const list = (images && images.backdrops || []).filter((b) => b && typeof b.file_path === "string" && b.file_path.startsWith("/") && b.width >= 1e3).sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0)).map((b) => base + b.file_path);
  const out = [];
  for (const u of [first, ...list]) if (u && !out.some((x) => x.slice(x.lastIndexOf("/")) === u.slice(u.lastIndexOf("/")))) out.push(u);
  return out.slice(0, 6);
}
function openArgs(card) {
  const r = titleRefOf(card.ref);
  const tmdb = r ? r.id : card.ids && Number.isInteger(card.ids.tmdb) ? card.ids.tmdb : 0;
  const year = card.year ? num(card.year) : 0;
  return { open: card.ref, i: card.id, t: String(card.title || "").slice(0, 100), k: card.kind, ...tmdb ? { d: tmdb } : {}, ...year ? { y: year } : {} };
}
var hoursOf = (min) => {
  const m = num(min);
  return m > 0 ? m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min` : "";
};
var MONTHS = {
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
};
var dateText = (iso) => {
  const [y, m, d] = String(iso).split("-").map(Number);
  return m >= 1 && m <= 12 ? { es: `${d} ${MONTHS.es[m - 1]} ${y}`, en: `${MONTHS.en[m - 1]} ${d}, ${y}` } : { es: iso, en: iso };
};
async function loadDetail(args) {
  const kind = args.k === "movie" ? "movie" : "series";
  const tmdbId = Number(args.d) || 0;
  const year = Number(args.y) || 0;
  let meta2 = null;
  if (typeof kino.meta === "function") {
    if (tmdbId) meta2 = await kino.meta({ type: kind, ids: { tmdb: tmdbId } }).catch(() => null);
    if (!meta2 && kino.meta.byTitle === true && args.t) meta2 = await kino.meta({ type: kind, title: String(args.t), ...year >= 1870 && year <= 2100 ? { year } : {} }).catch(() => null);
  }
  if (!meta2) throw Object.assign(new Error("no meta"), { code: "not_found" });
  const ids = meta2.ids || (tmdbId ? { tmdb: tmdbId } : {});
  const d = {
    kind,
    title: String(meta2.title || args.t || "").slice(0, 200),
    overview: String(meta2.overview || ""),
    year: num(meta2.year),
    backdrop: https(meta2.backdrop) || https(meta2.poster),
    logo: https(meta2.logo),
    genres: (meta2.genres || []).filter((g) => typeof g === "string").slice(0, 4),
    runtime: num(meta2.runtimeMinutes),
    tagline: String(meta2.tagline || ""),
    certification: String(meta2.certification || ""),
    directors: (meta2.directors || []).slice(0, 3),
    ratings: (meta2.ratings || []).slice(0, 3),
    cast: (meta2.cast || []).slice(0, MAX_CAST),
    ids,
    episodes: [],
    similar: []
  };
  if (kind === "series") {
    d.episodes = (Array.isArray(meta2.episodes) ? meta2.episodes : []).filter((e) => num(e.season) >= 1 && num(e.number) >= 1).slice(0, 600).map((e) => ({ s: num(e.season), n: num(e.number), title: String(e.title || "").slice(0, 120), overview: String(e.overview || "").slice(0, 110), still: https(e.still), air: /^\d{4}-\d{2}-\d{2}/.test(String(e.airDate || "")) ? String(e.airDate).slice(0, 10) : "" }));
  }
  if (ids.tmdb && typeof kino.tmdb === "function") {
    try {
      const credits = await kino.tmdb(`/${kind === "movie" ? "movie" : "tv"}/${ids.tmdb}/credits`, { language: "es-MX" });
      const cast = (credits && credits.cast || []).filter((c) => c && c.name).slice(0, MAX_CAST).map((c) => ({ name: String(c.name), character: String(c.character || ""), photo: typeof c.profile_path === "string" && c.profile_path.startsWith("/") ? "https://image.tmdb.org/t/p/w185" + c.profile_path : void 0 }));
      if (cast.length) d.cast = cast;
    } catch (_) {
    }
    try {
      d.images = backdropsOf(await kino.tmdb(`/${kind === "movie" ? "movie" : "tv"}/${ids.tmdb}/images`, { include_image_language: "null,es,en" }), d.backdrop);
    } catch (_) {
    }
    try {
      const data = await kino.tmdb(`/${kind === "movie" ? "movie" : "tv"}/${ids.tmdb}/recommendations`, { language: "es-MX" });
      d.similar = (data && data.results || []).filter((x) => x && x.id && (x.title || x.name) && x.poster_path).slice(0, 12).map((x) => ({
        id: (kind === "movie" ? "m-" : "s-") + x.id,
        ref: (kind === "movie" ? "m:" : "s:") + x.id,
        kind,
        title: String(x.title || x.name).slice(0, 200),
        poster: TMDB_IMG + x.poster_path,
        ids: { tmdb: x.id }
      }));
    } catch (_) {
    }
  }
  return d;
}
var heroSkeleton = () => ({ type: "Skeleton", key: "heroSkeleton", shape: "block", height: { compact: 200, expanded: 320 } });
var railSkeleton = () => ({
  type: "Column",
  key: "dskel1",
  gap: 8,
  children: [
    { type: "Skeleton", shape: "line", width: 120 },
    { type: "Row", gap: 12, children: [1, 2, 3].map((i) => ({ type: "Skeleton", shape: "card", key: `dsk${i}`, flex: 1 })) }
  ]
});
var sectionTitle = (key) => ({ type: "Text", ...twin(key), style: "h4" });
var episodeGo = (d, r) => ({ go: { title: { ref: r.ref, kind: "series", id: r.id, title: d.title } } });
function episodeRow(d, r, ep) {
  const facts = ep.air ? dateText(ep.air) : null;
  const heading = ep.title ? { text: `${ep.n}. ${ep.title}`, textEn: `${ep.n}. ${ep.title}` } : twin("dEpisodeN", "text", { n: ep.n });
  return {
    type: "Row",
    key: `ep-${ep.s}-${ep.n}`,
    gap: 12,
    crossAxisAlignment: "center",
    onTap: episodeGo(d, r),
    canRequestFocus: true,
    children: [
      { type: "Image", key: `epi-${ep.s}-${ep.n}`, width: 120, aspect: "16:9", fit: "cover", radius: "medium", ...ep.still ? { url: ep.still } : {}, fallback: { type: "Skeleton", shape: "block", height: 64 } },
      { type: "Column", flex: 1, gap: 4, children: [
        { type: "Text", bold: true, maxLines: 2, ...heading },
        ...facts ? [{ type: "Text", style: "caption", color: "muted", text: facts.es, textEn: facts.en }] : [],
        ...ep.overview ? [{ type: "Text", style: "caption", color: "muted", maxLines: 2, ...same(ep.overview) }] : []
      ] }
    ]
  };
}
function castItem(c) {
  const name = String(c.name || "").slice(0, 60);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return {
    type: "Column",
    key: "cast-" + name.replace(/[^A-Za-z0-9]/g, "").slice(0, 24) + "-" + String(c.character || "").length,
    width: 96,
    gap: 4,
    crossAxisAlignment: "center",
    canRequestFocus: true,
    children: [
      { type: "CircleAvatar", radius: 32, ...https(c.photo) ? { image: https(c.photo) } : {}, text: initials, textEn: initials },
      { type: "Text", ...same(name), style: "caption", maxLines: 2 },
      ...c.character ? [{ type: "Text", ...same(String(c.character).slice(0, 40)), style: "caption", color: "muted", maxLines: 1 }] : []
    ]
  };
}
function detailView({ r, entry, season, logo: logo2, back }) {
  const d = entry && entry.d;
  const appBar = { type: "AppBar", mergeWithKinoBar: true, dense: true, divider: false, leading: back, title: logo2 };
  const body = [];
  let hero2 = null;
  if (!entry) {
    hero2 = heroSkeleton();
    body.push(railSkeleton());
  } else if (!d) {
    body.push({ type: "MaterialBanner", key: "detailFailed", role: "error", ...twin("brFailed"), action: { ...twin("brRetry", "label"), onTap: "dretry" } });
    body.push({ type: "ElevatedButton", key: "dkino", icon: "play", ...twin("dSeeInKino", "labelText"), onPressed: { go: { title: { ref: r.ref, kind: r.kind, id: r.id, title: r.title } } } });
  } else {
    const series = d.kind === "series";
    const seasons = [...new Set(d.episodes.map((e) => e.s))].sort((a, b) => a - b);
    const shown = seasons.includes(season) ? season : seasons[0];
    const toKino = { go: { title: { ref: r.ref, kind: d.kind, id: r.id, title: r.title || d.title } } };
    const buttons = series ? [{ type: "ElevatedButton", key: "dplay", ...twin("dSeriesGo", "labelText"), icon: "play", autofocus: true, onPressed: toKino }] : [
      { type: "ElevatedButton", key: "dplay", ...twin("brWatch", "labelText"), icon: "play", autofocus: true, onPressed: { go: { play: { ref: r.ref, kind: "movie", id: r.id, title: d.title } } } },
      { type: "TextButton", key: "dmore", ...twin("dMore", "labelText"), onPressed: toKino }
    ];
    const lead = d.tagline || (d.overview.length <= LEAD_MAX ? d.overview : d.overview.slice(0, LEAD_MAX - 1).trimEnd() + "\u2026");
    const images = (d.images && d.images.length ? d.images : [d.backdrop || ""]).slice(0, 6);
    const slide = (image, i) => ({
      type: "heroCard",
      key: i ? "dhero-" + i : "dhero",
      h: { compact: 240, expanded: 320 },
      title: d.title,
      titleEn: d.title,
      ...lead ? same(lead) : {},
      ...image ? { image } : {},
      ...d.logo ? { logo: d.logo } : {},
      buttons: i ? buttons.map((b) => ({ ...b, key: b.key + "-" + i, autofocus: false })) : buttons
    });
    hero2 = images.length > 1 ? { type: "PageView", key: "hero" + images.length, autoPlayMs: 6e3, children: images.map(slide) } : slide(images[0], 0);
    const rating = d.ratings.find((x) => x.source === "imdb") || d.ratings.find((x) => x.source === "tmdb");
    const facts = [];
    if (rating) facts.push("\u2605 " + rating.value);
    if (d.year) facts.push(String(d.year));
    if (d.certification) facts.push(d.certification);
    if (d.runtime) facts.push(hoursOf(d.runtime));
    const es = facts.concat(series && seasons.length ? [both("dSeasonsN", { n: seasons.length }).es] : []);
    const en = facts.concat(series && seasons.length ? [both("dSeasonsN", { n: seasons.length }).en] : []);
    if (es.length) body.push({ type: "Text", key: "dfacts", style: "h4", text: es.join("  \xB7  "), textEn: en.join("  \xB7  ") });
    if (d.genres.length) body.push({ type: "Row", key: "dgenres", gap: 8, children: d.genres.map((g, i) => ({ type: "Badge", key: "dg-" + i, ...same(g) })) });
    if (d.overview) body.push({ type: "Text", key: "dsynopsis", canRequestFocus: true, ...same(d.overview) });
    if (d.directors.length) body.push({ type: "Text", ...twin(series ? "dCreators" : "dDirector", "text", { v: d.directors.join(", ") }), color: "muted" });
    if (d.cast.length) {
      body.push(sectionTitle("dCast"));
      body.push({ type: "SingleChildScrollView", key: "dcast", direction: "horizontal", children: [{ type: "Row", gap: 12, children: d.cast.map(castItem) }] });
    }
    if (series && seasons.length) {
      body.push(seasons.length > 1 ? { type: "DropdownButton", key: "dseason", value: String(shown), onChanged: "season", options: seasons.map((s) => {
        const w = both("dSeasonN", { n: s });
        return { value: String(s), label: w.es, labelEn: w.en };
      }) } : sectionTitle("dEpisodes"));
      for (const ep of d.episodes.filter((e) => e.s === shown).slice(0, MAX_EPISODES)) body.push(episodeRow(d, r, ep));
    }
    if (d.similar.length) {
      body.push(sectionTitle("dSimilar"));
      body.push(cardRow(d.similar, "dsimilar", "small"));
    }
  }
  return {
    type: "Scaffold",
    appBar,
    body: { type: "SingleChildScrollView", key: "detail-page", children: [...hero2 ? [hero2] : [], { type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: body }] },
    ...!entry ? { every: { ms: 1e3, event: "dtick" } } : {}
  };
}

// src/browse/view.js
var TAB_KEYS = { inicio: "tabHome", peliculas: "tabMovies", series: "tabSeries" };
var POLL_MS = 1500;
var SEARCH_CAP = 60;
var twin2 = (key, field = "text", vars) => {
  const w = both(key, vars);
  return { [field]: w.es, [field + "En"]: w.en };
};
var logo = () => ({ type: "Text", key: "logo", text: "SoloLatino", textEn: "SoloLatino", style: "h4" });
var tabBar = (active) => ({ type: "TabBar", key: "tabs", divider: false, value: active, onChanged: "tab", tabs: TAB_IDS.map((id) => ({ value: id, ...twin2(TAB_KEYS[id], "label") })) });
var railSkeleton2 = (n) => ({
  type: "Column",
  key: "skel" + n,
  gap: 8,
  children: [
    { type: "Skeleton", shape: "line", width: 120 },
    { type: "Row", gap: 12, sizes: ["compact"], children: [1, 2, 3].map((i) => ({ type: "Skeleton", shape: "card", key: `sk${n}c${i}`, flex: 1 })) },
    { type: "Row", gap: 12, sizes: ["medium", "expanded"], children: [1, 2, 3, 4, 5, 6].map((i) => ({ type: "Skeleton", shape: "card", key: `sk${n}w${i}`, flex: 1 })) }
  ]
});
var gridSkeleton = () => ({
  type: "Column",
  key: "gridSkeleton",
  gap: 12,
  children: [
    ...[1, 2].map((r) => ({ type: "Row", gap: 12, sizes: ["compact"], key: `gc${r}`, children: [1, 2, 3].map((i) => ({ type: "Skeleton", shape: "card", key: `gc${r}-${i}`, flex: 1 })) })),
    ...[1, 2].map((r) => ({ type: "Row", gap: 12, sizes: ["medium", "expanded"], key: `gw${r}`, children: [1, 2, 3, 4, 5, 6].map((i) => ({ type: "Skeleton", shape: "card", key: `gw${r}-${i}`, flex: 1 })) }))
  ]
});
var heroSkeleton2 = () => ({ type: "Skeleton", key: "heroSkeleton", shape: "block", height: { compact: 200, expanded: 320 } });
var slideNode = (s) => ({
  type: "heroCard",
  key: "slide-" + s.id,
  h: { compact: 200, expanded: 240 },
  ...s.logo ? { logo: s.logo } : {},
  title: s.title,
  text: s.text,
  image: s.image,
  buttons: [
    {
      type: "ElevatedButton",
      key: "watch-" + s.id,
      ...twin2("brWatch", "labelText"),
      icon: "play",
      onPressed: { go: { play: { ref: s.ref, kind: s.kind, id: s.id, title: s.title } } }
    },
    {
      type: "TextButton",
      key: "info-" + s.id,
      ...twin2("brInfo", "labelText"),
      onPressed: s.kind === "movie" || s.kind === "series" ? { go: { screen: { args: openArgs(s) } } } : { go: { title: { ref: s.ref, kind: s.kind, id: s.id, title: s.title } } }
    }
  ]
});
var hero = (slides) => slides.length === 1 ? slideNode(slides[0]) : {
  type: "PageView",
  key: "hero" + slides.length,
  autoPlayMs: 6e3,
  children: slides.map(slideNode)
};
var rail = (r, key, titleOverride) => ({
  type: "Column",
  key,
  gap: 8,
  children: [
    { type: "Row", key: key + "-h", crossAxisAlignment: "center", children: [
      { type: "Text", style: "h4", flex: 1, text: titleOverride ? titleOverride.title : r.title, textEn: titleOverride ? titleOverride.titleEn : r.title },
      ...r.ref ? [{ type: "TextButton", key: key + "-more", ...twin2("brMore", "labelText"), onPressed: { go: { browse: { ref: r.ref, title: r.title } } } }] : []
    ] },
    cardRow(r.items, key, "medium")
  ]
});
function browseView({ tab, data, recent, pending, failed, device = "phone" }) {
  const tv = device === "tv";
  const gear = { type: "IconButton", key: "settingsButton", icon: "settings", ...twin2("brSettings", "labelText"), ...twin2("brSettings", "tooltip"), onPressed: { event: "go", arg: "settings" } };
  const active = TAB_IDS.includes(tab) ? tab : TAB_IDS[0];
  const body = [];
  if (data) {
    if (data.slides.length > 0) body.push(hero(data.slides));
    if (recent.length > 0) body.push(rail({ items: recent }, "recent", twin2("brRecent", "title")));
    for (const r of data.rails) body.push(rail(r, "rail-" + String(r.id).replace(/[^A-Za-z0-9_-]/g, "_")));
    if (data.rails.length === 0) body.push({ type: "Text", ...twin2("brEmpty", "text"), color: "muted" });
  } else if (failed) {
    body.push({
      type: "MaterialBanner",
      key: "loadFailed",
      role: "error",
      ...twin2("brFailed"),
      action: { ...twin2("brRetry", "label"), onTap: "retry" }
    });
  } else {
    body.push(heroSkeleton2(), railSkeleton2(1), railSkeleton2(2), railSkeleton2(3));
  }
  const isBanner = (n) => !!n && (n.type === "heroCard" || n.key === "heroSkeleton" || n.type === "PageView" && String(n.key).startsWith("hero"));
  const banner = body.length > 0 && isBanner(body[0]) ? body.shift() : null;
  return {
    type: "Scaffold",
    appBar: {
      type: "AppBar",
      // One bar instead of two (Kino 0.9.81+; an older Kino draws its own bar above and this one under it): the close button where
      // Kino's was and the plugin's logo where its name was (its name when the logo cannot be drawn), with no line under it.
      mergeWithKinoBar: true,
      dense: true,
      divider: false,
      leading: { type: "IconButton", key: "close", icon: "close", ...twin2("brClose", "labelText"), ...twin2("brClose", "tooltip"), onPressed: { go: { close: true } } },
      // On a TV the search is a button of the bar (a floating one is hard to reach with a remote); elsewhere it floats.
      actions: tv ? [{ type: "IconButton", key: "searchButton", icon: "search", ...twin2("brSearch", "labelText"), ...twin2("brSearch", "tooltip"), onPressed: "openSearch" }, gear] : [gear],
      title: tv ? { type: "Row", key: "titleRow", gap: 24, crossAxisAlignment: "center", children: [logo(), tabBar(active)] } : logo()
    },
    ...tv ? {} : { floatingActionButton: { type: "FloatingActionButton", key: "searchFab", icon: "search", ...twin2("brSearch", "tooltip"), onPressed: "openSearch" } },
    // The tabs stay pinned under the bar; only the rows scroll.
    body: { type: "Column", key: "page", children: [
      // The tabs line up with the bar's buttons and the cards below (a wide window and the TV pad their content by 24).
      ...tv ? [] : [{ type: "Column", key: "tabsRow", padding: { compact: 0, expanded: 24 }, children: [tabBar(active)] }],
      { type: "SingleChildScrollView", key: "browse-" + active, flex: 1, children: [...banner ? [banner] : [], { type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: body }] }
    ] },
    ...pending ? { every: { ms: POLL_MS, event: "tick" } } : {}
  };
}
function settingsView() {
  return {
    type: "Scaffold",
    appBar: {
      type: "AppBar",
      mergeWithKinoBar: true,
      dense: true,
      divider: false,
      leading: { type: "IconButton", key: "back", icon: "arrow_back", ...twin2("brBack", "labelText"), ...twin2("brBack", "tooltip"), onPressed: "back" },
      title: logo()
    },
    body: { type: "SingleChildScrollView", key: "settings-page", children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: [{ type: "settings", key: "form" }] }] }
  };
}
function searchView({ query, status, items, history = [], device = "phone" }) {
  const tv = device === "tv";
  const searchForm = () => ({
    type: "Form",
    key: "searchForm",
    onSubmitted: "search",
    gap: 8,
    children: tv ? [{ type: "Row", key: "searchRow", gap: 16, crossAxisAlignment: "center", children: [
      { type: "TextField", key: "q", kind: "text", value: query, ...twin2("brSearchHint", "labelText"), maxLength: 100, autofocus: true, weight: 1 },
      { type: "ElevatedButton", key: "searchGo", ...twin2("brSearch", "labelText"), icon: "search", submit: true }
    ] }] : [
      { type: "TextField", key: "q", kind: "text", value: query, ...twin2("brSearchHint", "labelText"), maxLength: 100, autofocus: true },
      { type: "ElevatedButton", key: "searchGo", ...twin2("brSearch", "labelText"), icon: "search", submit: true }
    ]
  });
  const body = tv ? [] : [searchForm()];
  if (status === "fail") {
    body.push({ type: "MaterialBanner", key: "searchFailed", role: "error", ...twin2("brSearchFailed"), action: { ...twin2("brRetry", "label"), onTap: "sretry" } });
  } else if (status === "done" && items) {
    if (items.length === 0) body.push({ type: "Text", ...twin2("brNoResults", "text"), color: "muted" });
    else body.push(cardGrid(items.slice(0, SEARCH_CAP), "results"));
  } else if (status !== "idle") {
    body.push(gridSkeleton());
  } else if (history.length > 0) {
    body.push({ type: "Text", ...twin2("brSearchedBefore", "text"), style: "h4" });
    body.push(cardGrid(history.slice(0, SEARCH_CAP), "history"));
  }
  return {
    type: "Scaffold",
    appBar: {
      type: "AppBar",
      mergeWithKinoBar: true,
      dense: true,
      divider: false,
      leading: { type: "IconButton", key: "back", icon: "arrow_back", ...twin2("brBack", "labelText"), ...twin2("brBack", "tooltip"), onPressed: "back" },
      ...tv ? { title: searchForm() } : twin2("brSearchTitle", "title")
    },
    body: { type: "SingleChildScrollView", key: "search-page", children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: body }] },
    ...status === "loading" ? { every: { ms: 1e3, event: "stick" } } : {}
  };
}
function detailPage({ r, entry, season }) {
  const back = { type: "IconButton", key: "back", icon: "arrow_back", ...twin2("brBack", "labelText"), ...twin2("brBack", "tooltip"), onPressed: "back" };
  return detailView({ r, entry, season, logo: logo(), back });
}

// src/browse/metaCache.js
var KEY = "meta1";
var MAX = 120;
var CALL_MS = 8e3;
var HTTPS3 = /^https:\/\//;
function makeMetaCache({ kino: kino2, clock = { now: () => Date.now() } }) {
  const usable = () => {
    try {
      return typeof kino2.meta === "function" && kino2.meta.byTitle === true;
    } catch (_) {
      return false;
    }
  };
  let book = null;
  function read() {
    if (book) return book;
    try {
      const o = JSON.parse(kino2.storage.get(KEY) || "null");
      book = o && typeof o === "object" && !Array.isArray(o) ? o : {};
    } catch (_) {
      book = {};
    }
    return book;
  }
  function write() {
    try {
      const ids = Object.keys(book);
      if (ids.length > MAX) for (const id of ids.slice(0, ids.length - MAX)) delete book[id];
      kino2.storage.set(KEY, JSON.stringify(book));
    } catch (_) {
    }
  }
  function known(id) {
    const e = read()[id];
    if (!e) return {};
    return { ...e.t > 0 ? { tmdb: e.t } : {}, ...e.l && HTTPS3.test(e.l) ? { logo: e.l } : {} };
  }
  function dress(cards) {
    return cards.map((c) => {
      const k = known(c.id);
      return k.tmdb && !(c.ids && c.ids.tmdb) ? { ...c, ids: { ...c.ids || {}, tmdb: k.tmdb } } : c;
    });
  }
  async function fill(cards, budgetMs) {
    if (!usable()) return 0;
    const b = read();
    const end = clock.now() + budgetMs;
    let asked = 0;
    for (const c of cards) {
      if (clock.now() + CALL_MS > end) break;
      if (!c || typeof c.id !== "string" || Object.hasOwn(b, c.id) || c.ids && c.ids.tmdb && c.noLogo) continue;
      const year = c.year !== void 0 ? { year: c.year } : {};
      try {
        const a = await kino2.meta({ type: c.kind === "series" ? "series" : "movie", title: c.title, ...year });
        b[c.id] = { t: a && a.ids && Number.isInteger(a.ids.tmdb) ? a.ids.tmdb : 0, l: a && typeof a.logo === "string" ? a.logo : "" };
      } catch (e) {
        if (e && e.code === "rate_limited") break;
        continue;
      }
      asked++;
    }
    if (asked > 0) write();
    return asked;
  }
  return { known, dress, fill, usable };
}

// src/browse/index.js
var TAB_KEY = "browseTab";
var SNAP_PREFIX = "browse1:";
var SNAP_TTL_MS = 7 * 24 * 3600 * 1e3;
var HOME_KEY = "home1";
var SNAP_MAX = 20 * 1024;
var RECENT_KEY = "recent1";
var RECENT_MAX = 12;
var HIST_KEY = "searchHist1";
var HIST_MAX = 24;
function makeBrowse({ kino: kino2, loadTab, searchTitles }) {
  const meta2 = makeMetaCache({ kino: kino2 });
  const enrich = (data) => data ? {
    slides: data.slides.map((s) => {
      const k = meta2.known(s.id);
      return k.logo ? { ...s, logo: k.logo } : s;
    }),
    rails: data.rails.map((r) => ({ ...r, items: meta2.dress(r.items) }))
  } : data;
  const memo = /* @__PURE__ */ new Map();
  const log = (...a) => {
    try {
      kino2.log("[latino]", ...a);
    } catch (_) {
    }
  };
  const get = (k) => {
    try {
      return kino2.storage.get(k);
    } catch (_) {
      return null;
    }
  };
  const set = (k, v, opts) => {
    try {
      kino2.storage.set(k, v, opts);
    } catch (_) {
    }
  };
  function readSnap(tab) {
    try {
      const o = JSON.parse(get(SNAP_PREFIX + tab) || "null");
      return o && Date.now() - o.at < SNAP_TTL_MS && o.data && Array.isArray(o.data.rails) ? o.data : null;
    } catch (_) {
      return null;
    }
  }
  function writeSnap(tab, data) {
    for (let per = 10; per >= 3; per -= 2) {
      const slim2 = { slides: data.slides, rails: data.rails.map((r) => ({ ...r, items: r.items.slice(0, per) })) };
      const text2 = JSON.stringify({ at: Date.now(), data: slim2 });
      if (text2.length <= SNAP_MAX) {
        set(SNAP_PREFIX + tab, text2, { ttlMs: SNAP_TTL_MS });
        return;
      }
    }
  }
  function homeSeed(tab) {
    if (tab !== "inicio") return null;
    try {
      const o = JSON.parse(get(HOME_KEY) || "null");
      return o && Array.isArray(o.rows) && o.rows.length ? tabOf({ rows: o.rows }) : null;
    } catch (_) {
      return null;
    }
  }
  const stored = () => {
    const t3 = get(TAB_KEY);
    return TAB_IDS.includes(t3) ? t3 : null;
  };
  const remember = (tab) => set(TAB_KEY, tab);
  function dataOf(tab) {
    if (memo.has(tab)) return memo.get(tab).data;
    const snap = readSnap(tab) || homeSeed(tab);
    if (snap) {
      memo.set(tab, { data: snap, whole: false });
      return snap;
    }
    return null;
  }
  const readKeys = () => {
    try {
      const a = JSON.parse(get(RECENT_KEY) || "[]");
      return Array.isArray(a) ? a.filter((k) => typeof k === "string") : [];
    } catch (_) {
      return [];
    }
  };
  function notePlayed(ref) {
    try {
      const key = playedKey(ref);
      if (key === "" || key.startsWith("x|")) return;
      const keys = readKeys();
      if (keys[0] === key) return;
      set(RECENT_KEY, JSON.stringify([key, ...keys.filter((k) => k !== key)].slice(0, RECENT_MAX)));
    } catch (_) {
    }
  }
  const slim = (c) => ({ id: c.id, ref: c.ref, title: c.title, kind: c.kind, ...c.poster ? { poster: c.poster } : {} });
  function readHistory() {
    try {
      const a = JSON.parse(get(HIST_KEY) || "[]");
      return Array.isArray(a) ? a.filter((c) => c && typeof c.id === "string" && typeof c.ref === "string" && typeof c.title === "string").slice(0, HIST_MAX) : [];
    } catch (_) {
      return [];
    }
  }
  function rememberFound(cards) {
    try {
      const fresh = cards.filter((c) => c.adult !== true).slice(0, 12).map(slim);
      const ids = new Set(fresh.map((c) => c.id));
      set(HIST_KEY, JSON.stringify([...fresh, ...readHistory().filter((c) => !ids.has(c.id))].slice(0, HIST_MAX)));
    } catch (_) {
    }
  }
  let found = null;
  const details2 = /* @__PURE__ */ new Map();
  const paramsOf = (route) => route && route.params && typeof route.params === "object" ? route.params : {};
  const tabFromArgs = (route) => {
    const a = route && route.args && typeof route.args === "object" ? route.args : {};
    return TAB_IDS.includes(a.tab) ? a.tab : null;
  };
  function needed(tab, device) {
    const order = [tab, ...TAB_IDS.filter((t3) => t3 !== tab)];
    return order.filter((t3, i) => (i === 0 || device !== "tv") && !(memo.get(t3) && memo.get(t3).whole));
  }
  function view(ctx) {
    const st = ctx.state && typeof ctx.state === "object" ? ctx.state : {};
    if (ctx.route && ctx.route.name === "settings") return settingsView();
    if (ctx.route && ctx.route.name === "detail") {
      const p = paramsOf(ctx.route);
      if (typeof p.open === "string" && typeof p.i === "string") {
        return detailPage({ r: { ref: p.open, id: p.i, kind: p.k === "movie" ? "movie" : "series", title: typeof p.t === "string" ? p.t : "" }, entry: details2.get(p.open) || null, season: Number(st.season) || 0 });
      }
    }
    if (ctx.route && ctx.route.name === "search") {
      const query = typeof st.sq === "string" ? st.sq : "";
      const items = found && found.q === query ? found.items : null;
      const status = query === "" ? "idle" : st.sstate === "fail" ? "fail" : items ? "done" : "loading";
      return searchView({ query, status, items, history: query === "" ? readHistory() : [], device: ctx.device });
    }
    const tab = TAB_IDS.includes(st.tab) ? st.tab : tabFromArgs(ctx.route) ?? stored() ?? TAB_IDS[0];
    const data = enrich(dataOf(tab));
    const loaded = TAB_IDS.map((t3) => memo.get(t3)).filter(Boolean).map((m) => m.data);
    const pending = Array.isArray(st.pending) && st.pending.length > 0;
    return browseView({ tab, data, recent: meta2.dress(recentOf(readKeys(), loaded)), pending, failed: !!(st.failed && st.failed[tab]), device: ctx.device });
  }
  async function load(tab) {
    const page = await loadTab(tab);
    const data = tabOf(page);
    if (data) {
      memo.set(tab, { data, whole: true });
      writeSnap(tab, data);
    }
    return data !== null;
  }
  const events = {
    open({ route, state, device }) {
      const tab = tabFromArgs(route) ?? (TAB_IDS.includes(state.tab) ? state.tab : stored() ?? TAB_IDS[0]);
      for (const t3 of TAB_IDS) dataOf(t3);
      const out = { state: { tab, pending: needed(tab, device), failed: null } };
      const a = route && route.args && typeof route.args === "object" ? route.args : {};
      if (typeof a.open === "string" && typeof a.i === "string" && (a.k === "movie" || a.k === "series")) {
        out.route = { push: "detail", params: { open: a.open, i: a.i, t: typeof a.t === "string" ? a.t.slice(0, 100) : "", k: a.k, d: Number(a.d) || 0, y: Number(a.y) || 0 } };
        out.state.season = null;
      }
      return out;
    },
    // A card of the list was tapped: its page goes over the list.
    openTitle({ arg }) {
      const route = pushOf(arg);
      return route ? { route, state: { season: null } } : null;
    },
    // The page's timer: loads the title once, then no timer.
    async dtick({ route }) {
      const p = paramsOf(route);
      if (typeof p.open !== "string" || details2.has(p.open)) return { state: { dv: Date.now() } };
      try {
        details2.set(p.open, { d: await loadDetail({ t: p.t, k: p.k, d: p.d, y: p.y }) });
      } catch (e) {
        log("browse detail", e && e.code || "error");
        details2.set(p.open, { d: null });
      }
      return { state: { dv: Date.now() } };
    },
    dretry({ route }) {
      details2.delete(paramsOf(route).open);
      return { state: { dv: Date.now() } };
    },
    season({ value, arg }) {
      const n = parseInt(value != null ? value : arg, 10);
      return n > 0 ? { state: { season: n } } : null;
    },
    tab({ value, arg, state }) {
      const tab = TAB_IDS.includes(value) ? value : TAB_IDS.includes(arg) ? arg : null;
      if (!tab) return null;
      remember(tab);
      dataOf(tab);
      const failed = { ...state.failed || {} };
      delete failed[tab];
      const pending = [tab, ...Array.isArray(state.pending) ? state.pending.filter((t3) => t3 !== tab) : []];
      return { state: { tab, pending: memo.get(tab) && memo.get(tab).whole ? pending.slice(1) : pending, failed } };
    },
    retry({ state, device }) {
      const tab = TAB_IDS.includes(state.tab) ? state.tab : TAB_IDS[0];
      return { state: { failed: null, pending: [tab, ...needed(tab, device).filter((t3) => t3 !== tab)] } };
    },
    async tick({ state }) {
      const pending = Array.isArray(state.pending) ? state.pending : [];
      if (pending.length === 0) return null;
      const [next, ...rest] = pending;
      const failed = { ...state.failed || {} };
      if (next.startsWith("meta:")) {
        const m = memo.get(next.slice(5));
        if (m) await meta2.fill([...m.data.slides.map((s) => ({ id: s.id, title: s.title, kind: s.kind })), ...m.data.rails.flatMap((r) => r.items.slice(0, 6).map((c) => ({ id: c.id, title: c.title, kind: c.kind })))], 12e3);
        return { state: { pending: rest } };
      }
      try {
        const ok = await load(next);
        if (!ok) failed[next] = true;
        else delete failed[next];
        if (ok && meta2.usable()) rest.unshift("meta:" + next);
      } catch (e) {
        log("browse tab", e && e.code || "error");
        failed[next] = true;
      }
      return { state: { pending: rest, failed } };
    },
    // The floating button: straight to the search page, empty and ready for the words.
    openSearch() {
      return { route: { push: "search" }, state: { sq: "", sstate: null } };
    },
    search({ value, route }) {
      const q = value && typeof value.q === "string" ? value.q.trim().slice(0, 100) : "";
      if (q === "") return null;
      const state = { sq: q, sstate: "loading" };
      return route && route.name === "search" ? { state } : { route: { push: "search" }, state };
    },
    // The search page's timer: one search per press, then no timer.
    async stick({ state }) {
      const q = typeof state.sq === "string" ? state.sq : "";
      if (q === "" || state.sstate !== "loading") return null;
      try {
        const out = await searchTitles(q);
        found = { q, items: (Array.isArray(out) ? out : []).slice(0, 60).map(cardOf) };
        rememberFound(found.items);
        return { state: { sstate: "done" } };
      } catch (e) {
        log("browse search", e && e.code || "error");
        return { state: { sstate: "fail" } };
      }
    },
    sretry({ state }) {
      return typeof state.sq === "string" && state.sq !== "" ? { state: { sstate: "loading" } } : null;
    },
    // The gear: the plugin's settings are a page of their own, one Back away.
    go({ arg }) {
      return arg === "settings" ? { route: { push: "settings" }, state: { fromBrowse: true } } : null;
    },
    back({ state, route }) {
      if (route && route.name === "settings" && !state.fromBrowse) return { close: true };
      return { route: { pop: true }, state: { sq: null, sstate: null } };
    }
  };
  async function event(ev) {
    const handler = Object.hasOwn(events, ev.name) ? events[ev.name] : null;
    return handler ? await handler({ ...ev, state: ev.state || {} }) ?? null : null;
  }
  return { view, event, notePlayed };
}

// src/util/terms.js
function searchTerms(arg) {
  const q = String((typeof arg === "string" ? arg : arg && arg.q) || "").trim();
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const out = [];
  const add = (s) => {
    const v = String(s || "").trim();
    if (v.length >= 2 && !out.some((x) => norm(x) === norm(v))) out.push(v);
  };
  add(q);
  if (arg && typeof arg === "object") {
    add(arg.originalTitle);
    for (const a of Array.isArray(arg.altTitles) ? arg.altTitles : []) add(a);
  }
  add(q.split(/\s*[:\-–—]\s*/)[0]);
  return out.slice(0, 4);
}
async function searchWithTerms(arg, one) {
  for (const q of searchTerms(arg)) {
    const found = await one(arg && typeof arg === "object" ? { ...arg, q } : q);
    if (found.length) return found;
  }
  return [];
}

// src/util/probe.js
async function playable(kino2, out, ms = 6e3) {
  try {
    const r = await kino2.fetch(out.url, { headers: { ...out.headers || {} }, timeoutMs: ms });
    return r.ok || r.status === 401 || r.status === 403;
  } catch (e) {
    return !!(e && e.code === "host_not_allowed");
  }
}

// src/util/home.js
var BUDGET_MS = 11e3;
var KEEP_MS = 12 * 60 * 60 * 1e3;
var MAX_CHARS = 60 * 1024;
function keep(key, rows) {
  try {
    for (let per = 20; per >= 4; per -= 4) {
      const text2 = JSON.stringify({ at: Date.now(), rows: rows.map((r) => ({ ...r, items: Array.isArray(r.items) ? r.items.slice(0, per) : r.items })) });
      if (text2.length <= MAX_CHARS) {
        kino.storage.set(key, text2, { ttlMs: KEEP_MS });
        return;
      }
    }
  } catch (_) {
  }
}
function kept(key) {
  try {
    const o = JSON.parse(kino.storage.get(key) || "null");
    return o && Date.now() - o.at < KEEP_MS && Array.isArray(o.rows) && o.rows.length ? o.rows : null;
  } catch (_) {
    return null;
  }
}
async function homeWithin(jobs, { key = "home:last", budgetMs = BUDGET_MS } = {}) {
  const out = jobs.map(() => null);
  let done = false;
  const all = Promise.all(jobs.map((job, i) => Promise.resolve().then(job).then((row) => {
    out[i] = row;
  }, () => {
  }))).then(() => {
    done = true;
  });
  const end = Date.now() + budgetMs;
  while (!done && Date.now() < end) await Promise.race([all, kino.sleep(Math.min(250, Math.max(1, end - Date.now())))]);
  const rows = out.filter(Boolean);
  if (rows.length) {
    keep(key, rows);
    return rows;
  }
  return kept(key) || [];
}

// src/plugin.js
globalThis.__kinoDropPendingFetches = true;
var CACHE_MS = 10 * 60 * 1e3;
var RESOLVE_MS = 7e4;
var CAPTURE_MS = 2e4;
var MAX_CAPTURES = 1;
var MAX_COPIES = 8;
var HLS = "application/vnd.apple.mpegurl";
var STRINGS = {
  es: {
    news: "Novedades",
    movies: "Pel\xEDculas",
    series: "Series",
    anime: "Anime",
    doramas: "Doramas",
    platforms: "Plataformas",
    genres: "G\xE9neros",
    recentMovies: "Pel\xEDculas recientes",
    recentSeries: "Series recientes",
    popularMovies: "Pel\xEDculas populares",
    topSeries: "Series mejor valoradas",
    more: "M\xE1s",
    lat: "Latino",
    sub: "Subtitulado",
    cast: "Castellano",
    season: "Temporada",
    episode: "Episodio",
    heroText: "Pel\xEDculas y series en espa\xF1ol latino, con estrenos al d\xEDa.",
    unavailable: "El servicio no est\xE1 disponible en este momento.",
    noEpisodes: "No se encontraron episodios de esta serie.",
    noStreams: "Ning\xFAn servidor de este t\xEDtulo abri\xF3. Prueba m\xE1s tarde.",
    statusLine: "Listas guardadas: {n}",
    cacheCleared: "Cach\xE9 vaciada.",
    needResolver: "Para reproducir, abre SoloLatino desde el men\xFA e instala el motor de reproducci\xF3n que te pedir\xE1."
  },
  en: {
    news: "What's new",
    movies: "Movies",
    series: "Series",
    anime: "Anime",
    doramas: "Doramas",
    platforms: "Platforms",
    genres: "Genres",
    recentMovies: "Recent movies",
    recentSeries: "Recent series",
    popularMovies: "Popular movies",
    topSeries: "Top rated series",
    more: "More",
    lat: "Latino",
    sub: "Subtitled",
    cast: "Castilian",
    season: "Season",
    episode: "Episode",
    heroText: "Movies and series in Latin American Spanish, with new releases.",
    unavailable: "The service is not available right now.",
    noEpisodes: "No episodes found for this series.",
    noStreams: "No server of this title opened. Try again later.",
    statusLine: "Lists kept: {n}",
    cacheCleared: "Cache cleared.",
    needResolver: "To play, open SoloLatino from the menu and install the playback engine it asks for."
  }
};
var t2 = (key) => {
  const lang = String(kino.lang || "").toLowerCase().startsWith("es") ? "es" : "en";
  return STRINGS[lang][key] || STRINGS.es[key] || key;
};
async function getPage(url, headers) {
  const r = await kino.fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-MX,es;q=0.9", ...headers || {} }, timeoutMs: 15e3 });
  if (!r.ok) throw kino.error("unavailable", `SoloLatino ${r.status} ${url}`, { userMessage: t2("unavailable") });
  return r.text();
}
async function cached(key, fn) {
  try {
    const raw = kino.storage.get("c:" + key);
    const e = raw ? JSON.parse(raw) : null;
    if (e && Date.now() - e.at < CACHE_MS) return e.v;
  } catch (_) {
  }
  const v = await fn();
  if (Array.isArray(v) && !v.length) return v;
  try {
    kino.storage.set("c:" + key, JSON.stringify({ at: Date.now(), v }), { ttlMs: CACHE_MS });
  } catch (_) {
  }
  return v;
}
var fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
var hash36 = (s) => {
  let h = 5381;
  for (const ch of String(s)) h = (h * 33 ^ ch.codePointAt(0)) >>> 0;
  return h.toString(36);
};
var KIND_GENRE = { anime: "Anime", dorama: "Dorama", toon: "Animaci\xF3n" };
function toItem(card, genreName) {
  const item = {
    id: "sl-" + (fold(card.slug).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "t") + "-" + hash36(card.kind + card.slug),
    ref: (card.kind === "movie" ? "m:" : "s:") + card.slug,
    title: card.title,
    kind: card.kind
  };
  if (card.poster) item.poster = card.poster;
  if (card.year) item.year = String(card.year);
  if (card.rating) item.rating = card.rating;
  const g = [KIND_GENRE[card.type], genreName].filter(Boolean);
  if (g.length) item.genres = g;
  return item;
}
var LISTS = {
  peliculas: { path: "/peliculas", titleKey: "recentMovies", genre: "peliculas" },
  populares: { path: "/peliculas", query: "sort=popular", titleKey: "popularMovies", genre: "peliculas" },
  series: { path: "/series", titleKey: "recentSeries", genre: "series" },
  mejores: { path: "/series", query: "sort=rating", titleKey: "topSeries", genre: "series" },
  animes: { path: "/animes", titleKey: "anime", genre: "anime" },
  doramas: { path: "/doramas", titleKey: "doramas", genre: "doramas" }
};
function refOf(ref) {
  const m = /^(list|genre|net):([a-z0-9-]+)$/.exec(String(ref || ""));
  if (!m) return null;
  if (m[1] === "list") {
    const l = LISTS[m[2]];
    return l ? { ...l, title: t2(l.titleKey) } : null;
  }
  if (m[1] === "genre") {
    const g = GENRES.find((x) => x[0] === m[2]);
    return g ? { path: "/genero/" + g[0], title: g[1], genre: void 0, genreName: g[1] } : null;
  }
  const n = NETWORKS.find((x) => x[0] === m[2]);
  return n ? { path: "/red/" + n[0], title: n[1], genre: "series" } : null;
}
async function listPage(def, page) {
  const qs = [def.query, page > 1 ? "page=" + page : ""].filter(Boolean).join("&");
  const url = SITE + def.path + (qs ? "?" + qs : "");
  const cards = await cached(`l:${def.path}:${qs}`, async () => parseCards(await getPage(url)));
  return { cards, more: cards.length >= 24 };
}
var safeRow = async (id, fn) => {
  try {
    return await fn();
  } catch (e) {
    kino.log("row " + id + ": " + (e && e.message));
    return null;
  }
};
async function rowOf(id, ref, genre) {
  const def = refOf(ref);
  const { cards } = await listPage(def, 1);
  const items = cards.slice(0, 20).map((c) => toItem(c, def.genreName));
  return items.length ? { id, title: def.title, items, ref, genre: genre || def.genre || "series" } : null;
}
async function home() {
  return homeWithin([
    () => safeRow("peliculas", () => rowOf("peliculas", "list:peliculas")),
    () => safeRow("series", () => rowOf("series", "list:series")),
    () => safeRow("animes", () => rowOf("animes", "list:animes")),
    () => safeRow("doramas", () => rowOf("doramas", "list:doramas")),
    () => safeRow("populares", () => rowOf("populares", "list:populares")),
    () => safeRow("netflix", () => rowOf("netflix", "net:netflix"))
  ]);
}
async function browse(ref, cursor) {
  const def = refOf(ref);
  if (!def) return { items: [] };
  const page = cursor ? Math.max(1, parseInt(cursor, 10) || 1) : 1;
  const { cards, more } = await listPage(def, page);
  return { items: cards.map((c) => toItem(c, def.genreName)), next: more ? String(page + 1) : void 0 };
}
async function searchCards(q) {
  try {
    const cards2 = parseCards(await getPage(`${SITE}/buscar?q=${encodeURIComponent(q)}`));
    if (cards2.length) return cards2;
  } catch (e) {
    kino.log("search page: " + (e && e.message));
  }
  const r = await kino.fetch(`${SITE}/api/search/suggest?q=${encodeURIComponent(q)}`, { headers: { "User-Agent": UA, Accept: "application/json" }, timeoutMs: 15e3 });
  if (!r.ok) throw kino.error("unavailable", `SoloLatino search ${r.status}`, { userMessage: t2("unavailable") });
  const data = JSON.parse(await r.text());
  const cards = [];
  for (const x of Array.isArray(data) ? data : []) {
    const m = /sololatino\.net\/(pelicula|serie)\/([^\/?#]+)/.exec(String(x && x.url || ""));
    if (!m || x.type === "person") continue;
    cards.push({ slug: m[2], kind: m[1] === "pelicula" ? "movie" : "series", type: String(x.type || ""), title: String(x.title || m[2]), year: Number(x.year) || void 0, poster: String(x.poster || "") });
  }
  return cards;
}
async function searchOne(arg) {
  const q = String((typeof arg === "string" ? arg : arg && arg.q) || "").trim();
  const within = typeof arg === "object" && arg && arg.within ? refOf(arg.within) : null;
  if (q.length < 2) return [];
  const cards = await cached("s2:" + q.toLowerCase(), () => searchCards(q));
  const kindOnly = within && /^\/(peliculas)$/.test(within.path) ? "movie" : within && /^\/(series|animes|doramas)$/.test(within.path) ? "series" : null;
  return cards.filter((c) => !kindOnly || c.kind === kindOnly).slice(0, 40).map((c) => toItem(c));
}
var search = (arg) => searchWithTerms(arg, searchOne);
async function section({ tab } = {}) {
  const tabs = [{ id: "novedades", label: t2("news") }, { id: "peliculas", label: t2("movies") }, { id: "series", label: t2("series") }, { id: "anime", label: t2("anime") }, { id: "doramas", label: t2("doramas") }, { id: "plataformas", label: t2("platforms") }];
  const chosen = tabs.some((x) => x.id === tab) ? tab : "novedades";
  let rows = [];
  if (chosen === "novedades") rows = await Promise.all([safeRow("peliculas", () => rowOf("peliculas", "list:peliculas")), safeRow("series", () => rowOf("series", "list:series")), safeRow("populares", () => rowOf("populares", "list:populares"))]);
  else if (chosen === "peliculas") rows = await Promise.all([safeRow("peliculas", () => rowOf("peliculas", "list:peliculas")), safeRow("populares", () => rowOf("populares", "list:populares")), safeRow("terror", () => rowOf("terror", "genre:terror", "peliculas")), safeRow("comedia", () => rowOf("comedia", "genre:comedia", "peliculas"))]);
  else if (chosen === "series") rows = await Promise.all([safeRow("series", () => rowOf("series", "list:series")), safeRow("mejores", () => rowOf("mejores", "list:mejores"))]);
  else if (chosen === "anime") rows = [await safeRow("animes", () => rowOf("animes", "list:animes"))];
  else if (chosen === "doramas") rows = [await safeRow("doramas", () => rowOf("doramas", "list:doramas"))];
  else rows = await Promise.all(NETWORKS.slice(0, 5).map(([slug]) => safeRow("net-" + slug, () => rowOf("net-" + slug, "net:" + slug))));
  rows = rows.filter(Boolean);
  const answer = { tabs, tab: chosen, rows };
  const first = rows.flatMap((r) => r.items).find((i) => i.poster);
  if (first) answer.hero = { title: first.title, text: t2("heroText"), image: first.poster };
  return answer;
}
async function categories() {
  return [
    ...GENRES.map(([slug, name]) => ({ id: "g-" + slug, title: name, ref: "genre:" + slug })),
    ...NETWORKS.slice(0, 5).map(([slug, name]) => ({ id: "n-" + slug, title: name, ref: "net:" + slug }))
  ];
}
function slugOf(ref, prefix) {
  const m = new RegExp(`^${prefix}:([a-z0-9-]+)$`).exec(String(ref || ""));
  return m ? m[1] : null;
}
var titlePage = (kind, slug) => cached("p:" + kind + slug, async () => parseTitle(await getPage(`${SITE}/${kind === "movie" ? "pelicula" : "serie"}/${slug}`)));
async function details(ref) {
  const slug = slugOf(ref, "m");
  if (!slug) return null;
  const p = await titlePage("movie", slug);
  if (!p) return null;
  const out = { overview: p.overview || void 0, genres: p.genres.length ? p.genres : void 0, poster: p.poster || void 0, backdrop: p.backdrop || void 0, year: p.year ? String(p.year) : void 0, rating: p.rating };
  const mins = /^(?:(\d+)h)?\s*(?:(\d+)m)?$/.exec(p.runtime || "");
  if (mins && (mins[1] || mins[2])) out.runtimeMinutes = Number(mins[1] || 0) * 60 + Number(mins[2] || 0);
  for (const k of Object.keys(out)) if (out[k] === void 0) delete out[k];
  return out;
}
async function episodes(ref) {
  const slug = slugOf(ref, "s");
  if (!slug) throw kino.error("not_found", "unknown ref: " + ref);
  const p = await titlePage("series", slug);
  const list = p ? p.seasons.flatMap((s) => s.episodes) : [];
  if (!list.length) throw kino.error("not_found", "no episodes for " + slug, { userMessage: t2("noEpisodes") });
  const series = { title: p.title || void 0, poster: p.poster || void 0, backdrop: p.backdrop || void 0, overview: p.overview || void 0, genres: p.genres.length ? p.genres : void 0, year: p.year ? String(p.year) : void 0, rating: p.rating };
  for (const k of Object.keys(series)) if (series[k] === void 0) delete series[k];
  return {
    series,
    episodes: list.map((e) => {
      const ep = { season: e.season, number: e.number, ref: `e:${slug}:${e.season}:${e.number}`, title: e.title || `${t2("episode")} ${e.number}` };
      if (e.thumb) ep.still = e.thumb;
      if (e.overview) ep.overview = e.overview;
      return ep;
    })
  };
}
var RESOLVER_REPO = "xuper-plugin/kino-plugin-kino-resolver";
var SUPPORT_URL = "https://ko-fi.com/xuperplugins";
async function resolverInstalled() {
  try {
    await kino.plugins.call("resolver", "normalizeHost", { url: "https://probe.invalid/" });
    return true;
  } catch (e) {
    return (e && e.code) !== "provider_missing";
  }
}
function supportNode(device) {
  if (device === "tv") return { type: "QrImage", value: SUPPORT_URL, size: "large", labelText: "Si te gusta mi trabajo, escan\xE9alo y ap\xF3yame", labelTextEn: "If you like my work, scan it and support me" };
  return { type: "ElevatedButton", key: "donate", icon: "heart", labelText: "Si te gusta mi trabajo, ap\xF3yame", labelTextEn: "If you like my work, support me", onPressed: { go: { url: { href: SUPPORT_URL } } } };
}
function installGateView(device) {
  return {
    type: "Scaffold",
    key: "sololatino-install",
    body: { type: "SingleChildScrollView", key: "installScroll", children: [
      { type: "Column", padding: 24, gap: 16, crossAxisAlignment: "stretch", children: [
        { type: "Text", text: "Necesitas el motor de reproducci\xF3n", textEn: "You need the playback engine", style: "h3" },
        { type: "Text", color: "secondary", text: "SoloLatino reproduce a trav\xE9s de Kino Resolver (gratis). Inst\xE1lalo una vez y sirve para este y para otros plugins de sitios.", textEn: "SoloLatino plays through Kino Resolver (free). Install it once and it works here and in other site plugins." },
        { type: "ElevatedButton", key: "installResolver", labelText: "Instalar Kino Resolver", labelTextEn: "Install Kino Resolver", onPressed: { go: { installPlugin: { repo: RESOLVER_REPO } } } },
        supportNode(device)
      ] }
    ] }
  };
}
var browseInstance = null;
var browseScreen = () => browseInstance ?? (browseInstance = makeBrowse({
  kino,
  loadTab: async () => ({ rows: await home() }),
  searchTitles: (q) => search({ q })
}));
async function screen(ctx) {
  await null;
  const c = ctx && typeof ctx === "object" ? ctx : {};
  if (!(c.installed && c.installed[RESOLVER_REPO])) return installGateView(c.device);
  return browseScreen().view(c);
}
async function screenEvent(ev) {
  await null;
  return browseScreen().event(ev && typeof ev === "object" ? ev : {});
}
var LANG_NAME = { LAT: "lat", SUB: "sub", CAST: "cast", ESP: "cast" };
var SERVER_NAME = { vidhide: "VidHide", streamwish: "StreamWish", voe: "VOE", filemoon: "Filemoon", mixdrop: "MixDrop", streamtape: "StreamTape" };
async function playerUrl(token, pageUrl) {
  await kino.fetch(`${SITE}/sanctum/csrf-cookie`, { headers: { "User-Agent": UA, Accept: "application/json", Referer: pageUrl }, timeoutMs: 1e4 });
  let xsrf = null;
  try {
    xsrf = kino.cookies.get(SITE + "/", "XSRF-TOKEN");
  } catch (_) {
    xsrf = null;
  }
  if (!xsrf) throw kino.error("unavailable", "no XSRF cookie");
  const r = await kino.fetch(`${SITE}/api/player-url`, {
    method: "POST",
    timeoutMs: 15e3,
    body: JSON.stringify({ t: token }),
    headers: { "User-Agent": UA, "Content-Type": "application/json", Accept: "application/json", "X-XSRF-TOKEN": decodeURIComponent(xsrf), Referer: pageUrl, Origin: SITE }
  });
  if (!r.ok) throw kino.error("unavailable", "player-url " + r.status);
  const j = JSON.parse(await r.text());
  return j && typeof j.url === "string" ? j.url : null;
}
function pageOf(ref) {
  let m = /^m:([a-z0-9-]+)$/.exec(ref);
  if (m) return `${SITE}/pelicula/${m[1]}`;
  m = /^e:([a-z0-9-]+):(\d+):(\d+)$/.exec(ref);
  return m ? `${SITE}/serie/${m[1]}/temporada-${m[2]}/episodio-${m[3]}` : null;
}
async function serversOf2(pageUrl, req) {
  const players = parsePlayers(await getPage(pageUrl, { Referer: SITE + "/" }));
  if (!players.length) return [];
  let id = null;
  for (const p of players) {
    try {
      id = embedId(await playerUrl(p.token, pageUrl));
    } catch (_) {
      id = null;
    }
    if (id) break;
  }
  if (!id) return [];
  const rows = (await servers(kino, req, id)).filter((s) => s.url);
  let pref = "lat";
  try {
    pref = String(kino.config.get("audio") || "lat");
  } catch (_) {
    pref = "lat";
  }
  const lang = (s) => LANG_NAME[s.lang.toUpperCase()] || "sub";
  const cost = (s) => !extractorFor(s.url) ? 2 : /vidhide/i.test(s.server) ? 1 : 0;
  const rank = (s) => (lang(s) === pref ? 0 : lang(s) === "lat" ? 1 : lang(s) === "cast" ? 2 : 3) * 3 + cost(s);
  return rows.map((s, i) => ({ ...s, i })).sort((a, b) => rank(a) - rank(b) || a.i - b.i).slice(0, MAX_COPIES);
}
async function open(server, req, budget) {
  try {
    const res = await kino.plugins.call("resolver", "resolve", { url: server.url, referer: SITE + "/" });
    const s = (res && Array.isArray(res.streams) ? res.streams : []).find((x) => x && x.url);
    if (s) {
      const headers = {};
      if (s.referer) headers.Referer = s.referer;
      if (Array.isArray(s.headers)) {
        for (const h of s.headers) if (h && h.name) headers[h.name] = String(h.value);
      }
      const out = { url: s.url, mime: s.kind === "hls" ? HLS : /\.mp4(\?|$)/i.test(s.url) ? "video/mp4" : HLS, headers };
      if (res.subtitles && res.subtitles.length) out.subtitles = res.subtitles;
      return out;
    }
    if (res && res.error === "dead") return null;
  } catch (_) {
  }
  if (!kino.browser || typeof kino.browser.capture !== "function" || budget.captures <= 0) return null;
  budget.captures -= 1;
  const page = await kino.browser.capture(server.url, { timeoutMs: CAPTURE_MS, match: "\\.m3u8|\\.mp4", headers: { Referer: SITE + "/" } });
  const media = page && page.media || [];
  const best = media.find((x) => /m3u8/i.test(x.url)) || media[0];
  if (!best) return null;
  return { captured: true, url: best.url, mime: best.mime || (/\.mp4/i.test(best.url) ? "video/mp4" : HLS), headers: best.headers || { Referer: server.url } };
}
var labelOf = (s) => `${t2(LANG_NAME[s.lang.toUpperCase()] || "sub")} \xB7 ${SERVER_NAME[s.server.toLowerCase()] || s.server}`;
async function resolve(ref) {
  const m = /^c:(.+)@(\d+)$/.exec(String(ref || ""));
  const base = m ? m[1] : String(ref || "");
  const only = m ? Number(m[2]) : null;
  const pageUrl = pageOf(base);
  if (!pageUrl) throw kino.error("not_found", "unknown ref: " + ref);
  if (!await resolverInstalled()) throw kino.error("unavailable", "resolver missing", { userMessage: t2("needResolver") });
  const req = makeReq(kino, { deadline: Date.now() + RESOLVE_MS });
  const servers2 = await serversOf2(pageUrl, req);
  if (!servers2.length) throw kino.error("not_found", "no servers on " + pageUrl, { userMessage: t2("noStreams") });
  const budget = { captures: MAX_CAPTURES };
  const failures = [];
  for (const i of only != null ? [only] : servers2.map((_, k) => k)) {
    const s = servers2[i];
    if (!s) continue;
    try {
      const out = await open(s, req, budget);
      if (!out) {
        failures.push(`${s.server}: no stream`);
        continue;
      }
      if (!out.captured && !await playable(kino, { url: out.url, headers: { "User-Agent": UA, ...out.headers || {} } })) {
        failures.push(`${s.server}: address does not answer`);
        continue;
      }
      const stream = { url: out.url, mime: out.mime, headers: { "User-Agent": UA, ...out.headers || {} }, label: labelOf(s) };
      if (out.subtitles) stream.subtitles = out.subtitles;
      if (out.durationMs) stream.durationMs = out.durationMs;
      if (only == null) {
        const others = servers2.map((_, j) => j).filter((j) => j !== i);
        if (others.length) stream.alternatives = others.map((j) => ({ ref: `c:${base}@${j}`, label: labelOf(servers2[j]) }));
      }
      return stream;
    } catch (e) {
      failures.push(`${s.server}: ${e && e.code || ""} ${e && e.message || e}`.trim());
    }
  }
  kino.log(`resolve ${base} failed: ${failures.join("; ")}`);
  throw kino.error("not_found", "no server opened for " + pageUrl, { userMessage: t2("noStreams") });
}
async function settingsStatus() {
  let n = 0;
  try {
    n = kino.storage.keys().filter((k) => k.startsWith("c:")).length;
  } catch (_) {
  }
  return { info: t2("statusLine").replace("{n}", String(n)) };
}
async function action(key) {
  if (key === "clearCache") {
    try {
      for (const k of kino.storage.keys()) if (k.startsWith("c:")) kino.storage.remove(k);
    } catch (_) {
    }
    return { message: t2("cacheCleared") };
  }
  return { message: "" };
}
export {
  action,
  browse,
  categories,
  details,
  episodes,
  home,
  resolve,
  screen,
  screenEvent,
  search,
  section,
  settingsStatus
};
