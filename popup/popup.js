import uFuzzy from "../lib/ufuzzy.js";
import { countDuplicates, isProtected } from "../lib/tab-actions.js";
import { icon } from "./icons.js";
import { t, setLang, getLang, otherLang } from "./i18n.js";

const $ = (id) => document.getElementById(id);
const $q = $("q"), $searchRow = $("searchRow"), $reviewBar = $("reviewBar"), $reviewBack = $("reviewBack"),
  $reviewTitle = $("reviewTitle"), $reviewProgress = $("reviewProgress"), $statusRow = $("statusRow"), $stats = $("stats"),
  $start = $("start"),
  $results = $("results"), $empty = $("empty"), $review = $("review"), $footer = $("footer"),
  $footStats = $("footStats"), $audioChip = $("audioChip"), $dedupe = $("dedupe"),
  $reviewBtn = $("review-btn"), $ram = $("ram"), $ramInfo = $("ramInfo"), $mic = $("mic"), $langToggle = $("langToggle"),
  $lifetime = $("lifetime"), $toasts = $("toasts"), $feedbackLink = $("feedbackLink");

const uf = new uFuzzy({ intraMode: 1, intraIns: 1 });
const STALE_MS = 2 * 24 * 60 * 60 * 1000;
const KEEP_BUMP_TO_PERSIST = 3;

let TABS = [], view = [], sel = 0;
let mode = "search";           // search | review | audio
let reviewQueue = [], reviewIdx = 0;
let scope = "all";             // all | this
let currentWindowId = null;
let keepDomains = new Set();

// static icons
$("searchIco").innerHTML = icon("search");
$mic.innerHTML = icon("mic");
$reviewBack.innerHTML = icon("chevronLeft");

// ---------- i18n: apply to the fixed HTML chrome (not the dynamic list) ----
function applyStaticI18n() {
  $q.placeholder = t("searchPlaceholder");
  $mic.title = t("voiceSearch"); $mic.setAttribute("aria-label", t("voiceSearch"));
  $reviewBack.title = t("backToSearch"); $reviewBack.setAttribute("aria-label", t("backToSearch"));
  $reviewTitle.textContent = t("reviewOldTabs");
  $("segAll").textContent = t("all");
  $("segThis").textContent = t("thisWindow");
  const hintKeys = ["hintNavigate", "hintOpen", "hintClose", "hintJump"];
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (hintKeys.includes(key)) el.textContent = t(key);
  });
  $langToggle.textContent = otherLang().toUpperCase();
  $langToggle.title = t("switchLanguage");
  $langToggle.setAttribute("aria-label", t("switchLanguage"));
  $ramInfo.title = t("ramInfoLabel");
  $ramInfo.setAttribute("aria-label", t("ramInfoLabel"));
  $feedbackLink.textContent = t("feedbackLinkLabel");
  $feedbackLink.title = t("feedbackTooltip");
  document.documentElement.lang = getLang();
}
$ramInfo.addEventListener("click", (e) => {
  e.stopPropagation();
  toast(t("ramExplain"), { type: "info", duration: 6000 });
});
$langToggle.addEventListener("click", async () => {
  setLang(otherLang());
  await chrome.storage.local.set({ lang: getLang() }).catch(() => {});
  applyStaticI18n();
  if (mode === "review") renderReview();
  else { renderStats(); render($q.value, false); }
});

