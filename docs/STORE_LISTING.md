# Chrome Web Store listing — copy to paste into the Developer Dashboard

## Basics
- **Item name:** TabSonar
- **Category:** Productivity
- **Language:** English

## Short description (132 char max — currently 104)
Instant tab search, one-click duplicate cleanup, and real memory relief — for anyone drowning in tabs.

## Detailed description

Too many tabs? TabSonar finds any open tab in under a second, cleans up duplicates automatically, and frees up the memory Chrome is hoarding — all without sending a single byte anywhere.

**Find anything, instantly**
Press ⌘⇧K (Ctrl+Shift+K on Windows) and start typing. TabSonar fuzzy-searches every tab in every window by title, domain, and URL, with matches highlighted as you type. Arrow keys or number keys jump straight there.

**Never juggle duplicates again**
Open a link to a page you already have open, and TabSonar closes the newcomer and jumps you to the existing tab instead. A background sweep quietly cleans up older duplicates every few minutes, and a one-click button handles the rest — including duplicate tabs that are playing audio, without ever cutting off the sound you're listening to.

**See what's making noise, control it in place**
A chip shows exactly how many tabs are currently playing audio. One click filters to just those, and a speaker icon lets you mute or unmute any tab without leaving the search palette.

**Free up memory without losing your tabs**
One click puts inactive tabs to sleep — they stay right where they are and reload instantly when you click back into them. A small "i" button explains exactly what this does, so it's never a mystery.

**A calm way to clean house**
"Review old tabs" turns your stale, forgotten tabs into a simple one-at-a-time keep/close flow. Tell it to always keep a site and it stops asking.

**Undo anything**
Closed a tab by mistake — on purpose, via dedupe, or during review? An undo toast has you covered for a few seconds after every close.

**Built for real tab hoarders**
Bilingual (English/German) interface, full keyboard control, voice search, and a live-updating view that reflects new tabs and windows the moment they open — no need to reopen the popup.

**Your data never leaves your browser**
TabSonar has no server, no analytics SDK, and no telemetry. Tab data is read locally to power search and never transmitted anywhere. Full privacy policy: https://dmohtachem.github.io/tabsonar/privacy.html

Feedback and bug reports are very welcome — there's a link right in the popup.

## Single purpose statement
TabSonar helps users find, organize, and manage their open browser tabs — searching, de-duplicating, and freeing memory from tabs, all within the browser itself.

## Permission justifications (paste into the dashboard's per-permission fields)
- **tabs** — Required to read tab titles/URLs/favicons for search, to detect duplicates, and to focus, close, mute, and discard (sleep) tabs on the user's command.
- **storage** — Stores the user's language preference and their "always keep this site" list locally, so preferences persist between sessions.
- **system.memory** — Reads system-wide available memory to display a "free RAM" figure in the header; no per-process or per-tab memory is read.
- **alarms** — Schedules a periodic (5-minute) background check that silently merges duplicate tabs the user already has open.
- **sessions** — Powers the "Undo" toast after closing a tab, and shows a "recently closed" fallback when a search has no open match.
- **tabGroups** — Reads the count of tab groups to display an accurate group count in the header; does not read group contents.

## Privacy practices tab (data usage declarations)
- Does this item collect or transmit any of the following? → **No** to every category (personally identifiable info, health info, financial info, authentication info, personal communications, location, web history, user activity, website content).
  - Note: TabSonar *reads* tab URLs/titles locally to power its own UI, but never transmits or stores them outside the user's own browser (`chrome.storage` stays local/synced only within the user's own Chrome profile, the same as bookmarks).
- **Privacy policy URL:** https://dmohtachem.github.io/tabsonar/privacy.html
- Certify: "I do not sell or transfer user data to third parties" → **Yes**
- Certify: "I do not use or transfer user data for purposes unrelated to the item's single purpose" → **Yes**
- Certify: "I do not use or transfer user data to determine creditworthiness or for lending purposes" → **Yes**

## Screenshots (1280×800, generated from `demo/index.html`)
1. Idle state — full tab list with header stats and footer actions
2. Search + fuzzy-match highlight ("tron")
3. Review-mode card (keep/close)

## Store icon
`icons/icon128.png` (already 128×128)
