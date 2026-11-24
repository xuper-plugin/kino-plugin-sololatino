// @ts-check
// Kino plugin: SoloLatino -- movies, series, anime and doramas in Spanish (mostly Latino) from sololatino.net.
// Home rows, a section of its own, categories (genres and platforms), search, details and episodes come from the site, whose covers are TMDB's
// (they load for Kino). A title's players are two: its own ("Principal", an app the site guards) and Embed69, whose page lists, per language, the
// hosts that carry the title. Those are opened here: VidHide and StreamWish with plain requests (./extractors), VOE through the hidden browser.

import { SITE, GENRES, NETWORKS, parseCards, parseTitle, parsePlayers, embedId } from "./sololatino.js";
import * as embed69 from "./embed69.js";
import { makeReq, UA } from "./util/http.js";
import { makeStandardScreen } from "./std/index.js";
import { rankServers } from "./std/rank.js";
import { LOGO, LOGO_ASPECT } from "./logo.js";
import { searchWithTerms } from "./util/terms.js";
import { peek } from "./util/probe.js";
import { homeWithin } from "./util/home.js";

// Kino waits for every request a call left running before it delivers the call's answer (quickjs-kt joins the pending async work), so a Home that
// gave up on a slow row at its own budget was still held until that row's request ended, or retried: measured on users' devices Home ran 21-34 s
// with rows logged as "skipped: its source did not answer in time", and Kino threw the whole answer away at 20 s. Asking Kino to drop what a call
// leaves running (the prelude reads this flag after every call; Kino 0.9.55 and later, an older one ignores it) lets the answer leave at the budget.
globalThis.__kinoDropPendingFetches = true;


const CACHE_MS = 10 * 60 * 1000;
const RESOLVE_MS = 70000;
const CAPTURE_MS = 20000;
const MAX_CAPTURES = 1;
const MAX_COPIES = 8;
const HLS = "application/vnd.apple.mpegurl";

// ---- i18n ----

const STRINGS = {
  es: {
    news: "Novedades", movies: "Películas", series: "Series", anime: "Anime", kids: "Infantil", doramas: "Doramas", platforms: "Plataformas", genres: "Géneros",
    recentMovies: "Películas recientes", recentSeries: "Series recientes", popularMovies: "Películas populares", topSeries: "Series mejor valoradas", more: "Más",
    lat: "Latino", sub: "Subtitulado", cast: "Castellano", season: "Temporada", episode: "Episodio",
    heroText: "Películas y series en español latino, con estrenos al día.",
    unavailable: "El servicio no está disponible en este momento.", noEpisodes: "No se encontraron episodios de esta serie.", noStreams: "Ningún servidor de este título abrió. Prueba más tarde.",
    statusLine: "Listas guardadas: {n}", cacheCleared: "Caché vaciada.",
    needResolver: "Para reproducir, abre SoloLatino desde el menú e instala el motor de reproducción que te pedirá.",
  },
  en: {
    news: "What's new", movies: "Movies", series: "Series", anime: "Anime", kids: "Kids", doramas: "Doramas", platforms: "Platforms", genres: "Genres",
    recentMovies: "Recent movies", recentSeries: "Recent series", popularMovies: "Popular movies", topSeries: "Top rated series", more: "More",
    lat: "Latino", sub: "Subtitled", cast: "Castilian", season: "Season", episode: "Episode",
    heroText: "Movies and series in Latin American Spanish, with new releases.",
    unavailable: "The service is not available right now.", noEpisodes: "No episodes found for this series.", noStreams: "No server of this title opened. Try again later.",
    statusLine: "Lists kept: {n}", cacheCleared: "Cache cleared.",
    needResolver: "To play, open SoloLatino from the menu and install the playback engine it asks for.",
  },
};
const t = (key) => {
  const lang = String(kino.lang || "").toLowerCase().startsWith("es") ? "es" : "en";
  return STRINGS[lang][key] || STRINGS.es[key] || key;
};

