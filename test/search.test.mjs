// Search: the site's results page first (its suggestion endpoint answered 404 from late October), the old suggestion box as a fallback.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createKino } from "../sdk/kino-shim.mjs";

const manifest = JSON.parse(readFileSync(new URL("../kino-plugin.json", import.meta.url)));
const CARD = (href, title, year, type, label) => `<div class="card"> <a href="https://sololatino.net/${href}"> <div class="card__poster-wrap"> <img src="https://image.tmdb.org/t/p/w500/x.jpg"> <span class="badge card__badge badge-${type}">${label}</span> </div> <p class="card__title">${title}</p> <span class="card__year">${year}</span> </a></div>`;

function install(routes) {
  const dir = mkdtempSync(join(tmpdir(), "sl-"));
  const { kino } = createKino(manifest, { storageFile: join(dir, "s.json"), cookiesFile: join(dir, "c.json"), config: {}, lang: "es-CO", env: {} });
  const calls = [];
  globalThis.kino = Object.freeze({
    ...kino,
    fetch: async (url) => {
      calls.push(url);
      for (const [re, answer] of routes) {
        if (!re.test(url)) continue;
        const a = typeof answer === "function" ? answer(url) : answer;
        const body = typeof a.body === "string" ? a.body : JSON.stringify(a.body ?? {});
        return { ok: (a.status || 200) < 300, status: a.status || 200, url, headers: {}, text: () => body, json: () => JSON.parse(body) };
      }
      return { ok: false, status: 404, url, headers: {}, text: () => "", json: () => ({}) };
    },
  });
  return calls;
}

let n = 0;
const load = () => import("../src/plugin.js?x=" + ++n);

test("search reads the results page (/buscar?q=) and builds items from its cards", async () => {
  const calls = install([[/\/buscar\?q=avatar/, { body: CARD("pelicula/avatar", "Avatar", 2009, "movie", "Película") + CARD("serie/avatar-aang", "Avatar: Aang", 2005, "anime", "Anime") }]]);
  const { search } = await load();
  const items = await search({ q: "avatar" });
  assert.ok(items.length >= 2, "got " + items.length);
  assert.ok(items.some((i) => /Avatar/.test(i.title)));
  assert.ok(calls.some((u) => /\/buscar\?q=avatar/.test(u)));
  assert.ok(!calls.some((u) => /api\/search\/suggest/.test(u)), "the suggestion endpoint is not needed when the page answers");
});

test("when the results page fails the old suggestion box still answers", async () => {
  install([[/\/api\/search\/suggest\?q=dark/, { body: [{ url: "https://sololatino.net/serie/dark", type: "series", title: "Dark", year: 2017, poster: "https://image.tmdb.org/t/p/w500/d.jpg" }] }]]);
  const { search } = await load();
  const items = await search({ q: "dark" });
  assert.ok(items.some((i) => /Dark/.test(i.title)));
});

test("when neither answers the person is told the site is not answering", async () => {
  install([]);
  const { search } = await load();
  await assert.rejects(() => search({ q: "nada" }), (e) => e.code === "unavailable");
});
