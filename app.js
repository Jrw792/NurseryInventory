/* ==========================================================
   NURSERY OPS
   Offline PWA — order routing, inventory, pick runs
   ========================================================== */

/* ---------------- STORAGE ---------------- */
const LS_KEY = 'nursery_ops_v1';

function emptyState() {
  return {
    products: [],      // {id, name, potSize, cellIds: [string]}  -- cellIds is array (multi-location supported)
    orders: [],        // {id, number, items: [{productId, qty}], createdAt}
    run: null,
    map: defaultMap(),
    machineRules: defaultRules(),
    potSizes: ['4"', '1 Gal', '3 Gal', '5 Gal', '7 Gal', '10 Gal', '15 Gal', '30 Gal', '45 Gal', 'Root Ball', 'Unknown'],
    history: [],
    seenOnboard: false,
  };
}

function defaultMap() {
  // Buck Jones Nursery layout — 45 cols x 55 rows.
  // Pre-painted with the real facility zones. Users can modify via Map → CONFIG.
  const cols = 45, rows = 55;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({
        id: `${r}_${c}`,
        r, c,
        type: 'blocked',
        label: '',
        customLabel: false,
      });
    }
  }

  // Helper: paint a rectangle (inclusive)
  const cellAt = (r, c) => cells[r * cols + c];
  const paintRect = (r1, c1, r2, c2, type, label, customLabel) => {
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
        const cell = cellAt(r, c);
        cell.type = type;
        if (label !== undefined) cell.label = label;
        if (customLabel !== undefined) cell.customLabel = customLabel;
      }
    }
  };

  // ==== Paint aisles first (horizontal rows and vertical columns) ====
  const aisleRows = [0, 12, 18, 19, 24, 29, 34, 42, 49, 50, 54];
  const aisleCols = [0, 1, 10, 11, 20, 21, 30, 31, 38, 39, 44];
  aisleRows.forEach(r => paintRect(r, 0, r, cols - 1, 'aisle', '', false));
  aisleCols.forEach(c => paintRect(0, c, rows - 1, c, 'aisle', '', false));

  // ==== Paint zones (overwriting aisles where they overlap) ====

  // E Section (top-left) — B&B Evergreens/Dogwoods/Maples
  paintRect(1, 2, 2, 7,   'zone', 'E5', true);
  paintRect(3, 2, 4, 7,   'zone', 'E4', true);
  paintRect(5, 2, 6, 7,   'zone', 'E3', true);
  paintRect(7, 2, 8, 7,   'zone', 'E2', true);
  paintRect(9, 2, 10, 7,  'zone', 'E1', true);

  // Shop / Fertilizer (top-middle)
  paintRect(1, 13, 7, 18, 'zone', 'Shop', true);

  // The Hill (top-right area) - Shade Trees B&B
  paintRect(1, 22, 7, 27, 'zone', 'HILL', true);

  // Upper working area
  paintRect(13, 4, 17, 8,   'zone', 'JAP PAD', true);
  paintRect(13, 11, 15, 17, 'zone', 'Large Container Trees', true);
  paintRect(13, 18, 15, 22, 'zone', 'Crape Myrtles', true);

  // Sod
  paintRect(17, 22, 19, 29, 'zone', 'Sod Pad', true);
  paintRect(20, 22, 20, 29, 'zone', 'Sod Pieces', true);

  // A section (upper block) — Native Azaleas/Hydrangeas, Azaleas/Cephalotaxus, Japanese Maples
  paintRect(20, 2, 23, 9, 'zone', 'A9', true);
  paintRect(25, 2, 27, 3, 'zone', 'A8', true);
  paintRect(25, 4, 27, 4, 'zone', 'A7', true);
  paintRect(25, 5, 27, 5, 'zone', 'A6', true);
  paintRect(25, 6, 27, 7, 'zone', 'A5', true);

  // A section (lower block) — Shade Shrubs, Camellias, Hostas
  paintRect(30, 2, 33, 2, 'zone', 'A4', true);
  paintRect(30, 4, 33, 4, 'zone', 'A3', true);
  paintRect(30, 5, 33, 6, 'zone', 'A2', true);
  paintRect(30, 7, 33, 8, 'zone', 'A1', true);
  // B section — vertical rows, B9 at top through B1 at bottom
  const bZones = ['B9', 'B8', 'B7', 'B6', 'B5', 'B4', 'B3', 'B2', 'B1'];
  bZones.forEach((name, i) => {
    const r = 20 + i; // rows 20-28 for B9-B1
    paintRect(r, 12, r, 19, 'zone', name, true);
  });

  // C section — C7-C1 top to bottom
  const cZones = ['C7', 'C6', 'C5', 'C4', 'C3', 'C2', 'C1'];
  cZones.forEach((name, i) => {
    const r = 21 + i; // rows 21-27 for C7-C1
    paintRect(r, 22, r, 29, 'zone', name, true);
  });

  // D section
  paintRect(20, 32, 27, 34, 'zone', 'D3', true);
  paintRect(20, 35, 27, 37, 'zone', 'D2', true);
  paintRect(28, 32, 29, 34, 'zone', 'D3 Misc', true);
  paintRect(28, 35, 29, 37, 'zone', 'D2 Drip', true);
  paintRect(35, 32, 42, 37, 'zone', 'D1', true);

  // Shade Trees & OLD DRIP (right side)
  paintRect(20, 40, 33, 43, 'zone', 'Shade Trees', true);
  paintRect(35, 40, 42, 43, 'zone', 'OLD DRIP', true);

  // NEW DRIP (main body)
  paintRect(35, 23, 42, 29, 'zone', 'NEW DRIP', true);

  // Bottom row structures
  paintRect(43, 12, 46, 17, 'zone', 'Office', true);
  paintRect(43, 19, 46, 26, 'zone', 'Specialty Items', true);
  paintRect(43, 2, 44, 7, 'zone', 'Bagged Material', true);
  paintRect(46, 2, 48, 8, 'zone', 'Specimen Items', true);

  // Stone/Mulch Yard
  paintRect(51, 12, 53, 32, 'zone', 'Stone/Mulch Yard', true);

  // Re-paint aisle rows on top of any accidentally-zoned cells in aisle-only rows
  // (The bZones above intentionally sit on row 24 which was an aisle; we KEEP those as zones.)
  // But also need to make sure aisles still connect. The C-zone at row 24 is C4, fine.

  // Entrance at Office area — matches "YOU ARE HERE" on real map
  const entCell = cellAt(47, 14);
  entCell.type = 'entrance';
  entCell.label = 'IN/OUT';
  entCell.customLabel = false;

  return { cols, rows, cells };
}

