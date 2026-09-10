/* The placeholder covers. Neutral, abstract, brand-adjacent — soft light over the blue-grey family,
   no type, no marks — so a real photograph can replace any one of them without touching the layout.
   One file per category id in categories.json.   node design/landing/blog/img/make.mjs
   Rendered rather than drawn by hand so the set stays consistent when a category is added. */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const cats = JSON.parse(readFileSync(join(HERE, '..', 'categories.json'), 'utf8'));
const W = 1200, H = 750;

/* each category takes one hue and one light direction, so the five read as a set and never as a repeat */
const LOOK = {
  signals:  { a: '#1b3f9e', b: '#0b1f4f', c: '#4f8bff', x: '22%', y: '28%' },
  records:  { a: '#17356f', b: '#0a1836', c: '#6ea2ff', x: '74%', y: '22%' },
  cashback: { a: '#123a86', b: '#08203f', c: '#57c7c0', x: '30%', y: '74%' },
  referral: { a: '#22347f', b: '#0d1a3e', c: '#8a7cff', x: '70%', y: '70%' },
  company:  { a: '#14295c', b: '#070f26', c: '#9fb6d9', x: '50%', y: '35%' }
};

const page = (k) => {
  const L = LOOK[k] || LOOK.company;
  const fx = 100 - parseInt(L.x), fy = 100 - parseInt(L.y);
  return `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;background:${L.b}}
  .f{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:
      radial-gradient(70% 60% at ${L.x} ${L.y}, ${L.c}66, transparent 60%),
      radial-gradient(80% 70% at ${fx}% ${fy}%, ${L.a}dd, transparent 68%),
      linear-gradient(155deg, ${L.a}, ${L.b} 92%)}
  .f *{position:absolute;display:block}
  /* the light: three long bars across the frame, blurred until only their travel is left */
  .b1,.b2,.b3{height:170%;top:-35%;filter:blur(34px);transform-origin:center}
  .b1{width:96px;left:6%;background:linear-gradient(180deg,transparent,${L.c},transparent);opacity:.62;transform:rotate(22deg)}
  .b2{width:210px;left:50%;background:linear-gradient(180deg,transparent,#fff,transparent);opacity:.20;transform:rotate(22deg)}
  .b3{width:54px;left:79%;background:linear-gradient(180deg,transparent,#fff,transparent);opacity:.34;transform:rotate(22deg)}
  /* the depth: three out-of-focus rounds, the near one clipped by the frame */
  .o1,.o2,.o3{border-radius:50%;filter:blur(60px)}
  .o1{width:560px;height:560px;left:-9%;top:-24%;background:${L.c};opacity:.52}
  .o2{width:420px;height:420px;right:-8%;bottom:-22%;background:#fff;opacity:.10}
  .o3{width:230px;height:230px;left:58%;top:16%;background:${L.c};opacity:.24}
  /* the ground the brand keeps: the survey grid, faded off at the edges */
  .g{inset:0;background:
      repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 1px, transparent 1px 72px),
      repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 1px, transparent 1px 72px);
      -webkit-mask-image:radial-gradient(78% 68% at 50% 42%, #000, transparent 76%);
      mask-image:radial-gradient(78% 68% at 50% 42%, #000, transparent 76%)}
  .v{inset:0;box-shadow:inset 0 0 170px 44px rgba(3,10,28,.42)}
  /* the grain, so the frame holds a photograph~s texture and not a flat fill */
  .n{inset:-50%;width:200%;height:200%;opacity:.30;background-image:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27300%27 height=%27300%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.75%27 numOctaves=%273%27 stitchTiles=%27stitch%27/%3E%3CfeColorMatrix type=%27saturate%27 values=%270%27/%3E%3C/filter%3E%3Crect width=%27300%27 height=%27300%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")}
  </style><div class="f"><i class="o1"></i><i class="o2"></i><i class="o3"></i><i class="b1"></i><i class="b2"></i><i class="b3"></i><i class="g"></i><i class="v"></i><i class="n"></i></div>`;
};

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
for (const c of cats) {
  await pg.setContent(page(c.id), { waitUntil: 'load' });
  const shot = await pg.locator('.f').screenshot({ type: 'jpeg', quality: 82 });
  writeFileSync(join(HERE, `${c.id}.jpg`), shot);
  console.log(`${c.id}.jpg  ${(shot.length / 1024).toFixed(0)} KB`);
}
await b.close();
