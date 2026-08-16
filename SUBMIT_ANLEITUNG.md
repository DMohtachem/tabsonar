# TabSonar — Chrome Web Store Einreichung (< 10 Min)

Alles ist vorbereitet. Nur die folgenden Schritte sind noch nötig — beide können nur du selbst machen (Dev-Account-Zahlung + Upload).

## 1. Dev-Account anlegen (einmalig, ~5$)
1. Öffne https://chrome.google.com/webstore/devconsole
2. Mit deinem Google-Account einloggen
3. Einmalige Registrierungsgebühr **5 $** zahlen (Kreditkarte)

## 2. Neues Item anlegen + Paket hochladen
1. **"Neues Element hinzufügen"** klicken
2. Datei hochladen: `~/ventures/apps/tabsonar/tabsonar-submission.zip`
   (140 KB, enthält nur den lauffähigen Extension-Code — manifest.json, background.js, popup/, lib/, icons/, fonts/, LICENSE)

## 3. Store-Listing ausfüllen
Alle Texte stehen fertig formuliert in [`docs/STORE_LISTING.md`](docs/STORE_LISTING.md) — einfach copy-paste, Feld für Feld:

| Dashboard-Feld | Quelle im Dokument |
|---|---|
| Artikelname, Kategorie, Sprache | Abschnitt „Basics" |
| Kurzbeschreibung (132 Zeichen) | Abschnitt „Short description" |
| Ausführliche Beschreibung | Abschnitt „Detailed description" |
| Single Purpose Statement | Abschnitt „Single purpose statement" |
| Berechtigungs-Begründungen (pro Permission ein Feld) | Abschnitt „Permission justifications" |
| Privacy-practices-Tab (alle Kategorien → Nein) | Abschnitt „Privacy practices tab" |
| Privacy Policy URL | `https://dmohtachem.github.io/tabsonar/privacy.html` (bereits live) |

## 4. Screenshots hochladen (1280×800, fertig erzeugt)
Aus `~/ventures/apps/tabsonar/store-assets/`, in dieser Reihenfolge:
1. `screenshot-1-idle-state.png` — Grundzustand mit Header-Stats (43 Tabs · 3 Fenster · 2 Gruppen · freier RAM)
2. `screenshot-2-search-fuzzy-match.png` — Suche nach „tron" mit Fuzzy-Match-Highlight
3. `screenshot-3-review-mode.png` — Review-Mode-Karte (Keep/Close)

## 5. Store-Icon
`~/ventures/apps/tabsonar/icons/icon128.png` (128×128, bereits im Format).

## 6. Absenden
**"Zur Prüfung einreichen"** klicken. Google-Review dauert meist 1–3 Tage (Erst-Einreichung teils länger).

---

**Falls etwas fehlt:** Alle Quelldateien liegen in `~/ventures/apps/tabsonar/`. Das Submission-Zip ist reproduzierbar über:
```bash
cd ~/ventures/apps/tabsonar
zip -r tabsonar-submission.zip manifest.json background.js mic-setup.html mic-setup.js popup lib icons fonts LICENSE -x "*.DS_Store"
```