function defaultProducts(map) {
  // Pre-loaded inventory from Buck Jones Nursery's product sheet.
  // Zone labels must match those painted in defaultMap().
  // Format: [name, potSize, [zoneLabel1, zoneLabel2, ...]]
  const items = [
    ['Abelia', 'Unknown', ['C3', 'C4', 'C5']],
    ['Anise', '3 Gal', ['A4']],
    ['Anise', '7 Gal', ['D1']],
    ['Anise Yellow', '3 Gal', ['C5']],
    ['Annuals', 'Unknown', ['A1']],  // "BY A1" in source
    ['Arborvitae', '15 Gal', ['D3']],
    ['Arborvitae', '30 Gal', ['NEW DRIP']],
    ['Arborvitae', '7 Gal', ['D2', 'D3']],
    ['Arborvitae B&B', 'Root Ball', ['E1', 'E2', 'E3']],
    ['Aucuba', 'Unknown', ['A4']],
    ['Azalea (Encore/sun)', 'Unknown', ['B2', 'B3']],
    ['Azalea (shade)', 'Unknown', ['A5', 'A6', 'B6']],
    ['Azaleas Native', 'Unknown', ['A9']],
    ['Blueberry', 'Unknown', ['B7']],
    ['Bottlebrush Buckeyes', 'Unknown', ['B7', 'D2']],
    ['Boxwoods', '3 Gal', ['C4', 'C5', 'C6']],
    ['Boxwoods', '7 Gal', ['C7', 'D1', 'D3']],
    ['Butterfly Bush', 'Unknown', ['B8', 'B9']],
    ['Camellias', '15 Gal', ['D1']],
    ['Camellias', '3 Gal', ['A1']],
    ['Camellias', '7 Gal', ['A3']],
    ['Carex', 'Unknown', ['C2']],
    ['Cherry Flowering', '15 Gal', ['OLD DRIP']],
    ['Cleyera', 'Unknown', ['C5']],
    ['Conifers', '3 Gal', ['B9']],
    ['Crape Myrtles', 'Unknown', ['NEW DRIP']],
    ['Cryptomeria', '3 Gal', ['B9']],
    ['Cryptomeria', '7 Gal', ['D2']],
    ['Cypress Gold Mop', 'Unknown', ['B9']],
    ['Cypress Leyland', '15 Gal', ['D3']],
    ['Cypress Leyland', '7 Gal', ['D2']],
    ['Daylilies', 'Unknown', ['C7']],
    ['Distylium', 'Unknown', ['C3']],
    ['Dogwood', '15 Gal', ['OLD DRIP']],
    ['Evergreens', '15 Gal', ['D3', 'OLD DRIP']],
    ['Evergreen Plants', '5 Gal', ['D1', 'D2']],
    ['Evergreen Plants', '7 Gal', ['D1', 'D2']],
    ['Evergreen Trees B&B', 'Root Ball', ['E1', 'E2', 'E3']],
    ['Fatsia', 'Unknown', ['A4']],
    ['Fern', '1 Gal', ['C1']],
    ['Fern', '3 Gal', ['A4']],
    ['Fruit Shrubs', 'Unknown', ['B7']],
    ['Gardenias', 'Unknown', ['C6', 'B4', 'B9']],
    ['Grass Ornamental', 'Unknown', ['C2', 'B9']],
    ['Groundcovers', 'Unknown', ['B1', 'C1', 'C2']],
    ['Holly', '15 Gal', ['OLD DRIP']],
    ['Holly', '3 Gal', ['B5']],
    ['Holly', '7 Gal', ['D1', 'D2']],
    ['Hostas', 'Unknown', ['A2']],
    ['Hydrangea (shade)', 'Unknown', ['A9']],
    ['Hydrangea (sun)', 'Unknown', ['B9']],
    ['Itea', 'Unknown', ['B8']],
    ['Japanese Maples', 'Unknown', ['JAP PAD']],
    ['Juniper', '1 Gal', ['B7']],
    ['Laurel Cherry', 'Unknown', ['D2', 'OLD DRIP']],
    ['Leucothoe', 'Unknown', ['A2']],
    ['Ligustrum Sunshine', 'Unknown', ['B4']],
    ['Ligustrum Waxleaf', 'Unknown', ['C6']],
    ['Liriope', 'Unknown', ['B1']],
    ['Loropetalum', '7 Gal', ['D1']],
    ['Loropetalum Crimson Fire', 'Unknown', ['C3']],
    ['Loropetalum Purple Daydream', 'Unknown', ['B4']],
    ['Loropetalum Purple Diamond', 'Unknown', ['B4']],
    ['Loropetalum Purple Pixie', 'Unknown', ['B4']],
    ['Loropetalum Ruby', 'Unknown', ['C5']],
    ['Magnolia', '15 Gal', ['OLD DRIP']],
    ['Magnolia', '30 Gal', ['NEW DRIP']],
    ['Maple', '15 Gal', ['OLD DRIP']],
    ['Mondo Grass', 'Unknown', ['C1']],
    ['Mountain Laurel', 'Unknown', ['A2']],
    ['Nandina', 'Unknown', ['B6']],
    ['Oak', '15 Gal', ['OLD DRIP']],
    ['Osmanthus', '15 Gal', ['OLD DRIP']],
    ['Osmanthus (Tea Olive)', '3 Gal', ['A4']],
    ['Osmanthus (Tea Olive)', '7 Gal', ['D1']],
    ['Palms', 'Unknown', ['D1', 'NEW DRIP']],
    ['Peony', 'Unknown', ['A2']],
    ['Perennials (shade)', 'Unknown', ['C1']],
    ['Perennials (sun)', 'Unknown', ['B1']],
    ['Pieris', 'Unknown', ['A2']],
    ['Pittosporum', 'Unknown', ['A4', 'B4']],
    ['Podocarpus', 'Unknown', ['A4', 'A5', 'B4']],
    ['Proven Winners', 'Unknown', ['B9']],
    ['Redbud', 'Unknown', ['OLD DRIP']],
    ['Rhododendron', 'Unknown', ['C2']],
    ['Rosemary', '3 Gal', ['C4']],
    ['Roses', 'Unknown', ['B8']],
    ['Sarcococca', 'Unknown', ['A4']],
    ['Seasonal Items', 'Unknown', ['Specialty Items']],  // "Education" in source
    ['Shade Trees', '15 Gal', ['OLD DRIP']],
    ['Shade Trees B&B', 'Root Ball', ['HILL']],
    ['Southern Living', 'Unknown', ['B4', 'B6']],
    ['Spirea', 'Unknown', ['B8']],
    ['Viburnum (deciduous)', 'Unknown', ['B7']],
    ['Viburnum (evergreen)', 'Unknown', ['C4', 'C5']],
    ['Vines', 'Unknown', ['C4']],
    ['Yew', 'Unknown', ['A5']],
  ];

  // Build labelToCellId map from the provided map
  const labelToCellIds = {};
  for (const cell of map.cells) {
    if (cell.type === 'zone' && cell.customLabel && cell.label) {
      if (!labelToCellIds[cell.label]) labelToCellIds[cell.label] = [];
      labelToCellIds[cell.label].push(cell.id);
    }
  }
  // For each zone label, pick the top-left-most cell as the "primary" location.
  // (Products assigned to a zone go to one representative cell; user can reassign later.)
  const primaryCellFor = (label) => {
    const ids = labelToCellIds[label];
    if (!ids || ids.length === 0) return null;
    // Pick cell with smallest r, then smallest c
    const sorted = [...ids].sort((a, b) => {
      const [ar, ac] = a.split('_').map(Number);
      const [br, bc] = b.split('_').map(Number);
      if (ar !== br) return ar - br;
      return ac - bc;
    });
    return sorted[0];
  };

  const products = [];
  for (const [name, potSize, zoneLabels] of items) {
    const cellIds = [];
    for (const label of zoneLabels) {
      const cellId = primaryCellFor(label);
      if (cellId) cellIds.push(cellId);
    }
    products.push({
      id: uid('p'),
      name,
      potSize,
      cellIds,
    });
  }
  return products;
}

function defaultRules() {
  // Machines: "Small Ford Ranger w/ wagons" (SMALL), "Medium Chevy" (MEDIUM), "Skid Steer" (SKID)
  return [
    { id: 'r1', label: '30 Gal, 45 Gal, or Root Ball (any qty)', test: { potSizesIn: ['30 Gal', '45 Gal', 'Root Ball'] }, machine: 'SKID', machineLabel: 'Skid Steer' },
    { id: 'r2', label: 'High quantity (20+) of any size up to 15 Gal', test: { qtyMin: 20, potSizesNotIn: ['30 Gal', '45 Gal', 'Root Ball'] }, machine: 'SMALL', machineLabel: 'Ford Ranger + Wagons' },
    { id: 'r3', label: '15 Gal (any qty below 20)', test: { potSizesIn: ['15 Gal'] }, machine: 'SMALL', machineLabel: 'Ford Ranger + Wagons' },
    { id: 'r4', label: 'Everything else (low/mid qty, up to 7 Gal)', test: { any: true }, machine: 'MEDIUM', machineLabel: 'Medium Chevrolet' },
  ];
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    // Forward-compat: merge missing keys
    const base = emptyState();
    const merged = { ...base, ...parsed };
    // Migrate: old products had `cellId: string` — convert to `cellIds: [string]`
    if (Array.isArray(merged.products)) {
      merged.products.forEach(p => {
        if (p.cellIds === undefined) {
          p.cellIds = p.cellId ? [p.cellId] : [];
          delete p.cellId;
        }
      });
    }
    return merged;
  } catch (e) {
    console.error('loadState failed', e);
    return emptyState();
  }
}

function saveState() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('saveState failed', e);
    toast('Storage full', true);
  }
}

/* ---------------- STATE ---------------- */
let state = loadState();
let ui = {
  currentView: 'run',
  selectedCellId: null,
  mapMode: 'view', // 'view' or 'config'
  paintTool: 'aisle', // when in config mode: 'aisle', 'zone', 'entrance', 'blocked', 'label'
  isPainting: false,  // true while a drag-paint is in progress
  paintedInDrag: new Set(), // cells already painted this drag (prevents re-painting the same cell)
  invSearch: '',
  runMode: 'route', // 'route' or 'order'
};

/* ---------------- UTIL ---------------- */
function uid(prefix = 'x') {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return Array.from(document.querySelectorAll(sel)); }

function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  el.style.borderColor = isError ? 'var(--danger)' : 'var(--accent)';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 2000);
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function findCellById(id) {
  return state.map.cells.find(c => c.id === id);
}
function findProductById(id) {
  return state.products.find(p => p.id === id);
}
function findOrderById(id) {
  return state.orders.find(o => o.id === id);
}
function getEntrance() {
  return state.map.cells.find(c => c.type === 'entrance');
}

