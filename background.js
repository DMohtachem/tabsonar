// TabSonar service worker: badge counter, auto-dedupe engine, RAM freeing.
import { normalizeUrl } from "./lib/url-normalize.js";
import { findDuplicateGroups, tabsToDiscard, isProtected } from "./lib/tab-actions.js";

const SWEEP_ALARM = "tabsonar-dedupe-sweep";
const BADGE_IDLE = "#5f6368";
const BADGE_BUSY = "#e8710a"; // orange nudge at >= 40 tabs
const BADGE_OK = "#1e8e3e"; // green flash after a merge
const NUDGE_THRESHOLD = 40;

// ---- storage helpers ------------------------------------------------------
async function getState() {
  const { duplicatesClosed = 0, extraHosts = [] } = await chrome.storage.local.get([
    "duplicatesClosed",
    "extraHosts",
  ]);
  return { duplicatesClosed, extraHosts };
}
async function bumpClosed(n) {
  if (n <= 0) return;
  const { duplicatesClosed } = await getState();
  await chrome.storage.local.set({ duplicatesClosed: duplicatesClosed + n });
}

// ---- badge ----------------------------------------------------------------
async function updateBadge(flash) {
  let tabs;
  try {
    tabs = await chrome.tabs.query({});
  } catch {
    return;
  }
  const count = tabs.length;
  await chrome.action.setBadgeText({ text: count ? String(count) : "" });
  if (flash === "merge") {
    await chrome.action.setBadgeBackgroundColor({ color: BADGE_OK });
    // revert after a moment
    setTimeout(() => {
      chrome.action.setBadgeBackgroundColor({
        color: count >= NUDGE_THRESHOLD ? BADGE_BUSY : BADGE_IDLE,
      });
    }, 900);
  } else {
    await chrome.action.setBadgeBackgroundColor({
      color: count >= NUDGE_THRESHOLD ? BADGE_BUSY : BADGE_IDLE,
    });
  }
}

// ---- auto-dedupe: merge & jump on new page loads --------------------------
// When a tab finishes loading a URL that already exists elsewhere, close the
// newcomer and focus the existing tab. Guarded by protection rules.
async function mergeOnLoad(tabId, url) {
  if (!url) return;
  let loaded;
  try {
    loaded = await chrome.tabs.get(tabId);
  } catch {
    return;
  }
  const { extraHosts } = await getState();
  if (isProtected(loaded, extraHosts)) return;

  const key = normalizeUrl(url);
  if (!key) return;

  const all = await chrome.tabs.query({});
  // find an OLDER tab (different id) with the same key that is not protected.
  // Silent/automatic action — skip audible twins so we never interrupt playback
  // without the user explicitly asking (that's what the "Close N duplicates"
  // button in the popup is for).
  const twin = all.find(
    (t) => t.id !== tabId && !isProtected(t, extraHosts) && !t.audible && normalizeUrl(t.url) === key
  );
  if (!twin) return;

  // keep the twin (it holds the earlier context), drop the newcomer, jump over
  try {
    await chrome.tabs.remove(tabId);
    await chrome.tabs.update(twin.id, { active: true });
    await chrome.windows.update(twin.windowId, { focused: true });
    await bumpClosed(1);
    await updateBadge("merge");
  } catch {
    /* tab vanished mid-flight — ignore */
  }
}

// ---- dedupe: shared by the 5-min background sweep AND the popup's button --
// skipAudible=true (background alarm): never silently close a tab that's
// currently playing sound. skipAudible=false (explicit user click): include
// audible duplicates too — the user asked for this directly (e.g. two copies
// of the same YouTube video) and can see the result immediately.
async function closeDuplicates({ skipAudible }) {
  const { extraHosts } = await getState();
  const tabs = await chrome.tabs.query({});
  const groups = findDuplicateGroups(tabs, extraHosts, { skipAudible });
  let closed = 0;
  for (const g of groups) {
    for (const id of g.closeIds) {
      try {
        await chrome.tabs.remove(id);
        closed++;
      } catch {
        /* ignore */
      }
    }
  }
  if (closed) {
    await bumpClosed(closed);
    await updateBadge("merge");
  } else {
    await updateBadge();
  }
  return closed;
}

// ---- RAM freeing ----------------------------------------------------------
async function freeUpRam() {
  const { extraHosts } = await getState();
  const tabs = await chrome.tabs.query({});
  const ids = tabsToDiscard(tabs, { keepRecent: 3, extraHosts });
  let frozen = 0;
  for (const id of ids) {
    try {
      await chrome.tabs.discard(id);
      frozen++;
    } catch {
      /* some tabs refuse discard — ignore */
    }
  }
  return frozen;
}

// ---- message bridge for the popup ----------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg?.type === "closeDuplicates") {
        const closed = await closeDuplicates({ skipAudible: false });
        sendResponse({ ok: true, closed });
      } else if (msg?.type === "freeUpRam") {
        const frozen = await freeUpRam();
        await updateBadge();
        sendResponse({ ok: true, frozen });
      } else {
        sendResponse({ ok: false, error: "unknown message" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e?.message || e) });
    }
  })();
  return true; // async response
});

// ---- event wiring ---------------------------------------------------------
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "complete") mergeOnLoad(tabId, changeInfo.url);
  else if (changeInfo.url) mergeOnLoad(tabId, changeInfo.url);
  else updateBadge();
});
chrome.tabs.onCreated.addListener(() => updateBadge());
chrome.tabs.onRemoved.addListener(() => updateBadge());
chrome.tabs.onAttached.addListener(() => updateBadge());
chrome.tabs.onDetached.addListener(() => updateBadge());
chrome.windows.onRemoved.addListener(() => updateBadge());

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(SWEEP_ALARM, { periodInMinutes: 5 });
  updateBadge();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(SWEEP_ALARM, { periodInMinutes: 5 });
  updateBadge();
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SWEEP_ALARM) closeDuplicates({ skipAudible: true });
});

// initial paint (service worker cold start)
updateBadge();
