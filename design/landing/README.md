# Landing pages

Nine pages on one system. `cb8/` is the Cashback page and the system itself — its nav, grounds,
glass, held cards, FAQ, final and footer are what every other page loads (`../cb8/grounds.css`,
`../cb8/style.css`, `../cb8/main.js`) before its own `page.css`. `index.html` opens `home/`, and
every page's nav and footer link Home there.

| Page | Folder | Source of its structure |
|---|---|---|
| Home | `home/` (+ `page.js`, the weekly record) | `_qa/wireframe-home-v24.html` (Home v24, 2026-09-12) |
| Cashback | `cb8/` | `_qa/wireframe-v24.html` |
| Results | `results/` (+ `page.js`, the two charts) | the Results wireframe (`result.html`, final) |
| Referral | `referral/` | the Referral wireframe (`referall.html`, final) |
| About | `about/` | the About wireframe (`about us.html`, final) |
| Partner Brokers | `brokers/` (+ `page.js`: the picker, and what a record shows for a broker whose figures are pending) | the Broker Profile skeleton (`Broker Profile.html`, 2026-09-12) |
| Broker Partnership | `partnership/` (+ `page.js`: the access switch and the request form → `POST app.trustforex.net/api/partnership`) | the Broker Partnership wireframe (`Broker Partnership.html`) |
| Blog | `blog/` — built from `blog/posts/*.md`, see `blog/README.md` | the founder's two layout references |
| Legal Center | `legal/` (+ `page.js`, the document switch) | the Legal Center wireframe (`Legal Center.html`, 2026-09-12) |

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

The nav is written once, in `cb8/index.html`; `python3 _qa/nav.py` splices it into every sibling
page that carries a `<!--NAV <Page>-->` marker and `blog/build.mjs` reads it for every blog
page. Edit the nav in cb8 only, then run both. Icons are Iconly Lottie files in `cb8/ico/` (the ids are
listed in `_qa/iconly.py`); a slot keeps an inline stand-in glyph (`svg.fb`) that shows only if
its file is missing. Each icon rests on its last frame, plays once on reveal and once per hover;
`data-rest="<frame>"` on a slot picks another resting frame. Every icon glyph, Iconly or the
Brokers market chips, renders at `--icon-size` (24px), and every box an icon sits in is
`--icon-well` (40px, radius `--icon-well-radius`) at every width (founder 2026-09-12). A glyph that
filled a 44px box on a phone and a 52px one on a laptop read as two sizes, so boxes do not shrink.
Never size the glyph in a slot; where the box is the `.ico` itself it pads down to the token, because
the player sets its svg to 100% of the box. `node _qa/icon-sizes.mjs` fails on any other size. Inline glyphs
inside text (arrows, socials, plan ticks) are not icons for this rule. Chapter sentences take one of six
gradients via `data-grad="1…6"` on the section (`cb8/style.css`).

Forms on glass use two shared controls, both in `cb8/style.css` and both built on `.tile`:
`.well` puts one input in its own frosted pane with its label inside it, and `.rate-cell` is the
tier chooser that the Referral rate rail and the Cashback calculator now share. Size a rail with
`--cell-h` and `--cell-figure` on the row rather than restyling the cell. `cb8/main.js` turns any
`<select>` inside a well into the page's own listbox and hides the select behind it as the value,
so the OS never draws its list; without JS the select is untouched and still works.