/* ---------------- ROUTING ---------------- */
// Dijkstra shortest path between cells.
// All cells are walkable (a worker CAN physically walk through any zone), but aisles
// are "cheaper" to traverse so the route naturally prefers aisle corridors and only
// cuts through zones when that's genuinely shorter (or the only way).
function bfsDistance(fromCellId, toCellId) {
  if (fromCellId === toCellId) return { dist: 0, path: [fromCellId] };
  const from = findCellById(fromCellId);
  const to = findCellById(toCellId);
  if (!from || !to) return { dist: Infinity, path: [] };

  const { cols, rows, cells } = state.map;
  const cellMap = new Map(cells.map(c => [c.id, c]));
  // Cost to step INTO a cell. Aisles and entrance are the "roads"; zones are passable but penalized.
  // Blocked cells are impassable.
  const costOf = (c) => {
    if (!c) return Infinity;
    if (c.type === 'blocked') return Infinity;
    if (c.type === 'aisle' || c.type === 'entrance') return 1;
    return 3; // zone — walkable but discouraged
  };

  // Simple array-based priority queue (small graphs, fine for a nursery)
  const dist = new Map();
  const prev = new Map();
  dist.set(from.id, 0);
  const pq = [{ id: from.id, r: from.r, c: from.c, d: 0 }];
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];

  while (pq.length) {
    // Extract min
    let mi = 0;
    for (let i = 1; i < pq.length; i++) if (pq[i].d < pq[mi].d) mi = i;
    const cur = pq.splice(mi, 1)[0];
    if (cur.id === to.id) break;
    if (cur.d > (dist.get(cur.id) ?? Infinity)) continue;

    for (const [dr, dc] of dirs) {
      const nr = cur.r + dr, nc = cur.c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const nid = `${nr}_${nc}`;
      const nCell = cellMap.get(nid);
      if (!nCell) continue;
      const step = costOf(nCell);
      if (step === Infinity) continue;
      const nd = cur.d + step;
      if (nd < (dist.get(nid) ?? Infinity)) {
        dist.set(nid, nd);
        prev.set(nid, cur.id);
        pq.push({ id: nid, r: nr, c: nc, d: nd });
      }
    }
  }

  if (!dist.has(to.id)) return { dist: Infinity, path: [] };
  // Reconstruct path
  const path = [to.id];
  let p = prev.get(to.id);
  while (p) { path.unshift(p); p = prev.get(p); }
  return { dist: dist.get(to.id), path };
}

/* ---------------- MACHINE SELECTION ---------------- */
function pickMachineForPick(pick) {
  const product = findProductById(pick.productId);
  if (!product) return { machine: 'MEDIUM', machineLabel: 'Medium Chevrolet' };
  for (const rule of state.machineRules) {
    if (ruleMatches(rule, product, pick.qty)) {
      return { machine: rule.machine, machineLabel: rule.machineLabel };
    }
  }
  return { machine: 'MEDIUM', machineLabel: 'Medium Chevrolet' };
}

function ruleMatches(rule, product, qty) {
  const t = rule.test || {};
  if (t.any) return true;
  if (t.potSizesIn && !t.potSizesIn.includes(product.potSize)) return false;
  if (t.potSizesNotIn && t.potSizesNotIn.includes(product.potSize)) return false;
  if (t.qtyMin != null && qty < t.qtyMin) return false;
  if (t.qtyMax != null && qty > t.qtyMax) return false;
  return true;
}

// Stop-level machine = the heaviest requirement of any pick at that stop.
// Precedence: SKID > SMALL > MEDIUM
function stopMachine(stop) {
  const rank = { SKID: 3, SMALL: 2, MEDIUM: 1 };
  let best = { machine: 'MEDIUM', machineLabel: 'Medium Chevrolet' };
  for (const pick of stop.picks) {
    const m = pickMachineForPick(pick);
    if (rank[m.machine] > rank[best.machine]) best = m;
  }
  return best;
}

/* ---------------- BUILD RUN ---------------- */
function buildRun() {
  const entrance = getEntrance();
  if (!entrance) {
    toast('Set an entrance on the map first', true);
    return null;
  }
  if (state.orders.length === 0) {
    toast('Add orders first', true);
    return null;
  }

  // Aggregate all items across orders by productId, keeping order numbers
  const byProduct = new Map();
  for (const order of state.orders) {
    for (const item of order.items) {
      if (!byProduct.has(item.productId)) {
        byProduct.set(item.productId, { productId: item.productId, qty: 0, orderNums: [] });
      }
      const agg = byProduct.get(item.productId);
      agg.qty += item.qty;
      const count = order.items.filter(i => i.productId === item.productId).reduce((a, b) => a + b.qty, 0);
      // track per-order breakdown for staging
      const existing = agg.orderNums.find(o => o.number === order.number);
      if (existing) existing.qty += item.qty;
      else agg.orderNums.push({ number: order.number, qty: item.qty });
    }
  }

  // Multi-location routing:
  // For each product-with-multiple-locations, we'll choose its "stop" location lazily during
  // the tour, picking whichever of its locations is closest to our current position at that
  // step. This gives much better routes than arbitrarily picking one location up front.
  //
  // Pre-index: picksByProduct maps productId -> aggregated pick (qty + orderNums).
  // unplaced tracks products with zero locations.
  const unplaced = [];
  const pickByProduct = new Map(); // productId -> pick
  for (const [pid, pick] of byProduct.entries()) {
    const product = findProductById(pid);
    const cellIds = (product && Array.isArray(product.cellIds) ? product.cellIds : []).filter(Boolean);
    if (!product || cellIds.length === 0) {
      unplaced.push(pick);
      continue;
    }
    pick.candidateCellIds = cellIds;
    pickByProduct.set(pid, pick);
  }

  if (pickByProduct.size === 0 && unplaced.length > 0) {
    toast('No products are placed on the map', true);
    return null;
  }

  // Greedy nearest-neighbor tour from entrance, back to entrance.
  // Stops are built as we go: each iteration picks the closest (product, location) pair,
  // and then groups any other products at that same chosen cell into the same stop.
  const ordered = [];
  let current = entrance.id;
  const remainingProducts = new Set(pickByProduct.keys());
  // Cache BFS distances (from -> to) so we don't recompute across iterations
  const distCache = new Map();
  const dist = (from, to) => {
    const key = from + '|' + to;
    if (distCache.has(key)) return distCache.get(key);
    const d = bfsDistance(from, to).dist;
    distCache.set(key, d);
    return d;
  };

  while (remainingProducts.size > 0) {
    // Find the (product, cellId) pair minimizing distance from current
    let bestPid = null, bestCell = null, bestDist = Infinity;
    for (const pid of remainingProducts) {
      const pick = pickByProduct.get(pid);
      for (const cid of pick.candidateCellIds) {
        const d = dist(current, cid);
        if (d < bestDist) { bestDist = d; bestPid = pid; bestCell = cid; }
      }
    }
    if (bestPid === null) {
      // Unreachable remaining — just place them somewhere
      for (const pid of remainingProducts) {
        const pick = pickByProduct.get(pid);
        const cid = pick.candidateCellIds[0];
        ordered.push({ cellId: cid, picks: [pick] });
      }
      break;
    }

    // Collect ALL products whose best location is this same cell, at roughly the same distance
    const stopPicks = [pickByProduct.get(bestPid)];
    remainingProducts.delete(bestPid);
    for (const pid of Array.from(remainingProducts)) {
      const pick = pickByProduct.get(pid);
      if (pick.candidateCellIds.includes(bestCell)) {
        // If this cell is among its options and is also its current-best (or very close),
        // prefer grouping it here.
        const myBest = Math.min(...pick.candidateCellIds.map(cid => dist(current, cid)));
        const thisDist = dist(current, bestCell);
        if (thisDist <= myBest) {
          stopPicks.push(pick);
          remainingProducts.delete(pid);
        }
      }
    }

    ordered.push({ cellId: bestCell, picks: stopPicks });
    current = bestCell;
  }
  // Clean up: remove the candidateCellIds helper field from picks (they're no longer needed)
  ordered.forEach(stop => stop.picks.forEach(p => { delete p.candidateCellIds; }));

  // Attach machine to each stop, mark done:false
  for (const stop of ordered) {
    const m = stopMachine(stop);
    stop.machine = m.machine;
    stop.machineLabel = m.machineLabel;
    stop.done = false;
    // compute label for display
    const cell = findCellById(stop.cellId);
    stop.label = cell ? cell.label : stop.cellId;
    // init picked flags
    stop.picks.forEach(p => { p.picked = false; });
  }

  const run = {
    stops: ordered,
    unplaced,
    createdAt: Date.now(),
  };
  return run;
}

/* ---------------- VIEW SWITCHING ---------------- */
function setView(view) {
  ui.currentView = view;
  $$('.view').forEach(v => v.classList.toggle('active', v.dataset.view === view));
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  render();
}