// ---- helpers ----

async function getPage(url, headers) {
  const r = await kino.fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-MX,es;q=0.9", ...(headers || {}) }, timeoutMs: 15000 });
  if (!r.ok) throw kino.error("unavailable", `SoloLatino ${r.status} ${url}`, { userMessage: t("unavailable") });
  return r.text();
}

async function cached(key, fn) {
  try {
    const raw = kino.storage.get("c:" + key);
    const e = raw ? JSON.parse(raw) : null;
    if (e && Date.now() - e.at < CACHE_MS) return e.v;
  } catch (_) { /* no cache */ }
  const v = await fn();
  if (Array.isArray(v) && !v.length) return v; // an empty answer may be a throttle or a hiccup: not kept
  try { kino.storage.set("c:" + key, JSON.stringify({ at: Date.now(), v }), { ttlMs: CACHE_MS }); } catch (_) { /* a full storage only costs a refetch */ }
  return v;
}

const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const hash36 = (s) => { let h = 5381; for (const ch of String(s)) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0; return h.toString(36); };

const KIND_GENRE = { anime: "Anime", dorama: "Dorama", toon: "Animación" };

function toItem(card, genreName) {
  const item = {
    id: "sl-" + (fold(card.slug).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "t") + "-" + hash36(card.kind + card.slug),
    ref: (card.kind === "movie" ? "m:" : "s:") + card.slug, title: card.title, kind: card.kind,
  };
  if (card.poster) item.poster = card.poster;
  if (card.year) item.year = String(card.year);
  if (card.rating) item.rating = card.rating;
  const g = [KIND_GENRE[card.type], genreName].filter(Boolean);
  if (g.length) item.genres = g;
  return item;
}

// ---- the lists ----

const LISTS = {
  peliculas: { path: "/peliculas", titleKey: "recentMovies", genre: "peliculas" },
  populares: { path: "/peliculas", query: "sort=popular", titleKey: "popularMovies", genre: "peliculas" },
  series: { path: "/series", titleKey: "recentSeries", genre: "series" },
  mejores: { path: "/series", query: "sort=rating", titleKey: "topSeries", genre: "series" },
  animes: { path: "/animes", titleKey: "anime", genre: "anime" },
  doramas: { path: "/doramas", titleKey: "doramas", genre: "doramas" },
  infantil: { path: "/genero/familia", titleKey: "kids", genre: "infantil" },
};

/** `{ path, query, title, genre }` for a browse ref ("list:<name>", "genre:<slug>" or "net:<slug>"); null for anything else. */
function refOf(ref) {
  const m = /^(list|genre|net):([a-z0-9-]+)$/.exec(String(ref || ""));
  if (!m) return null;
  if (m[1] === "list") { const l = LISTS[m[2]]; return l ? { ...l, title: t(l.titleKey) } : null; }
  if (m[1] === "genre") { const g = GENRES.find((x) => x[0] === m[2]); return g ? { path: "/genero/" + g[0], title: g[1], genre: undefined, genreName: g[1] } : null; }
  const n = NETWORKS.find((x) => x[0] === m[2]);
  return n ? { path: "/red/" + n[0], title: n[1], genre: "series" } : null;
}

/** One page (from 1) of a list: the cards, and whether there may be a next page (full pages are 36 titles, 24 on genres and platforms). */
async function listPage(def, page) {
  const qs = [def.query, page > 1 ? "page=" + page : ""].filter(Boolean).join("&");
  const url = SITE + def.path + (qs ? "?" + qs : "");
  const cards = await cached(`l:${def.path}:${qs}`, async () => parseCards(await getPage(url)));
  return { cards, more: cards.length >= 24 };
}

const safeRow = async (id, fn) => { try { return await fn(); } catch (e) { kino.log("row " + id + ": " + (e && e.message)); return null; } };

