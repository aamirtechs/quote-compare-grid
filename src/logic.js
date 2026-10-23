"use strict";
// Quote Compare Grid: core logic. Pure functions, no DOM, no fetch.

function num(v) {
  const n = Number(String(v == null ? "" : v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

// Parse pasted spreadsheet rows (TSV or CSV) for one supplier.
// Expected columns: item, pack price, pack size, unit, MOQ, lead days, delivery.
// Header row is detected and skipped.
function parseQuotePaste(text) {
  const lines = [];
  const errors = [];
  String(text || "").split(/\r?\n/).forEach((raw, i) => {
    const t = raw.trim();
    if (!t) return;
    const parts = t.split(/\t|,/).map((x) => x.trim());
    if (/item/i.test(parts[0]) && /price/i.test(parts[1] || "")) return; // header
    if (parts.length < 2 || !parts[0]) { errors.push("Line " + (i + 1) + ": needs at least item and pack price"); return; }
    lines.push({
      item: parts[0],
      packPrice: num(parts[1]),
      packSize: num(parts[2]) || 1,
      unit: parts[3] || "each",
      moq: num(parts[4]),
      leadDays: num(parts[5]),
      delivery: num(parts[6])
    });
  });
  return { lines, errors };
}

// Normalise one quote line: price per single unit.
function normaliseLine(line) {
  const packSize = line.packSize > 0 ? line.packSize : 1;
  const perUnit = line.packPrice / packSize;
  return { ...line, packSize, perUnit: Math.round(perUnit * 10000) / 10000 };
}

// MOQ feasibility for a target quantity: packs needed, units bought, feasible.
function packsFor(line, targetQty) {
  const packSize = line.packSize > 0 ? line.packSize : 1;
  const minUnits = Math.max(targetQty || 0, line.moq || 0);
  const packs = Math.ceil(minUnits / packSize);
  return { packs, units: packs * packSize, meetsMoq: (line.moq || 0) <= Math.max(targetQty || 0, line.moq || 0) };
}

// Landed total for a target quantity: packs x pack price + delivery.
function landedTotal(line, targetQty) {
  const { packs } = packsFor(line, targetQty);
  return Math.round((packs * line.packPrice + (line.delivery || 0)) * 100) / 100;
}

// Build the comparison grid. quotes: [{ supplier, lines: [...] }].
// Items are matched across suppliers by normalised item name.
// A line is "comparable" for an item only if every supplier quoting it uses
// the same unit; otherwise the row is flagged non-comparable.
function buildGrid(quotes, targetQty) {
  const itemMap = new Map();
  quotes.forEach((q, qi) => {
    (q.lines || []).forEach((raw) => {
      const line = normaliseLine(raw);
      const key = line.item.trim().toLowerCase();
      if (!itemMap.has(key)) itemMap.set(key, { item: line.item, offers: {} });
      itemMap.get(key).offers[qi] = { ...line, supplier: q.supplier, landed: landedTotal(line, targetQty), packs: packsFor(line, targetQty) };
    });
  });
  const rows = [];
  itemMap.forEach((entry) => {
    const offers = Object.values(entry.offers);
    const units = new Set(offers.map((o) => String(o.unit).trim().toLowerCase()));
    const comparable = units.size <= 1;
    let bestIdx = null;
    if (comparable && offers.length) {
      let best = null;
      offers.forEach((o) => { if (best === null || o.perUnit < best.perUnit) best = o; });
      bestIdx = best ? quotes.findIndex((q) => q.supplier === best.supplier) : null;
    }
    rows.push({
      item: entry.item,
      comparable,
      unitNote: comparable ? (offers[0] ? offers[0].unit : "") : "units differ: " + Array.from(units).join(" vs "),
      offers: entry.offers,
      bestSupplierIdx: bestIdx
    });
  });
  rows.sort((a, b) => a.item.localeCompare(b.item));
  return rows;
}

// Totals per supplier: sum of landed totals across items that supplier quotes.
function supplierTotals(grid, supplierCount) {
  const totals = new Array(supplierCount).fill(0);
  const counts = new Array(supplierCount).fill(0);
  grid.forEach((row) => {
    Object.keys(row.offers).forEach((qi) => {
      totals[qi] += row.offers[qi].landed;
      counts[qi]++;
    });
  });
  return totals.map((t, i) => ({ supplierIdx: i, landedTotal: Math.round(t * 100) / 100, itemsQuoted: counts[i] }));
}

function csvEscape(value) {
  const s = String(value == null ? "" : value);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function buildGridCSV(grid, quotes, targetQty) {
  const header = ["item", "comparable", "notes"];
  quotes.forEach((q) => {
    header.push(q.supplier + " per-unit", q.supplier + " pack price", q.supplier + " pack size", q.supplier + " MOQ", q.supplier + " lead days", q.supplier + " landed for " + targetQty);
  });
  header.push("best supplier");
  const rows = [header];
  grid.forEach((row) => {
    const out = [row.item, row.comparable ? "yes" : "NO", row.comparable ? "" : row.unitNote];
    quotes.forEach((q, qi) => {
      const o = row.offers[qi];
      if (o) out.push(o.perUnit, o.packPrice, o.packSize, o.moq, o.leadDays, o.landed);
      else out.push("", "", "", "", "", "");
    });
    out.push(row.bestSupplierIdx == null ? "" : quotes[row.bestSupplierIdx].supplier);
    rows.push(out);
  });
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n") + "\n";
}

const api = { num, parseQuotePaste, normaliseLine, packsFor, landedTotal, buildGrid, supplierTotals, buildGridCSV, csvEscape };
if (typeof module !== "undefined" && module.exports) { module.exports = api; }
if (typeof window !== "undefined") { window.QuoteCompareGrid = api; }