`legal/` is the exception to everything above: four documents (Terms of Service, Risk
Disclosure, Privacy Policy, Cookie Settings) on one page and one URL space,
`?document=terms|risk|privacy|cookies`, so an acceptance record can point at a stable address.
It loads the nav, the footer and the tokens and nothing else — no grounds, no glass, no reveal,
no `cb8/main.js`, and so no scroll holds. It is also the one page with no colour: black, greys
and white from the nav to the footer, with the hierarchy every other policy page uses — a 28px
page title, 24px document title, 18px section headings, 16px subheadings, no numbering (founder,
2026-09-12: "completely black and white and simple, like every other privacy policy"). Titles are
medium weight, not bold, and the page lede is gone (same day: "edit the boldness of titles, make
them simple text and make them smaller"). That replaced a first pass the same day where every heading was body size in body
ink. `page.css` does it by resetting the site's colour tokens at `:root`, so the nav, footer and
focus ring follow. A row of plain text links, sticky under the nav, switches documents; the open
one is black and underlined. The text is the wireframe's verbatim, nothing rewritten, less one
clause: the wireframe's "One Time Acceptance" paragraph is the Mini App's sign-up checkbox, not
part of a document, so it is not on this page (founder, 2026-09-12). Nothing is hidden in the markup: without `page.js` the page is
all four documents in order, which is also what prints and what a crawler reads. Every page's
footer links here. `node _qa/legal.test.mjs` covers the switch, the history, the no-JS
fallback, the hierarchy, and that no computed colour on the page has a hue.

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
python3 design/landing/_qa/serve.py        # port 5311, the port every QA script expects
```

Use that rather than `python3 -m http.server`: the plain server sends only `Last-Modified`, so a
browser caches the HTML, a cached page then asks for the stylesheet hashes it already has, and an
edit looks like it did nothing. `_qa/serve.py` is the same server with `Cache-Control: no-store`.

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

## Home page

`home/` is the site's front door and what `index.html` opens. Thirteen screens: the hero, the
weekly record, a chapter, the four protocol steps, the signal service, a second chapter, the two
benefits, the plans, the questions and the close.

Three departures from the wireframe, all commented in `page.css`. Its neutral greys become the
site's blue: the four `#0d0f11` protocol screens are one blue corridor, the `#111` rate bar is a
blue one carrying the four tier metals, and the white plan cards are glass tiles in Silver, Gold
and Diamond. Each protocol step carries its own rayfield rather than sharing one stretched across
the run — a halo is sized in percentages of its box, so one field over four screens becomes a
single glare on the title band. And the record module's bars grow by `height`, not `scaleY`,
because the figure above a bar is pinned to that bar's top edge and has to ride up with it.

### The record's bars

The four bars are windows onto one green light behind the plot, not four green swatches. Each
paints the slice of a field sized to the whole bars row, so TP1→TP4 is a single light falling
across the chart and the streak through it is unbroken across the gaps. The light leans with the
pane under the pointer, and holds still under reduced motion.

Picked on 2026-09-13 from two rounds of candidates. Round 1 dressed each bar's surface — a lit
glass tube, frosted green glass, a clear vessel filled to the rate, edge-lit dark glass, a single
sheen pass — and every one read as an effect; the tube was called "3D generated AI slop", and
translucent green over the blue pane turns teal. Round 2 started from the data: one glass tile per
signal lit when it reached the target, the four targets as concentric rings, and last week's rate
as a level across each bar. One light was chosen; the tiles were the runner-up.

Reworked the same day against the founder's reference card. The light is now one vertical field the
height of the plot, bright at the 100% line and deep at the floor, so a bar that reaches higher
reaches brighter green. The radial hot spot, the streak through the gaps and the lean under the
pointer went with it. The card took the reference too: the paper screen's glass frame is back (it
had been removed on 2026-09-12 as reading like a border), the header is a tile with the chart icon,
the week and an "11 signals" pill, and the link to the full record sits under a full-width rule.

### The protocol steps

The four steps are the one place on the site that does not use the ordinary reveal, and all four use
the same move. The word is tracked wide open at a weight it never keeps, out of focus, and closes
onto the weight, the tracking and the sharpness it holds for good — a word not yet read becoming the
one you keep. Its sentence follows it in along the composition's own axis (the title sits 44px left
of centre, the sentence 44px right of it, so the sentence arrives from the word's side rather than
from below) and is unveiled left to right behind a soft mask edge. The word itself never translates
and never staggers, and nothing is added to the screens to carry any of it: the wireframe gives
these four type and only type, and the type is still the whole of it.

Four *different* arrivals were built here first and thrown out. A corridor where each screen does
its own trick reads as a slideshow of effects rather than as one place, and the reader spends the
second screen wondering what the third will do. One move used four times is a page with a habit.

The move is the variable weight axis: Inter ships variable (`shared/fonts/inter.css` declares
`font-weight:100 900`), so a weight is interpolable and a word can arrive light and firm up. The
heading stays one text run at every frame — no per-character split, so the kerning holds and
"fixed" keeps its fi ligature. The from-state is gated on `html.js`, which `main.js` sets and which
is also what splits `.words` and what adds `.in`; without it these are plain headings no rule would
ever reveal.

**The arrival is gated on the word, not on the screen.** `cb8/main.js` reveals a screen at
`threshold: .25` of the screen itself, which is right where content fills a screen and wrong for
these four, where one word sits in the middle of 100dvh of ground: when `.in` landed on step-1 the
word's top edge was 137px *below* the fold, so the whole move played off screen and the reader only
ever met the finished word. `page.js` watches the title instead, through a root inset 20% at the top
and 40% at the bottom, and adds `.step-here` once the word reaches that band — about three fifths
down the screen, so the arrival plays while the word rises into reading position. The sentence hangs
off the same gate, or it lands a screen ahead of the word it belongs to.