async function rowOf(id, ref, genre) {
  const def = refOf(ref);
  const { cards } = await listPage(def, 1);
  const items = cards.slice(0, 20).map((c) => toItem(c, def.genreName));
  return items.length ? { id, title: def.title, items, ref, genre: genre || def.genre || "series" } : null;
}

// ---- exports ----

/** The Home's rows, each tagged (LISTS' `genre`) with the type Kino files it under: Películas, Series, Anime (the site's newest first), Infantil (its Familia genre). */
export const HOME_ROWS = [["peliculas", "list:peliculas"], ["series", "list:series"], ["animes", "list:animes"], ["infantil", "list:infantil"], ["doramas", "list:doramas"], ["populares", "list:populares"], ["netflix", "net:netflix"]];

/** The type tag each Home row carries, by row id (what Kino reads to shelve its titles). */
export const homeRowTags = () => Object.fromEntries(HOME_ROWS.map(([id, ref]) => [id, refOf(ref).genre || "series"]));

export async function home() {
  return homeWithin(HOME_ROWS.map(([id, ref]) => () => safeRow(id, () => rowOf(id, ref))));
}

export async function browse(ref, cursor) {
  const def = refOf(ref);
  if (!def) return { items: [] };
  const page = cursor ? Math.max(1, parseInt(cursor, 10) || 1) : 1;
  const { cards, more } = await listPage(def, page);
  return { items: cards.map((c) => toItem(c, def.genreName)), next: more ? String(page + 1) : undefined };
}