/* ---------------- RENDER ---------------- */
function render() {
  switch (ui.currentView) {
    case 'run': renderRun(); break;
    case 'orders': renderOrders(); break;
    case 'history': renderHistory(); break;
    case 'inventory': renderInventory(); break;
    case 'map': renderMap(); break;
    case 'settings': renderSettings(); break;
  }
  saveState();
}

/* ---------- RUN RENDER ---------- */
function renderRun() {
  const run = state.run;
  const empty = $('#run-empty');
  const active = $('#run-active');
  const stats = $('#run-stats');

  if (!run || !run.stops || run.stops.length === 0) {
    empty.classList.remove('hidden');
    active.classList.add('hidden');
    stats.textContent = state.orders.length
      ? `${state.orders.length} order${state.orders.length !== 1 ? 's' : ''} pending`
      : 'No active run';
    return;
  }

  empty.classList.add('hidden');
  active.classList.remove('hidden');

  const totalPicks = run.stops.reduce((a, s) => a + s.picks.length, 0);
  const donePicks = run.stops.reduce((a, s) => a + s.picks.filter(p => p.picked).length, 0);
  stats.textContent = `${run.stops.length} stops · ${donePicks}/${totalPicks} picked`;

  // Update mode toggle state
  $$('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === ui.runMode));

  const list = $('#stops-list');
  list.innerHTML = '';

  if (ui.runMode === 'route') {
    renderRunByRoute(list, run);
  } else {
    renderRunByOrder(list, run);
  }

  // unplaced warning
  if (run.unplaced && run.unplaced.length > 0) {
    const warn = document.createElement('div');
    warn.style.cssText = 'background: var(--bg-card); border: 1px solid var(--warn); color: var(--warn); padding: 12px 14px; border-radius: var(--r-md); font-size: 13px; font-family: var(--font-display); margin-top: 10px;';
    const names = run.unplaced
      .map(p => {
        const prod = findProductById(p.productId);
        return prod ? prod.name : '?';
      })
      .join(', ');
    warn.innerHTML = `⚠ NOT ON MAP: ${escapeHtml(names)}<br><span style="color:var(--ink-dim); font-family:var(--font-body)">Assign locations in Inventory to include these.</span>`;
    list.appendChild(warn);
  }

  // bind pick toggles (works for both modes — data attributes store stop+pick indices)
  list.querySelectorAll('.pick-check').forEach(btn => {
    btn.addEventListener('click', () => {
      const sIdx = +btn.dataset.stop;
      const pIdx = +btn.dataset.pick;
      const pick = state.run.stops[sIdx].picks[pIdx];
      pick.picked = !pick.picked;
      renderRun();
    });
  });
}

function renderRunByRoute(list, run) {
  run.stops.forEach((stop, idx) => {
    const allPicked = stop.picks.every(p => p.picked);
    const machineClass =
      stop.machine === 'SKID' ? 'skid' :
      stop.machine === 'SMALL' ? 'small' :
      'medium';

    const card = document.createElement('div');
    card.className = 'stop-card' + (allPicked ? ' done' : '');
    card.innerHTML = `
      <div class="stop-head">
        <div class="stop-num">${idx + 1}</div>
        <div>
          <div class="stop-loc">${escapeHtml(stop.label)}</div>
          <div class="stop-meta">${stop.picks.length} product${stop.picks.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="stop-machine ${machineClass}">${escapeHtml(stop.machineLabel)}</div>
      </div>
      <div class="stop-picks"></div>
    `;
    const picksBox = card.querySelector('.stop-picks');
    stop.picks.forEach((pick, pIdx) => {
      const product = findProductById(pick.productId);
      const row = document.createElement('div');
      row.className = 'pick-row' + (pick.picked ? ' picked' : '');
      const orderBreakdown = pick.orderNums.map(o =>
        `<span class="order-tag">#${escapeHtml(o.number)} ×${o.qty}</span>`
      ).join('');
      row.innerHTML = `
        <button class="pick-check ${pick.picked ? 'checked' : ''}" data-stop="${idx}" data-pick="${pIdx}">${pick.picked ? '✓' : ''}</button>
        <div class="pick-text">
          <div><span class="pick-product">${escapeHtml(product ? product.name : '?')}</span> — <span class="pick-qty">${pick.qty}</span> × ${escapeHtml(product ? product.potSize : '?')}</div>
          <div class="pick-orders">${orderBreakdown}</div>
        </div>
      `;
      picksBox.appendChild(row);
    });
    list.appendChild(card);
  });
}

function renderRunByOrder(list, run) {
  // Group picks by original order number. Note: one pick may belong to multiple orders (aggregated),
  // so we re-split it per-order for staging clarity.
  const byOrder = new Map(); // orderNumber -> [{stopIdx, pickIdx, qty, productId, location, machine}]
  run.stops.forEach((stop, sIdx) => {
    stop.picks.forEach((pick, pIdx) => {
      pick.orderNums.forEach(on => {
        if (!byOrder.has(on.number)) byOrder.set(on.number, []);
        byOrder.get(on.number).push({
          stopIdx: sIdx, pickIdx: pIdx,
          qty: on.qty, productId: pick.productId,
          location: stop.label, machine: stop.machineLabel,
          machineClass: stop.machine === 'SKID' ? 'skid' : stop.machine === 'SMALL' ? 'small' : 'medium',
          picked: pick.picked,
        });
      });
    });
  });

  // Preserve natural order-number order
  const orderNums = Array.from(byOrder.keys()).sort();
  orderNums.forEach(num => {
    const rows = byOrder.get(num);
    const allPicked = rows.every(r => r.picked);
    const picked = rows.filter(r => r.picked).length;

    const card = document.createElement('div');
    card.className = 'stop-card' + (allPicked ? ' done' : '');
    card.innerHTML = `
      <div class="order-group-head">
        <div class="stop-num">#</div>
        <div class="order-group-num">ORDER #${escapeHtml(num)}</div>
        <div class="order-group-progress">${picked}/${rows.length}</div>
      </div>
      <div class="stop-picks"></div>
    `;
    const picksBox = card.querySelector('.stop-picks');
    rows.forEach(r => {
      const product = findProductById(r.productId);
      const row = document.createElement('div');
      row.className = 'pick-row' + (r.picked ? ' picked' : '');
      row.innerHTML = `
        <button class="pick-check ${r.picked ? 'checked' : ''}" data-stop="${r.stopIdx}" data-pick="${r.pickIdx}">${r.picked ? '✓' : ''}</button>
        <div class="pick-text">
          <div><span class="pick-product">${escapeHtml(product ? product.name : '?')}</span> — <span class="pick-qty">${r.qty}</span> × ${escapeHtml(product ? product.potSize : '?')}</div>
          <div class="pick-detail">◉ ${escapeHtml(r.location)} · <span style="color:var(--accent)">${escapeHtml(r.machine)}</span></div>
        </div>
      `;
      picksBox.appendChild(row);
    });
    list.appendChild(card);
  });
}

/* ---------- ORDERS RENDER ---------- */
function renderOrders() {
  const list = $('#orders-list');
  list.innerHTML = '';
  if (state.orders.length === 0) {
    list.innerHTML = `<div class="empty-state" style="padding: 30px 16px;">
      <div class="empty-icon">◱</div>
      <div class="empty-title">No orders yet</div>
      <div class="empty-sub">Paste rows above or tap + ORDER.</div>
    </div>`;
    return;
  }
  state.orders.forEach(order => {
    const card = document.createElement('div');
    card.className = 'order-card';
    const totalQty = order.items.reduce((a, i) => a + i.qty, 0);
    card.innerHTML = `
      <div class="order-head">
        <div class="order-num">ORDER #${escapeHtml(order.number)}</div>
        <div class="order-count">${order.items.length} items · ${totalQty} units</div>
      </div>
      <div class="order-items"></div>
      <div class="order-actions">
        <button class="btn btn-ghost btn-small" data-act="edit" data-id="${order.id}">EDIT</button>
        <button class="btn btn-danger btn-small" data-act="del" data-id="${order.id}">DELETE</button>
      </div>
    `;
    const itemsBox = card.querySelector('.order-items');
    order.items.forEach(it => {
      const p = findProductById(it.productId);
      const row = document.createElement('div');
      row.className = 'order-item-row';
      row.innerHTML = `
        <div class="order-item-name">${escapeHtml(p ? p.name : '(missing product)')} <span style="color:var(--ink-faint); font-size:12px">${escapeHtml(p ? p.potSize : '')}</span></div>
        <div class="order-item-qty">× ${it.qty}</div>
      `;
      itemsBox.appendChild(row);
    });
    list.appendChild(card);
  });

  list.querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (btn.dataset.act === 'del') {
        if (confirm('Delete this order?')) {
          state.orders = state.orders.filter(o => o.id !== id);
          renderOrders();
        }
      } else if (btn.dataset.act === 'edit') {
        openOrderModal(id);
      }
    });
  });
}

