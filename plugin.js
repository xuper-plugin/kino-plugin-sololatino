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
var NAMED_ENTITIES = { ndash: "\u2013", mdash: "\u2014", hellip: "\u2026", lsquo: "\u2018", rsquo: "\u2019", ldquo: "\u201C", rdquo: "\u201D", nbsp: " ", iexcl: "\xA1", iquest: "\xBF", laquo: "\xAB", raquo: "\xBB", aacute: "\xE1", eacute: "\xE9", iacute: "\xED", oacute: "\xF3", uacute: "\xFA", ntilde: "\xF1", Aacute: "\xC1", Eacute: "\xC9", Iacute: "\xCD", Oacute: "\xD3", Uacute: "\xDA", Ntilde: "\xD1", uuml: "\xFC" };
var decodeMore = (s) => s.replace(/&#([0-9]{1,7});/g, (m, n) => {
  const c = Number(n);
  return c > 0 && c <= 1114111 ? String.fromCodePoint(c) : m;
}).replace(/&#x([0-9a-f]{1,6});/gi, (m, h) => {
  const c = parseInt(h, 16);
  return c > 0 && c <= 1114111 ? String.fromCodePoint(c) : m;
}).replace(/&([a-z]+);/gi, (m, k) => NAMED_ENTITIES[k] ?? m);
var decode = (s) => decodeMore(String(s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " "));
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
  const t2 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(h);
  if (!t2) return null;
  const para = /<p class="text-sm leading-relaxed[^"]*"[^>]*>([\s\S]*?)<\/p>/.exec(h.slice(t2.index));
  const head = h.slice(t2.index, para ? t2.index + para.index : t2.index + 6e3);
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
    title: text(t2[1]),
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

// src/std/model.js
var MAX_SLIDES = 5;
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
var slidesOf = (rows) => pickSlides(rows, (item) => item.backdrop);
var posterSlidesOf = (rows) => pickSlides(rows, (item) => item.poster);
function slideText(overview, item = {}) {
  const text2 = typeof overview === "string" ? overview.trim() : "";
  if (text2 === "") return [item.year, item.rating ? "\u2605 " + item.rating : null].filter(Boolean).join(" \xB7 ");
  return text2.length <= MAX_SLIDE_TEXT ? text2 : `${text2.slice(0, MAX_SLIDE_TEXT - 1).trimEnd()}\u2026`;
}
function pickSlides(rows, pictureOf) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const row of rows) {
    for (const item of row.items || []) {
      if (out.length >= MAX_SLIDES) return out;
      const image = pictureOf(item);
      if (item.adult === true || seen.has(item.id) || !image || !HTTPS.test(image)) continue;
      seen.add(item.id);
      out.push({ id: item.id, ref: item.ref, kind: item.kind, title: item.title, image, text: slideText(item.overview, item) });
    }
  }
  return out;
}
var uniform = (items) => items.every((i) => i.backdrop) ? items : items.map(({ backdrop, ...rest }) => rest);
function railsOf(rows) {
  return rows.filter((r) => !r.hidden && r.items && r.items.length > 0).slice(0, MAX_RAILS).map((r) => ({
    id: r.id,
    title: r.title,
    ...r.titleEn ? { titleEn: r.titleEn } : {},
    ...r.ref ? { ref: r.ref } : {},
    items: uniform(r.items.slice(0, MAX_RAIL_ITEMS).map(cardOf))
  }));
}
function tabOf(page) {
  const rows = page && Array.isArray(page.rows) ? page.rows : [];
  const rails = railsOf(rows);
  if (rails.length === 0) return null;
  return { slides: slidesOf(rows), posterSlides: posterSlidesOf(rows), rails };
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

// src/std/strings.js
var WORDS = {
  watch: ["Ver", "Watch"],
  info: ["M\xE1s informaci\xF3n", "More info"],
  recent: ["Continuar viendo", "Continue watching"],
  search: ["Buscar", "Search"],
  searchHint: ["Buscar en {name}", "Search {name}"],
  failed: ["No se pudo cargar esta secci\xF3n. Revisa tu conexi\xF3n e int\xE9ntalo de nuevo.", "This section could not be loaded. Check your connection and try again."],
  retry: ["Reintentar", "Retry"],
  empty: ["A\xFAn no hay nada aqu\xED.", "Nothing here yet."],
  back: ["Atr\xE1s", "Back"],
  close: ["Cerrar", "Close"],
  settings: ["Ajustes", "Settings"],
  supportTv: ["Si te gusta mi trabajo, escan\xE9alo y ap\xF3yame", "If you like my work, scan it and support me"],
  support: ["Si te gusta mi trabajo, ap\xF3yame", "If you like my work, support me"],
  gateTitle: ["Necesitas el motor de reproducci\xF3n", "You need the playback engine"],
  gateText: [
    "{name} reproduce a trav\xE9s de Kino Resolver (gratis). Inst\xE1lalo una vez y sirve para este y para otros plugins de sitios.",
    "{name} plays through Kino Resolver (free). Install it once and it works here and in other site plugins."
  ],
  gateInstall: ["Instalar Kino Resolver", "Install Kino Resolver"]
};
var fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => vars && vars[k] != null ? String(vars[k]) : m);
function twin(key, field = "text", vars) {
  const [es, en] = WORDS[key];
  const pick = (i) => vars && Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, Array.isArray(v) ? v[i] : v]));
  return { [field]: fill(es, pick(0)), [field + "En"]: fill(en, pick(1)) };
}
var STRING_KEYS = Object.keys(WORDS);