The site's word mask comes off all four, and both halves have to go together: the wrapper stops
clipping, and the inner span gives up the resting offset that parks a word a full line below its box
until its screen arrives. That offset is invisible while the wrapper clips and is a line of overflow
the moment it does not, which is how it surfaced — `?check=1` reported step-1 and step-4 clipping
their content in plain mode.

**The paint box has to end below the ink.** `--grad-light` goes pale at both ends, and the span it
is measured against stops a little under the baseline, so a descender lands on the very last stop
and is painted `--p-400` — barely there on this blue. "Stay fixed" lost the tail of its y and
"Prepare" the foot of its p. It is a fade, not a clip: the ink reaches the same row either way,
measured. Four tenths of an em of paint box below the baseline, pulled straight back off the margin
so nothing moves, puts the whole glyph inside the white part of the run.

**The same fade is on every page**, wherever a gradient heading carries a descender — the Cashback
and Referral heroes both lose the g in "trading" and "sharing". It is not fixed there. The same
padding cannot be: those headings still reveal through the mask, and `.w{overflow:hidden}` clips a
taller span straight back off. Fixing it site-wide means changing `--grad-light`'s foot or the mask
itself, which is a decision about every page, not about this one.

**The arrival did not run at all until 2026-09-12.** A comment above the rule closed one line early,
so the prose that followed it was parsed as a selector and swallowed the `html.js .step-title`
from-state whole. The four words shipped at their finished weight and never moved, and the table that
used to sit here — 158 long frames with the arrival against 155 without — was measuring the arrival
against itself. Both numbers below are re-measured with the rule actually in the sheet.

Animating a weight and a tracking is a text relayout, so it is measured rather than assumed.
`_qa/perf-corridor.mjs` runs it: 220 notches down the four steps at 1440×900, five interleaved runs
an arm, medians of frames over 20ms. Absolute counts do not travel between machines — the harness is
headless Chromium and composites in software — but the gap between two arms does.

| Long frames (>20ms), 220 notches | Median | Spread |
|---|---|---|
| Four still screens | 91 | 81–94 |
| The word and its sentence (ships) | 97 | 87–99 |

Six long frames, inside the run-to-run spread, so the arrival costs nothing worth counting.

**Anything added to the ground here has to be measured, and four things now have been.** The corridor
is the one run on the site whose ground never changes, and four screens with one word each is exactly
where a reader loses count, so lighting it is the obvious next move. It does not survive contact with
the harness:

| Lighting the corridor | Long frames over still |
|---|---|
| The halos drift on the scroll timeline | +57 |
| A third halo cross-fades in as the drift's destination | +46 |
| The two existing halos trade opacity — nothing added, nothing moved | +33 |
| The travelling band every other blue ground carries | +16 |

The pattern is the layer, not the technique. k09's halos are 70–80px blurs over a full screen, and on
four stacked 100dvh sections any per-frame work on that surface is re-rasterised or re-blended; the
cheapest version of the idea still cost five times what the whole arrival costs. Read it as a budget
rather than as taste — a GPU-composited browser may pay less than this harness does. Anyone who wants
the light back should get the harness onto a real compositor and re-run these arms, not re-derive
them a fifth time.

Two more were cut earlier and are not in the table: a sticky rail threading the four screens (the
wireframe gives them no such element) and a glow riding a wipe across Measure as a `drop-shadow` on a
transforming element.

### The benefits

The column beside the heading held two cards and a bar of all four rates. The bar went first: the
Plans block one screen below prints each plan's rate on its own card, so the page said every rate
twice. Three rounds of `home/benefits-lab.html` looked for what should replace the rest (founder,
2026-09-13). Round one rearranged the same cards and rates four ways, and every arrangement still read
as a table. Round two stopped listing rates and showed where the money comes from and where it lands:
two loops meeting at "you", a ribbon whose thickness was the share, and the one that was picked — the
two messages the bot sends when a benefit pays, landing in the Earning balance. Round three told that
one story five ways. The version that shipped (F3) has no card in it at all.

Two notifications, newest on top, then the balance as the largest type in the column. The
notifications cut the bot's `cashback_earned` and `referral_earned` templates in `server/admin.mjs`
to one short sentence each, amount first ("$20.00 Cashback added."). The full sentences ran two lines
each and buried the amount (founder, 2026-09-13). The amounts are an example. The line under the
column that said so was cut the same day.

