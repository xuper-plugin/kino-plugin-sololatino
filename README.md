# SoloLatino para Kino

Plugin de [Kino](https://github.com/kinotvapp/kino-light) para ver **películas, series, anime y doramas** en español (sobre todo latino) de
[sololatino.net](https://sololatino.net/).

> Plugin no oficial. El catálogo y los videos pertenecen a sololatino.net y a los servidores donde están alojados; este plugin solo los
> lista y abre dentro de Kino.

## Instalar

En Kino: **Ajustes ▸ Plugins ▸ Agregar**, y pega:

```
xuper-plugin/kino-plugin-sololatino
```

Kino pide dos permisos en rojo: *abrir páginas web ocultas para encontrar el video* y *reproducir video desde cualquier servidor que
indique*. Hacen falta para VOE, que arma su dirección con JavaScript, y para las direcciones de video que cambian de dominio.

## Qué trae

- **Una sección propia** («SoloLatino») con seis pestañas —*Novedades*, *Películas*, *Series*, *Anime*, *Doramas* y *Plataformas*— y un destacado.
- **Inicio** con películas y series recientes, anime, doramas, películas populares y Netflix.
- **Categorías**: 18 géneros y las plataformas (Netflix, Prime Video, Disney+, HBO Max, HBO), cada una con su lista por páginas.
- **Búsqueda** (también dentro de una lista), **ficha** con sinopsis, géneros, año, nota y duración, **temporadas y episodios** con su imagen y
  sinopsis, y **descarga**.
- **Ajustes ▸ SoloLatino**: idioma preferido (latino, castellano o subtitulado) y vaciar la caché.
- Las carátulas son las de TMDB que usa el sitio, y el icono es su logo.

## Servidores

El sitio ofrece dos reproductores por título. El «Principal» es una aplicación que el propio sitio protege (se salta); el otro es **Embed69**,
cuya página lista, por idioma, los servidores que tienen el título. Kino abre el primero que funcione y deja los demás en el menú **Servidor**:

| Servidor | Cómo se abre |
| --- | --- |
| StreamWish y VidHide | peticiones normales, sin navegador |
| VOE | el navegador oculto de Kino (`kino.browser`), una sola página por título |

Para llegar a Embed69 el sitio pide primero una cookie `XSRF-TOKEN` (`/sanctum/csrf-cookie`) y devuelve la dirección del reproductor en
`/api/player-url`; Kino guarda la cookie para el plugin. La página de búsqueda del sitio está tras una verificación que solo un navegador pasa,
así que la búsqueda usa su caja de sugerencias (JSON), que devuelve unos ocho resultados.

## Límites

- La búsqueda trae pocos resultados (los de la caja de sugerencias del sitio).
- Los títulos sin entrada en Embed69 no abren: el reproductor «Principal» no se usa.

## Desarrollo

```
npm test            # pruebas sin red
npm run validate    # compila plugin.js y valida el manifiesto con el kit
node sdk/run.mjs ./plugin.js home
node sdk/run.mjs ./plugin.js resolve 'e:las-kardashian:1:1'
```

Licencia Apache-2.0 (ver `LICENSE` y `NOTICE`).
