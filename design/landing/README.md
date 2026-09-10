# Landing pages

Five pages on one system. `cb8/` is the Cashback page and the system itself — its nav, grounds,
glass, held cards, FAQ, final and footer are what every other page loads (`../cb8/grounds.css`,
`../cb8/style.css`, `../cb8/main.js`) before its own `page.css`. `index.html` opens cb8 directly.

| Page | Folder | Source of its structure |
|---|---|---|
| Cashback | `cb8/` | `_qa/wireframe-v24.html` |
| Results | `results/` (+ `page.js`, the two charts) | the Results wireframe (`result.html`, final) |
| Referral | `referral/` | the Referral wireframe (`referall.html`, final) |
| About | `about/` | the About wireframe (`about us.html`, final) |
| Broker Partnership | `partnership/` (+ `page.js`: the access switch and the request form → `POST app.trustforex.net/api/partnership`) | the Broker Partnership wireframe (`Broker Partnership.html`) |
| Blog | `blog/` — built from `blog/posts/*.md`, see `blog/README.md` | the founder's two layout references |

The three wireframed pages keep their wireframes' structure, sizes and layout exactly (new type
roles went into `shared/scale.css`); the treatment — blue grounds, glass panes and tiles, the
30vh holds on the mechanics and the 12vh beat on the chapters, the travelling light — is cb8's.
Two things found on 2026-09-09 while matching line breaks to the wireframes: cb8's
`body{font-variant-numeric:tabular-nums}` widens Inter's *letters* by ~2% (not only digits), so
the new pages set `font-variant-numeric:normal` and keep tabular figures only inside data
panels; and Inter is not installed on the design Mac, so the wireframe files open there in the
system font, ~1.5% narrower still. The chapter headings' box is 960px on Results and Referral
(the wireframe's 940 plus that margin) — the one width at which every chapter breaks as drawn.
`node _qa/lines.mjs` reports all headings matching on all three pages.

The nav is written once, in `cb8/index.html`; `python3 _qa/nav.py` splices it into the other
three pages (they carry a `<!--NAV <Page>-->` marker) and `blog/build.mjs` reads it for every blog
page. Edit the nav in cb8 only, then run both. Icons are Iconly Lottie files in `cb8/ico/` (the ids are
listed in `_qa/iconly.py`); a slot keeps an inline stand-in glyph (`svg.fb`) that shows only if
its file is missing. Each icon rests on its last frame, plays once on reveal and once per hover;
`data-rest="<frame>"` on a slot picks another resting frame. Chapter sentences take one of six
gradients via `data-grad="1…6"` on the section (`cb8/style.css`).

Forms on glass use two shared controls, both in `cb8/style.css` and both built on `.tile`:
`.well` puts one input in its own frosted pane with its label inside it, and `.rate-cell` is the
tier chooser that the Referral rate rail and the Cashback calculator now share. Size a rail with
`--cell-h` and `--cell-figure` on the row rather than restyling the cell. `cb8/main.js` turns any
`<select>` inside a well into the page's own listbox and hides the select behind it as the value,
so the OS never draws its list; without JS the select is untouched and still works.

QA: `node _qa/screens.mjs <url> <out.png> [w h [frames]]` shoots every screen of a page into one
sheet (`?check=1` prints CHECK OK/FAIL in the console); `node _qa/lines.mjs <wireframe file> <url>`
compares every heading's line count and size against a wireframe.

## Cashback page


- `cb8/index.html` — content and structure.
- `cb8/main.js` — scrolling, calculator and FAQ.
- `cb8/base.css` — layout and components.
- `cb8/grounds.css`, `cb8/style.css` — blue backgrounds and liquid glass.
- `shared/scale.css` — reusable typography and sizing tokens.
- [Sizing and maintenance](shared/README.md).
- [Cashback wireframe](../reference/wireframe-cashback-v24.html).

Preview from the repository root:

```sh
python3 -m http.server 5311 --directory design/landing
```

After changes, run `python3 design/landing/_qa/stamp.py` to refresh the stylesheet
and script cache keys. Use `sh design/landing/deploy.sh` for a full deployment;
it replaces the old preview tree with cb8 and its required runtime assets.

In soft mode, the approach to the first text break follows native scroll distance;
it settles at the chapter boundary and holds fading arrival momentum. Fresh
gestures accumulate small trackpad deltas, reversals work during entry, and a held
wheel continues after a 900ms reading pause. These paths must work without a pointer click;
`chapter-scroll.test.mjs` covers them in both directions and scroll modes.
Browser scroll snapping is disabled: it must not pull native scrolling backward
or compete with the controller that lands the chapter and stacked cards. Native
`scroll-snap-type: mandatory` was measured as a replacement (2026-09-07) and rejected:
in Chromium a single mouse notch snaps back to the same screen, so a notched-mouse
user cannot leave a card.

The controller tells a new gesture from the momentum tail of the last one by shape,
never by one tick: two rising ticks in a row (a finger pushing again), a reversal, a
360ms silence, or — after a 900ms beat — two non-decreasing ticks (a held drag or a
spinning wheel). One bigger tick alone is a dropped frame merging two momentum ticks;
counting it as a gesture was the "two screens per flick" bug. `lock.test.mjs` replays
that merged-tick tail in both modes.

Everything that moves with the scroll animates `transform` or `opacity` only (the
chapter's white ramp scales, the card behind dims through a veil) — a growing
background or a `filter` repaints a full screen every frame. The pinned card stack is
the page's one real frame cost, so its blocks clip by `clip-path`, are promoted up
front, and a card fully covered by the next is hidden; the glass frame drops its
displacement to a plain blur while the deck travels. `_qa/perf.mjs` counts long
frames per hop (105 → 20 on 2026-09-07); run it before and after touching
scroll-driven motion. Full record: `SCROLL-PLAN.md`.

Checks against the preview server:

```sh
node design/landing/_qa/chapter-scroll.test.mjs
node design/landing/_qa/scroll-scale.test.mjs
node design/landing/_qa/lock.test.mjs
```