Under the balance, the two benefits and the four rates came back the same day, from the founder's
reference of the column that was cut. They return as two rows between hairlines and one blue strip,
not as cards, so the notifications stay the only raised surfaces. The strip repeats the Plans block's
three rates, which is what cut the bar the first time, and adds Standard, the no-plan rate the Plans
block does not show. `page.js ?check=1` holds all four to the app's rates. The rows replaced
"Withdraw earnings" and "Use earning balance", dropped to keep the column short.

The balance is a counter. `page.js` splits it into one strip of 0–9 per digit, and CSS slides each
strip to its value, so going from $20.00 to $56.00 rolls the ones digit through 1–5 on the way to 6.
The script writes four transforms per step and runs no frame loop. The column ships finished. `page.js`
sets it back to its opening only while it is still below the fold and motion is allowed, and plays
it once when it reaches the protocol steps' reading band.

### The plans

Built from the founder's two references (2026-09-13). The three cards are one size. Each has the
badge, the name and the term on one line, a 60px price, then the monthly figure and the Cashback
and Referral share, each in its own glass pane. A rule follows, then the three things every plan
includes.

A card is picked, not just read. Each carries a native radio stretched over the whole card, so a
click anywhere picks it and the arrow keys move between the three. The picked card lights its rim
and its term in its tier ink, glows in that ink and brightens its halo, with no script. The cards not
picked keep a quiet white rim. Gold is picked on every load, as the app's "Most popular": the radios
carry `autocomplete="off"`, so a reload does not restore the last card picked. A card
is not a `<button>` like `.rate-cell`, because it holds a heading and a list. The one button under
the cards opens the app's checkout on the pick: `src/App.tsx` hands `/checkout?plan=silver|gold|diamond`
to Checkout as its starting plan. `page.js` keeps that link in step. The markup's own href is the
app's plan picker, for a reader without JavaScript. `?check=1` picks each card in turn and fails if
the button does not follow.

The header gives the plans its room (founder, 2026-09-13). In hold mode the plans screen's top edge
pushes the nav up and out over the last 56px of its arrival. The nav comes back down over the last
56px of the screen's exit. The block then sits 20px off the viewport's top, not off the nav, so the
cards and the button gain 56px. It is CSS only, a view timeline on `#plans` in `page.css`. Phones and
reduced motion keep the nav. Firefox has no scroll-driven animations, so it keeps the nav and the old
spacing. `node _qa/nav-plans.test.mjs` measures the nav at each edge.

`page.js` holds the record module. Its figures are the last completed week of the Results page's
own weekly series, recomputed here from that page's rule — same base win rates, same per-period
shift, same rounding — so the two pages cannot print different numbers for the same week. The
HTML ships those values too, so the module reads without JavaScript. `?check=1` proves the shipped
markup equals what the rule returns, that a further target is never reached more often than a
nearer one, that the benefits column's balance is the sum of its two amounts, that each plan's rate
is the one the app pays and each monthly equivalent divides out of its price — and it fetches
`../results/page.js` to confirm the constants it borrowed are still the ones that page uses.

```sh
node _qa/screens.mjs 'http://localhost:5311/home/?check=1' /tmp/home.png
node _qa/lines.mjs 'http://localhost:5311/_qa/wireframe-home-v24.html' 'http://localhost:5311/home/'
```

## Partner Brokers page

`brokers/` is the broker record: one page, one broker at a time, `?broker=<key>` in the URL. The
hero is the picker — the three partner cards the Cashback page lists, on the mechanics' glass —
and the active card's name is the page's statement. Under it a sticky strip of six anchors, then
the records: overview, regulation, accounts, markets, cashback, bonuses, and the Cashback page's
own four connection steps.

The structure is the founder's Broker Profile skeleton, kept as drawn; the treatment is cb8's.
Two departures, both commented in `page.css`: the records **flow** at their own height rather
than hold a screen each (a licence table that pins for 30vh is a page you cannot read), and
anything a `.block` puts straight on its ground is lifted to `z-index:1` — base.css does that for
`.mech-grid` alone, and a heading placed directly in a block paints *under* the rayfield without it.

`page.js` holds the broker table. GTCFX is published; a broker with no record yet keeps the same
shape with its figures pending, and regulation, rates and bonuses say so rather than leaving the
last broker's numbers on screen. `?check=1` proves the tables' arithmetic — every figure is the
no-plan figure scaled by that plan's share (10, 15, 20, 30) and the overview's "Maximum cashback"
is the largest figure printed — and, on a pending broker, that nothing published is left behind.

```sh
node _qa/screens.mjs 'http://localhost:5311/brokers/?check=1' /tmp/brokers.png
node _qa/screens.mjs 'http://localhost:5311/brokers/?broker=xm&check=1' /tmp/xm.png
```
