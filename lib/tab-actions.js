// Shared tab logic: safety rules, duplicate detection, RAM freeing.
// Pure functions where possible so they can be unit-reasoned and reused
// by both the service worker (background.js) and the popup.

import { normalizeUrl } from "./url-normalize.js";

// Hosts where two tabs with the same URL may hold DIFFERENT unsaved state.
// These are NEVER auto-closed, NEVER discarded, and NEVER counted as duplicates.
// Matched as substring on hostname.
export const PROTECTED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "automation.nexperts.cloud", // n8n editor — same URL != same unsaved workflow
];

// URL schemes we never touch.
const PROTECTED_SCHEMES = ["chrome:", "chrome-extension:", "about:", "edge:", "devtools:", "view-source:"];

/**
 * Is this tab HARD off-limits (localhost/n8n/pinned/internal pages)?
 * Deliberately does NOT include audible tabs — playing sound doesn't mean the
 * URL is "special", just that closing it should be an explicit choice, not a
 * silent background action. See `respectAudible` in the functions below.
 * @param {chrome.tabs.Tab} tab
 * @param {string[]} [extraHosts] user-added protected hosts
 */
export function isProtected(tab, extraHosts = []) {
  if (!tab || !tab.url) return true;
  if (tab.pinned) return true;
  let host = "";
  let scheme = "";
  try {
    const u = new URL(tab.url);
    host = u.hostname.toLowerCase();
    scheme = u.protocol;
  } catch {
    return true; // unparseable → be safe, leave it alone
  }
  if (PROTECTED_SCHEMES.includes(scheme)) return true;
  const hosts = [...PROTECTED_HOSTS, ...extraHosts];
  return hosts.some((h) => host === h || host.endsWith("." + h) || host.includes(h));
}

/**
 * Group tabs by normalized URL and return the duplicates to close.
 * Survivor per group = the audible one (never interrupt playback), else the
 * most-recently-accessed tab. Hard-protected tabs are excluded from grouping.
 * @param {chrome.tabs.Tab[]} tabs
 * @param {string[]} [extraHosts]
 * @param {object} [opts]
 * @param {boolean} [opts.skipAudible=false] exclude audible tabs from grouping
 *   entirely — used for silent/automatic sweeps. Explicit user-triggered
 *   dedupe (the "Close N duplicates" button) leaves this false so a muted
 *   copy of a playing video is still found and offered for closing.
 * @returns {{survivorId:number, closeIds:number[], key:string}[]}
 */
export function findDuplicateGroups(tabs, extraHosts = [], { skipAudible = false } = {}) {
  const byKey = new Map();
  for (const tab of tabs) {
    if (isProtected(tab, extraHosts)) continue;
    if (skipAudible && tab.audible) continue;
    const key = normalizeUrl(tab.url);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(tab);
  }
  const groups = [];
  for (const [key, group] of byKey) {
    if (group.length < 2) continue;
    const survivor = group.reduce((best, t) => {
      if (t.audible && !best.audible) return t;
      if (!t.audible && best.audible) return best;
      return (t.lastAccessed ?? t.id) > (best.lastAccessed ?? best.id) ? t : best;
    });
    const closeIds = group.filter((t) => t.id !== survivor.id).map((t) => t.id);
    groups.push({ survivorId: survivor.id, closeIds, key });
  }
  return groups;
}

/** Total number of tabs that would be closed across all duplicate groups. */
export function countDuplicates(tabs, extraHosts = [], opts) {
  return findDuplicateGroups(tabs, extraHosts, opts).reduce((n, g) => n + g.closeIds.length, 0);
}

/**
 * Decide which tabs to discard when freeing memory.
 * Keeps: active tab per window, pinned, audible (don't interrupt playback),
 * protected hosts, the N most-recently-accessed tabs, already-discarded tabs.
 * @param {chrome.tabs.Tab[]} tabs
 * @param {object} [opts]
 * @param {number} [opts.keepRecent=3] how many most-recent tabs to spare
 * @param {string[]} [opts.extraHosts]
 * @returns {number[]} tab ids to discard
 */
export function tabsToDiscard(tabs, { keepRecent = 3, extraHosts = [] } = {}) {
  const recentIds = new Set(
    [...tabs]
      .filter((t) => !t.discarded)
      .sort((a, b) => (b.lastAccessed ?? b.id) - (a.lastAccessed ?? a.id))
      .slice(0, keepRecent)
      .map((t) => t.id)
  );
  return tabs
    .filter((t) => {
      if (t.active) return false;
      if (t.discarded) return false;
      if (t.audible) return false; // never freeze a tab that's currently playing
      if (recentIds.has(t.id)) return false;
      if (isProtected(t, extraHosts)) return false;
      return true;
    })
    .map((t) => t.id);
}
