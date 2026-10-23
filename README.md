# Quote Compare Grid
Live page: https://aamirtechs.github.io/quote-compare-grid/

Supplier quotes arrive as mismatched spreadsheets: one prices per pack, another per unit, a third hides a minimum order quantity, and comparing them takes an afternoon. Quote Compare Grid normalises every quote to a per-unit price, works out the landed total for the quantity you actually need, and flags the lines that are not comparable at all.

## Features
- Grid entry for up to three suppliers, plus paste-from-spreadsheet (TSV) rows
- Per-unit price normalisation by pack size and unit
- MOQ and lead-time columns with best-per-row highlighting
- Landed total for a target quantity, including delivery charges
- Non-comparable line flags, grid CSV export and a printable summary

## How it works
Paste each supplier's rows in a fixed column order, set a target quantity, and run the comparison. Prices are normalised per unit, packs are rounded up against MOQs, delivery is added for landed totals, and rows quoted in mismatched units are flagged instead of mis-ranked. It runs entirely in the browser.

## Privacy
Runs 100% in your browser. Your files never leave this device, nothing is uploaded,
and there is no tracking.

## Development
Core logic lives in `src/logic.js` and is shared by the page and the tests.
Run the tests with `npm test`.

## License
MIT, Copyright 2026 Amir Hussain.