// ---------- helpers ----------
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function domainOf(url) { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url || ""; } }
function relTime(ms) {
  if (!ms) return { label: "", stale: false };
  const diff = Date.now() - ms, min = diff / 6e4, hr = min / 60, day = hr / 24;
  if (min < 1) return { label: "now", stale: false };
  if (min < 60) return { label: `${Math.round(min)} min`, stale: false };
  if (hr < 24) return { label: `${Math.round(hr)} h`, stale: false };
  return { label: `${Math.round(day)} d`, stale: diff >= STALE_MS };
}
function hlTitle(title, query) {
  const esc = escapeHtml;
  const terms = (query || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return esc(title);
  const low = title.toLowerCase(), marks = [];
  for (const term of terms) { let i = 0; while ((i = low.indexOf(term, i)) !== -1) { marks.push([i, i + term.length]); i += term.length; } }
  if (!marks.length) return esc(title);
  marks.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const m of marks) { const last = merged[merged.length - 1]; if (last && m[0] <= last[1]) last[1] = Math.max(last[1], m[1]); else merged.push([...m]); }
  let out = "", pos = 0;
  for (const [s, e] of merged) { out += esc(title.slice(pos, s)) + "<mark>" + esc(title.slice(s, e)) + "</mark>"; pos = e; }
  return out + esc(title.slice(pos));
}
function favHtml(t, cls, fb) {
  return t.favIconUrl && /^https?:|^data:/.test(t.favIconUrl)
    ? `<img class="${cls}" src="${escapeHtml(t.favIconUrl)}" alt="" loading="lazy" decoding="async" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'${fb}',textContent:'▢'}))"/>`
    : `<span class="${fb}">▢</span>`;
}
function keepMatch(t) { const d = domainOf(t.url); return [...keepDomains].some((k) => d === k || d.endsWith("." + k)); }

// ---------- data ----------
function buildTabs(tabs) {
  return tabs.map((t) => ({
    id: t.id, windowId: t.windowId, title: t.title || t.url || "(untitled)",
    url: t.url || "", domain: domainOf(t.url || ""), favIconUrl: t.favIconUrl || "",
    lastAccessed: t.lastAccessed ?? 0, discarded: !!t.discarded, pinned: !!t.pinned,
    audible: !!t.audible, muted: !!(t.mutedInfo && t.mutedInfo.muted),
  }));
}
async function load() {
  // 0) Language preference — cheap local read, fine to await before anything
  // paints since it only affects text, not data.
  try {
    const { lang } = await chrome.storage.local.get("lang");
    if (lang) setLang(lang);
  } catch {}
  applyStaticI18n();

  // 1) Instant paint from session cache. This is the ONLY thing awaited
  // before we try to show something — no storage.sync, no tabGroups, no
  // system.memory call gets to sit in front of it. chrome.storage.sync in
  // particular can be meaningfully slow (it talks to the Chrome Sync
  // backend), so it must never block first paint.
  try {
    const { tabsSnapshot } = await chrome.storage.session.get("tabsSnapshot");
    if (tabsSnapshot?.length && !TABS.length) { TABS = tabsSnapshot; render($q.value, false); }
  } catch {}

  // 2) The live tab list — the one thing the popup actually needs to be useful.
  // refreshTabs() already calls renderStats() at the end (keep-list, tab
  // groups, free-memory figure, lifetime counter, loaded in parallel so they
  // never delay the list) — no need to call it again here.
  await refreshTabs({ focus: true, animate: true });
}

// Re-fetch the live tab list and repaint the CURRENT view (keeps whatever the
// user has typed and which mode they're in). Used both by the initial load
// and by the live tabs/windows listeners below, so opening a new window or
// closing a tab while the popup is sitting open updates it in real time
// instead of requiring a reopen.
async function refreshTabs({ focus = false, animate = false } = {}) {
  const [tabs, win] = await Promise.all([chrome.tabs.query({}), chrome.windows.getCurrent().catch(() => null)]);
  currentWindowId = win?.id ?? null;
  TABS = buildTabs(tabs);
  chrome.storage.session?.set({ tabsSnapshot: TABS }).catch(() => {});
  if (mode === "review") { /* don't yank the card mid-review; staleTabs() is recomputed on next advance */ }
  else { render($q.value, animate); if (focus) $q.focus(); }
  renderStats();
}

