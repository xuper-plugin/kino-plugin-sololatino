# Changelog

## 0.1.3

- A search that finds nothing now tries the work's original title and the other titles Kino knows (`originalTitle`, `altTitles`) and the typed text cut at its first colon or dash, and an empty answer is no longer kept in the cache for ten minutes. (Found searching "Yosuga no Sora" in SoloLatino.)
  / Una búsqueda sin resultados ahora prueba el título original, los otros títulos que Kino conoce y el texto cortado en el primer dos puntos o guion; una respuesta vacía ya no se guarda diez minutos en la caché.

## 0.1.2

- The doramas row is tagged `doramas`, genre pages carry their genre on every title, and `telemetry` is added.
  / La fila de doramas lleva la categoría `doramas`, cada título de un género lleva su género y se agrega `telemetry`.

## 0.1.1

- StreamWish is tried before VidHide: on a phone VidHide's host took 8 s to time out before the next server opened.
  / StreamWish se prueba antes que VidHide: en un teléfono el host de VidHide tardó 8 s en fallar.

## 0.1.0

- First version, built on Kino's plugin API from the start: **Home rows** (recent movies and series, anime, doramas, popular movies, Netflix),
  a **section of its own** (six tabs and a hero), **categories** (18 genres and the platforms), **search** (also inside a list), **details**,
  **seasons and episodes** with stills and synopses, a **settings form** (preferred language, clear cache) and **downloads**.
  / Primera versión: filas de Inicio, sección propia, categorías, búsqueda, ficha, temporadas y episodios, ajustes y descargas.
- Servers come from Embed69 (StreamWish and VidHide with plain requests, VOE through the hidden browser), Latino first.
  / Los servidores salen de Embed69, con el latino primero.
