// @ts-check
// Kino plugin: SoloLatino -- movies, series, anime and doramas in Spanish (mostly Latino) from sololatino.net.
// Home rows, a section of its own, categories (genres and platforms), search, details and episodes come from the site, whose covers are TMDB's
// (they load for Kino). A title's players are two: its own ("Principal", an app the site guards) and Embed69, whose page lists, per language, the
// hosts that carry the title. Those are opened here: VidHide and StreamWish with plain requests (./extractors), VOE through the hidden browser.

import { SITE, GENRES, NETWORKS, parseCards, parseTitle, parsePlayers, embedId } from "./sololatino.js";
import * as embed69 from "./embed69.js";
import { extractorFor } from "./extractors/index.js";
import { makeReq, UA } from "./util/http.js";
import { searchWithTerms } from "./util/terms.js";
import { playable } from "./util/probe.js";

const CACHE_MS = 10 * 60 * 1000;
const RESOLVE_MS = 70000;
const CAPTURE_MS = 20000;
const MAX_CAPTURES = 1;
const MAX_COPIES = 8;
const HLS = "application/vnd.apple.mpegurl";

// ---- i18n ----

const STRINGS = {
  es: {
    news: "Novedades", movies: "Películas", series: "Series", anime: "Anime", doramas: "Doramas", platforms: "Plataformas", genres: "Géneros",
    recentMovies: "Películas recientes", recentSeries: "Series recientes", popularMovies: "Películas populares", topSeries: "Series mejor valoradas", more: "Más",
    lat: "Latino", sub: "Subtitulado", cast: "Castellano", season: "Temporada", episode: "Episodio",
    heroText: "Películas y series en español latino, con estrenos al día.",
    unavailable: "El servicio no está disponible en este momento.", noEpisodes: "No se encontraron episodios de esta serie.", noStreams: "Ningún servidor de este título abrió. Prueba más tarde.",
    statusLine: "Listas guardadas: {n}", cacheCleared: "Caché vaciada.",
  },
  en: {
    news: "What's new", movies: "Movies", series: "Series", anime: "Anime", doramas: "Doramas", platforms: "Platforms", genres: "Genres",
    recentMovies: "Recent movies", recentSeries: "Recent series", popularMovies: "Popular movies", topSeries: "Top rated series", more: "More",
    lat: "Latino", sub: "Subtitled", cast: "Castilian", season: "Season", episode: "Episode",
    heroText: "Movies and series in Latin American Spanish, with new releases.",
    unavailable: "The service is not available right now.", noEpisodes: "No episodes found for this series.", noStreams: "No server of this title opened. Try again later.",
    statusLine: "Lists kept: {n}", cacheCleared: "Cache cleared.",
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

export async function home() {
  return (await Promise.all([
    safeRow("peliculas", () => rowOf("peliculas", "list:peliculas")),
    safeRow("series", () => rowOf("series", "list:series")),
    safeRow("animes", () => rowOf("animes", "list:animes")),
    safeRow("doramas", () => rowOf("doramas", "list:doramas")),
    safeRow("populares", () => rowOf("populares", "list:populares")),
    safeRow("netflix", () => rowOf("netflix", "net:netflix")),
  ])).filter(Boolean);
}

export async function browse(ref, cursor) {
  const def = refOf(ref);
  if (!def) return { items: [] };
  const page = cursor ? Math.max(1, parseInt(cursor, 10) || 1) : 1;
  const { cards, more } = await listPage(def, page);
  return { items: cards.map((c) => toItem(c, def.genreName)), next: more ? String(page + 1) : undefined };
}

/** Search uses the site's suggestion box (JSON): the page itself sits behind a check that only a browser passes. */
async function searchOne(arg) {
  const q = String((typeof arg === "string" ? arg : arg && arg.q) || "").trim();
  const within = typeof arg === "object" && arg && arg.within ? refOf(arg.within) : null;
  if (q.length < 2) return [];
  const rows = await cached("s:" + q.toLowerCase(), async () => {
    const r = await kino.fetch(`${SITE}/api/search/suggest?q=${encodeURIComponent(q)}`, { headers: { "User-Agent": UA, Accept: "application/json" }, timeoutMs: 15000 });
    if (!r.ok) throw kino.error("unavailable", `SoloLatino search ${r.status}`, { userMessage: t("unavailable") });
    const data = JSON.parse(await r.text());
    return Array.isArray(data) ? data : [];
  });
  const cards = [];
  for (const x of rows) {
    const m = /sololatino\.net\/(pelicula|serie)\/([^\/?#]+)/.exec(String((x && x.url) || ""));
    if (!m || x.type === "person") continue;
    cards.push({ slug: m[2], kind: m[1] === "pelicula" ? "movie" : "series", type: String(x.type || ""), title: String(x.title || m[2]), year: Number(x.year) || undefined, poster: String(x.poster || "") });
  }
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

export async function categories() {
  return [
    ...GENRES.map(([slug, name]) => ({ id: "g-" + slug, title: name, ref: "genre:" + slug })),
    ...NETWORKS.slice(0, 5).map(([slug, name]) => ({ id: "n-" + slug, title: name, ref: "net:" + slug })),
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
  // StreamWish answers in about a second everywhere; VidHide's host (morencius.com) took 8 s to time out on a phone, so it goes second
  const cost = (s) => (!extractorFor(s.url) ? 2 : /vidhide/i.test(s.server) ? 1 : 0);
  const rank = (s) => (lang(s) === pref ? 0 : lang(s) === "lat" ? 1 : lang(s) === "cast" ? 2 : 3) * 3 + cost(s);
  return rows.map((s, i) => ({ ...s, i })).sort((a, b) => rank(a) - rank(b) || a.i - b.i).slice(0, MAX_COPIES);
}

async function open(server, req, budget) {
  const ex = extractorFor(server.url);
  if (ex) {
    const out = await ex.extract(server.url, req, kino);
    if (out !== undefined) return out; // undefined: the extractor cannot reach its host from here, so the hidden browser may try
  }
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
  const req = makeReq(kino, { deadline: Date.now() + RESOLVE_MS });
  const servers = await serversOf(pageUrl, req);
  if (!servers.length) throw kino.error("not_found", "no servers on " + pageUrl, { userMessage: t("noStreams") });
  const budget = { captures: MAX_CAPTURES };
  const failures = [];
  for (const i of only != null ? [only] : servers.map((_, k) => k)) {
    const s = servers[i];
    if (!s) continue;
    try {
      const out = await open(s, req, budget);
      if (!out) { failures.push(`${s.server}: no stream`); continue; }
      if (!out.captured && !(await playable(kino, { url: out.url, headers: { "User-Agent": UA, ...(out.headers || {}) } }))) { failures.push(`${s.server}: address does not answer`); continue; }
      const stream = { url: out.url, mime: out.mime, headers: { "User-Agent": UA, ...(out.headers || {}) }, label: labelOf(s) };
      if (out.subtitles) stream.subtitles = out.subtitles;
      if (out.durationMs) stream.durationMs = out.durationMs;
      if (only == null) {
        const others = servers.map((_, j) => j).filter((j) => j !== i);
        if (others.length) stream.alternatives = others.map((j) => ({ ref: `c:${base}@${j}`, label: labelOf(servers[j]) }));
      }
      return stream;
    } catch (e) {
      failures.push(`${s.server}: ${(e && e.code) || ""} ${(e && e.message) || e}`.trim());
    }
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