let refreshTimer = null;
function scheduleRefresh() {
  // Debounce bursts (a new window firing onCreated for its window AND its
  // first tab within the same tick, a page load firing many onUpdated
  // events, etc.) into a single re-render.
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refreshTabs(), 120);
}
chrome.tabs.onCreated.addListener(scheduleRefresh);
chrome.tabs.onRemoved.addListener(scheduleRefresh);
chrome.tabs.onUpdated.addListener(scheduleRefresh); // also keeps title/favicon/audible/muted live
chrome.tabs.onAttached.addListener(scheduleRefresh);
chrome.tabs.onDetached.addListener(scheduleRefresh);
if (chrome.windows.onCreated) chrome.windows.onCreated.addListener(scheduleRefresh);
if (chrome.windows.onRemoved) chrome.windows.onRemoved.addListener(scheduleRefresh);
function scoped() { return scope === "this" && currentWindowId != null ? TABS.filter((t) => t.windowId === currentWindowId) : TABS; }
function staleTabs() { return scoped().filter((t) => !isProtected(t) && !keepMatch(t) && relTime(t.lastAccessed).stale).sort((a, b) => a.lastAccessed - b.lastAccessed); }
function audibleTabs() { return TABS.filter((t) => t.audible && !t.muted); }

// ---------- stats + footer ----------
// Everything here is "nice to have, arrives a beat later" — it runs after the
// tab list is already on screen and never blocks it. All the slower/optional
// chrome.* calls (sync storage, tabGroups, system.memory) run in parallel
// instead of one-after-another.
async function renderStats() {
  const set = scoped();
  const windowCount = new Set(TABS.map((t) => t.windowId)).size;

  const dupes = countDuplicates(TABS);
  $dedupe.hidden = dupes === 0;
  if (dupes) $dedupe.innerHTML = icon("stack") + t("closeDuplicates", dupes);

  const playing = audibleTabs().length;
  $audioChip.hidden = playing === 0;
  if (playing) $audioChip.innerHTML = icon("speaker") + t("nPlaying", playing);

  $ram.innerHTML = icon("moon") + t("freeUpMemory");

  // Provisional header without groups/free-memory — replaced below once ready.
  $stats.textContent = t("stats", set.length, windowCount, 0, "");
  $footStats.textContent = "";

  const [keepRes, groupsArr, mem, localRes] = await Promise.all([
    chrome.storage.sync.get("keep").catch(() => ({ keep: [] })),
    chrome.tabGroups.query({}).catch(() => []),
    chrome.system.memory.getInfo().catch(() => null),
    chrome.storage.local.get("duplicatesClosed").catch(() => ({ duplicatesClosed: 0 })),
  ]);

  const newKeep = keepRes.keep || [];
  const keepChanged = newKeep.length !== keepDomains.size || newKeep.some((k) => !keepDomains.has(k));
  keepDomains = new Set(newKeep);

  const groups = groupsArr.length;
  const memStr = mem ? t("freeGb", (mem.availableCapacity / 1024 ** 3).toFixed(1)) : "";
  $stats.textContent = t("stats", set.length, windowCount, groups, memStr);

  const stale = staleTabs().length;
  $reviewBtn.hidden = stale === 0;
  if (stale) $reviewBtn.innerHTML = icon("clock") + t("reviewNOld", stale);

  const duplicatesClosed = localRes.duplicatesClosed || 0;
  if (duplicatesClosed > 0) { $lifetime.hidden = false; $lifetime.textContent = t("duplicatesAutoClosed", duplicatesClosed); }

  // Keep-list arrived after the list was first painted — refresh "old" tags.
  if (keepChanged && mode === "search") render($q.value, false);
}

