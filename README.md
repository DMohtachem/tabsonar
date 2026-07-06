# TabSonar

Find any open tab instantly, auto-merge duplicates, and free up Chrome RAM — in one lightweight extension. No build step, no cloud, no telemetry.

Built to solve one real problem: dozens of tabs across several windows eating gigabytes of RAM, with no fast way to jump to the one you need.

## Features

- **⌘⇧K palette** — a Spotlight-style search over every tab in every window, live-updating as tabs/windows open and close. Fuzzy match on title + domain + URL, with the matched letters highlighted. Arrow keys + Enter jump straight to the tab; `⌥1`–`8` jump directly; `⌘⌫` closes the selected tab.
- **Per-row actions** — every result shows how long ago it was used (`now / 15 min / 4 d`), a jump arrow, and a close ×. Long-unused tabs are flagged `old` in amber.
- **Live monitor** — the toolbar badge always shows your total tab count (orange past 50). The header shows `tabs · windows · groups · free RAM`, with a `This window / All` scope toggle.
- **Auto-dedupe** — open a URL that's already open and the newcomer is closed while you land on the existing tab (*merge & jump*). A 5-minute background sweep clears older duplicates. A lifetime counter shows the total saved.
- **Audio control** — a `N playing` chip surfaces every tab making sound; one click filters to them, and a speaker icon mutes/unmutes any tab in place. No more hunting for the noise.
- **Review old tabs** — a focused, one-card-at-a-time cleanup mode (`← keep · → close`). "Always keep this site" and adaptive learning stop it nagging about tabs you always keep.
- **Free up memory** — one click puts inactive tabs to sleep (`chrome.tabs.discard`); they stay visible but release memory and reload on click. An "i" button next to it explains what that means in plain language.
- **Undo everything** — closing a tab (single, dedupe, or review) shows an Undo toast that restores it via `chrome.sessions`. Search with no open match falls back to *recently closed*.
- **English / German toggle** — every string in the popup switches with one click, persisted across sessions.
- **Voice search** — mic uses the browser's built-in speech recognition (English or German, matching the current language). [Wispr Flow](https://wisprflow.ai) also works in the field as a system-wide alternative.
- **Motion** — tasteful, GPU-cheap animations (palette entrance, staggered rows, sliding selection, card transitions, toasts); fully disabled under `prefers-reduced-motion`.
- **Feedback** — a small link in the corner opens an email, no account or form needed.

## Development / visual QA

`demo/` (gitignored) contains a harness that mocks the `chrome.*` APIs with ~40 sample tabs so the real `popup/` renders in a normal browser tab. Serve the folder (`python3 -m http.server 8777`) and open `/demo/index.html` to eyeball every state without loading the extension.

## Safety — never touched by auto-close or discard

- `localhost`, `127.0.0.1`, and `automation.nexperts.cloud` (n8n editor) — same URL can hold different unsaved work
- pinned tabs, tabs playing audio, and `chrome://` / extension / `about:` pages
- your 3 most recently used tabs (for discard)

## Install (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select this folder (`~/ventures/apps/tabsonar`)
4. Optional: set the shortcut at `chrome://extensions/shortcuts` (default ⌘⇧K / Ctrl+Shift+K)

## Architecture

Manifest V3, vanilla ES modules, zero dependencies except a vendored copy of
[uFuzzy](https://github.com/leeoniya/uFuzzy) (MIT, ~26 KB) for fuzzy matching.

| File | Role |
|------|------|
| `manifest.json` | MV3 config, `⌘⇧K` command, permissions: `tabs`, `storage`, `system.memory`, `alarms` |
| `background.js` | Service worker: badge counter, merge-&-jump, 5-min dedupe sweep, discard |
| `popup/` | The palette (html/css/js) |
| `lib/url-normalize.js` | URL equality (strips tracking params, keeps hash) |
| `lib/tab-actions.js` | Safety rules, duplicate grouping, discard selection |
| `lib/ufuzzy.js` | vendored fuzzy matcher |
| `mic-setup.*` | one-time microphone permission grant (MV3 needs this outside the popup) |

## Privacy

TabSonar has no server, no analytics, no telemetry. Everything runs locally in your browser. Full policy: [docs/privacy.html](docs/privacy.html).

## License

[MIT](LICENSE)

## Roadmap

- Real per-tab RAM in MB via a tiny native-messaging host
- Optional semantic search (embeddings) if fuzzy proves too literal in daily use
- Stale-tab archive: bookmark + close tabs untouched for >7 days
