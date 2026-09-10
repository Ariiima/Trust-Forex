// Tile a shoot's desktop frames into one sheet, so a whole build can be reviewed in one look.
import { chromium } from 'playwright';
import { readdirSync, readFileSync } from 'node:fs';
const [dir, out, prefix = 'd'] = process.argv.slice(2);
const files = readdirSync(dir).filter(f => f.startsWith(prefix + '-') && f.endsWith('.png')).sort();
const names = ['Hero','Facts','Meaning','Chapter 1','01 Broker','02 Share','03 Activity','04 Control','Calculator','Chapter 2','Activation','FAQ','Final + footer'];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1520, height: 1000 } });
await p.setContent(`<style>body{margin:0;background:#20242c;color:#fff;font:500 12px ui-monospace,monospace}
.g{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px}
.t{position:relative;border-radius:8px;overflow:hidden}
.t img{width:100%;display:block}
.t span{position:absolute;left:8px;top:8px;background:#000b;padding:5px 9px;border-radius:6px;letter-spacing:.06em}</style>
<div class="g">${files.map((f, i) => `<div class="t"><span>${String(i+1).padStart(2,'0')} · ${names[i]||''}</span><img src="data:image/png;base64,${readFileSync(dir + '/' + f).toString('base64')}"></div>`).join('')}</div>`);
await p.waitForTimeout(1200);
const h = await p.evaluate(() => document.body.scrollHeight);
await p.setViewportSize({ width: 1520, height: Math.min(h, 6000) });
await p.waitForTimeout(400);
await p.screenshot({ path: out, fullPage: true });
await b.close();
console.log('tiled', files.length);