// ---------- search / list ----------
function render(query, animate) {
  const trimmed = (query || "").trim();
  const set = scoped();
  if (mode === "audio") { view = audibleTabs(); paint(trimmed, animate); return; }
  if (!trimmed) {
    // No query = browse everything, most-recently-used first. The list scrolls;
    // we no longer artificially cap this to a handful of "recent" tabs.
    view = [...set].sort((a, b) => b.lastAccessed - a.lastAccessed);
    $start.hidden = false;
  } else {
    $start.hidden = true;
    const hay = set.map((t) => `${t.title} ${t.domain} ${t.url}`);
    const idxs = uf.filter(hay, trimmed);
    if (idxs && idxs.length) {
      const info = uf.info(idxs, hay, trimmed);
      const order = uf.sort(info, hay, trimmed);
      view = order.map((oi) => set[info.idx[oi]]).slice(0, 8);
    } else view = [];
  }
  sel = Math.min(sel, Math.max(0, view.length - 1));
  paint(trimmed, animate);
}

function rowHtml(t, i, query) {
  const time = relTime(t.lastAccessed), prot = isProtected(t), stale = time.stale && !keepMatch(t);
  const otherWin = t.windowId !== currentWindowId ? `<span class="dot" style="background:var(--text-tertiary)"></span><span>${translate("otherWindow")}</span>` : "";
  const lock = prot ? `<span class="sub-lock" title="${translate("protectedTitle")}">${icon("lock")}</span>` : "";
  const oldTag = stale ? `<span class="dot amber"></span><span class="old-tag">${translate("old")}</span>` : "";
  // Show the speaker toggle whenever the tab is making sound OR you've muted
  // it — that second half is the fix: once muted, `audible` alone must not
  // hide the only control that can undo it.
  const speaker = (t.audible || t.muted)
    ? `<button class="row-act speaker ${t.muted ? "muted" : ""}" data-act="mute" title="${t.muted ? translate("unmuteTab") : translate("muteTab")}" aria-label="${t.muted ? translate("unmuteTab") : translate("muteTab")}">${icon(t.muted ? "speakerMute" : "speaker")}</button>` : "";
  return `<li class="row ${i === sel ? "sel" : ""} ${stale ? "stale" : ""} ${animateNext ? "reveal" : ""}" data-i="${i}" role="option" aria-selected="${i === sel}" style="${animateNext ? `animation-delay:${Math.min(i * 18, 160)}ms` : ""}">
    ${favHtml(t, "fav", "fav-fallback")}
    <span class="row-main">
      <div class="row-title">${hlTitle(t.title, query)}</div>
      <div class="row-sub">${escapeHtml(t.domain)}${lock}${oldTag}${otherWin}</div>
    </span>
    <span class="time ${stale ? "stale" : ""}">${time.label ? icon("clock") + time.label : ""}</span>
    ${speaker}
    <button class="row-act jump" data-act="jump" title="${translate("goToTab")}" aria-label="${translate("goToTab")}">${icon("arrow")}</button>
    <button class="row-act close" data-act="close" title="${translate("closeTab")}" aria-label="${translate("closeTab")}">${icon("close")}</button>
  </li>`;
}
// short alias so the template literals above stay readable
function translate(key, ...args) { return t(key, ...args); }

let animateNext = false;
function paint(trimmed, animate) {
  animateNext = !!animate;
  if (!view.length) {
    $results.innerHTML = "";
    if (mode === "audio") { $empty.hidden = false; $empty.innerHTML = t("nothingPlaying"); return; }
    if (trimmed) { showNoMatch(trimmed); } else { $empty.hidden = true; }
    return;
  }
  $empty.hidden = true;
  $results.innerHTML = view.map((t, i) => rowHtml(t, i, trimmed)).join("");
  scrollSelIntoView();
  animateNext = false;
}
function scrollSelIntoView() { const el = $results.querySelector(".row.sel"); if (el) el.scrollIntoView({ block: "nearest" }); }