/* ---------- INVENTORY RENDER ---------- */
function renderInventory() {
  const list = $('#inventory-list');
  list.innerHTML = '';
  const q = ui.invSearch.trim().toLowerCase();
  let items = state.products;
  if (q) items = items.filter(p => p.name.toLowerCase().includes(q) || (p.potSize || '').toLowerCase().includes(q));

  if (items.length === 0) {
    list.innerHTML = `<div class="empty-state" style="padding: 30px 16px;">
      <div class="empty-icon">◲</div>
      <div class="empty-title">${state.products.length === 0 ? 'No products yet' : 'No matches'}</div>
      <div class="empty-sub">${state.products.length === 0 ? 'Tap + PRODUCT to add your first item.' : 'Try a different search.'}</div>
    </div>`;
    return;
  }

  items.forEach(p => {
    const cellIds = Array.isArray(p.cellIds) ? p.cellIds : [];
    const cells = cellIds.map(id => findCellById(id)).filter(Boolean);
    const locLabel = cells.length === 0
      ? '◌ UNASSIGNED'
      : '◉ ' + cells.map(c => escapeHtml(c.label)).join(', ');
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <div class="product-info">
        <div class="product-name">${escapeHtml(p.name)}</div>
        <div class="product-loc ${cells.length === 0 ? 'unassigned' : ''}">${locLabel}</div>
      </div>
      <div class="product-pot">${escapeHtml(p.potSize || '?')}</div>
      <button class="icon-btn" data-edit="${p.id}" style="width:36px; height:36px; font-size:14px;">✎</button>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('button[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openProductModal(btn.dataset.edit));
  });
}

/* ---------- MAP RENDER ---------- */
function renderMap() {
  const grid = $('#facility-map');
  const { cols, rows, cells } = state.map;
  // Dynamic cell min-size: shrink for larger grids so everything fits without being microscopic
  const minCell = cols > 40 ? 13 : cols > 30 ? 16 : cols > 20 ? 22 : 32;
  grid.style.gridTemplateColumns = `repeat(${cols}, minmax(${minCell}px, 1fr))`;
  grid.innerHTML = '';

  // Toolbar visibility follows mapMode
  $('#map-toolbar').classList.toggle('hidden', ui.mapMode !== 'config');
  // Disable touch-scrolling inside the map when painting so drags paint instead of scroll
  const wrap = grid.parentElement;
  if (wrap) wrap.classList.toggle('config-painting', ui.mapMode === 'config');

  // count products per zone (products can have multiple locations)
  const countByCell = new Map();
  for (const p of state.products) {
    const ids = Array.isArray(p.cellIds) ? p.cellIds : [];
    for (const cid of ids) {
      countByCell.set(cid, (countByCell.get(cid) || 0) + 1);
    }
  }

  cells.forEach(cell => {
    const div = document.createElement('div');
    div.className = 'map-cell ' + cell.type;
    if (cell.id === ui.selectedCellId) div.classList.add('selected');
    const n = countByCell.get(cell.id) || 0;
    if (cell.type === 'zone' && n > 0) div.classList.add('has-products');
    if (cell.type === 'zone' && cell.customLabel) div.classList.add('custom-label');
    // Only render label text if it fits (zones and entrance)
    const showLabel = (cell.type === 'entrance') || (cell.type === 'zone' && cols <= 30);
    div.innerHTML = `
      ${showLabel ? `<span>${escapeHtml(cell.label || '')}</span>` : ''}
      ${n > 0 ? `<span class="cell-count">${n}</span>` : ''}
    `;
    div.dataset.cellId = cell.id;
    grid.appendChild(div);
  });

  // Attach delegated pointer handlers on the grid container for tap + drag-paint
  attachMapInteractions(grid);

  renderMapInfo();
}

// Attach pointer listeners once per render (grid is rebuilt each render)
function attachMapInteractions(grid) {
  // Use pointer events — they unify mouse and touch, and work fine on iOS Safari.
  const getCellId = (target) => {
    const el = target.closest('.map-cell');
    return el ? el.dataset.cellId : null;
  };

  grid.addEventListener('pointerdown', (e) => {
    const id = getCellId(e.target);
    if (!id) return;
    // In view mode, tap = select. In config mode, tap-or-drag = paint.
    if (ui.mapMode !== 'config') {
      ui.selectedCellId = id;
      renderMap();
      return;
    }
    ui.isPainting = true;
    ui.paintedInDrag = new Set();
    applyPaint(id);
    // Capture so drag continues even if finger leaves original cell
    try { grid.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });

  grid.addEventListener('pointermove', (e) => {
    if (!ui.isPainting) return;
    // While the pointer is down, find the cell under the current position
    const elUnder = document.elementFromPoint(e.clientX, e.clientY);
    const id = elUnder ? getCellId(elUnder) : null;
    if (id && !ui.paintedInDrag.has(id)) {
      applyPaint(id);
    }
  });

  const endDrag = () => {
    if (!ui.isPainting) return;
    ui.isPainting = false;
    ui.paintedInDrag.clear();
    saveState();
  };
  grid.addEventListener('pointerup', endDrag);
  grid.addEventListener('pointercancel', endDrag);
  grid.addEventListener('pointerleave', endDrag);
}

// Apply current paint tool to a single cell.
function applyPaint(cellId) {
  const cell = findCellById(cellId);
  if (!cell) return;
  ui.paintedInDrag.add(cellId);

  const tool = ui.paintTool;

  if (tool === 'label') {
    // Only labelable when zone
    if (cell.type !== 'zone') {
      toast('Tap a ZONE to label it', true);
      return;
    }
    const current = cell.customLabel ? cell.label : '';
    const name = prompt('Zone label (leave empty to reset):', current || '');
    if (name === null) return; // cancelled
    const trimmed = name.trim();
    if (trimmed === '') {
      cell.customLabel = false;
      cell.label = autoZoneLabel(cell);
    } else {
      cell.label = trimmed;
      cell.customLabel = true;
    }
    renderMap();
    return;
  }

  if (tool === 'entrance') {
    // Exactly one entrance — clear existing first
    const existing = getEntrance();
    if (existing && existing.id !== cell.id) {
      existing.type = 'aisle';
      existing.label = '';
    }
    cell.type = 'entrance';
    cell.label = 'IN/OUT';
    cell.customLabel = false;
    renderMapCell(cell.id);
    // Also re-render the old entrance cell
    if (existing && existing.id !== cell.id) renderMapCell(existing.id);
    return;
  }

  // aisle / zone / blocked
  if (tool === 'aisle') {
    if (cell.type === 'entrance') return; // don't overwrite entrance via paint
    cell.type = 'aisle';
    cell.label = '';
    cell.customLabel = false;
  } else if (tool === 'zone') {
    if (cell.type === 'entrance') return;
    cell.type = 'zone';
    if (!cell.customLabel) cell.label = autoZoneLabel(cell);
  } else if (tool === 'blocked') {
    if (cell.type === 'entrance') {
      toast('Cannot erase the entrance', true);
      return;
    }
    // If products reference this cell, remove this cell from their cellIds array
    state.products.forEach(p => {
      if (Array.isArray(p.cellIds)) {
        p.cellIds = p.cellIds.filter(id => id !== cell.id);
      }
    });
    cell.type = 'blocked';
    cell.label = '';
    cell.customLabel = false;
  }
  renderMapCell(cell.id);
}

function autoZoneLabel(cell) {
  // Simple grid-coord label, e.g. "R03-C14"
  const r = String(cell.r + 1).padStart(2, '0');
  const c = String(cell.c + 1).padStart(2, '0');
  return `R${r}-C${c}`;
}

// Re-render a single cell in place without rebuilding the whole grid (performance during drag)
function renderMapCell(cellId) {
  const grid = $('#facility-map');
  const el = grid.querySelector(`.map-cell[data-cell-id="${cellId}"]`);
  if (!el) return;
  const cell = findCellById(cellId);
  if (!cell) return;
  el.className = 'map-cell ' + cell.type;
  if (cell.id === ui.selectedCellId) el.classList.add('selected');
  const productCount = state.products.filter(p => Array.isArray(p.cellIds) && p.cellIds.includes(cellId)).length;
  if (cell.type === 'zone' && productCount > 0) el.classList.add('has-products');
  if (cell.type === 'zone' && cell.customLabel) el.classList.add('custom-label');
  const showLabel = (cell.type === 'entrance') || (cell.type === 'zone' && state.map.cols <= 30);
  el.innerHTML = `
    ${showLabel ? `<span>${escapeHtml(cell.label || '')}</span>` : ''}
    ${productCount > 0 ? `<span class="cell-count">${productCount}</span>` : ''}
  `;
}

function renderMapInfo() {
  const box = $('#map-info');
  if (ui.mapMode === 'config') {
    const toolHint = {
      aisle: 'Painting AISLES (walkable paths, preferred by router)',
      zone: 'Painting ZONES (product bays, passable but discouraged)',
      entrance: 'Setting ENTRANCE (one per map)',
      blocked: 'ERASING to blocked (unwalkable)',
      label: 'Tap a zone to give it a custom name',
    }[ui.paintTool];
    box.innerHTML = `<strong>CONFIG MODE</strong> · ${escapeHtml(toolHint)}`;
    return;
  }
  if (!ui.selectedCellId) {
    box.innerHTML = 'Tap a cell to view its contents.';
    return;
  }
  const cell = findCellById(ui.selectedCellId);
  if (!cell) { box.textContent = ''; return; }
  if (cell.type === 'entrance') {
    box.innerHTML = `<strong>${escapeHtml(cell.label || 'ENTRANCE')}</strong> · Route starts and ends here.`;
    return;
  }
  if (cell.type === 'aisle') {
    box.innerHTML = `<strong>Aisle</strong> · walkable path`;
    return;
  }
  if (cell.type === 'blocked') {
    box.innerHTML = `<strong>Blocked</strong> · impassable`;
    return;
  }
  // zone
  const products = state.products.filter(p => Array.isArray(p.cellIds) && p.cellIds.includes(cell.id));
  if (products.length === 0) {
    box.innerHTML = `<strong>${escapeHtml(cell.label)}</strong> · empty · <em style="color:var(--ink-dim)">Assign products in Inventory.</em>`;
    return;
  }
  box.innerHTML = `<strong>${escapeHtml(cell.label)}</strong> · ${products.length} product${products.length !== 1 ? 's' : ''}<br>` +
    products.map(p => `<span style="color:var(--ink-dim); font-size:12px">• ${escapeHtml(p.name)} <span style="color:var(--ink-faint)">(${escapeHtml(p.potSize || '?')})</span></span>`).join('<br>');
}

function clearMap() {
  if (!confirm('Clear the entire map? All cells will be reset to blocked and all products will be unassigned.')) return;
  // Unassign all products (clear their location arrays)
  state.products.forEach(p => { p.cellIds = []; });
  // Reset every cell to blocked, keep entrance if we have one
  const entrance = getEntrance();
  state.map.cells.forEach(cell => {
    if (entrance && cell.id === entrance.id) return;
    cell.type = 'blocked';
    cell.label = '';
    cell.customLabel = false;
  });
  toast('Map cleared');
  render();
}

function applyGridSize() {
  const newCols = parseInt($('#grid-cols').value);
  const newRows = parseInt($('#grid-rows').value);
  if (!newCols || !newRows || newCols < 5 || newRows < 5) {
    toast('Size must be at least 5x5', true);
    return;
  }
  if (newCols > 80 || newRows > 100) {
    toast('Size too large', true);
    return;
  }
  if (newCols === state.map.cols && newRows === state.map.rows) {
    toast('No change');
    return;
  }
  // Compute which cells will be removed
  const removedCellIds = new Set();
  state.map.cells.forEach(c => {
    if (c.r >= newRows || c.c >= newCols) removedCellIds.add(c.id);
  });
  // Count products that will LOSE at least one location
  const affectedProducts = state.products.filter(p =>
    Array.isArray(p.cellIds) && p.cellIds.some(id => removedCellIds.has(id))
  ).length;

  let msg = `Resize grid to ${newCols} × ${newRows}?`;
  if (removedCellIds.size > 0) msg += ` ${removedCellIds.size} cell${removedCellIds.size !== 1 ? 's' : ''} will be removed.`;
  if (affectedProducts > 0) msg += ` ${affectedProducts} product${affectedProducts !== 1 ? 's' : ''} will lose a location.`;
  if (!confirm(msg)) return;

  // Remove affected cell IDs from each product's locations array
  state.products.forEach(p => {
    if (Array.isArray(p.cellIds)) {
      p.cellIds = p.cellIds.filter(id => !removedCellIds.has(id));
    }
  });

  // Build the new grid, copying existing cells where they fit
  const oldCells = new Map(state.map.cells.map(c => [c.id, c]));
  const newCells = [];
  for (let r = 0; r < newRows; r++) {
    for (let c = 0; c < newCols; c++) {
      const id = `${r}_${c}`;
      const existing = oldCells.get(id);
      if (existing) {
        newCells.push(existing);
      } else {
        newCells.push({
          id, r, c,
          type: 'blocked',
          label: '',
          customLabel: false,
        });
      }
    }
  }
  state.map.cols = newCols;
  state.map.rows = newRows;
  state.map.cells = newCells;

  // Ensure there's still exactly one entrance (if the old one got cut, preserve)
  // The old entrance may still exist; otherwise the router will warn at build time.
  toast(`Grid resized to ${newCols} × ${newRows}`);
  render();
}

/* ---------- SETTINGS RENDER ---------- */
function renderSettings() {
  const box = $('#machine-rules');
  box.innerHTML = '';
  state.machineRules.forEach(r => {
    const row = document.createElement('div');
    row.className = 'rule-row';
    row.innerHTML = `
      <div class="rule-label">${escapeHtml(r.label)}</div>
      <div class="rule-machine">→ ${escapeHtml(r.machineLabel)}</div>
    `;
    box.appendChild(row);
  });

  const chips = $('#pot-sizes-list');
  chips.innerHTML = '';
  state.potSizes.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = p;
    chips.appendChild(chip);
  });

  // Grid size inputs reflect current map dimensions
  const colsInput = $('#grid-cols');
  const rowsInput = $('#grid-rows');
  if (colsInput) colsInput.value = state.map.cols;
  if (rowsInput) rowsInput.value = state.map.rows;

  // storage info
  try {
    const bytes = new Blob([JSON.stringify(state)]).size;
    const kb = (bytes / 1024).toFixed(1);
    $('#storage-info').textContent = `Local data · ${kb} KB · ${state.products.length} products · ${state.orders.length} orders`;
  } catch (e) {}
}