/** The cards for a typed search: the site's results page (HTML, the same cards as a listing), else its older suggestion box (JSON). */
async function searchCards(q) {
  // /api/search/suggest answered 404 from late October; the results page is plain HTML with the listing's cards.
  try {
    const cards = parseCards(await getPage(`${SITE}/buscar?q=${encodeURIComponent(q)}`));
    if (cards.length) return cards;
  } catch (e) {
    kino.log("search page: " + (e && e.message));
  }
  const r = await kino.fetch(`${SITE}/api/search/suggest?q=${encodeURIComponent(q)}`, { headers: { "User-Agent": UA, Accept: "application/json" }, timeoutMs: 15000 });
  if (!r.ok) throw kino.error("unavailable", `SoloLatino search ${r.status}`, { userMessage: t("unavailable") });
  const data = JSON.parse(await r.text());
  const cards = [];
  for (const x of Array.isArray(data) ? data : []) {
    const m = /sololatino\.net\/(pelicula|serie)\/([^\/?#]+)/.exec(String((x && x.url) || ""));
    if (!m || x.type === "person") continue;
    cards.push({ slug: m[2], kind: m[1] === "pelicula" ? "movie" : "series", type: String(x.type || ""), title: String(x.title || m[2]), year: Number(x.year) || undefined, poster: String(x.poster || "") });
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

export const search = (arg) => searchWithTerms(arg, searchOne);

// ---- the plugin's own section, categories and details ----

export async function section({ tab } = {}) {
  const tabs = [{ id: "novedades", label: t("news") }, { id: "peliculas", label: t("movies") }, { id: "series", label: t("series") }, { id: "anime", label: t("anime") }, { id: "doramas", label: t("doramas") }, { id: "plataformas", label: t("platforms") }];
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
  if (first) answer.hero = { title: first.title, text: t("heroText"), image: first.poster };
  return answer;
}

/**
 * One backdrop per Categorías tile: a well-known title of the genre (or of the network), its TMDB image path at w780 (each checked with a
 * request to image.tmdb.org: 200, image/jpeg). Static on purpose: `categories()` asks nothing of the network. Keys are the
 * site's own slugs; a slug not listed gets no art (Kino draws its plain tile). Kino draws a tile's picture from `art`.
 */
const TILE_ART_SIZE = "w780";
const GENRE_ART = {
  accion: "/gqrnQA6Xppdl8vIb2eJc58VC1tW.jpg", // Mad Max: Fury Road
  animacion: "/g7CHF8gTLGooTbP4GznIGwaqAGL.jpg", // Coco
  aventura: "/zPACwR32amTNvzId9qyapCWXYDJ.jpg", // Raiders of the Lost Ark
  belica: "/bdD39MpSVhKjxarTxLSfX6baoMP.jpg", // Saving Private Ryan
  "ciencia-ficcion": "/xJHokMbljvjADYdit5fK5VQsXEG.jpg", // Interstellar
  comedia: "/jK65srQczOKTpW62wPxwwKztGgE.jpg", // The Grand Budapest Hotel
  crimen: "/ejdD20cdHNFAYAN2DlqPToXKyzx.jpg", // The Godfather
  documental: "/sW7VOrkHKYIeV9PaYc5IqGU2XK8.jpg", // My Octopus Teacher
  drama: "/pNjh59JSxChQktamG3LMp9ZoQzp.jpg", // The Shawshank Redemption
  familia: "/iJgNOTSBNrC90U2xyYq9ln0b35o.jpg", // Paddington 2
  fantasia: "/oiwc338EoBgS4sEI2ixAny4KQKg.jpg", // The Fellowship of the Ring
  historia: "/m4MGxxEgAMqIX9x8MCg5pYeyYjU.jpg", // The King's Speech
  misterio: "/4HWAQu28e2yaWrtupFPGFkdNU7V.jpg", // Knives Out
  musica: "/dcvbs8z0GEXslC1kCT77x19XDeR.jpg", // Bohemian Rhapsody
  romance: "/zdXnJqBaGFVtLoPNuMeKfEYUViZ.jpg", // The Notebook
  suspense: "/iWak7wT0j6ycCc8lKr4NBz9c7n5.jpg", // Gone Girl
  terror: "/nHRUtBwFNnNN70vcQ7lAsjc2T6S.jpg", // A Quiet Place
  western: "/x4biAVdPVCghBlsVIzB6NmbghIz.jpg", // The Good, the Bad and the Ugly
};
const NETWORK_ART = {
  netflix: "/9P4IIMYY3HifqeruZq0ZZ9g7YUi.jpg", // Stranger Things
  "amazon-prime-video": "/i1phX1JpaqSnHBBGta6LBFYVCZq.jpg", // The Rings of Power
  disney: "/dLIKNqBi9L1cVbwuniXkaNOsIXg.jpg", // Percy Jackson and the Olympians
  "hbo-max": "/900tHlUYUkp7Ol04XFSoAaEIXcT.jpg", // Chernobyl (HBO)
  hbo: "/zZqpAXxVSBtxV9qPBcscfXBcL2w.jpg", // Game of Thrones
};
const tileArt = (table, slug) => (table[slug] ? "https://image.tmdb.org/t/p/" + TILE_ART_SIZE + table[slug] : undefined);
const withArt = (tile, art) => (art ? { ...tile, art } : tile);

export async function categories() {
  return [
    ...GENRES.map(([slug, name]) => (withArt({ id: "g-" + slug, title: name, ref: "genre:" + slug }, tileArt(GENRE_ART, slug)))),
    ...NETWORKS.slice(0, 5).map(([slug, name]) => withArt({ id: "n-" + slug, title: name, ref: "net:" + slug }, tileArt(NETWORK_ART, slug))),
  ];
}

function slugOf(ref, prefix) {
  const m = new RegExp(`^${prefix}:([a-z0-9-]+)$`).exec(String(ref || ""));
  return m ? m[1] : null;
}

const titlePage = (kind, slug) => cached("p:" + kind + slug, async () => parseTitle(await getPage(`${SITE}/${kind === "movie" ? "pelicula" : "serie"}/${slug}`)));

/** A title's own page: synopsis, genres, year, runtime, rating and the wide picture, from the site. */
export async function details(ref) {
  const slug = slugOf(ref, "m");
  if (!slug) return null;
  const p = await titlePage("movie", slug);
  if (!p) return null;
  const out = { overview: p.overview || undefined, genres: p.genres.length ? p.genres : undefined, poster: p.poster || undefined, backdrop: p.backdrop || undefined, year: p.year ? String(p.year) : undefined, rating: p.rating };
  const mins = /^(?:(\d+)h)?\s*(?:(\d+)m)?$/.exec(p.runtime || "");
  if (mins && (mins[1] || mins[2])) out.runtimeMinutes = Number(mins[1] || 0) * 60 + Number(mins[2] || 0);
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

export async function episodes(ref) {
  const slug = slugOf(ref, "s");
  if (!slug) throw kino.error("not_found", "unknown ref: " + ref);
  const p = await titlePage("series", slug);
  const list = p ? p.seasons.flatMap((s) => s.episodes) : [];
  if (!list.length) throw kino.error("not_found", "no episodes for " + slug, { userMessage: t("noEpisodes") });
  const series = { title: p.title || undefined, poster: p.poster || undefined, backdrop: p.backdrop || undefined, overview: p.overview || undefined, genres: p.genres.length ? p.genres : undefined, year: p.year ? String(p.year) : undefined, rating: p.rating };
  for (const k of Object.keys(series)) if (series[k] === undefined) delete series[k];
  return {
    series,
    episodes: list.map((e) => {
      const ep = { season: e.season, number: e.number, ref: `e:${slug}:${e.season}:${e.number}`, title: e.title || `${t("episode")} ${e.number}` };
      if (e.thumb) ep.still = e.thumb;
      if (e.overview) ep.overview = e.overview;
      return ep;
    }),
  };
}

// ---- the screen: the standard xuper-plugin screen (src/std) ----

/** True when the shared kino-resolver is installed (a cheap door probe; only provider_missing means "not installed"). */
async function resolverInstalled() {
  try { await kino.plugins.call("resolver", "normalizeHost", { url: "https://probe.invalid/" }); return true; }
  catch (e) { return (e && e.code) !== "provider_missing"; }
}

// SoloLatino delegates every hoster to kino-resolver (the hidden-browser capture is only a fallback), so it does not play without it: the screen is the install gate while it is missing, and resolve() refuses.
let std = null;
const standard = () => (std ??= makeStandardScreen({ snapshot: "xuper-plugin/kino-plugin-sololatino",
  kino, name: "SoloLatino", logo: LOGO, logoAspect: LOGO_ASPECT, needsResolver: true, hasSettings: true,
  tabs: [
    { id: "inicio", label: "Inicio", labelEn: "Home" },
    { id: "peliculas", label: "Películas", labelEn: "Movies" },
    { id: "series", label: "Series", labelEn: "Series" },
  ],
  loadTab: async (tab) => ({ rows: tab === "peliculas" || tab === "series" ? (await section({ tab })).rows : await home() }),
}));

export async function screen(ctx) {
  await null;
  return standard().screen(ctx && typeof ctx === "object" ? ctx : {});
}

export async function screenEvent(ev) {
  await null;
  return standard().screenEvent(ev && typeof ev === "object" ? ev : {});
}

// ---- resolve ----

const LANG_NAME = { LAT: "lat", SUB: "sub", CAST: "cast", ESP: "cast" };
const SERVER_NAME = { vidhide: "VidHide", streamwish: "StreamWish", voe: "VOE", filemoon: "Filemoon", mixdrop: "MixDrop", streamtape: "StreamTape" };

/** A player token's address: the site asks first for an XSRF cookie, which Kino keeps for the plugin, and wants it back as a header. */
async function playerUrl(token, pageUrl) {
  await kino.fetch(`${SITE}/sanctum/csrf-cookie`, { headers: { "User-Agent": UA, Accept: "application/json", Referer: pageUrl }, timeoutMs: 10000 });
  let xsrf = null;
  try { xsrf = kino.cookies.get(SITE + "/", "XSRF-TOKEN"); } catch (_) { xsrf = null; }
  if (!xsrf) throw kino.error("unavailable", "no XSRF cookie");
  const r = await kino.fetch(`${SITE}/api/player-url`, {
    method: "POST", timeoutMs: 15000, body: JSON.stringify({ t: token }),
    headers: { "User-Agent": UA, "Content-Type": "application/json", Accept: "application/json", "X-XSRF-TOKEN": decodeURIComponent(xsrf), Referer: pageUrl, Origin: SITE },
  });
  if (!r.ok) throw kino.error("unavailable", "player-url " + r.status);
  const j = JSON.parse(await r.text());
  return j && typeof j.url === "string" ? j.url : null;
}

/** The page address of a movie ("m:<slug>") or an episode ("e:<slug>:<season>:<episode>"). */
function pageOf(ref) {
  let m = /^m:([a-z0-9-]+)$/.exec(ref);
  if (m) return `${SITE}/pelicula/${m[1]}`;
  m = /^e:([a-z0-9-]+):(\d+):(\d+)$/.exec(ref);
  return m ? `${SITE}/serie/${m[1]}/temporada-${m[2]}/episodio-${m[3]}` : null;
}

/** Every server of a title, in the order to try them: the preferred language first, then the ones opened with plain requests. */
async function serversOf(pageUrl, req) {
  const players = parsePlayers(await getPage(pageUrl, { Referer: SITE + "/" }));
  if (!players.length) return [];
  let id = null;
  for (const p of players) {
    try { id = embedId(await playerUrl(p.token, pageUrl)); } catch (_) { id = null; }
    if (id) break;
  }
  if (!id) return [];
  const rows = (await embed69.servers(kino, req, id)).filter((s) => s.url);
  let pref = "lat";
  try { pref = String(kino.config.get("audio") || "lat"); } catch (_) { pref = "lat"; }
  const lang = (s) => LANG_NAME[s.lang.toUpperCase()] || "sub";
  // The person's language first; within it, the hoster kino-resolver ranks best (its rank call: how well each one plays,
  // from the playback audit), so one resolver update re-orders every plugin. An older resolver: the order the site gave.
  const langRank = (s) => (lang(s) === pref ? 0 : lang(s) === "lat" ? 1 : lang(s) === "cast" ? 2 : 3);
  return (await rankServers(kino, rows, (s) => s.url, langRank)).slice(0, MAX_COPIES);
}

async function open(server, req, budget) {
  // The shared kino-resolver does the extraction (its provider door); capture is the fallback for gate hosts (VOE,
  // filemoon, doodstream) and for when the resolver is not installed.
  try {
    const res = await kino.plugins.call("resolver", "resolve", { url: server.url, referer: SITE + "/" });
    const s = (res && Array.isArray(res.streams) ? res.streams : []).find((x) => x && x.url);
    if (s) {
      const headers = {};
      if (s.referer) headers.Referer = s.referer;
      if (Array.isArray(s.headers)) { for (const h of s.headers) if (h && h.name) headers[h.name] = String(h.value); }
      const out = { url: s.url, mime: s.kind === "hls" ? HLS : (/\.mp4(\?|$)/i.test(s.url) ? "video/mp4" : HLS), headers };
      if (res.subtitles && res.subtitles.length) out.subtitles = res.subtitles;
      return out;
    }
    if (res && res.error === "dead") return null; // a dead host: don't spend a capture on it
  } catch (_) { /* provider_missing / failed: the hidden browser may still reach it */ }
  if (!kino.browser || typeof kino.browser.capture !== "function" || budget.captures <= 0) return null;
  budget.captures -= 1;
  const page = await kino.browser.capture(server.url, { timeoutMs: CAPTURE_MS, match: "\\.m3u8|\\.mp4", headers: { Referer: SITE + "/" } });
  const media = (page && page.media) || [];
  const best = media.find((x) => /m3u8/i.test(x.url)) || media[0];
  if (!best) return null;
  return { captured: true, url: best.url, mime: best.mime || (/\.mp4/i.test(best.url) ? "video/mp4" : HLS), headers: best.headers || { Referer: server.url } };
}

const labelOf = (s) => `${t(LANG_NAME[s.lang.toUpperCase()] || "sub")} · ${SERVER_NAME[s.server.toLowerCase()] || s.server}`;

/** `ref` is a movie ("m:<slug>"), an episode ("e:<slug>:<season>:<ep>") or one of their other servers ("c:<ref>@<i>"). */
export async function resolve(ref) {
  const m = /^c:(.+)@(\d+)$/.exec(String(ref || ""));
  const base = m ? m[1] : String(ref || "");
  const only = m ? Number(m[2]) : null;
  const pageUrl = pageOf(base);
  if (!pageUrl) throw kino.error("not_found", "unknown ref: " + ref);
  if (!(await resolverInstalled())) throw kino.error("unavailable", "resolver missing", { userMessage: t("needResolver") });
  const req = makeReq(kino, { deadline: Date.now() + RESOLVE_MS });
  const servers = await serversOf(pageUrl, req);
  if (!servers.length) throw kino.error("not_found", "no servers on " + pageUrl, { userMessage: t("noStreams") });
  const budget = { captures: MAX_CAPTURES };
  const deliver = (i, out) => {
    const s = servers[i];
    const stream = { url: out.url, mime: out.mime, headers: { "User-Agent": UA, ...(out.headers || {}) }, label: labelOf(s) };
    if (out.subtitles) stream.subtitles = out.subtitles;
    if (out.durationMs) stream.durationMs = out.durationMs;
    if (only == null) {
      const others = servers.map((_, j) => j).filter((j) => j !== i);
      if (others.length) stream.alternatives = others.map((j) => ({ ref: `c:${base}@${j}`, label: labelOf(servers[j]) }));
    }
    return stream;
  };
  let slow = null;
  const failures = [];
  for (const i of only != null ? [only] : servers.map((_, k) => k)) {
    const s = servers[i];
    if (!s) continue;
    try {
      const out = await open(s, req, budget);
      if (!out) { failures.push(`${s.server}: no stream`); continue; }
      if (!out.captured) {
        const answer = await peek(kino, { url: out.url, headers: { "User-Agent": UA, ...(out.headers || {}) } });
        // A slow CDN is kept as the last resort: the next server is tried, and only if none answers is this one played.
        if (answer === "slow") { if (!slow) slow = { i, out }; failures.push(`${s.server}: slow`); continue; }
        if (answer !== "ok") { failures.push(`${s.server}: address does not answer`); continue; }
      }
      return deliver(i, out);
    } catch (e) {
      failures.push(`${s.server}: ${(e && e.code) || ""} ${(e && e.message) || e}`.trim());
    }
  }
  if (slow) {
    kino.log(`resolve ${base}: only a slow server answered (${failures.join("; ")})`);
    return deliver(slow.i, slow.out);
  }
  kino.log(`resolve ${base} failed: ${failures.join("; ")}`);
  throw kino.error("not_found", "no server opened for " + pageUrl, { userMessage: t("noStreams") });
}

// ---- Ajustes ▸ SoloLatino ----

export async function settingsStatus() {
  let n = 0;
  try { n = kino.storage.keys().filter((k) => k.startsWith("c:")).length; } catch (_) { /* no storage */ }
  return { info: t("statusLine").replace("{n}", String(n)) };
}

export async function action(key) {
  if (key === "clearCache") {
    try { for (const k of kino.storage.keys()) if (k.startsWith("c:")) kino.storage.remove(k); } catch (_) { /* nothing to clear */ }
    return { message: t("cacheCleared") };
  }
  return { message: "" };
}

// std 1.7.0: the catalog door -- the author's other plugins (Da-Video) find titles here through Kino, and Kino opens and
// plays what they find in this plugin, with its own resolve.
import { catalogDoor } from "./std/catalog.js";
export const proto_catalog_search = catalogDoor(search);