// #6 recently closed fallback
async function showNoMatch(trimmed) {
  let closed = [];
  try {
    const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 25 });
    closed = sessions.filter((s) => s.tab).map((s) => s.tab).filter((t) => (`${t.title} ${t.url}`).toLowerCase().includes(trimmed.toLowerCase())).slice(0, 5);
  } catch {}
  if (!closed.length) {
    $empty.hidden = false;
    $empty.innerHTML = `${t("noMatch", escapeHtml(trimmed))}<div class="sub">${t("pressEscToReset")}</div>`;
    $results.innerHTML = "";
    return;
  }
  $empty.hidden = true;
  $results.innerHTML = `<li class="row" style="height:auto;cursor:default"><span class="row-sub" style="padding:6px 0">${t("recentlyClosed")}</span></li>` +
    closed.map((tab) => `<li class="row rc" data-sid="${escapeHtml(tab.sessionId)}">
      ${favHtml({ favIconUrl: tab.favIconUrl }, "fav", "fav-fallback")}
      <span class="row-main"><div class="row-title">${hlTitle(tab.title || tab.url, trimmed)}</div><div class="row-sub">${escapeHtml(domainOf(tab.url))} · closed</div></span>
      <button class="row-act jump" data-act="restore" title="${t("reopen")}" aria-label="${t("reopen")}">${icon("undo")}</button></li>`).join("");
}

// ---------- actions ----------
async function jumpTo(t) {
  if (!t) return;
  try { await chrome.tabs.update(t.id, { active: true }); await chrome.windows.update(t.windowId, { focused: true }); window.close(); }
  catch { load(); }
}
async function animateRemove(id) {
  const idx = view.findIndex((v) => v.id === id);
  const el = idx >= 0 ? $results.querySelector(`.row[data-i="${idx}"]`) : null;
  if (el) { el.classList.add("closing"); await new Promise((r) => setTimeout(r, 170)); }
}
async function closeTab(tab, { silent = false } = {}) {
  // Protection guards automatic actions (auto-dedupe, background sweep,
  // free-up-memory discard) — see lib/tab-actions.js. A manual, single-row
  // click is a deliberate choice by the user and must always work, even for
  // localhost/n8n/chrome:// pages.
  if (!tab) return;
  await animateRemove(tab.id);
  try { await chrome.tabs.remove(tab.id); } catch {}
  TABS = TABS.filter((x) => x.id !== tab.id);
  await renderStats();
  render($q.value, false);
  if (!silent) toast(t("closedToast", `${tab.title.slice(0, 28)}${tab.title.length > 28 ? "…" : ""}`), { type: "ok", action: t("undo"), onAction: undoClose });
}
async function undoClose() { try { await chrome.sessions.restore(); } catch {} await load(); toast(t("restored"), { type: "ok" }); }
async function muteTab(tab) {
  // Toggle, don't just always mute — and only update local state if the
  // browser call actually succeeded (previously this always set muted:true
  // and pretended it worked even on failure, which left no way back).
  const next = !tab.muted;
  try {
    await chrome.tabs.update(tab.id, { muted: next });
  } catch {
    toast(t("muteFailed"), { type: "err" });
    return;
  }
  const x = TABS.find((v) => v.id === tab.id); if (x) x.muted = next;
  await renderStats(); render($q.value, false);
  const short = `${tab.title.slice(0, 24)}${tab.title.length > 24 ? "…" : ""}`;
  toast(next ? t("mutedToast", short) : t("unmutedToast", short), { type: "ok" });
}
async function restoreSession(sid) { try { await chrome.sessions.restore(sid); } catch {} window.close(); }

// event delegation
$results.addEventListener("click", (e) => {
  const row = e.target.closest(".row"); if (!row) return;
  const act = e.target.closest(".row-act");
  if (row.classList.contains("rc")) { if (act?.dataset.act === "restore") restoreSession(row.dataset.sid); return; }
  const tab = view[Number(row.dataset.i)]; if (!tab) return;
  if (act?.dataset.act === "close") { closeTab(tab); return; }
  if (act?.dataset.act === "mute") { muteTab(tab); return; }
  jumpTo(tab);
});