// src/std/view.js
var SUPPORT_URL = "https://ko-fi.com/xuperplugins";
var RESOLVER_REPO = "xuper-plugin/kino-plugin-kino-resolver";
var POLL_MS = 1500;
function brand(cfg) {
  return {
    type: "Row",
    key: "brand",
    gap: 12,
    crossAxisAlignment: "center",
    children: [
      ...cfg.logo ? [{ type: "Image", key: "logo", url: cfg.logo, aspect: cfg.logoAspect || "1:1", fit: "contain", h: 32, alt: cfg.name, altEn: cfg.nameEn || cfg.name }] : [],
      { type: "Text", key: "name", style: "h4", text: cfg.name, textEn: cfg.nameEn || cfg.name }
    ]
  };
}
var tabBar = (tabs, active) => ({
  type: "TabBar",
  key: "tabs",
  divider: false,
  value: active,
  onChanged: "tab",
  tabs: tabs.map((t2) => ({ value: t2.id, label: t2.label, labelEn: t2.labelEn || t2.label }))
});
var iconButton = (key, icon, word, onPressed) => ({ type: "IconButton", key, icon, ...twin(word, "labelText"), ...twin(word, "tooltip"), onPressed });
var searchOpenOps = (tabsInBar) => [
  { hide: "brand" },
  { hide: "searchButton" },
  { hide: "settingsButton" },
  ...tabsInBar ? [{ hide: "tabs" }] : [],
  { show: "closeSearch" },
  { show: "q" },
  { focus: "q" }
];
var searchClosedOps = (tabsInBar) => [
  { hide: "closeSearch" },
  { hide: "q" },
  { clear: "q" },
  { show: "brand" },
  { show: "searchButton" },
  { show: "settingsButton" },
  ...tabsInBar ? [{ show: "tabs" }] : []
];
function supportNode(device) {
  if (device === "tv") return { type: "QrImage", key: "donate", value: SUPPORT_URL, size: "large", ...twin("supportTv", "labelText") };
  return { type: "ElevatedButton", key: "donate", icon: "heart", ...twin("support", "labelText"), onPressed: { go: { url: { href: SUPPORT_URL } } } };
}
var bar = ({ leading, title, actions = [] }) => ({ type: "AppBar", mergeWithKinoBar: true, dense: true, divider: false, leading, title, actions });
var railSkeleton = (n) => ({
  type: "Column",
  key: "skel" + n,
  gap: 8,
  children: [
    { type: "Skeleton", shape: "line", width: 120 },
    { type: "Row", gap: 12, sizes: ["compact"], children: [1, 2, 3].map((i) => ({ type: "Skeleton", shape: "card", key: `sk${n}c${i}`, flex: 1 })) },
    { type: "Row", gap: 12, sizes: ["medium", "expanded"], children: [1, 2, 3, 4, 5, 6].map((i) => ({ type: "Skeleton", shape: "card", key: `sk${n}w${i}`, flex: 1 })) }
  ]
});
var heroSkeleton = () => ({ type: "Skeleton", key: "heroSkeleton", shape: "block", height: { compact: 200, expanded: 320 } });
var titleOf = (s) => ({ ref: s.ref, kind: s.kind, id: s.id, title: s.title });
var withHeaders = (headers) => headers ? { headers } : {};
var slideNode = (s, headers) => ({
  type: "heroCard",
  key: "slide-" + s.id,
  h: { compact: 200, expanded: 240 },
  ...s.logo ? { logo: s.logo } : {},
  title: s.title,
  text: s.text,
  image: s.image,
  ...withHeaders(headers),
  buttons: [
    { type: "ElevatedButton", key: "watch-" + s.id, ...twin("watch", "labelText"), icon: "play", onPressed: { go: { play: titleOf(s) } } },
    { type: "TextButton", key: "info-" + s.id, ...twin("info", "labelText"), onPressed: { go: { title: titleOf(s) } } }
  ]
});
var hero = (slides, headers) => slides.length === 1 ? slideNode(slides[0], headers) : {
  type: "PageView",
  key: "hero" + slides.length,
  autoPlayMs: 6e3,
  children: slides.map((s) => slideNode(s, headers))
};
var rail = (r, key, words, headers) => ({
  type: "titleRail",
  key,
  ...words || { title: r.title, titleEn: r.titleEn || r.title },
  ...r.ref ? { ref: r.ref } : {},
  items: r.items,
  ...withHeaders(headers)
});
function browseView(cfg, { tab, data, recent, pending, failed, device = "phone" }) {
  const tv = device === "tv";
  const tabs = cfg.tabs;
  const active = tabs.some((t2) => t2.id === tab) ? tab : tabs[0].id;
  const withTabs = tabs.length > 1;
  const body = [];
  if (data) {
    const h = cfg.imageHeaders;
    if (data.slides.length > 0) body.push(hero(data.slides, h));
    if (recent.length > 0) body.push(rail({ items: recent }, "recent", twin("recent", "title"), h));
    for (const r of data.rails) body.push(rail(r, "rail-" + String(r.id).replace(/[^A-Za-z0-9_-]/g, "_"), null, h));
    if (data.rails.length === 0) body.push({ type: "Text", key: "empty", ...twin("empty"), color: "muted" });
  } else if (failed) {
    body.push({ type: "MaterialBanner", key: "loadFailed", role: "error", ...twin("failed"), action: { ...twin("retry", "label"), onTap: "retry" } });
  } else {
    body.push(heroSkeleton(), railSkeleton(1), railSkeleton(2), railSkeleton(3));
  }
  const isBanner = (n) => !!n && (n.type === "heroCard" || n.key === "heroSkeleton" || n.type === "PageView" && String(n.key).startsWith("hero"));
  const banner = body.length > 0 && isBanner(body[0]) ? body.shift() : null;
  const tabsInBar = tv && withTabs;
  const appBar = bar({
    leading: iconButton("close", "close", "close", { go: { close: true } }),
    title: { type: "Row", key: "titleRow", gap: tabsInBar ? 24 : 8, crossAxisAlignment: "center", children: [
      { ...iconButton("closeSearch", "arrow_back", "back", { ui: searchClosedOps(tabsInBar) }), hidden: true },
      brand(cfg),
      ...tabsInBar ? [tabBar(tabs, active)] : [],
      {
        type: "TextField",
        key: "q",
        hidden: true,
        flex: 1,
        kind: "search",
        maxLength: 200,
        ...twin("searchHint", "hintText", { name: [cfg.name, cfg.nameEn || cfg.name] }),
        onSubmitted: "search",
        trailingIcon: "search",
        ...twin("search", "trailingLabel"),
        onTrailingTap: "search"
      }
    ] },
    actions: [
      iconButton("searchButton", "search", "search", { ui: searchOpenOps(tabsInBar) }),
      iconButton("settingsButton", "settings", "settings", "openSettings")
    ]
  });
  return {
    type: "Scaffold",
    appBar,
    body: { type: "Column", key: "page", children: [
      ...withTabs && !tv ? [{ type: "Column", key: "tabsRow", padding: { compact: 0, expanded: 24 }, children: [tabBar(tabs, active)] }] : [],
      { type: "SingleChildScrollView", key: "browse-" + active, flex: 1, children: [...banner ? [banner] : [], { type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: body }] }
    ] },
    ...pending ? { every: { ms: POLL_MS, event: "tick" } } : {}
  };
}
function settingsView(cfg, device = "phone") {
  return {
    type: "Scaffold",
    appBar: bar({ leading: iconButton("back", "arrow_back", "back", "back"), title: brand(cfg) }),
    body: { type: "SingleChildScrollView", key: "settings-page", children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: [
      ...cfg.hasSettings ? [{ type: "settings", key: "form" }, { type: "Divider", key: "supportDivider" }] : [],
      supportNode(device)
    ] }] }
  };
}
function gateView(cfg, device = "phone") {
  const name = [cfg.name, cfg.nameEn || cfg.name];
  return {
    type: "Scaffold",
    appBar: bar({ leading: iconButton("close", "close", "close", { go: { close: true } }), title: brand(cfg) }),
    body: { type: "Column", key: "gate", mainAxisAlignment: "center", crossAxisAlignment: "center", padding: 24, gap: 16, children: [
      { type: "Text", key: "gateTitle", style: "h3", ...twin("gateTitle") },
      { type: "Text", key: "gateText", style: "p", ...twin("gateText", "text", { name }) },
      { type: "ElevatedButton", key: "installResolver", ...twin("gateInstall", "labelText"), onPressed: { go: { installPlugin: { repo: RESOLVER_REPO } } } },
      supportNode(device)
    ] }
  };
}

