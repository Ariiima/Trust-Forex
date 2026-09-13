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
so the OS never draws its list; without JS the select is untouched and still works. The
Partnership request form is built from the same parts (founder, 2026-09-13): its fields are wells
in a `.glass .panel`, its contact choice is the 02 access switch, and a picked goal wears the rate
cell's white rim.

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
ink. The "Legal" eyebrow, each document's lede and its version line are gone too, and the
24px document title is off screen once a tab is open, since the tab already names it (founder,
2026-09-13); it still shows without JS, in print, and to a screen reader. `page.css` does it by resetting the site's colour tokens at `:root`, so the nav, footer and
focus ring follow. A row of plain text links, sticky under the nav, switches documents; the open
one is black and underlined. The text is the wireframe's verbatim, nothing rewritten, less one
clause: the wireframe's "One Time Acceptance" paragraph is the Mini App's sign-up checkbox, not
part of a document, so it is not on this page (founder, 2026-09-12). Nothing is hidden in the markup: without `page.js` the page is
all four documents in order, which is also what prints and what a crawler reads. Every page's
footer links here. `node _qa/legal.test.mjs` covers the switch, the history, the no-JS
fallback, the hierarchy, and that no computed colour on the page has a hue.

Cookie consent is one script, `cb8/consent.js` (its styles are `cb8/consent.css`, imported by
`style.css`), loaded by every page here and by every page `blog/build.mjs` writes. It is the
pattern most sites use (founder, 2026-09-13: "see what's common and expected … we should do the
same"). A first visit gets a banner, bottom left, with Reject all and Accept all side by side at the
same size and Manage preferences under them. The dialog lists Strictly necessary (always on),
Analytics and Marketing (off until switched on), each with its cookies' provider, purpose and
duration. The Cookie Settings tab ends on the saved choice and a "Change your consent" button. The
choice is one first-party cookie, `tf_consent`, kept six months; raising `VERSION` in the script
asks everyone again. No optional tool is in use yet, so both optional lists read "None in use." A
new tool goes into its category's list and loads as `<script type="text/plain"
data-consent="analytics">`, which the script releases once that category is allowed; withdrawing a
category whose script already ran reloads the page. `node _qa/consent.test.mjs` covers the banner,
both one-click answers, the choice across pages, the dialog, Escape, a stale version, a phone and
the gate. Fresh browsers in the other `_qa` scripts now see the banner too.

The footer is one markup on every page (`blog/build.mjs` writes its own copy), and `cb8/base.css`
`.fsig` owns it. It stands on its own navy floor (`--p-abyss`) under the closing screen, rounded at
the shoulders, with the wordmark under the links tall enough to read and masked into the floor. The
founder picked it on 2026-09-13 ("23 is the winner") out of rounds three and four in
`cb8/footer-lab-3.html`. It replaced variant 02 of `cb8/footer-lab.html`, where the links sat on the
closing screen's own blue with a hairline between, and the cropped wordmark ran under the small
print and the socials. The links are 4 / 4 / 4. Brokers was dropped because it was Partner brokers
twice, then Partner brokers because it was Partner broker rules twice (one page); Home came back to The
site and Blog moved under Company to keep the columns even (founder, 2026-09-13). The closing screen above it holds a full window of blue on its own and
the floor starts past the fold (founder, 2026-09-13): sized as one window with the footer inside, the
closing words stood in about half the fold. The blog's floor rises out of paper unchanged. Legal's floor is black,
so that page still has no hue.

Every nav and footer link lands at the top of its page (founder, 2026-09-14: "touching a footer or
header link should bring you to the top of that page, not somewhere random in the middle"). So
Partner broker rules goes to `brokers/`, not `brokers/#cashback`; the Cashback page's in-body "View
rules for each broker" link keeps the anchor. A nav or footer link to the page you are on jumps
rather than glides (`cb8/main.js`, and the footer's legal column in `legal/page.js`): from the footer
the glide took about two seconds, and a touch on the way stopped it mid-page. The back-to-top
button, the rail dots and in-body anchors still glide.

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

### Type

Home was built at its wireframe's own sizes, which ran a size over the same element on every other
page. On 2026-09-13 (founder: the hero's size "should be the same for other heros") it took the
site's roles, and the Home-only roles were dropped from `shared/scale.css`. Phone sizes in brackets.

| Element | Was | Now |
|---|---|---|
| Hero statement | 104px (52) | `--text-display`, 92 (48), as Cashback and Referral |
| Chapters 1 and 2 | 92 (48) | `--text-chapter`, 76 (42) |
| The four step words | 104 (78) | `--text-display`, 92 (54, the short chapter's phone size) |
| Their sentences | 20 (18) | `--text-mech-copy`, 19 (16): the steps are Home's mechanics |
| Benefits and Plans headings | 58 and 62 (44) | `--text-title`, 66 (40), every section heading's |
| The Plans sentence | 14 | `--text-copy`, 18, every section paragraph's |
| Closing statement | 88 (48) | `--text-display-close`, 88 (52), as Results and Referral |
| Service and benefit tiles | 17px names, 12.5px lines | 15 and 13, the Referral evidence card they copy |
| "How it works" capsule | 11.5 | `--text-small`, 12 |

At 78px "Stay fixed" had been breaking onto two lines on a 390px phone. At 1440 the benefits
heading now runs four lines, as the record's does. The held Plans screen still fits one window at
1280×720 with the larger sentence (680px of 720).

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

**The glass on the four is painted, and measured free** (founder, 2026-09-13). A backdrop-filter
over a full screen that scales as it stacks would re-blur every frame, so the sheet is drawn and
nothing on it moves: a translucent tint over the halos, the grid under a static blur, an edge light
and a doubled band. The harness's `noglass` arm against what ships: −1 long frame, inside the spread.
The rim line started at .36 white and read too shiny along the incoming step's top edge; it is .1
now. The incoming step's rounded clip cuts that line where the corner turns. Rounding the sheet with
the clip measured −5, also inside the spread, and was not taken once the line was dimmed.

### The benefits

The column beside the heading held two cards and a bar of all four rates. The bar went first: the
Plans block one screen below prints each plan's rate on its own card, so the page said every rate
twice. Three rounds of `home/benefits-lab.html` looked for what should replace the rest (founder,
2026-09-13). Round one rearranged the same cards and rates four ways, and every arrangement still read
as a table. Round two stopped listing rates and showed where the money comes from and where it lands:
two loops meeting at "you", a ribbon whose thickness was the share, and the one that was picked — the
two messages the bot sends when a benefit pays, landing in the Earning balance. Round three told that
one story five ways. The version that shipped (F3) had no card in it at all.

F3 put two notifications, newest on top, over the balance. The notifications cut the bot's `cashback_earned` and
`referral_earned` templates in `server/admin.mjs` to one short sentence each, amount first ("$20.00
Cashback added."). The full sentences ran two lines each and buried the amount (founder, 2026-09-13).
The amounts are an example. The line under the column that said so was cut the same day.

Under them, the two benefits and the four rates came back the same day, from the founder's reference
of the column that was cut: first as two rows between hairlines and one blue strip. The strip repeats
the Plans block's three rates, which is what cut the bar the first time, and adds Standard, the no-plan
rate the Plans block does not show. `page.js ?check=1` holds all four to the app's rates. The rows
replaced "Withdraw earnings" and "Use earning balance", dropped to keep the column short.

The F3 Earning balance ($56.00 as the column's largest type, a digit-strip counter, a split bar and
its legend) was cut the same day (founder, 2026-09-13). The column then took the page's own format:
it moved onto the service panel's blue glass, with the same frame, pane and tiles. The two rows became
tiles in the service tiles' rim, tint and icon well, Cashback in the green and Referral in the sky,
each with a "How it works" capsule in its colour on the right edge. The rates became a third tile with
no colour of its own. The section borrows `.screen-paper` for the field, the beam and the frame. It
kept the body's white ground at first, then took the paper grey so it meets chapter 2 on one colour.
Chapter 2 runs from paper to light blue and back to paper on Home, where cb8 runs it from white to
paper, so the service, chapter 2 and the benefits meet without a line (founder, 2026-09-13).

Paper ramps at every blue screen's seams were tried the same day, each blue screen fading into the
paper beside it as it scrolled in or out, and reverted the same day as too much fade everywhere.

The screen pins full screen for the site's 30vh hold, as Plans does (founder, 2026-09-13: "full
screen, with some scroll between this section, the previous one and the next"). It was one window
tall before too, but it scrolled straight through, so it never rested framed in the window.

The notifications were cut the same day too (founder, 2026-09-13), with the arrival `page.js` played
as they landed. The panel now holds only the two benefit tiles and the rates tile. Each of the four
rates wears its plan's colour from cb8's tier system (`cb8/style.css [data-tier]`), the palette the
Plans cards are lit in: the tint as a halo from the top, the rim, and the figure in the tier's ink.
Standard takes the calculator's copper. Silver's figure takes the ice blue its Plans card uses for
its name, because Silver's own ink is a white.

### The plans

Built from the founder's two references (2026-09-13). The three cards are one size. Each has the
badge, the name and the term on one line, a 60px price, then the monthly figure and the Cashback
and Referral share, each in its own glass pane. A rule follows, then the three things every plan
includes.

The card's words share one text style (founder, 2026-09-13: "same color, same weight, same size",
then "smaller and more unified"). The term, the monthly line, the saving, the share's label and the
list all inherit 14px at weight 500 in white at .82. Before, they ran 14 to 16px at four weights in
four whites. The card has three sizes in all: those words at 14px, the name and the share at 24px,
and the price at 52px (it was 28, 27 and 60). The saving keeps its green.

Each pane is a tier plate (founder, 2026-09-13: "match the color of the plan more, and prettier"):
the tier's metal at .8, a light shade falling to a deep one, under a rim and a top highlight in the
tier's colour. The light end is kept a mid tone, so the white words on it still read. Gold's plate
is quieter than the other two: less saturated, at .72 (founder, same day: "tone down gold a little,
looks way too strong"). Three passes
came first, the same day. The first was a right-edge fade that brightened on the picked card. The
second was Referral's proof-row shading (`referral/page.css` `.proof-row`, a .18 wash to navy), where
Gold read grey and Silver read as no colour. The third was tier glass, a .3 to .6 wash falling to each
tier's deep shade. Diamond read well there, but Gold read khaki: amber over the blue mixes to grey at
any strength that lets the blue show through.

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

The pick moves (founder, 2026-09-13: "changing between the selected panel has no visual effect").
A press sinks the card to 98%. The pick springs it up 6px to 102% on an overshooting curve, and the
two cards left behind ease back and dim to 80%. Every tier-ink layer of the glow is scaled by one
registered number, `--pick`, so the light fades out of the old card and into the new one instead
of jumping. The Cashback and Referral share springs up on each pick, one character at a time: 3, then 0, then %,
60ms apart, each 10px on the card's overshooting curve. A slide out of a clipped line at the
figure's foot was tried first (same day) and cut as not pretty. Stacked cards grow 1.5%
and do not lift, so the flag does not ride up into the card above. The button names the pick,
"Continue with Gold", with its rim in the tier's ink and one ring of that ink on each change;
without JavaScript it keeps "Choose Your Plan in the App". The saving ("Save $701") counts up from
$0 to its figure over 900ms on each pick, easing out; a card left mid-count snaps to its figure, and
the markup keeps the finished figure for a reader without JavaScript, reduced motion and Gold's
opening pick. The calculator's estimate still never counts (cb8/base.css): it changes as you type,
where this is one fixed figure arriving on a pick. `?check=1` holds each saving to the monthly
plan's price times the term, less the plan's own price. All of it is CSS except the button's words
and the count. Reduced motion keeps the lit card and drops the movement. Haptic feedback was offered and
declined: the web has no vibration on iPhone except an unofficial switch-input trick.

The screen is blue edge to edge (founder, 2026-09-13), on the hero's ground with its streaks. It
used to be a rounded blue block inset in a white frame. The sentence under the heading was cut and put
back the same day. The screen also holds: it sits in a `.hold`, so it pins full
screen for 30vh of scroll before it moves on. Landing on it at exactly one screen had been hard
(founder, same day).

The header gives the plans its room (founder, 2026-09-13). In hold mode the nav rises up and out over
56px of the plans screen's arrival, ending 8px before the screen reaches the top, so it leaves just
ahead of the screen's edge. The nav comes back down over the last 56px of the screen's exit. While
the nav is away, the block's top padding drops the nav's 56px, so the cards and the button gain it.
It is CSS only, a view timeline in `page.css` named on the hold box, because the pinned screen's flow
position keeps moving through the hold. Phones and reduced motion keep the nav.
Firefox has no scroll-driven animations, so it keeps the nav and the padding that clears it.
`node _qa/nav-plans.test.mjs` measures the nav at each edge.

`page.js` holds the record module. Its figures are the last completed week of the Results page's
own weekly series, recomputed here from that page's rule — same base win rates, same per-period
shift, same rounding — so the two pages cannot print different numbers for the same week. The
HTML ships those values too, so the module reads without JavaScript. `?check=1` proves the shipped
markup equals what the rule returns, that a further target is never reached more often than a
nearer one, that each plan's rate
is the one the app pays and each monthly equivalent divides out of its price — and it fetches
`../results/page.js` to confirm the constants it borrowed are still the ones that page uses.

```sh
node _qa/screens.mjs 'http://localhost:5311/home/?check=1' /tmp/home.png
node _qa/lines.mjs 'http://localhost:5311/_qa/wireframe-home-v24.html' 'http://localhost:5311/home/'
```

## Partner Brokers page

`brokers/` is the broker record: one page, one broker at a time, `?broker=<key>` in the URL. The
hero is the picker — the three partner brokers the Cashback page lists, each as a large tile in
its own colours (the founder's reference, 2026-09-13), and dots on a glass capsule. The display-size
broker name and the fact marquee were cut. A carousel on a full screen of blue read empty; four
glass figure tiles and a CTA under it were tried and cut the same day, and the hero band now
shrinks to the rail instead of holding a screen. Then the records: overview, regulation,
accounts, markets, cashback, bonuses, and the Cashback page's own four connection steps. Connect
was Regulation's shape, copy and button at the left and the steps down a pane at the right; the
founder's reference (2026-09-13) makes it the heading over one blue pane, the four steps side by
side and the button filling the pane's foot. Two rows of two below 1024px, one list below 560px.
The pane carries the ground's 48px grid, the one blue pane on the page that does, and each step
takes its content's height; 208px steps with the number and line at opposite ends read as empty.

The structure is the founder's Broker Profile skeleton, kept as drawn; the treatment is cb8's.
Two departures, both commented in `page.css`: the records **flow** at their own height rather
than hold a screen each (a licence table that pins for 30vh is a page you cannot read). For a day
each record also kept a one-screen floor; once the intro lines and the closing screen were cut, the
short records stood in ~400px of bare paper and the page read naked (founder, 2026-09-13), so the
floor went: a record is its content plus `--section-space` above and below. Each record also carries
one soft glow beside its card, left and right in turn, as a layer of its own background. And
anything a `.block` puts straight on its ground is lifted to `z-index:1` — base.css does that for
`.mech-grid` alone, and a heading placed directly in a block paints *under* the rayfield without it.

The words are that skeleton's too, line for line (founder, 2026-09-13: "match the text 1-on-1").
That cut the hero's label, the intro line under every record heading, the Regulation footnote, the
Connect paragraph, and the closing screen's headline and lede. The Connect paragraph came back
(founder, 2026-09-14), under its heading and over the pane; the button stays in the pane's foot.
The rate tables' four plan columns took the Cashback page's tier metals the same day, each column
filled in its tile's glass; before that only Diamond's column was filled. The closing screen then held only
its button, a full screen of blue with one pill in it, and went too (founder, 2026-09-13): Connect's
pane already ends on the same button, so the page ends on the footer, on paper, as Legal does.
Three places keep the design over the skeleton: each account card lists the rows that differ first,
the Markets pane has no "Market / Examples" column head, and the rail keeps GTCFX, XM and XS where
the skeleton has placeholder brokers.

`page.js` holds the broker table, and a broker shows only what it has. A field left out of its
entry takes its row off the page; a broker with no licences, no rates or no bonus does not get
that record at all, and Account types goes once neither card has a row. There is no "data
pending" state: an empty record read as a broken page. The side glows re-alternate over the
records that remain. GTCFX is published (its licences, rate tables and bonuses are lists in the
table, drawn into the markup `index.html` ships); XM and XS carry only their names so far.
`?check=1` proves that every row and record is on the page exactly when its data is, that GTCFX's
drawn records match the shipped markup, and the tables' arithmetic — every figure is the no-plan
figure scaled by that plan's share (10, 15, 20, 30) and the overview's "Maximum cashback" is the
largest figure printed.

```sh
node _qa/screens.mjs 'http://localhost:5311/brokers/?check=1' /tmp/brokers.png
node _qa/screens.mjs 'http://localhost:5311/brokers/?broker=xm&check=1' /tmp/xm.png
```
