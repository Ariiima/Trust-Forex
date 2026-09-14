/* The writer's editor: fields + Markdown + the theme's blocks as buttons, previewed with the same renderer the
   build uses. Nothing is sent anywhere — the draft lives in this browser (localStorage) until it is downloaded
   as a .md and dropped into design/landing/blog/posts/. */
import { render, parseFrontMatter, serializeFrontMatter, slugify } from './render.js';   // a module resolves against this file (blog/), not the page

const $ = id => document.getElementById(id);
const FIELDS = ['title', 'slug', 'category', 'date', 'author', 'excerpt', 'cover', 'reads', 'featured'];
const CATS = Object.fromEntries([...$('category').options].map(o => [o.value, o.textContent]));
const KEY = 'tf-blog-draft';
const fmtDate = d => { const [y, m, day] = String(d).split('-').map(Number); return d && m ? `${day} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}` : ''; };

const meta = () => Object.fromEntries(FIELDS.map(k => [k, $(k).type === 'checkbox' ? $(k).checked : $(k).value.trim()]));
const markdown = () => { const m = meta(); if (!m.slug) m.slug = slugify(m.title); return serializeFrontMatter(m, $('body').value); };

function preview() {
  const m = meta(); const { html, toc, words } = render($('body').value);
  $('pv-title').textContent = m.title || 'Untitled';
  $('pv-cat').textContent = CATS[m.category] || 'Category';
  $('pv-meta').innerHTML = [fmtDate(m.date), m.author, `${Math.max(1, Math.round(words / 220))} min read`].filter(Boolean).map(s => `<span>${s}</span>`).join('');
  $('pv-body').innerHTML = html;
  $('pv-toc').innerHTML = toc.map(t => `<a href="#${t.id}">${t.text}</a>`).join('') || '<a>—</a>';
  try { localStorage.setItem(KEY, markdown()); } catch {}
}

/* the buttons: wrap the selection or drop a block at the cursor */
const SNIP = {
  h2: ['\n## ', 'Heading', '\n'], h2blue: ['\n## ', 'Heading', ' {.blue}\n'], bold: ['**', 'text', '**'], link: ['[', 'text', '](https://)'],
  image: ['\n![', 'What the image shows', '](https://…/image.webp "Caption")\n'], list: ['\n- ', 'First point', '\n- Second point\n'],
  glass: ['\n:::glass\n', 'Text inside a frosted glass box.', '\n:::\n'], blue: ['\n:::blue\n## A heading on blue\n', 'Text on the blue block, in white.', '\n:::\n'],
  pane: ['\n:::pane\n', 'Text on a glass pane inside a blue block.', '\n:::\n'],
  info: ['\n:::callout info Good to know\n', 'A note in the info blue.', '\n:::\n'], success: ['\n:::callout success What this means\n', 'A note in the TP green.', '\n:::\n'], warning: ['\n:::callout warning Before you rely on it\n', 'A note in the pending amber.', '\n:::\n'],
  quote: ['\n:::quote\n', 'The sentence worth pulling out of the text.', '\n— Who said it\n:::\n'],
  stats: ['\n:::stats\n', 'TP1 | R:R 1:0.5 | Fixed before outcome', '\nTP2 | R:R 1:1 | Fixed before outcome\nTP3 | R:R 1:2 |\nTP4 | R:R 1:3 |\n:::\n'],
  steps: ['\n:::steps\n', 'Open the TrustForex App', '\nChoose a partner broker\nConnect the account\n:::\n'],
  table: ['\n| Period | TP2 | TP4 |\n|---|---|---|\n| ', 'Week 32', ' | 70% | 30% |\n'],
  cta: ['\n:::cta Open the App | https://app.trustforex.net\n', 'One line on why the reader should open the App now.', '\n:::\n']
};
document.querySelectorAll('.ed-toolbar button').forEach(b => b.addEventListener('click', () => {
  const [pre, mid, post] = SNIP[b.dataset.snip]; const t = $('body');
  const s = t.selectionStart, e = t.selectionEnd; const sel = t.value.slice(s, e) || mid;
  t.setRangeText(pre + sel + post, s, e, 'select'); t.setSelectionRange(s + pre.length, s + pre.length + sel.length); t.focus(); preview();
}));

/* fill from a .md, and out again */
function load(text) {
  const { meta: m, body } = parseFrontMatter(text);
  FIELDS.forEach(k => { if ($(k).type === 'checkbox') $(k).checked = m[k] === true; else if (m[k] != null) $(k).value = m[k]; });
  $('body').value = body.trim(); preview();
}
$('download').addEventListener('click', () => {
  const name = (meta().slug || slugify(meta().title) || 'post') + '.md';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([markdown()], { type: 'text/markdown' })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
});
$('copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(markdown()); $('copy').textContent = 'Copied'; setTimeout(() => $('copy').textContent = 'Copy .md', 1500); } catch { prompt('Copy the post', markdown()); } });
$('import').addEventListener('change', e => { const f = e.target.files[0]; if (f) f.text().then(load); e.target.value = ''; });
$('clear').addEventListener('click', () => { if (!confirm('Clear the draft?')) return; try { localStorage.removeItem(KEY); } catch {} FIELDS.forEach(k => { if ($(k).type === 'checkbox') $(k).checked = false; else $(k).value = k === 'author' ? 'TrustForex' : k === 'reads' ? '0' : ''; }); $('body').value = ''; preview(); });
$('title').addEventListener('input', () => { if (!$('slug').dataset.touched) $('slug').value = slugify($('title').value); });
$('slug').addEventListener('input', () => { $('slug').dataset.touched = '1'; });
document.querySelector('.ed-form').addEventListener('input', preview);
document.querySelector('.ed-form').addEventListener('submit', e => e.preventDefault());

let draft = null; try { draft = localStorage.getItem(KEY); } catch {}
if (draft) load(draft); else { $('date').value = new Date().toISOString().slice(0, 10); preview(); }
