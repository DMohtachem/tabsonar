// Shared URL normalization for duplicate detection.
// Goal: two tabs count as "the same" only when they are truly the same page.
// Imported by both background.js and popup.js.

// Tracking params that never change the page content — safe to strip.
const TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "utm_id", "utm_reader", "utm_name", "utm_social", "utm_brand",
  "fbclid", "gclid", "dclid", "gbraid", "wbraid", "msclkid", "yclid",
  "mc_cid", "mc_eid", "_hsenc", "_hsmi", "igshid", "ref", "ref_src",
  "ref_url", "cmpid", "cid", "campaign", "s_kwcid", "spm",
];

/**
 * Normalize a URL for equality comparison.
 * - lowercases host, drops "www."
 * - removes default ports and trailing slash on the path
 * - strips known tracking query params, sorts the rest for stable ordering
 * - KEEPS the hash (SPA routing like n8n / docs anchors rely on it)
 * Falls back to the raw string for non-parseable URLs (chrome://newtab, etc.).
 * @param {string} rawUrl
 * @returns {string} normalized key
 */
export function normalizeUrl(rawUrl) {
  if (!rawUrl) return "";
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return rawUrl.trim();
  }

  // Only normalize real web pages; leave chrome://, about:, file:, etc. verbatim
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return rawUrl.trim();
  }

  let host = u.hostname.toLowerCase();
  if (host.startsWith("www.")) host = host.slice(4);

  // path without trailing slash (but keep root "/")
  let path = u.pathname;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  // filter + sort query params
  const params = new URLSearchParams(u.search);
  for (const p of TRACKING_PARAMS) params.delete(p);
  const kept = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const query = kept.length ? "?" + kept.map(([k, v]) => `${k}=${v}`).join("&") : "";

  const hash = u.hash || "";

  return `${host}${path}${query}${hash}`;
}
