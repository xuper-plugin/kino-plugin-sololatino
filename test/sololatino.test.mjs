import test from "node:test";
import assert from "node:assert/strict";
import { parseCards, parseTitle, parsePlayers, embedId } from "../src/sololatino.js";

const CARD = (href, title, year, type, label) => `<div class="card"> <a href="https://sololatino.net/${href}"> <div class="card__poster-wrap"> <img src="https://image.tmdb.org/t/p/w500/x.jpg" alt="${title}" class="card__poster"> <span class="badge card__badge badge-${type}">${label}</span> <span class="card__rating">★ 6.2</span> </div> </a> <div class="card__info"> <p class="card__title">${title}</p> <span class="card__year">${year}</span> </div> </div>`;

test("parseCards reads slug, kind, year, poster and rating", () => {
  const cards = parseCards(CARD("pelicula/idiots", "Idiotas", 2026, "movie", "Película") + CARD("serie/dark", "Dark &amp; Co", 2017, "anime", "Anime"));
  assert.equal(cards.length, 2);
  assert.deepEqual(cards[0], { slug: "idiots", kind: "movie", badge: "Película", type: "movie", title: "Idiotas", year: 2026, poster: "https://image.tmdb.org/t/p/w500/x.jpg", rating: 6.2 });
  assert.equal(cards[1].kind, "series");
  assert.equal(cards[1].type, "anime");
  assert.equal(cards[1].title, "Dark & Co");
});

test("parseCards drops a title that appears twice", () => {
  assert.equal(parseCards(CARD("pelicula/a", "A", 2020, "movie", "Película") + CARD("pelicula/a", "A", 2020, "movie", "Película")).length, 1);
});

const SERIES = `<h1 class="sr-only">Las Kardashian</h1> <div class="flex flex-wrap items-center gap-3 text-sm mb-4"> <span>2022</span> <span>8 temp.</span> <a href="https://sololatino.net/genero/reality" class="x">Reality</a> </div>
<div class="rating-badge"><span class="rating-badge__val">4.5</span></div>
<p class="text-sm leading-relaxed mb-5 max-w-2xl" style="color:#a0a0c8">La familia &amp; sus cámaras.</p>
<div data-season-panel="1"> <a href="https://sololatino.net/serie/las-kardashian/temporada-1/episodio-1" class="ep-item"> <img src="https://image.tmdb.org/t/p/w300/s.jpg" class="ep-thumb"> <p class="text-sm font-semibold text-white leading-tight"> Uno </p> <p class="text-xs mt-1 line-clamp-2" style="x">Sinopsis</p></a>
<a href="https://sololatino.net/serie/las-kardashian/temporada-1/episodio-2" class="ep-item"> <p class="text-sm font-semibold text-white leading-tight"> Dos </p></a></div>
<div data-season-panel="2"> <a href="https://sololatino.net/serie/las-kardashian/temporada-2/episodio-1" class="ep-item"></a></div>`;

test("parseTitle reads a series page and its seasons", () => {
  const p = parseTitle(SERIES);
  assert.equal(p.title, "Las Kardashian");
  assert.equal(p.year, 2022);
  assert.deepEqual(p.genres, ["Reality"]);
  assert.equal(p.overview, "La familia & sus cámaras.");
  assert.equal(p.rating, 4.5);
  assert.deepEqual(p.seasons.map((s) => [s.season, s.episodes.length]), [[1, 2], [2, 1]]);
  assert.deepEqual(p.seasons[0].episodes[0], { season: 1, number: 1, title: "Uno", thumb: "https://image.tmdb.org/t/p/w300/s.jpg", overview: "Sinopsis" });
});

test("parseTitle is null without a title", () => assert.equal(parseTitle("<html></html>"), null));

test("parsePlayers lists the tokens per language group, without the star", () => {
  const html = `<div data-lang-group="mx" hidden class="mb-3"><button class="server-btn" data-server-btn data-player-token="AAA" > ⭐ Principal </button> <button class="server-btn" data-server-btn data-player-token="BBB" > Servidor 2 </button></div>`;
  assert.deepEqual(parsePlayers(html), [{ lang: "mx", name: "Principal", token: "AAA" }, { lang: "mx", name: "Servidor 2", token: "BBB" }]);
});

test("embedId takes the IMDb id, with the episode when there is one", () => {
  assert.equal(embedId("https://embed69.org/f/tt6628920"), "tt6628920");
  assert.equal(embedId("https://embed69.org/f/tt15791630-1x01"), "tt15791630-1x01");
  assert.equal(embedId("https://x.test/other"), null);
});