// ---------- review mode ----------
function enterReview() {
  reviewQueue = staleTabs(); reviewIdx = 0;
  if (!reviewQueue.length) { toast(t("noOldToReview"), { type: "info" }); return; }
  mode = "review";
  $searchRow.hidden = true; $statusRow.hidden = true; $reviewBar.hidden = false;
  $results.hidden = true; $empty.hidden = true; $start.hidden = true; $footer.hidden = true; $lifetime.hidden = true;
  $review.hidden = false; renderReview("in");
}
function exitReview() {
  mode = "search";
  $searchRow.hidden = false; $statusRow.hidden = false; $reviewBar.hidden = true;
  $results.hidden = false; $review.hidden = true; $footer.hidden = false;
  renderStats(); render($q.value, true); $q.focus();
}
function renderReview(anim) {
  const tab = reviewQueue[reviewIdx];
  if (!tab) {
    $review.innerHTML = `<div class="rev-done"><div class="big">${icon("check")}${t("allCaughtUp")}</div><div class="sub">${t("noMoreOld")}</div></div>`;
    $reviewProgress.textContent = ""; return;
  }
  $reviewProgress.textContent = `${reviewIdx + 1} / ${reviewQueue.length}`;
  const age = relTime(tab.lastAccessed).label;
  $review.innerHTML = `<div class="rev-card ${anim === "in" ? "in" : ""}">
    ${favHtml(tab, "rev-fav", "rev-fav-fallback")}
    <h3 class="rev-title">${escapeHtml(tab.title)}</h3>
    <p class="rev-domain">${escapeHtml(tab.domain)}</p>
    <span class="rev-age">${t("lastUsedAgo", age)}</span>
    <div class="rev-actions">
      <button class="rev-btn rev-keep" id="revKeep">${icon("arrow")}${t("keep")}</button>
      <button class="rev-btn rev-close" id="revClose">${icon("close")}${t("reviewClose")}</button>
    </div>
    <button class="rev-keepsite" id="revKeepSite">${t("alwaysKeep", escapeHtml(tab.domain))}</button>
    <div class="rev-hint">${t("reviewHint")}</div></div>`;
  $("revKeep").onclick = () => keepCurrent();
  $("revClose").onclick = () => closeCurrent();
  $("revKeepSite").onclick = () => keepSiteCurrent();
}
function advance(dir) {
  const card = $review.querySelector(".rev-card");
  if (card) card.classList.add(dir === "close" ? "out-right" : "out-left");
  setTimeout(() => { reviewIdx++; renderReview("in"); }, dir ? 200 : 0);
}
async function bumpKeep(domain) {
  const { keepCounts = {} } = await chrome.storage.local.get("keepCounts");
  keepCounts[domain] = (keepCounts[domain] || 0) + 1;
  await chrome.storage.local.set({ keepCounts });
  if (keepCounts[domain] >= KEEP_BUMP_TO_PERSIST && !keepDomains.has(domain)) { await persistKeep(domain); toast(t("willStopSuggesting", domain), { type: "info" }); }
}
function keepCurrent() { const tab = reviewQueue[reviewIdx]; if (tab) bumpKeep(tab.domain); advance("keep"); }
async function closeCurrent() { const tab = reviewQueue[reviewIdx]; if (tab) { try { await chrome.tabs.remove(tab.id); } catch {} TABS = TABS.filter((x) => x.id !== tab.id); } advance("close"); }
async function keepSiteCurrent() { const tab = reviewQueue[reviewIdx]; if (tab) { await persistKeep(tab.domain); toast(t("alwaysKeepingToast", tab.domain), { type: "ok" }); } advance("keep"); }
async function persistKeep(domain) { keepDomains.add(domain); await chrome.storage.sync.set({ keep: [...keepDomains] }); }