/* ---------------- MODALS ---------------- */
function openModal(title, bodyHTML) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHTML;
  $('#modal').classList.remove('hidden');
}
function closeModal() {
  $('#modal').classList.add('hidden');
  $('#modal-body').innerHTML = '';
}

function openProductModal(productId) {
  const isNew = !productId;
  const p = isNew
    ? { name: '', potSize: state.potSizes[0], cellIds: [] }
    : findProductById(productId);
  if (!isNew && !p) return;
  const pCellIds = Array.isArray(p.cellIds) ? p.cellIds.slice() : [];

  // Group zone cells by label so "C3" (multi-cell zone) shows as a single entry
  const zoneGroups = new Map(); // label -> { label, cellIds: [] }
  state.map.cells.filter(c => c.type === 'zone').forEach(c => {
    const key = c.label || c.id;
    if (!zoneGroups.has(key)) zoneGroups.set(key, { label: key, cellIds: [] });
    zoneGroups.get(key).cellIds.push(c.id);
  });
  // Sort by label for readability
  const groups = [...zoneGroups.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

  // A zone group is considered "selected" if ANY of its cell IDs is in pCellIds.
  // When saving, we keep exactly one representative cell per selected zone (whichever was selected before,
  // otherwise the first cell of that zone's group).
  const isGroupSelected = (g) => g.cellIds.some(id => pCellIds.includes(id));
  const representativeFor = (g) => {
    const existing = g.cellIds.find(id => pCellIds.includes(id));
    return existing || g.cellIds[0];
  };

  const html = `
    <div class="form-field">
      <label class="form-label">Product name</label>
      <input type="text" class="form-input" id="prod-name" value="${escapeHtml(p.name)}" placeholder="Japanese Maple" />
    </div>
    <div class="form-field">
      <label class="form-label">Pot size</label>
      <select class="form-select" id="prod-pot">
        ${state.potSizes.map(s => `<option ${s === p.potSize ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
      </select>
    </div>
    <div class="form-field">
      <label class="form-label">Locations (tap to toggle)</label>
      <div class="zone-chips" id="prod-locs">
        ${groups.map(g => `
          <button type="button" class="zone-chip ${isGroupSelected(g) ? 'selected' : ''}" data-zone="${escapeHtml(g.label)}">
            ${escapeHtml(g.label)}
          </button>
        `).join('')}
      </div>
    </div>
    <div class="button-row" style="margin-top: 14px;">
      <button class="btn btn-primary" id="prod-save" style="flex:1">${isNew ? 'ADD' : 'SAVE'}</button>
      ${!isNew ? `<button class="btn btn-danger" id="prod-del">DELETE</button>` : ''}
    </div>
  `;
  openModal(isNew ? 'New Product' : 'Edit Product', html);

  // Chip toggling
  $$('#prod-locs .zone-chip').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('selected'));
  });

  $('#prod-save').addEventListener('click', () => {
    const name = $('#prod-name').value.trim();
    const potSize = $('#prod-pot').value;
    if (!name) { toast('Name required', true); return; }
    // Gather selected zones and convert to one representative cell per zone
    const selectedZones = $$('#prod-locs .zone-chip.selected').map(el => el.dataset.zone);
    const newCellIds = selectedZones.map(label => {
      const group = zoneGroups.get(label);
      return representativeFor(group);
    });
    if (isNew) {
      state.products.push({ id: uid('p'), name, potSize, cellIds: newCellIds });
      toast('Added');
    } else {
      p.name = name; p.potSize = potSize; p.cellIds = newCellIds;
      toast('Saved');
    }
    closeModal();
    render();
  });
  if (!isNew) {
    $('#prod-del').addEventListener('click', () => {
      if (!confirm('Delete this product? It will be removed from any orders.')) return;
      state.products = state.products.filter(x => x.id !== productId);
      // Scrub from orders
      state.orders.forEach(o => {
        o.items = o.items.filter(i => i.productId !== productId);
      });
      state.orders = state.orders.filter(o => o.items.length > 0);
      closeModal();
      render();
    });
  }
}

function openOrderModal(orderId) {
  const isNew = !orderId;
  const order = isNew
    ? { id: uid('o'), number: '', items: [], createdAt: Date.now() }
    : JSON.parse(JSON.stringify(findOrderById(orderId)));
  if (!isNew && !order) return;

  const html = `
    <div class="form-field">
      <label class="form-label">Order number</label>
      <input type="text" class="form-input" id="ord-num" value="${escapeHtml(order.number)}" placeholder="1001" />
    </div>
    <div class="form-field">
      <label class="form-label">Line items</label>
      <div id="line-items"></div>
      <button class="btn btn-ghost btn-small" id="add-line" style="margin-top: 8px;">+ LINE</button>
    </div>
    <div class="button-row" style="margin-top: 14px;">
      <button class="btn btn-primary" id="ord-save" style="flex:1">${isNew ? 'CREATE ORDER' : 'SAVE'}</button>
      ${!isNew ? `<button class="btn btn-danger" id="ord-del">DELETE</button>` : ''}
    </div>
  `;
  openModal(isNew ? 'New Order' : 'Edit Order', html);

  const linesBox = $('#line-items');
  function renderLines() {
    linesBox.innerHTML = '';
    order.items.forEach((it, i) => {
      const row = document.createElement('div');
      row.className = 'line-item';
      const opts = state.products.map(p =>
        `<option value="${p.id}" ${p.id === it.productId ? 'selected' : ''}>${escapeHtml(p.name)} (${escapeHtml(p.potSize)})</option>`
      ).join('');
      row.innerHTML = `
        <select class="form-select line-prod"><option value="">Select...</option>${opts}</select>
        <input type="number" class="form-input line-qty" min="1" value="${it.qty || 1}" />
        <div style="font-size:11px; color:var(--ink-dim); font-family: var(--font-display);">${escapeHtml(findProductById(it.productId)?.potSize || '')}</div>
        <button class="line-remove">×</button>
      `;
      row.querySelector('.line-prod').addEventListener('change', e => {
        it.productId = e.target.value;
        renderLines();
      });
      row.querySelector('.line-qty').addEventListener('input', e => {
        it.qty = Math.max(1, parseInt(e.target.value) || 1);
      });
      row.querySelector('.line-remove').addEventListener('click', () => {
        order.items.splice(i, 1);
        renderLines();
      });
      linesBox.appendChild(row);
    });
    if (order.items.length === 0) {
      linesBox.innerHTML = '<div style="color:var(--ink-faint); font-size:13px; padding: 8px 0;">No items yet. Tap + LINE.</div>';
    }
  }
  renderLines();

  $('#add-line').addEventListener('click', () => {
    order.items.push({ productId: '', qty: 1 });
    renderLines();
  });

  $('#ord-save').addEventListener('click', () => {
    const num = $('#ord-num').value.trim();
    if (!num) { toast('Order number required', true); return; }
    const clean = order.items.filter(i => i.productId && i.qty > 0);
    if (clean.length === 0) { toast('Add at least one item', true); return; }
    order.items = clean;
    order.number = num;
    if (isNew) {
      state.orders.push(order);
      toast('Order created');
    } else {
      const idx = state.orders.findIndex(o => o.id === orderId);
      if (idx >= 0) state.orders[idx] = order;
      toast('Saved');
    }
    closeModal();
    render();
  });
  if (!isNew) {
    $('#ord-del').addEventListener('click', () => {
      if (!confirm('Delete this order?')) return;
      state.orders = state.orders.filter(o => o.id !== orderId);
      closeModal();
      render();
    });
  }
}

/* ---------------- BULK IMPORT ---------------- */
function handleBulkImport() {
  const text = $('#bulk-input').value.trim();
  if (!text) { toast('Paste some rows first', true); return; }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const ordersByNum = new Map();
  // Seed with existing orders so pastes merge into them
  for (const o of state.orders) ordersByNum.set(o.number, o);

  let created = 0, added = 0, skipped = 0;
  for (const line of lines) {
    const parts = line.split(',').map(s => s.trim());
    if (parts.length < 4) { skipped++; continue; }
    const [orderNum, prodName, qtyStr, potSize] = parts;
    const qty = parseInt(qtyStr);
    if (!orderNum || !prodName || !qty || qty < 1) { skipped++; continue; }

    // Find or create product
    let product = state.products.find(p =>
      p.name.toLowerCase() === prodName.toLowerCase() &&
      (p.potSize || '').toLowerCase() === potSize.toLowerCase()
    );
    if (!product) {
      // match pot size from list (case insensitive)
      const matchedPot = state.potSizes.find(s => s.toLowerCase() === potSize.toLowerCase()) || potSize;
      product = { id: uid('p'), name: prodName, potSize: matchedPot, cellIds: [] };
      state.products.push(product);
    }

    // Find or create order
    let order = ordersByNum.get(orderNum);
    if (!order) {
      order = { id: uid('o'), number: orderNum, items: [], createdAt: Date.now() };
      state.orders.push(order);
      ordersByNum.set(orderNum, order);
      created++;
    }
    order.items.push({ productId: product.id, qty });
    added++;
  }

  $('#bulk-input').value = '';
  toast(`${added} item${added !== 1 ? 's' : ''} added · ${created} new order${created !== 1 ? 's' : ''}${skipped ? ` · ${skipped} skipped` : ''}`);
  render();
}

/* ---------------- RUN CONTROL ---------------- */
function startBuildRoute() {
  const run = buildRun();
  if (!run) return;
  state.run = run;
  setView('run');
  toast(`Route built · ${run.stops.length} stops`);
}

function resetRun() {
  if (!confirm('Reset the current run? Picked progress will be cleared.')) return;
  state.run = null;
  render();
}

function completeRun() {
  const run = state.run;
  if (!run) return;
  const totalPicks = run.stops.reduce((a, s) => a + s.picks.length, 0);
  const donePicks = run.stops.reduce((a, s) => a + s.picks.filter(p => p.picked).length, 0);

  let msg;
  if (donePicks < totalPicks) {
    msg = `Only ${donePicks}/${totalPicks} picks done. Complete anyway? Incomplete picks will be archived as-is and the current orders cleared.`;
  } else {
    msg = `Complete this run? It will be archived to History and orders will be cleared.`;
  }
  if (!confirm(msg)) return;

  // Build a snapshot we can reconstruct a report from
  const orderNumbersSet = new Set();
  run.stops.forEach(s => s.picks.forEach(p => p.orderNums.forEach(o => orderNumbersSet.add(o.number))));

  // Deep-copy stops with product names resolved at time of completion (names may change later)
  const snapshot = run.stops.map(s => ({
    label: s.label,
    cellId: s.cellId,
    machine: s.machine,
    machineLabel: s.machineLabel,
    picks: s.picks.map(p => {
      const prod = findProductById(p.productId);
      return {
        productId: p.productId,
        productName: prod ? prod.name : '(deleted)',
        potSize: prod ? prod.potSize : '?',
        qty: p.qty,
        picked: !!p.picked,
        orderNums: p.orderNums.map(o => ({ ...o })),
      };
    }),
  }));

  const record = {
    id: uid('h'),
    completedAt: Date.now(),
    stopsCount: run.stops.length,
    totalPicks,
    donePicks,
    orderNumbers: Array.from(orderNumbersSet).sort(),
    snapshot,
  };
  state.history = state.history || [];
  state.history.unshift(record);
  // Cap history to 200 entries to keep storage lean
  if (state.history.length > 200) state.history.length = 200;

  // Clear current run + orders (history has a copy)
  state.run = null;
  state.orders = [];
  toast(`Archived · ${donePicks}/${totalPicks} picks`);
  render();
}

function renderHistory() {
  const list = $('#history-list');
  list.innerHTML = '';
  const history = state.history || [];
  if (history.length === 0) {
    list.innerHTML = `<div class="empty-state" style="padding: 30px 16px;">
      <div class="empty-icon">◳</div>
      <div class="empty-title">No runs yet</div>
      <div class="empty-sub">Completed runs will appear here.</div>
    </div>`;
    return;
  }
  history.forEach(h => {
    const d = new Date(h.completedAt);
    const dateStr = d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const card = document.createElement('div');
    card.className = 'history-card';
    card.innerHTML = `
      <div class="history-date">${escapeHtml(dateStr)}</div>
      <div class="history-sub">${h.stopsCount} stops · ${h.donePicks}/${h.totalPicks} picks · ${h.orderNumbers.length} order${h.orderNumbers.length !== 1 ? 's' : ''}</div>
      <div class="history-orders">Orders: ${h.orderNumbers.map(n => '#' + escapeHtml(n)).join(', ') || '—'}</div>
      <div class="order-actions">
        <button class="btn btn-ghost btn-small" data-hist-view="${h.id}">VIEW</button>
        <button class="btn btn-ghost btn-small" data-hist-csv="${h.id}">CSV</button>
        <button class="btn btn-danger btn-small" data-hist-del="${h.id}">DELETE</button>
      </div>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('[data-hist-view]').forEach(btn =>
    btn.addEventListener('click', () => openHistoryDetail(btn.dataset.histView)));
  list.querySelectorAll('[data-hist-csv]').forEach(btn =>
    btn.addEventListener('click', () => exportRunCSV(btn.dataset.histCsv)));
  list.querySelectorAll('[data-hist-del]').forEach(btn =>
    btn.addEventListener('click', () => {
      if (!confirm('Delete this run from history?')) return;
      state.history = state.history.filter(h => h.id !== btn.dataset.histDel);
      renderHistory();
      saveState();
    }));
}

function openHistoryDetail(id) {
  const h = (state.history || []).find(x => x.id === id);
  if (!h) return;
  const d = new Date(h.completedAt);
  let body = `<div style="color:var(--ink-dim); font-size:13px; margin-bottom:12px;">
    ${escapeHtml(d.toLocaleString())} · ${h.donePicks}/${h.totalPicks} picks
  </div>`;
  h.snapshot.forEach((stop, i) => {
    body += `<div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--r-md); padding:10px; margin-bottom:8px;">
      <div style="font-family:var(--font-display); font-weight:700; font-size:13px;">${i + 1}. ${escapeHtml(stop.label)} <span style="float:right; color:var(--accent); font-size:11px;">${escapeHtml(stop.machineLabel)}</span></div>
      <div style="font-size:12px; color:var(--ink-dim); margin-top:6px;">`;
    stop.picks.forEach(p => {
      body += `<div style="padding:3px 0;">${p.picked ? '✓' : '◌'} ${escapeHtml(p.productName)} (${escapeHtml(p.potSize)}) × ${p.qty}</div>`;
    });
    body += `</div></div>`;
  });
  openModal(`RUN · ${d.toLocaleDateString()}`, body);
}

function exportRunCSV(id) {
  const h = (state.history || []).find(x => x.id === id);
  if (!h) return;
  const rows = [['Stop', 'Location', 'Machine', 'Product', 'Pot Size', 'Qty', 'Orders', 'Picked']];
  h.snapshot.forEach((stop, i) => {
    stop.picks.forEach(p => {
      const orderTags = p.orderNums.map(o => `#${o.number}×${o.qty}`).join('; ');
      rows.push([
        i + 1,
        stop.label,
        stop.machineLabel,
        p.productName,
        p.potSize,
        p.qty,
        orderTags,
        p.picked ? 'yes' : 'no',
      ]);
    });
  });
  downloadCSV(rows, `run-${new Date(h.completedAt).toISOString().slice(0,10)}.csv`);
}

function exportAllHistoryCSV() {
  const history = state.history || [];
  if (history.length === 0) { toast('No history to export', true); return; }
  const rows = [['Run Date', 'Stop', 'Location', 'Machine', 'Product', 'Pot Size', 'Qty', 'Orders', 'Picked']];
  history.forEach(h => {
    const dateStr = new Date(h.completedAt).toISOString();
    h.snapshot.forEach((stop, i) => {
      stop.picks.forEach(p => {
        const orderTags = p.orderNums.map(o => `#${o.number}×${o.qty}`).join('; ');
        rows.push([
          dateStr,
          i + 1,
          stop.label,
          stop.machineLabel,
          p.productName,
          p.potSize,
          p.qty,
          orderTags,
          p.picked ? 'yes' : 'no',
        ]);
      });
    });
  });
  downloadCSV(rows, `nursery-history-${new Date().toISOString().slice(0,10)}.csv`);
}

function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(cell => {
    const s = String(cell ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV exported');
}

/* ---------------- IMPORT/EXPORT ---------------- */
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nursery-ops-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Exported');
}

function importData() {
  $('#import-file').click();
}

function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const incoming = JSON.parse(ev.target.result);
      if (!incoming.products || !incoming.map) throw new Error('Invalid file');
      if (!confirm('Replace all current data with imported file?')) return;
      state = { ...emptyState(), ...incoming };
      toast('Imported');
      render();
    } catch (err) {
      toast('Import failed: ' + err.message, true);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function wipeData() {
  if (!confirm('WIPE ALL DATA? This cannot be undone.')) return;
  if (!confirm('Are you absolutely sure?')) return;
  state = emptyState();
  saveState();
  toast('Wiped');
  render();
}

function loadBuckJonesPreset() {
  if (!confirm('Replace the current map and inventory with the Buck Jones Nursery preset? Your orders and run history will be kept.')) return;
  state.map = defaultMap();
  state.products = defaultProducts(state.map);
  // Cancel any active run since the map/products just changed
  state.run = null;
  saveState();
  toast('Buck Jones preset loaded');
  render();
}

/* ---------------- EVENT WIRING ---------------- */
function init() {
  // tabs
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => setView(tab.dataset.view));
  });

  // run view
  $('#start-build-route').addEventListener('click', startBuildRoute);
  $('#complete-run').addEventListener('click', completeRun);
  $('#rebuild-route').addEventListener('click', () => {
    if (!confirm('Rebuild route from current orders? Picked progress will be cleared.')) return;
    startBuildRoute();
  });
  $('#reset-run').addEventListener('click', resetRun);

  // run view mode toggle (route vs by-order)
  $$('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      ui.runMode = btn.dataset.mode;
      renderRun();
    });
  });

  // history
  $('#export-history-csv').addEventListener('click', exportAllHistoryCSV);

  // orders
  $('#add-order-btn').addEventListener('click', () => openOrderModal());
  $('#bulk-import').addEventListener('click', handleBulkImport);

  // inventory
  $('#add-product-btn').addEventListener('click', () => openProductModal());
  $('#inv-search').addEventListener('input', e => {
    ui.invSearch = e.target.value;
    renderInventory();
  });

  // map
  $('#map-config-btn').addEventListener('click', () => {
    ui.mapMode = ui.mapMode === 'config' ? 'view' : 'config';
    $('#map-config-btn').textContent = ui.mapMode === 'config' ? 'DONE' : 'CONFIG';
    ui.selectedCellId = null;
    // Reset paint tool to default each time config mode is entered
    if (ui.mapMode === 'config') ui.paintTool = 'aisle';
    // Update tool button active states
    $$('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === ui.paintTool));
    renderMap();
  });

  // paint tool selection
  $$('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      ui.paintTool = btn.dataset.tool;
      $$('.tool-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderMapInfo();
    });
  });

  $('#clear-map').addEventListener('click', clearMap);

  // settings
  $('#reset-rules').addEventListener('click', () => {
    if (confirm('Reset machine rules to defaults?')) {
      state.machineRules = defaultRules();
      renderSettings();
    }
  });
  $('#apply-grid-size').addEventListener('click', applyGridSize);
  $('#export-data').addEventListener('click', exportData);
  $('#import-data').addEventListener('click', importData);
  $('#import-file').addEventListener('change', handleImportFile);
  $('#wipe-data').addEventListener('click', wipeData);
  $('#load-preset').addEventListener('click', loadBuckJonesPreset);

  // modal
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', e => {
    if (e.target.id === 'modal') closeModal();
  });

  // First-run seed
  if (!state.seenOnboard && state.products.length === 0) {
    seedSampleData();
    state.seenOnboard = true;
  }

  setView('run');

  // register service worker for offline
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed', err));
  }
}

function seedSampleData() {
  // On a fresh install, pre-load the Buck Jones Nursery inventory so users see a working app.
  // Products are linked to zones in the default map by label.
  state.products = defaultProducts(state.map);
}

document.addEventListener('DOMContentLoaded', init);
