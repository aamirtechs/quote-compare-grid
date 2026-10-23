"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../src/logic.js");

test("parseQuotePaste parses TSV rows and skips a header", () => {
  const text = "item\tpack price\tpack size\tunit\tmoq\tlead days\tdelivery\nCopy paper A4\t24\t500\tsheet\t1000\t5\t0\n";
  const { lines, errors } = L.parseQuotePaste(text);
  assert.equal(errors.length, 0);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].packPrice, 24);
  assert.equal(lines[0].packSize, 500);
});

test("normaliseLine converts a pack price to a per-unit price", () => {
  const n = L.normaliseLine({ item: "Paper", packPrice: 24, packSize: 500, unit: "sheet" });
  assert.equal(n.perUnit, 0.048);
});

test("packsFor rounds up to whole packs and respects the MOQ", () => {
  const p = L.packsFor({ packSize: 500, moq: 2000 }, 1200);
  assert.equal(p.packs, 4); // MOQ 2000 beats the 1200 target
  assert.equal(p.units, 2000);
  const p2 = L.packsFor({ packSize: 500, moq: 0 }, 1200);
  assert.equal(p2.packs, 3);
  assert.equal(p2.units, 1500);
});

test("landedTotal adds delivery to the pack cost", () => {
  const total = L.landedTotal({ packPrice: 24, packSize: 500, moq: 0, delivery: 15 }, 1200);
  assert.equal(total, 3 * 24 + 15);
});

const QUOTES = [
  { supplier: "Alpha", lines: [
    { item: "Copy paper A4", packPrice: 24, packSize: 500, unit: "sheet", moq: 0, leadDays: 5, delivery: 0 },
    { item: "Toner cartridge", packPrice: 40, packSize: 1, unit: "each", moq: 2, leadDays: 3, delivery: 5 }
  ]},
  { supplier: "Beta", lines: [
    { item: "Copy paper A4", packPrice: 5, packSize: 100, unit: "sheet", moq: 0, leadDays: 7, delivery: 10 },
    { item: "Toner cartridge", packPrice: 38, packSize: 1, unit: "each", moq: 1, leadDays: 2, delivery: 0 }
  ]},
  { supplier: "Gamma", lines: [
    { item: "Copy paper A4", packPrice: 30, packSize: 1, unit: "ream", moq: 0, leadDays: 4, delivery: 0 }
  ]}
];

test("buildGrid picks the cheapest comparable per-unit price", () => {
  const grid = L.buildGrid(QUOTES, 1000);
  const toner = grid.find((r) => r.item === "Toner cartridge");
  assert.equal(toner.comparable, true);
  assert.equal(QUOTES[toner.bestSupplierIdx].supplier, "Beta");
});

test("buildGrid flags rows whose units differ as non-comparable", () => {
  const grid = L.buildGrid(QUOTES, 1000);
  const paper = grid.find((r) => r.item === "Copy paper A4");
  assert.equal(paper.comparable, false); // sheet vs ream
  assert.equal(paper.bestSupplierIdx, null);
  assert.ok(paper.unitNote.includes("ream"));
});

test("supplierTotals sums landed totals per supplier", () => {
  const grid = L.buildGrid(QUOTES, 1000);
  const totals = L.supplierTotals(grid, 3);
  // Alpha: paper 2 packs x 24 = 48; toner 1000 x 40 + 5 = 40005
  assert.equal(totals[0].landedTotal, 48 + 40005);
  assert.equal(totals[0].itemsQuoted, 2);
  assert.equal(totals[2].itemsQuoted, 1);
});

test("buildGridCSV includes per-supplier columns and the best supplier", () => {
  const grid = L.buildGrid(QUOTES, 1000);
  const csv = L.buildGridCSV(grid, QUOTES, 1000);
  assert.ok(csv.includes("Alpha per-unit"));
  assert.ok(csv.includes("Toner cartridge"));
  const tonerLine = csv.split("\n").find((l) => l.startsWith("Toner"));
  assert.ok(tonerLine.endsWith("Beta"));
});
