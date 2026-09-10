/* The blog's one renderer: a Markdown subset plus the theme's own blocks, as ES module — build.mjs runs it in
   node to write the pages, editor.js runs it in the browser for the live preview, so what the writer sees is what
   ships. Posts are written in our editor, so the subset is deliberate: headings, paragraphs, bold/italic/code,
   links, images, lists, quotes, rules, fenced code, pipe tables — and the `:::` blocks (see README.md). */

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const slugify = s => String(s).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/* ---- front matter: `key: value` lines between two `---` rules ---- */
export function parseFrontMatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':'); if (i < 0) continue;
    const k = line.slice(0, i).trim(); let v = line.slice(i + 1).trim();
    if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^\d+$/.test(v)) v = +v;
    meta[k] = v;
  }
  return { meta, body: m[2] };
}
export function serializeFrontMatter(meta, body) {
  const lines = Object.entries(meta).filter(([, v]) => v !== '' && v !== false && v != null).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join('\n')}\n---\n\n${body.trim()}\n`;
}

/* ---- inline marks ---- */
function inline(s) {
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, a, src) => `<img src="${src}" alt="${a}" loading="lazy">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}"${/^https?:/.test(u) ? ' rel="noopener"' : ''}>${t}</a>`);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*]+)\*(?!\w)/g, '$1<em>$2</em>');
  return s;
}
export const plain = s => esc(String(s)).replace(/[*_`]/g, '').replace(/!\[([^\]]*)\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

/* the theme's icons for callouts: one fallback glyph per state, the Iconly file plays over it once pulled */
const ICO = {
  info: '<svg class="fb" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.2"/></svg>',
  success: '<svg class="fb" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>',
  warning: '<svg class="fb" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 21 19.5H3L12 3.5Z"/><path d="M12 10v4M12 16.5v.2"/></svg>',
  danger: '<svg class="fb" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/></svg>'
};
const RAY = k => `<div class="rayfield k ${k}" aria-hidden="true"><i></i><i></i><i></i><i></i></div>`;
const EXT = '<svg class="ext" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8 3.5 12.5 8 8 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ---- blocks ---- */
export function render(md) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const out = [], toc = [], stack = [], ids = new Set();
  let words = 0, i = 0;
  const count = s => { words += s.split(/\s+/).filter(Boolean).length; };
  const para = buf => { if (buf.length) { const t = buf.join(' '); count(t); out.push(`<p>${inline(t)}</p>`); buf.length = 0; } };
  const uid = t => { let id = slugify(plain(t)) || 'section', n = 1; while (ids.has(id)) id = `${slugify(plain(t))}-${++n}`; ids.add(id); return id; };
  const buf = [];
  while (i < lines.length) {
    const line = lines[i];
    // fenced code
    if (/^```/.test(line)) { para(buf); const code = []; i++; while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]); i++; out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); continue; }
    // the theme's blocks
    let m;
    if ((m = /^:::\s*(\w+)?\s*(.*)$/.exec(line))) {
      para(buf);
      if (!m[1]) { const top = stack.pop(); if (top) out.push(top.close); i++; continue; }
      const kind = m[1], arg = m[2].trim();
      if (kind === 'glass') { stack.push({ close: '</div>' }); out.push('<div class="md-glass">'); }
      else if (kind === 'blue') { stack.push({ close: '</div></div>' }); out.push(`<div class="md-blue">${RAY('k03')}<div class="md-blue-in">`); }
      else if (kind === 'pane') { stack.push({ close: '</div></div>' }); out.push(`<div class="md-blue glass">${RAY('k09')}<div class="md-pane">`); }
      else if (kind === 'callout') { const [, tone = 'info', title = ''] = /^(info|success|warning|danger)?\s*(.*)$/.exec(arg) || []; const t = ICO[tone] ? tone : 'info';
        stack.push({ close: '</div></aside>' }); out.push(`<aside class="md-callout is-${t}"><span class="ico" data-lottie="../../../cb8/ico/${t === 'success' ? 'tick-circle' : t === 'warning' ? 'danger' : t === 'danger' ? 'close-circle' : 'info-circle'}.json" aria-hidden="true">${ICO[t]}</span><div>${title ? `<b class="md-callout-title">${inline(title)}</b>` : ''}`); }
      else if (kind === 'quote') { stack.push({ close: '</blockquote></figure>', quote: true }); out.push('<figure class="md-quote"><blockquote>'); }
      else if (kind === 'stats') { const rows = []; i++; while (i < lines.length && !/^:::/.test(lines[i])) { if (lines[i].trim()) rows.push(lines[i].split('|').map(s => s.trim())); i++; } i++;
        out.push(`<div class="md-stats">${rows.map(([l = '', v = '', n = '']) => `<div class="md-stat"><small>${inline(l)}</small><strong>${inline(v)}</strong>${n ? `<span>${inline(n)}</span>` : ''}</div>`).join('')}</div>`); continue; }
      else if (kind === 'steps') { const rows = []; i++; while (i < lines.length && !/^:::/.test(lines[i])) { if (lines[i].trim()) rows.push(lines[i].replace(/^\s*(?:\d+\.|-)\s*/, '')); i++; } i++;
        out.push(`<ol class="path md-steps">${rows.map((r, n) => `<li class="pstep${n === rows.length - 1 ? ' last' : ''}"><span class="pnum">${String(n + 1).padStart(2, '0')}</span> <b>${inline(r)}</b></li>`).join('')}</ol>`); continue; }
      else if (kind === 'cta') { const [label = 'Open the App', url = 'https://app.trustforex.net'] = arg.split('|').map(s => s.trim());
        stack.push({ close: `<a class="btn btn-solid" href="${esc(url)}" rel="noopener">${inline(label)} ${EXT}</a></div></div>` }); out.push(`<div class="md-blue md-cta on-dark">${RAY('k01')}<div class="md-blue-in">`); }
      else { stack.push({ close: '</div>' }); out.push(`<div class="md-${esc(kind)}">`); }
      i++; continue;
    }
    // quote attribution inside :::quote
    if (stack.length && stack[stack.length - 1].quote && /^[—-]\s+/.test(line)) { para(buf); const top = stack.pop(); out.push(`</blockquote><figcaption>${inline(line.replace(/^[—-]\s+/, ''))}</figcaption></figure>`); void top; i++; continue; }
    // headings: `## Title {.blue}` — a hash in the body is an h2, the title is the page's h1
    if ((m = /^(#{1,4})\s+(.*?)(?:\s+\{\.([a-z-]+)\})?\s*$/.exec(line))) { para(buf); const level = Math.max(2, Math.min(4, m[1].length)); const id = uid(m[2]); count(m[2]);   /* `#` and `##` are both h2 — the title is the page's h1 */
      if (level === 2 && !stack.length) toc.push({ id, text: plain(m[2]) });
      out.push(`<h${level} id="${id}"${m[3] ? ` class="t-${m[3]}"` : ''}>${inline(m[2])}</h${level}>`); i++; continue; }
    // rule
    if (/^---+\s*$/.test(line)) { para(buf); out.push('<hr>'); i++; continue; }
    // standalone image = figure with caption
    if ((m = /^!\[([^\]]*)\]\((\S+)(?:\s+"([^"]*)")?\)\s*$/.exec(line))) { para(buf); out.push(`<figure class="md-figure"><img src="${esc(m[2])}" alt="${esc(m[1])}" loading="lazy">${m[3] ? `<figcaption>${inline(m[3])}</figcaption>` : ''}</figure>`); i++; continue; }
    // lists
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) { para(buf); const ordered = /^\s*\d+\./.test(line); const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '')); i++; }
      items.forEach(count); out.push(`<${ordered ? 'ol' : 'ul'}>${items.map(t => `<li>${inline(t)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`); continue; }
    // blockquote
    if (/^>\s?/.test(line)) { para(buf); const q = []; while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
      const inner = render(q.join('\n')); words += inner.words; out.push(`<blockquote>${inner.html}</blockquote>`); continue; }
    // pipe table
    if (/^\|/.test(line) && /^\|?\s*:?-+/.test(lines[i + 1] || '')) { para(buf); const cells = l => l.replace(/^\||\|$/g, '').split('|').map(s => s.trim());
      const head = cells(line); i += 2; const rows = []; while (i < lines.length && /^\|/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
      out.push(`<div class="md-table"><table><thead><tr>${head.map(h => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue; }
    // paragraph text
    if (line.trim() === '') { para(buf); i++; continue; }
    buf.push(line.trim()); i++;
  }
  para(buf);
  while (stack.length) out.push(stack.pop().close);
  return { html: out.join('\n'), toc, words };
}

export const firstParagraph = md => { const l = String(md).split(/\n\s*\n/).map(s => s.trim()).find(s => s && !/^(#|:::|!\[|```|\||>|-|\d+\.)/.test(s)); return l ? plain(l.replace(/\n/g, ' ')) : ''; };

/* self-check: node blog/render.js */
if (typeof process !== 'undefined' && process.argv[1] && /render\.js$/.test(process.argv[1])) {
  const { meta, body } = parseFrontMatter('---\ntitle: T\nreads: 3\nfeatured: true\n---\n\n## One {.blue}\n\nPara **b** [l](https://x).\n\n:::glass\ninside\n:::\n\n:::stats\nA | 1 | n\n:::\n\n| h | k |\n|---|---|\n| 1 | 2 |\n');
  const r = render(body);
  const must = ['class="t-blue"', 'id="one"', '<strong>b</strong>', 'rel="noopener"', 'md-glass', 'md-stat', '<table>'];
  const miss = must.filter(s => !r.html.includes(s));
  if (meta.reads !== 3 || meta.featured !== true || miss.length || r.toc.length !== 1) { console.error('RENDER FAIL', { meta, miss, toc: r.toc }); process.exit(1); }
  console.log('RENDER OK —', r.words, 'words, toc', r.toc.map(t => t.id).join(','));
}