// ---------- toasts ----------
function toast(msg, { type = "info", action, onAction, duration = action ? 5000 : 2500 } = {}) {
  const el = document.createElement("div"); el.className = "toast";
  const ic = type === "ok" ? "check" : type === "err" ? "close" : "arrow";
  el.innerHTML = `<span class="t-icon ${type}">${icon(ic)}</span><span class="t-msg">${escapeHtml(msg)}</span>` +
    (action ? `<button class="t-action">${escapeHtml(action)}</button>` : "") +
    `<span class="t-bar" style="animation-duration:${duration}ms"></span>`;
  if (action && onAction) el.querySelector(".t-action").onclick = () => { onAction(); dismiss(); };
  function dismiss() { el.classList.add("out"); setTimeout(() => el.remove(), 180); }
  $toasts.appendChild(el);
  setTimeout(dismiss, duration);
}

// ---------- keyboard ----------
$q.addEventListener("input", () => { mode = "search"; render($q.value, false); });
document.addEventListener("keydown", (e) => {
  if (mode === "review") {
    if (e.key === "Escape") { e.preventDefault(); exitReview(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); keepCurrent(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); closeCurrent(); }
    return;
  }
  if (e.altKey && /^[1-8]$/.test(e.key)) { e.preventDefault(); jumpTo(view[Number(e.key) - 1]); return; }
  if (e.altKey && (e.key === "m" || e.key === "M")) { e.preventDefault(); $mic.click(); return; }
  if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(sel + 1, view.length - 1); paint($q.value.trim(), false); }
  else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(sel - 1, 0); paint($q.value.trim(), false); }
  else if (e.key === "Enter") { e.preventDefault(); jumpTo(view[sel]); }
  else if ((e.key === "Backspace" || e.key === "Delete") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); closeTab(view[sel]); }
  else if (e.key === "Escape") { if (mode === "audio") { mode = "search"; render($q.value, true); } else window.close(); }
});

// ---------- footer + segments ----------
$reviewBack.addEventListener("click", exitReview);
$reviewBtn.addEventListener("click", enterReview);
$audioChip.addEventListener("click", () => { mode = mode === "audio" ? "search" : "audio"; render($q.value, true); });
$dedupe.addEventListener("click", async () => {
  $dedupe.disabled = true;
  const res = await chrome.runtime.sendMessage({ type: "closeDuplicates" });
  if (res?.ok) { toast(t("closedNDuplicates", res.closed), { type: "ok", action: res.closed ? t("undo") : undefined, onAction: undoClose }); await load(); }
  $dedupe.disabled = false;
});
$ram.addEventListener("click", async () => {
  $ram.disabled = true;
  const res = await chrome.runtime.sendMessage({ type: "freeUpRam" });
  if (res?.ok) toast(t("nTabsPutToSleep", res.frozen), { type: "ok" });
  else toast(t("ramFailed"), { type: "err" });
  await load(); $ram.disabled = false;
});
function setScope(s) { scope = s; $("segAll").setAttribute("aria-selected", s === "all"); $("segThis").setAttribute("aria-selected", s === "this"); renderStats(); render($q.value, true); }
$("segAll").addEventListener("click", () => setScope("all"));
$("segThis").addEventListener("click", () => setScope("this"));

// ---------- voice ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
$mic.addEventListener("click", async () => {
  if (!SR) { $q.placeholder = t("voiceNotSupported"); return; }
  const { micReady } = await chrome.storage.local.get("micReady");
  if (!micReady) { chrome.tabs.create({ url: chrome.runtime.getURL("mic-setup.html") }); window.close(); return; }
  startVoice();
});
function startVoice() {
  const rec = new SR(); rec.lang = getLang() === "de" ? "de-DE" : "en-US"; rec.interimResults = true; rec.continuous = false;
  $mic.classList.add("listening"); $searchRow.classList.add("listening");
  rec.onresult = (ev) => { const text = Array.from(ev.results).map((r) => r[0].transcript).join(""); $q.value = text; render(text, false); };
  const stop = () => { $mic.classList.remove("listening"); $searchRow.classList.remove("listening"); };
  rec.onend = stop; rec.onerror = stop; rec.start();
}

load();
