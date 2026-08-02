// Render every pack icon at a given size/colour so a design crop can be matched
// against the lot by pixels.
//
//   node design/icons/match.mjs <px> <fg> <bg> [strokeWidth]
//   node design/icons/match.mjs 20 "#ffffff" "#2a5fd4"
//
// Writes /tmp/fig/sheet.png plus /tmp/fig/sheet-index.json (names, cols, cell).
// score.py does the comparison. Cells are square and 2x the icon size so
// neighbours cannot bleed into a crop.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const [px = '20', fg = '#ffffff', bg = '#2a5fd4', sw = '2'] = process.argv.slice(2);
const SIZE = Number(px);
const CELL = SIZE * 2;
const COLS = 20;

const PACK = JSON.parse(readFileSync('design/review/icon-pack.json', 'utf8'));
const names = Object.keys(PACK).sort();

const cells = names
  .map((n) => {
    const g = PACK[n];
    const paint = g.fill ? 'fill="currentColor" fill-rule="evenodd"' : '';
    const paths = g.d.map((d) => `<path d="${d}" ${paint}/>`).join('');
    return `<i><svg viewBox="${g.box ?? '16 16 24 24'}" width="${SIZE}" height="${SIZE}" fill="none"
      stroke="${g.fill ? 'none' : 'currentColor'}" stroke-width="${sw}"
      stroke-linecap="round" stroke-linejoin="round">${paths}</svg></i>`;
  })
  .join('');

writeFileSync(
  '/tmp/fig/sheet.html',
  `<!doctype html><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:${bg}}
    #g{display:grid;grid-template-columns:repeat(${COLS},${CELL}px);width:${COLS * CELL}px}
    i{width:${CELL}px;height:${CELL}px;display:flex;align-items:center;justify-content:center;color:${fg}}
    svg{display:block}
  </style><div id="g">${cells}</div>`,
);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: COLS * CELL, height: Math.ceil(names.length / COLS) * CELL },
  deviceScaleFactor: 1,
});
await page.goto('file:///tmp/fig/sheet.html');
await page.locator('#g').screenshot({ path: '/tmp/fig/sheet.png' });
await browser.close();

writeFileSync('/tmp/fig/sheet-index.json', JSON.stringify({ names, cols: COLS, cell: CELL, size: SIZE }));
console.log(`${names.length} icons at ${SIZE}px on ${bg} -> /tmp/fig/sheet.png`);
