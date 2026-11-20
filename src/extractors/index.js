// Host classifier only — the extraction itself is the shared kino-resolver's (its provider door). SoloLatino no
// longer carries per-host extractors; `extractorFor(url)` just says whether the resolver resolves this host INLINE
// (no hidden browser), so `serversOf` can rank an inline server ahead of a gate host that needs a slower WebView
// capture. These are the host families SoloLatino's embed69 list hands out.
const INLINE_HOSTS = [
  "embedwish.com", "hlswish.com", "streamwish.com", "streamwish.to", "strwish.com", "wishembed.com", "filelions.com", "hglink.to", "vibuxer.com",
  "vidhide.com", "vidhidepro.com", "vidhideplus.com", "vidhidefast.com", "dintezuvio.com", "minochinos.com", "filelions.to", "morencius.com", "callistanise.com",
  "voe.sx",
];

/** Truthy (a `{ name }` marker) when the resolver resolves this embed's host inline; null otherwise. Ranking only. */
export function extractorFor(embedUrl) {
  let host;
  try { host = new URL(embedUrl).hostname.replace(/^www\./, ""); } catch (_) { return null; }
  return INLINE_HOSTS.some((h) => host === h || host.endsWith("." + h)) ? { name: "resolver" } : null;
}

export const HOSTS = INLINE_HOSTS;
