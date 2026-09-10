/* Build the blog: posts/*.md + categories.json → index.html, c/<category>/, p/<slug>/, editor/, posts.json.
     node design/landing/blog/build.mjs
   Every page is static HTML on cb8's system (the same nav, grounds, glass, holds and footer as the other landing
   pages); the index and category pages carry a small client script for filtering, sorting and "show more".
   Sources: categories.json, posts/, render.js, page.css, blog.js, editor.js. Everything else here is generated. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { render, parseFrontMatter, firstParagraph } from './render.js';

const BLOG = dirname(fileURLToPath(import.meta.url));
const LANDING = join(BLOG, '..');
const cats = JSON.parse(readFileSync(join(BLOG, 'categories.json'), 'utf8'));
const catById = Object.fromEntries(cats.map(c => [c.id, c]));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const digest = f => createHash('sha1').update(readFileSync(f)).digest('hex').slice(0, 8);
const V = { grounds: digest(join(LANDING, 'cb8/grounds.css')), style: digest(join(LANDING, 'cb8/style.css')), page: digest(join(BLOG, 'page.css')), main: digest(join(LANDING, 'cb8/main.js')), blog: digest(join(BLOG, 'blog.js')), editor: digest(join(BLOG, 'editor.js')), render: digest(join(BLOG, 'render.js')) };
const fmtDate = d => { const [y, m, day] = String(d).split('-').map(Number); return `${day} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`; };

/* ---- the posts ---- */
const posts = readdirSync(join(BLOG, 'posts')).filter(f => f.endsWith('.md')).map(f => {
  const { meta, body } = parseFrontMatter(readFileSync(join(BLOG, 'posts', f), 'utf8'));
  const r = render(body);
  const cat = catById[meta.category] || cats[cats.length - 1];
  return { ...meta, slug: meta.slug || f.replace(/\.md$/, ''), cat, html: r.html, toc: r.toc, minutes: Math.max(1, Math.round(r.words / 220)),
    excerpt: meta.excerpt || firstParagraph(body), date: String(meta.date || '1970-01-01'), author: meta.author || 'TrustForex', reads: +meta.reads || 0 };
}).filter(p => !p.draft).sort((a, b) => b.date.localeCompare(a.date));

/* ---- the nav, taken from cb8 so the pages never drift; hrefs re-rooted for the page's depth ---- */
const cb8 = readFileSync(join(LANDING, 'cb8/index.html'), 'utf8');
const NAV = /<header class="nav" id="nav">[\s\S]*?<\/header>/.exec(cb8)[0]
  .replace('<a href="#hero" aria-current="page">Cashback</a>', '<a href="../cb8/">Cashback</a>')
  .replace(/<a href="[^"]*">Blogs<\/a>/, '<a href="#hero" aria-current="page">Blogs</a>');
