// Embed69 (https://embed69.org/f/<imdb>[-<s>x<ee>]): per language, the hosts that carry the title. Their links are AES-256-CBC
// encrypted; the key is SHA-256(LINK_CHALLENGE + LINK_SALT), both quoted in the page (adapted from the Kino plugin "Latino", same
// author). Until 2026-11 the key came from a proof of work (POW_CHALLENGE/POW_SALT/POW_DIFFICULTY); the site dropped that and now
// wraps each decrypted link in backticks.

import { getThroughAnubis } from "./anubis.js";

const SITE = "https://embed69.org";

/** A link is base64 of 16 IV bytes followed by the AES-256-CBC ciphertext. */
export function decryptLink(kino, keyHex, b64) {
  const raw = atob(b64);
  let ivHex = "";
  for (let i = 0; i < 16; i++) ivHex += raw.charCodeAt(i).toString(16).padStart(2, "0");
  return kino.crypto.decrypt("aes-256-cbc", { key: keyHex, keyEncoding: "hex", iv: ivHex, ivEncoding: "hex", data: btoa(raw.slice(16)) });
}

const quoted = (html, name) => { const m = new RegExp(name + "\\s*=\\s*'([^']*)'").exec(html); return m ? m[1] : null; };

/** The decrypted servers of a page's HTML: `[{ lang: "LAT"|"SUB"|"CAST", server, url }]`; [] when the page carries none. */
export function serversOf(kino, html) {
  const data = /let\s+dataLink\s*=\s*(\[.+\]);/.exec(html);
  const challenge = quoted(html, "LINK_CHALLENGE"), salt = quoted(html, "LINK_SALT");
  if (!data || !challenge || salt == null) return [];
  let langs;
  try { langs = JSON.parse(data[1]); } catch (_) { return []; }
  const keyHex = kino.crypto.hash("sha256", challenge + salt);
  const rows = [];
  for (const l of langs) {
    for (const e of (l && l.sortedEmbeds) || []) {
      if (!e || e.servername === "download" || typeof e.link !== "string") continue;
      try { rows.push({ lang: String(l.video_language || ""), server: String(e.servername || ""), url: decryptLink(kino, keyHex, e.link).replace(/`/g, "").trim() }); } catch (_) { /* a link that does not decrypt is skipped */ }
    }
  }
  return rows;
}

export async function servers(kino, req, id) {
  // embed69 sits behind Anubis (a proof-of-work anti-bot) since 2026-11: getThroughAnubis solves it in the
  // background so a plain fetch reads the page. The partner Referer is what embed69 answers once past the gate.
  const html = await getThroughAnubis(kino, req, `${SITE}/f/${id}`, { headers: { Referer: "https://sololatino.net/" } });
  return html ? serversOf(kino, html) : [];
}
