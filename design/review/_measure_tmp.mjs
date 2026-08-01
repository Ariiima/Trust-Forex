import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:400,height:900}, deviceScaleFactor:1 });
await page.goto('http://localhost:5199/earning?sheet=history', { waitUntil:'networkidle' });
await page.waitForTimeout(600);
const res = await page.evaluate(() => {
  const c = document.createElement('canvas').getContext('2d');
  const out = [];
  const items = [['$100.00',12],['To: dvjdvojv...kvndiv',10],['dvjdvojv...kvndiv',10],['To:',10],['Jul 25, 2026',10],['19:56',10],['USDT',12],['TRC20',12]];
  for (const [t,s] of items) {
    c.font = `400 ${s}px Sora`;
    const m = c.measureText(t);
    out.push([JSON.stringify(t), s, +m.width.toFixed(2), 'lsb='+(-m.actualBoundingBoxLeft).toFixed(2), 'inkR='+m.actualBoundingBoxRight.toFixed(2)]);
  }
  return out;
});
for (const r of res) console.log(r.join('  '));
await browser.close();