// src/std/metaCache.js
var KEY = "meta3";
var MAX = 160;
var CONCURRENCY = 3;
var OVERVIEW_MAX = 160;
var HTTPS2 = /^https:\/\//;
function makeMetaCache({ kino: kino2, titleOf: titleOf2 = (c) => c.title, typeOf = (c) => c.kind === "series" ? "series" : "movie", tmdbPictures = false, clock = { now: () => Date.now() } }) {
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
    return {
      ...e.t > 0 ? { tmdb: e.t } : {},
      ...e.l && HTTPS2.test(e.l) ? { logo: e.l } : {},
      ...e.p && HTTPS2.test(e.p) ? { poster: e.p } : {},
      ...e.b && HTTPS2.test(e.b) ? { backdrop: e.b } : {},
      ...typeof e.o === "string" && e.o ? { overview: e.o } : {}
    };
  }
  const asked = (id) => Object.hasOwn(read(), id);
  function dress(cards) {
    return cards.map((c) => {
      const k = known(c.id);
      const poster = tmdbPictures && k.poster ? k.poster : null;
      if (!k.tmdb && !poster) return c;
      return { ...c, ...k.tmdb && !(c.ids && c.ids.tmdb) ? { ids: { ...c.ids || {}, tmdb: k.tmdb } } : {}, ...poster ? { poster } : {} };
    });
  }
  async function fill2(cards, budgetMs) {
    if (!usable()) return 0;
    const b = read();
    const end = clock.now() + budgetMs;
    let count = 0;
    let stop = false;
    const seen = /* @__PURE__ */ new Set();
    const todo = cards.filter((c) => {
      if (!c || typeof c.id !== "string" || seen.has(c.id) || Object.hasOwn(b, c.id) || c.ids && c.ids.tmdb && c.noLogo) return false;
      seen.add(c.id);
      return true;
    });
    let next = 0;
    const str = (v, max) => typeof v === "string" ? v.slice(0, max) : "";
    const worker = async () => {
      while (!stop && next < todo.length && clock.now() < end) {
        const c = todo[next++];
        const year = c.year !== void 0 ? { year: c.year } : {};
        try {
          const a = await kino2.meta({ type: typeOf(c), title: titleOf2(c), ...year });
          b[c.id] = {
            t: a && a.ids && Number.isInteger(a.ids.tmdb) ? a.ids.tmdb : 0,
            l: str(a && a.logo, 2048),
            p: str(a && a.poster, 2048),
            b: str(a && a.backdrop, 2048),
            o: str(a && a.overview, OVERVIEW_MAX)
          };
          count++;
        } catch (e) {
          if (e && e.code === "rate_limited") stop = true;
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (count > 0) write();
    return count;
  }
  return { known, asked, dress, fill: fill2, usable, tmdbPictures };
}

// src/std/index.js
var TAB_KEY = "browseTab";
var SNAP_PREFIX = "browse1:";
var SNAP_TTL_MS = 7 * 24 * 3600 * 1e3;
var SNAP_MAX = 20 * 1024;
var RECENT_KEY = "recent1";
var RECENT_MAX = 12;
var Q_MAX = 200;
var META_TICK_MS = 3e3;
var MAX_META_TICKS = 10;
var DEFAULT_TABS = [{ id: "inicio", label: "Inicio", labelEn: "Home" }];
function makeStandardScreen({ kino: kino2, name, nameEn, logo = null, logoAspect = "1:1", needsResolver, hasSettings, tabs, loadTab, homeKey = null, titleOf: titleOf2, typeOf, tmdbPictures = false, imageHeaders = null }) {
  const cfg = { name, nameEn, logo, logoAspect, imageHeaders, hasSettings: !!hasSettings, tabs: Array.isArray(tabs) && tabs.length > 0 ? tabs : DEFAULT_TABS };
  const TAB_IDS = cfg.tabs.map((t2) => t2.id);
  const meta2 = makeMetaCache({ kino: kino2, titleOf: titleOf2, typeOf, tmdbPictures });
  function slidesFromMeta(rails) {
    const out = [];
    for (const r of rails) {
      for (const c of r.items) {
        if (out.length >= MAX_SLIDES) return out;
        const k = meta2.known(c.id);
        if (!k.backdrop || c.adult === true || out.some((x) => x.id === c.id)) continue;
        out.push({ id: c.id, ref: c.ref, kind: c.kind, title: c.title, image: k.backdrop, text: slideText(k.overview, c), ...k.logo ? { logo: k.logo } : {} });
      }
    }
    return out;
  }
  const enrich = (data) => {
    if (!data) return data;
    const own = data.slides.map((s) => {
      const k = meta2.known(s.id);
      const image = tmdbPictures && k.backdrop ? k.backdrop : null;
      return k.logo || image ? { ...s, ...k.logo ? { logo: k.logo } : {}, ...image ? { image } : {} } : s;
    });
    const learned = own.length > 0 ? [] : slidesFromMeta(data.rails);
    return {
      // The site's own backdrops, else TMDB's, else the posters: every plugin has a hero.
      slides: own.length > 0 ? own : learned.length > 0 ? learned : data.posterSlides || [],
      rails: data.rails.map((r) => ({ ...r, items: meta2.dress(r.items) }))
    };
  };
  const metaTicks = /* @__PURE__ */ new Map();
  const memo = /* @__PURE__ */ new Map();
  const log = (...a) => {
    try {
      kino2.log("[std]", ...a);
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
      const slim = { slides: data.slides, posterSlides: data.posterSlides || [], rails: data.rails.map((r) => ({ ...r, items: r.items.slice(0, per) })) };
      const text2 = JSON.stringify({ at: Date.now(), data: slim });
      if (text2.length <= SNAP_MAX) {
        set(SNAP_PREFIX + tab, text2, { ttlMs: SNAP_TTL_MS });
        return;
      }
    }
  }
  function homeSeed(tab) {
    if (!homeKey || tab !== TAB_IDS[0]) return null;
    try {
      const o = JSON.parse(get(homeKey) || "null");
      return o && Array.isArray(o.rows) && o.rows.length ? tabOf({ rows: o.rows }) : null;
    } catch (_) {
      return null;
    }
  }
  const stored = () => {
    const t2 = get(TAB_KEY);
    return TAB_IDS.includes(t2) ? t2 : null;
  };
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
  const tabFromArgs = (route) => {
    const a = route && route.args && typeof route.args === "object" ? route.args : {};
    return TAB_IDS.includes(a.tab) ? a.tab : null;
  };
  function needed(tab) {
    return memo.get(tab) && memo.get(tab).whole ? [] : [tab];
  }
  function screen2(ctx) {
    const c = ctx || {};
    const device = c.device || "phone";
    if (needsResolver && !(c.installed && c.installed[RESOLVER_REPO])) return gateView(cfg, device);
    if (c.route && c.route.name === "settings") return settingsView(cfg, device);
    const st = c.state && typeof c.state === "object" ? c.state : {};
    const tab = TAB_IDS.includes(st.tab) ? st.tab : tabFromArgs(c.route) ?? stored() ?? TAB_IDS[0];
    const data = enrich(dataOf(tab));
    const loaded = TAB_IDS.map((t2) => memo.get(t2)).filter(Boolean).map((m) => m.data);
    const pending = Array.isArray(st.pending) && st.pending.length > 0;
    return browseView(cfg, { tab, data, recent: meta2.dress(recentOf(readKeys(), loaded)), pending, failed: !!(st.failed && st.failed[tab]), device });
  }
  async function load(tab) {
    const data = tabOf(await loadTab(tab));
    if (data) {
      memo.set(tab, { data, whole: true });
      writeSnap(tab, data);
    }
    return data !== null;
  }
  const events = {
    open({ route, state, device }) {
      const tab = tabFromArgs(route) ?? (TAB_IDS.includes(state.tab) ? state.tab : stored() ?? TAB_IDS[0]);
      for (const t2 of TAB_IDS) dataOf(t2);
      return { state: { tab, pending: needed(tab), failed: null } };
    },
    tab({ value, arg, state }) {
      const tab = TAB_IDS.includes(value) ? value : TAB_IDS.includes(arg) ? arg : null;
      if (!tab) return null;
      set(TAB_KEY, tab);
      dataOf(tab);
      const failed = { ...state.failed || {} };
      delete failed[tab];
      const pending = [tab, ...Array.isArray(state.pending) ? state.pending.filter((t2) => t2 !== tab) : []];
      return { state: { tab, pending: memo.get(tab) && memo.get(tab).whole ? pending.slice(1) : pending, failed } };
    },
    retry({ state }) {
      const tab = TAB_IDS.includes(state.tab) ? state.tab : TAB_IDS[0];
      return { state: { failed: null, pending: [tab] } };
    },
    async tick({ state }) {
      const pending = Array.isArray(state.pending) ? state.pending : [];
      if (pending.length === 0) return null;
      const [next, ...rest] = pending;
      const failed = { ...state.failed || {} };
      if (next.startsWith("meta:")) {
        const tab = next.slice(5);
        const m = memo.get(tab);
        if (!m) return { state: { pending: rest } };
        const ask = (x) => ({ id: x.id, title: x.title, kind: x.kind, ...x.year !== void 0 ? { year: x.year } : {} });
        const noOwnSlides = m.data.slides.length === 0;
        const cards = [...m.data.slides.map(ask), ...m.data.rails.flatMap((r) => r.items.slice(0, noOwnSlides ? MAX_SLIDES * 3 : 6).map(ask))];
        const count = await meta2.fill(cards, META_TICK_MS);
        const ticks = (metaTicks.get(tab) || 0) + 1;
        metaTicks.set(tab, ticks);
        const again = noOwnSlides && count > 0 && ticks < MAX_META_TICKS && slidesFromMeta(m.data.rails).length < MAX_SLIDES && cards.some((c) => !meta2.asked(c.id));
        return { state: { pending: again ? [next, ...rest] : rest } };
      }
      try {
        const ok = await load(next);
        if (!ok) failed[next] = true;
        else delete failed[next];
        if (ok && meta2.usable()) rest.unshift("meta:" + next);
      } catch (e) {
        log("tab", e && e.code || "error");
        failed[next] = true;
      }
      return { state: { pending: rest, failed } };
    },
    // The words go to Kino's own search, with this plugin as the source; the bar is put back as it was, locally.
    search({ value, state, device }) {
      const typed = value && typeof value === "object" ? value.q : value;
      const raw = typed != null && String(typed).trim() !== "" ? typed : state.inputs && state.inputs.q;
      const q = String(raw == null ? "" : raw).trim().slice(0, Q_MAX);
      return q ? { go: { search: { q } }, ui: searchClosedOps(device === "tv" && TAB_IDS.length > 1) } : null;
    },
    openSettings() {
      return { route: { push: "settings" }, state: { fromBrowse: true } };
    },
    back({ state, route }) {
      if (route && route.name === "settings" && !state.fromBrowse) return { close: true };
      return { route: { pop: true }, state: { fromBrowse: false } };
    }
  };
  async function screenEvent2(ev) {
    const e = ev || {};
    const name2 = e.name != null ? e.name : e.event;
    const handler = typeof name2 === "string" && Object.hasOwn(events, name2) ? events[name2] : null;
    return handler ? await handler({ ...e, state: e.state || {} }) ?? null : null;
  }
  return { screen: screen2, screenEvent: screenEvent2, notePlayed };
}

// src/logo.js
var LOGO = "data:image/png;base64,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";
var LOGO_ASPECT = "1:1";

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
var PEEK_BYTES = 2048;
async function peek(kino2, out, ms = 6e3) {
  try {
    const r = await kino2.fetch(out.url, { headers: { Range: `bytes=0-${PEEK_BYTES - 1}`, ...out.headers || {} }, timeoutMs: ms, maxBytes: PEEK_BYTES });
    return r.ok || r.status === 401 || r.status === 403 || r.status === 416 ? "ok" : "dead";
  } catch (e) {
    if (e && (e.code === "host_not_allowed" || e.code === "too_large")) return "ok";
    return e && e.code === "timeout" ? "slow" : "dead";
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
var t = (key) => {
  const lang = String(kino.lang || "").toLowerCase().startsWith("es") ? "es" : "en";
  return STRINGS[lang][key] || STRINGS.es[key] || key;
};
async function getPage(url, headers) {
  const r = await kino.fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-MX,es;q=0.9", ...headers || {} }, timeoutMs: 15e3 });
  if (!r.ok) throw kino.error("unavailable", `SoloLatino ${r.status} ${url}`, { userMessage: t("unavailable") });
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
    return l ? { ...l, title: t(l.titleKey) } : null;
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
  if (!r.ok) throw kino.error("unavailable", `SoloLatino search ${r.status}`, { userMessage: t("unavailable") });
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
  if (!list.length) throw kino.error("not_found", "no episodes for " + slug, { userMessage: t("noEpisodes") });
  const series = { title: p.title || void 0, poster: p.poster || void 0, backdrop: p.backdrop || void 0, overview: p.overview || void 0, genres: p.genres.length ? p.genres : void 0, year: p.year ? String(p.year) : void 0, rating: p.rating };
  for (const k of Object.keys(series)) if (series[k] === void 0) delete series[k];
  return {
    series,
    episodes: list.map((e) => {
      const ep = { season: e.season, number: e.number, ref: `e:${slug}:${e.season}:${e.number}`, title: e.title || `${t("episode")} ${e.number}` };
      if (e.thumb) ep.still = e.thumb;
      if (e.overview) ep.overview = e.overview;
      return ep;
    })
  };
}
async function resolverInstalled() {
  try {
    await kino.plugins.call("resolver", "normalizeHost", { url: "https://probe.invalid/" });
    return true;
  } catch (e) {
    return (e && e.code) !== "provider_missing";
  }
}
var std = null;
var standard = () => std ?? (std = makeStandardScreen({
  kino,
  name: "SoloLatino",
  logo: LOGO,
  logoAspect: LOGO_ASPECT,
  needsResolver: true,
  hasSettings: true,
  tabs: [
    { id: "inicio", label: "Inicio", labelEn: "Home" },
    { id: "peliculas", label: "Pel\xEDculas", labelEn: "Movies" },
    { id: "series", label: "Series", labelEn: "Series" }
  ],
  loadTab: async (tab) => ({ rows: tab === "peliculas" || tab === "series" ? (await section({ tab })).rows : await home() })
}));
async function screen(ctx) {
  await null;
  return standard().screen(ctx && typeof ctx === "object" ? ctx : {});
}
async function screenEvent(ev) {
  await null;
  return standard().screenEvent(ev && typeof ev === "object" ? ev : {});
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
var labelOf = (s) => `${t(LANG_NAME[s.lang.toUpperCase()] || "sub")} \xB7 ${SERVER_NAME[s.server.toLowerCase()] || s.server}`;
async function resolve(ref) {
  const m = /^c:(.+)@(\d+)$/.exec(String(ref || ""));
  const base = m ? m[1] : String(ref || "");
  const only = m ? Number(m[2]) : null;
  const pageUrl = pageOf(base);
  if (!pageUrl) throw kino.error("not_found", "unknown ref: " + ref);
  if (!await resolverInstalled()) throw kino.error("unavailable", "resolver missing", { userMessage: t("needResolver") });
  const req = makeReq(kino, { deadline: Date.now() + RESOLVE_MS });
  const servers2 = await serversOf2(pageUrl, req);
  if (!servers2.length) throw kino.error("not_found", "no servers on " + pageUrl, { userMessage: t("noStreams") });
  const budget = { captures: MAX_CAPTURES };
  const deliver = (i, out) => {
    const s = servers2[i];
    const stream = { url: out.url, mime: out.mime, headers: { "User-Agent": UA, ...out.headers || {} }, label: labelOf(s) };
    if (out.subtitles) stream.subtitles = out.subtitles;
    if (out.durationMs) stream.durationMs = out.durationMs;
    if (only == null) {
      const others = servers2.map((_, j) => j).filter((j) => j !== i);
      if (others.length) stream.alternatives = others.map((j) => ({ ref: `c:${base}@${j}`, label: labelOf(servers2[j]) }));
    }
    return stream;
  };
  let slow = null;
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
      if (!out.captured) {
        const answer = await peek(kino, { url: out.url, headers: { "User-Agent": UA, ...out.headers || {} } });
        if (answer === "slow") {
          if (!slow) slow = { i, out };
          failures.push(`${s.server}: slow`);
          continue;
        }
        if (answer !== "ok") {
          failures.push(`${s.server}: address does not answer`);
          continue;
        }
      }
      return deliver(i, out);
    } catch (e) {
      failures.push(`${s.server}: ${e && e.code || ""} ${e && e.message || e}`.trim());
    }
  }
  if (slow) {
    kino.log(`resolve ${base}: only a slow server answered (${failures.join("; ")})`);
    return deliver(slow.i, slow.out);
  }
  kino.log(`resolve ${base} failed: ${failures.join("; ")}`);
  throw kino.error("not_found", "no server opened for " + pageUrl, { userMessage: t("noStreams") });
}
async function settingsStatus() {
  let n = 0;
  try {
    n = kino.storage.keys().filter((k) => k.startsWith("c:")).length;
  } catch (_) {
  }
  return { info: t("statusLine").replace("{n}", String(n)) };
}
async function action(key) {
  if (key === "clearCache") {
    try {
      for (const k of kino.storage.keys()) if (k.startsWith("c:")) kino.storage.remove(k);
    } catch (_) {
    }
    return { message: t("cacheCleared") };
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
