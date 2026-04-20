# Nursery Ops

Offline order & inventory management system for a commercial plant nursery order filler. Runs as a PWA — install to iPhone home screen, then works fully offline.

## Installing on iPhone

1. Host the files on any static web host (GitHub Pages, Netlify, iCloud Drive + a tiny web host, or a local server on your home WiFi — any HTTPS origin will do).
2. Open the hosted URL in Safari on the iPhone.
3. Tap the share button, then "Add to Home Screen".
4. That's it — the app icon appears on the home screen and runs offline after first load.

The service worker caches all assets on first load, so after that it works with zero cell signal.

## Quick Start

The app launches pre-loaded with the **Buck Jones Nursery** facility map (45×55 grid, ~50 labeled zones) and inventory (97 products mapped to their zones). Products that were listed in multiple zones on the inventory sheet (e.g. "Azalea (shade) A5, A6, B6") are stored as multi-location products — the router picks whichever copy is closest to the current route position.

### If you already have a Nursery Ops install from v1 or v2

The Buck Jones preset does NOT automatically replace your existing layout on an upgrade. To load it into an existing install, go to **Settings → PRESETS → LOAD BUCK JONES PRESET**. This replaces the map + inventory but keeps your orders and run history.

### If you want to build a different nursery from scratch

Go to **Settings → DATA → WIPE ALL** to reset, then use **Map → CONFIG** to paint your own layout. Paint palette has five tools:

- **AISLE** — walkable paths (cost 1 to traverse, preferred by router)
- **ZONE** — product bays (cost 3 to traverse — passable but the router avoids them when possible)
- **ENTRANCE** — where the route starts and ends; there's always exactly one
- **ERASE** — reverts a cell back to blocked (unwalkable). Also unassigns any product there
- **LABEL** — tap a zone to give it a custom name like "Greenhouse 3" or "Field A-North"
- **CLEAR ALL** wipes every cell back to blocked (except the entrance)

**Settings → MAP GRID SIZE** resizes the grid. Shrinking removes out-of-bounds cells; products on those cells lose that location but stay in Inventory.

### Daily workflow

1. **Orders tab** — paste rows in the format `order#, product, qty, pot size` (one per line). Missing products are created automatically. Or tap + ORDER for a manual entry form.
2. **Run tab → BUILD ROUTE** — the app plans a greedy nearest-neighbor route starting and ending at the Entrance, aggregating quantities of the same product across orders into a single pick. For multi-location products, each stop uses whichever location is closest.
3. Toggle **BY ROUTE / BY ORDER** on the run view. BY ROUTE is the picking workflow; BY ORDER is the staging/sorting workflow after picking is done.
4. Tap the checkbox on each pick as it's completed.
5. **COMPLETE** archives the run to History (with CSV export) and clears the current orders for the next day.

### Tips for laying out a custom facility

- Start with ENTRANCE tool and place the loading dock where it actually is.
- Switch to AISLE tool and sketch the main roads/corridors the worker and vehicles use. Drag your finger to paint in strokes.
- Switch to ZONE tool and fill in the bench rows, field sections, or greenhouses.
- Use LABEL to name the important areas so they show up by name in the pick run (instead of `R12-C05`).
- The router *can* cut through zones when that's the only path, but it strongly prefers aisles. If a product location seems unreachable or the route looks weird, check that there's an aisle network connecting the zone to the entrance.

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
