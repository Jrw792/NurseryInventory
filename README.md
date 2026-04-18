# Nursery Ops

Offline order & inventory management system for a commercial plant nursery order filler. Runs as a PWA — install to iPhone home screen, then works fully offline.

## Installing on iPhone

1. Host the files on any static web host (GitHub Pages, Netlify, iCloud Drive + a tiny web host, or a local server on your home WiFi — any HTTPS origin will do).
2. Open the hosted URL in Safari on the iPhone.
3. Tap the share button, then "Add to Home Screen".
4. That's it — the app icon appears on the home screen and runs offline after first load.

The service worker caches all assets on first load, so after that it works with zero cell signal.

## Quick Start

1. **Map tab → CONFIG** to reshape the facility map. Tap cells to cycle: Zone → Aisle → Entrance → Zone. You need exactly one Entrance (the return/dispatch point). Aisles are walkable corridors (cost 1 to traverse); zones are product bays (passable but cost 3 — the route prefers aisles).
2. **Inventory tab → + PRODUCT** to add products. Assign each to a zone cell. Products without locations will be listed as "not on map" when routes are built.
3. **Orders tab** — paste rows in the format `order#, product, qty, pot size` (one per line). Missing products are created automatically with the pot size you provide. Or tap + ORDER for a manual entry form.
4. **Run tab → BUILD ROUTE** — the app plans a greedy nearest-neighbor route starting and ending at the Entrance, aggregating quantities of the same product across orders into a single pick.
5. Toggle **BY ROUTE / BY ORDER** on the run view. BY ROUTE is the picking workflow; BY ORDER is the staging/sorting workflow after picking is done.
6. Tap the checkbox on each pick as it's completed.
7. **COMPLETE** archives the run to History (with CSV export) and clears the current orders for the next day.

## Machine Rules (defaults)

- **Skid Steer** — 30 Gal, 45 Gal, or Root Ball (any quantity). Skid steer can only carry one at a time.
- **Ford Ranger + Wagons** — 15 Gal pots OR bulk quantities (20+) of anything up to 7 Gal.
- **Medium Chevrolet** — everything else (low/mid quantity, up to 7 Gal). Faster travel, no wagons.

Each stop on the route is tagged with the machine required by the heaviest pick at that stop (precedence: Skid > Ranger > Chevy). Rules are shown in the Settings tab.

## Data

Everything is in `localStorage` on the device. Settings → EXPORT dumps a JSON backup; IMPORT restores it. WIPE ALL clears everything.

## Files

- `index.html` — UI structure
- `styles.css` — industrial/utilitarian dark theme
- `app.js` — all logic (state, Dijkstra pathfinding, machine rules, bulk import, persistence)
- `sw.js` — service worker for offline caching
- `manifest.json` — PWA manifest for home-screen install
- `icon-192.png`, `icon-512.png` — app icons

## Changing the Machine Rules

The rule engine is in `app.js` in the `defaultRules()` function. Each rule has a `test` object with possible fields:

- `potSizesIn: [array]` — pot size must be in this list
- `potSizesNotIn: [array]` — pot size must NOT be in this list
- `qtyMin: n`, `qtyMax: n` — aggregated quantity thresholds
- `any: true` — match everything (for fallback rules)

Rules are evaluated top-to-bottom; the first match wins. Edit `defaultRules()` to change the mapping, then use Settings → RESET TO DEFAULTS to reload.