const nav = (rel, top = "hero") => NAV.replace(/href="\.\.\//g, `href="${rel}`).replace("href=\"#hero\"", `href="#${top}"`);

/* ---- the icons on the covers: one glyph per category, the Iconly file over it once pulled ---- */
const GLYPH = {
  analytics: '<path d="M4 20V4M4 20h16M8 16l4-5 3 3 5-6"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  'dollar-receive': '<circle cx="12" cy="12" r="9"/><path d="M12 6.5v11M14.8 9.2c0-1.1-1.2-1.9-2.8-1.9s-2.8.8-2.8 1.9c0 2.7 5.6 1 5.6 3.8 0 1.2-1.3 2-2.8 2s-2.8-.8-2.8-2"/>',
  send: '<path d="m21 4-7.5 16-3.8-6.1L4 10.7 21 4Z"/><path d="m9.7 13.9 4.2-3.8"/>',
  'shield-done': '<path d="M12 2.5 19 5v5.7c0 4.8-2.8 8.7-7 10.8-4.2-2.1-7-6-7-10.8V5l7-2.5Z"/><path d="m9 12 2.2 2.2L15 10"/>'
};
const ico = (name, rel, cls = '') => `<span class="ico ${cls}" data-lottie="${rel}cb8/ico/${name}.json" aria-hidden="true"><svg class="fb" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${GLYPH[name]}</svg></span>`;
const ray = k => `<div class="rayfield k ${k}" aria-hidden="true"><i></i><i></i><i></i><i></i></div>`;
const EXT = '<svg class="ext" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8 3.5 12.5 8 8 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PLACEHOLDER = Object.fromEntries(cats.map(c => [c.id, existsSync(join(BLOG, 'img', `${c.id}.jpg`))]));
const coverSrc = (p, rel) => p.cover || (PLACEHOLDER[p.cat.id] ? `${rel}blog/img/${p.cat.id}.jpg` : '');
const cover = (p, rel, cls = '') => { const src = coverSrc(p, rel);
  return `<div class="cover ${cls}">${ray(p.cat.ground)}${src ? `<img src="${esc(src)}" alt="" loading="lazy">` : ico(p.cat.icon, rel, 'cover-ico')}${cls.includes('cover-sm') ? '' : `<span class="read">${p.minutes} min read</span>`}</div>`; };
const initials = n => n.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const author = p => `<div class="author"><i>${initials(p.author)}</i><span>${esc(p.author)}</span></div>`;
const url = (p, rel) => `${rel}blog/p/${p.slug}/`;

const card = (p, rel, big = false) => `<article class="card${big ? ' card-big' : ''}" data-cat="${p.cat.id}" data-date="${p.date}" data-reads="${p.reads}">
  <a class="card-link" href="${url(p, rel)}">${cover(p, rel)}<div class="card-body"><span class="card-meta"><b>${esc(p.cat.name)}</b> · ${fmtDate(p.date)}</span><h3>${esc(p.title)}</h3><p>${esc(p.excerpt)}</p>${big ? author(p) : ''}</div></a></article>`;
const mini = (p, rel) => `<a class="mini" href="${url(p, rel)}"><div><b>${esc(p.title)}</b><span>${esc(p.author)} · ${p.minutes} min read</span></div>${cover(p, rel, 'cover-sm')}</a>`;

/* ---- the shell every page shares ---- */
const FAVICON = /<link rel="icon"[^>]*>/.exec(cb8)[0];
const LIQUID = /<svg id="liquid-svg"[\s\S]*?<\/svg>/.exec(cb8)[0];
const footer = rel => `<footer class="footer"><div class="wrap"><div class="footer-row"><div>TrustForex</div>
  <nav aria-label="Footer"><a href="https://trustforex.net/">Home</a><a href="${rel}results/">Results</a><a href="${rel}cb8/">Cashback</a><a href="${rel}referral/">Referral</a><a href="${rel}about/">About</a><a href="${rel}partnership/">Broker Partnership</a><a href="${rel}blog/">Blog</a><a href="#">Terms</a><a href="#">Privacy</a><a href="#">Risk Disclosure</a></nav>
  <div class="social"><a href="#" aria-label="Telegram"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 4 3 11l5 2 2 6 3-4 5 4 3-15Z"/></svg></a><a href="#" aria-label="Instagram"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r=".9"/></svg></a></div>
</div></div></footer>`;
const final = rel => `<section class="screen footer-only" id="final" data-name="Footer">${footer(rel)}</section>`;
const shell = ({ rel, title, desc, body, extraHead = '', scripts = '', top = 'hero' }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="preload" href="${rel}shared/fonts/Inter-VF.woff2" as="font" type="font/woff2" crossorigin>
${FAVICON}
<link rel="stylesheet" href="${rel}cb8/grounds.css?v=${V.grounds}">
<link rel="stylesheet" href="${rel}cb8/style.css?v=${V.style}">
<link rel="stylesheet" href="${rel}blog/page.css?v=${V.page}">${extraHead}
</head>
<body>
${LIQUID}
${nav(rel, top)}
<div id="rail" role="navigation" aria-label="Page sections"></div>
<main id="deck">
${body}
</main>
<button class="to-top" id="toTop" type="button" aria-label="Back to top"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
<script src="${rel}cb8/ico/lottie_light.min.js"></script>
<script src="${rel}cb8/main.js?v=${V.main}"></script>
${scripts}
<script>if (document.documentElement.classList.contains('reduce')) document.getElementById('liquid-svg').pauseAnimations();</script>
</body>
</html>
`;

/* ---- the listing page: the chips, the grid, "From the Blog" ---- */
const chips = (rel, current) => `<div class="chips" role="list"><a class="chip" role="listitem" href="${rel}blog/" data-cat="all"${current === 'all' ? ' aria-current="true"' : ''}>All</a>${cats.map(c => `<a class="chip" role="listitem" href="${rel}blog/c/${c.id}/" data-cat="${c.id}"${current === c.id ? ' aria-current="true"' : ''}>${esc(c.name)}</a>`).join('')}</div>`;
const fromBlog = rel => {
  const featured = posts.filter(p => p.featured).slice(0, 2); while (featured.length < 2 && posts[featured.length]) if (!featured.includes(posts[featured.length])) featured.push(posts[featured.length]); else break;
  const popular = [...posts].sort((a, b) => b.reads - a.reads).slice(0, 4);
  if (!posts.length) return '';
  return `<section class="screen" id="from-blog" data-name="From the Blog" aria-labelledby="fb-h"><div class="wrap">
  <h2 class="h2 words" id="fb-h">From the Blog</h2>
  <div class="fb-grid rv" style="--i:1">${featured.map(p => card(p, rel, true)).join('')}<aside class="fb-popular" aria-label="Most popular">${popular.map(p => mini(p, rel)).join('')}</aside></div>
</div></section>`;
};
const listing = ({ rel, list, current, heading, blurb, title, desc }) => {
  const grid = `<section class="screen" id="posts" data-name="Posts" aria-labelledby="posts-h"><div class="wrap">
  <div class="posts-head"><h1 class="h2 words" id="posts-h">${esc(heading)}</h1>
    <div class="posts-tools rv" style="--i:1">${chips(rel, current)}<div class="field well sort-well"><label for="sort">Sort</label><select id="sort"><option value="new">Newest</option><option value="old">Oldest</option><option value="reads">Most read</option></select></div></div></div>
  ${list.length ? `<div class="post-grid rv" id="grid" style="--i:2">${list.map(p => card(p, rel)).join('')}</div><button class="btn more" id="more" type="button" hidden>Show more</button>` : `<p class="copy rv" style="--i:2">No posts in this category yet.</p>`}
</div></section>`;
  return shell({ rel, title, desc, top: 'posts', body: grid + fromBlog(rel) + final(rel), scripts: `<script src="${rel}blog/blog.js?v=${V.blog}"></script>` });
};

/* ---- the post page ---- */
const postPage = p => {
  const rel = '../../../';
  const related = posts.filter(o => o !== p && o.cat === p.cat).concat(posts.filter(o => o !== p && o.cat !== p.cat)).slice(0, 3);
  const body = `<section class="screen screen-dark on-dark" id="hero" data-name="Post" aria-labelledby="h1">${ray(p.cat.ground)}
  <div class="wrap post-hero"><a class="chip rv" href="${rel}blog/c/${p.cat.id}/">${esc(p.cat.name)}</a>
    <h1 class="display words" id="h1">${esc(p.title)}</h1>
    <p class="post-meta rv" style="--i:1"><span>${fmtDate(p.date)}</span><span>${esc(p.author)}</span><span>${p.minutes} min read</span></p></div></section>
<section class="screen story" id="article" data-name="Article"><div class="wrap post-layout">
  <aside class="post-aside rv">${p.toc.length ? `<nav class="toc" aria-label="On this page"><b>On this page</b>${p.toc.map(t => `<a href="#${t.id}">${esc(t.text)}</a>`).join('')}</nav>` : ''}
    <button class="btn copy-link" type="button" data-url="https://trustforex.net/v/landing/blog/p/${p.slug}/">Copy link</button></aside>
  <article class="article rv" style="--i:1">${p.html}</article>
</div></section>
${related.length ? `<section class="screen" id="related" data-name="More" aria-labelledby="rel-h"><div class="wrap"><h2 class="h2 words" id="rel-h">${related[0].cat === p.cat ? `More in ${esc(p.cat.name)}` : 'More from the Blog'}</h2><div class="post-grid rv" style="--i:1">${related.map(o => card(o, rel)).join('')}</div></div></section>` : ''}
${final(rel)}`;
  return shell({ rel, title: `${p.title} — TrustForex Blog`, desc: p.excerpt, body, scripts: `<script src="${rel}blog/blog.js?v=${V.blog}"></script>` });
};

/* ---- the writer's editor ---- */
const editorPage = () => {
  const rel = '../../';
  const body = `<section class="screen story" id="editor" data-name="Editor" aria-labelledby="h1"><div class="wrap">
  <div class="ed-head"><div><h1 class="h2" id="h1">Write a post</h1><p class="copy">Fill the fields, write in Markdown, use the buttons for the theme's blocks. The preview on the right is the post as it ships. Download the .md into <code>design/landing/blog/posts/</code> and run the build.</p></div>
    <div class="ed-actions"><button class="btn btn-solid" type="button" id="download">Download .md</button><button class="btn" type="button" id="copy">Copy .md</button><label class="btn">Import .md<input type="file" id="import" accept=".md,text/markdown" hidden></label><button class="btn" type="button" id="clear">Clear draft</button></div></div>
  <div class="editor">
    <form class="ed-form" novalidate>
      <div class="field"><label for="title">Title</label><input id="title" type="text" placeholder="Four fixed targets define every signal"></div>
      <div class="ed-row"><div class="field"><label for="slug">Slug (URL)</label><input id="slug" type="text" placeholder="four-fixed-targets"></div><div class="field"><label for="category">Category</label><select id="category">${cats.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div></div>
      <div class="ed-row"><div class="field"><label for="date">Date</label><input id="date" type="date"></div><div class="field"><label for="author">Author</label><input id="author" type="text" value="TrustForex"></div></div>
      <div class="field"><label for="excerpt">Excerpt (the card and the page description)</label><input id="excerpt" type="text" placeholder="One sentence that says what the post is."></div>
      <div class="ed-row"><div class="field"><label for="cover">Cover image URL (optional — the category ground otherwise)</label><input id="cover" type="url" placeholder="https://…/cover.webp"></div><div class="field"><label for="reads">Reads (ranks Most popular)</label><input id="reads" type="number" min="0" value="0"></div></div>
      <label class="ed-check"><input id="featured" type="checkbox"> Featured — one of the two large cards in “From the Blog”</label>
      <div class="field"><label for="body">Body</label>
        <div class="ed-toolbar" aria-label="Insert a block">
          <button type="button" data-snip="h2">Heading</button><button type="button" data-snip="h2blue">Blue heading</button><button type="button" data-snip="bold">Bold</button><button type="button" data-snip="link">Link</button><button type="button" data-snip="image">Image</button><button type="button" data-snip="list">List</button>
          <button type="button" data-snip="glass">Glass box</button><button type="button" data-snip="blue">Blue block</button><button type="button" data-snip="pane">Glass pane on blue</button>
          <button type="button" data-snip="info">Callout · info</button><button type="button" data-snip="success">Callout · success</button><button type="button" data-snip="warning">Callout · warning</button>
          <button type="button" data-snip="quote">Quote</button><button type="button" data-snip="stats">Figures</button><button type="button" data-snip="steps">Steps</button><button type="button" data-snip="table">Table</button><button type="button" data-snip="cta">CTA</button>
        </div>
        <textarea id="body" spellcheck="true" placeholder="## Start with a heading&#10;&#10;Then write."></textarea></div>
    </form>
    <div class="ed-preview">
      <div class="pv-hero on-dark">${ray('k03')}<div class="pv-hero-in"><span class="chip" id="pv-cat">Category</span><h2 class="display" id="pv-title">Untitled</h2><p class="post-meta" id="pv-meta"></p></div></div>
      <div class="post-layout pv-layout"><aside class="post-aside"><nav class="toc" aria-label="On this page"><b>On this page</b><div id="pv-toc"></div></nav></aside><article class="article" id="pv-body"></article></div>
    </div>
  </div>
</div></section>`;
  return shell({ rel, title: 'Write a post — TrustForex Blog', desc: 'The blog editor.', top: 'editor', body, scripts: `<script type="module" src="${rel}blog/editor.js?v=${V.editor}"></script>` });
};

/* ---- write everything ---- */
for (const d of ['c', 'p']) if (existsSync(join(BLOG, d))) rmSync(join(BLOG, d), { recursive: true });
writeFileSync(join(BLOG, 'index.html'), listing({ rel: '../', list: posts, current: 'all', heading: 'Blog', blurb: 'Notes on how the record is kept: signals, results, Cashback, Referral and the decisions behind them.', title: 'TrustForex Blog', desc: 'Notes on how the TrustForex record is kept — signals, results, Cashback, Referral and the decisions behind them.' }));
for (const c of cats) {
  mkdirSync(join(BLOG, 'c', c.id), { recursive: true });
  writeFileSync(join(BLOG, 'c', c.id, 'index.html'), listing({ rel: '../../../', list: posts.filter(p => p.cat === c), current: c.id, heading: c.name, blurb: c.blurb, title: `${c.name} — TrustForex Blog`, desc: c.blurb }));
}
for (const p of posts) { mkdirSync(join(BLOG, 'p', p.slug), { recursive: true }); writeFileSync(join(BLOG, 'p', p.slug, 'index.html'), postPage(p)); }
mkdirSync(join(BLOG, 'editor'), { recursive: true });
writeFileSync(join(BLOG, 'editor', 'index.html'), editorPage());
writeFileSync(join(BLOG, 'posts.json'), JSON.stringify(posts.map(p => ({ slug: p.slug, title: p.title, category: p.cat.id, date: p.date, author: p.author, excerpt: p.excerpt, minutes: p.minutes, reads: p.reads, featured: !!p.featured, url: `/v/landing/blog/p/${p.slug}/` })), null, 1));
console.log(`blog built: ${posts.length} posts, ${cats.length} categories → index, c/*, p/*, editor, posts.json`);
