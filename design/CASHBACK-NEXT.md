# Cashback — next generation

> Current implementation (2026-09-06): `design/landing/cb8/` is the only landing
> page. Other experimental builds have been retired. Edit cb8 directly and run
> `python3 design/landing/_qa/stamp.py`; there is no variant generator.
> The reference file is `design/reference/wireframe-cashback-v24.html`.
> Sizing and maintenance: [shared reference](landing/shared/README.md).
> The dated notes below record earlier iterations.

Written 2026-09-03 from the founder's screen-share review (Persian, transcribed).
Checked against `design/CASHBACK-LANE.md` (cb1–cb4, live 2026-09-03),
`design/BRAND.md` and `design/landing/wireframe-cashback-v24.html`.

Scope he set explicitly: **Cashback only.** Home is parked ("هومو فعلاً بی‌خیال شو")
— the Cashback file he delivered is final content, Referral lands next, Home last.

---

## 1. What he confirmed (no change needed)

| His words | Already our rule |
|---|---|
| "دیتا ثابته، دیتیلش پر می‌شه" — the data stays put, its detail fills in; a whole new dataset dropping in is bad | §1 "Numbers land final … bars fill once on first reveal, nothing counts up" |
| copy, order, even left/right placement are fixed; only the theme is ours | lane rule: copy pinned to the wireframe |
| notification cards arriving on scroll — "این نوتیفیکیشن‌ها رو بذار بیاد" | the home lane's b3 signature; portable to Cashback |
| chapter breaks matter, want more of them | blocks 5 and 8, already the motion slots |
| section backgrounds shift to mark importance | already navy panels; but see §2.5 for his cap |

## 2. What he contradicted

### 2.1 The share bar is dead — cb2 goes in the bin
> "این مدل رو هیچ موقع هیچ جا قرار نیست داشته باشیم، چونکه خیلی به کاربر این حس رو
> می‌ده که انقدرش رو ما داریم برمی‌داریم… کاربر تو فضای انقدری فقط داره بازی می‌کنه."

Any visual that shows a **whole** with **your slice** inside it reads as "they keep
the rest". That is cb2's entire signature — the rebate bar with your share filled.
It is not fixable by re-skinning; the instrument itself is the problem.

**New standing rule:** never render the total broker rebate. Cashback appears only as
(a) an absolute figure — `+$37.50`, `$150.00` — or (b) a level — `10% · Standard`,
`30% · Diamond`. No pie, no split bar, no "your share of" geometry, on any page.

Collateral: cb1 mechanics 02 (the 10/15/20/30 ladder) is safe — it is four levels,
not a division of one pot. The calculator is safe — it only ever prints your number.

### 2.2 The sticky-stage layout is disliked
> "این مدل رو اصلاً خوشم نمیاد که این‌ور ثابته، این‌ور متن‌ها چیز می‌شن. چون دو تا متن
> روی هم می‌مونه و تمرکز کاربر کم می‌شه."

All four cb builds run Mechanics 01–04 as *sticky panel right, copy column scrolling
left*. That is exactly the pattern. He wants **one step = one full screen**, advanced
one at a time. "رو هر صفحه فقط یه دونه از این‌هاست، خیلی تمیزتره."

### 2.3 Every section catches the scroll — hard lock (decided)
> "اسکرول می‌کنه، اینجا گیر می‌کنه… یه ذره بیشتر باید اسکرول بکنی که بره صفحه بعد.
> اینو برای تک‌تک سکشن‌های هر صفحه می‌خوایم."
> "اسکرولا رو قفل بکنیم که کاربر گیر کنه توی هر صفحه."

**Decided 2026-09-03: hard lock.** One gesture = one section, the transition owns the
input while it plays. Not a soft pin. This is the page's defining behaviour, so it is
built first and everything else is laid out to fit it.

What that commits us to, so it is not a surprise later:

- **One section = exactly one viewport.** Nothing may overflow a screen — if a
  section's content does not fit at 1440×800, content gets cut, not scrolled. This is
  the real constraint on the design, tighter than anything in §2.2.
- **Native scroll goes away** on desktop. Scrollbar, `End`, `Cmd+F` jump-to-match and
  anchor links all need explicit handling. Nav anchors must drive the section index,
  not `scrollIntoView`.
- **Trackpad momentum** must be debounced or one flick fires three sections. Wheel
  events get a cooldown for the transition's duration plus ~150 ms.
- **Keyboard and a11y are not optional here** — arrows, PageUp/PageDown, Home/End and
  Tab focus must move the section index, or the page is unusable without a mouse.
- **Mobile is a separate mode**, not a smaller desktop: swipe-per-section fights
  native momentum badly. Ship mobile as a normal scrolling page with the same reveals.
- **`prefers-reduced-motion` is a normal scrolling page** too. The lock is motion.

Roughly a day rather than the two hours a soft pin would have cost, mostly in the
input layer and the two fallback modes. Worth stating once; it is his call and it is
made.

### 2.3b The reveal fires once, on entry — never on hover
> "فقط موسی نباید باشه ها… همون بار اول که اسکرول می‌کنه میاد رو صفحه اون نمایش
> میده و فقط همون یک بار نمایش میده."

Every section's animation plays the first time the user lands on it, once. Not on
hover, not on mouse position, and not again when they come back up. `once: true`.
Hover may still light a row, but nothing meaningful may be *hidden* behind a hover —
on a locked page the user may never move the mouse at all.

Ordered lists reveal in sequence: "اول ۱ بعد ۲ بعد ۳" — 01 lands, then 02, then 03,
then 04, staggered, once.

### 2.4 Chapter breaks are full screens, not bands
> "صفحه خالی بشه فقط چپتر بریک بیاد و بعد پرتمون کنه صفحه‌ی بعدی."

Nothing else on screen. Chapter text arrives, holds, then hands off. He also liked a
variant where the line sweeps in laterally ("به صورت لاین از راست به چپ") — use it
on one of the two, not both. He framed the grammar as: a chapter break moves a
screen **inside → out**; the next section's reveal comes **outside → in**.

### 2.5 Only two colour-shifted screens per page
> "دو جا بیشتر نمی‌تونیم از این قضیه استفاده بکنیم… زیاد نمی‌ذارن که اون ارزشش کم بشه."

Plus the first hero, which is a different thing: full-bleed single colour, our blue,
edge to edge, with soft same-hue shadow shapes — the style he repeatedly said he
loves ("انگاری سایه‌هایی روی همون تم رنگیت سایه می‌شه"). He suspects the reference is
darker than our blue; it is, so tune down.

The cb builds currently paint navy on: chapter 1, chapter 2, mechanics pages, the
last activation row, parts of the meaning split. That is five or six. Cut to:

| Screen | Ground |
|---|---|
| Hero | **full-bleed blue**, soft shadow shapes |
| Fact strip → Meaning → Mechanics 01–04 → Calculator | white / off-white, one tint step allowed |
| Chapter 1 | **navy, full screen** — the one dark moment mid-page |
| Chapter 2 | light tint, not dark (the cap) |
| Activation | white; last path row keeps its navy fill |
| Final CTA | **navy, full screen** — the second |

### 2.6 Typeface is reopened
He found a face he likes in a reference and is having it identified. `BRAND.md` was
updated *today* to "Inter — no exceptions". Do not pre-empt: build on Inter, and when
he sends the name it is a one-line swap (`--sans` in `shared/`), plus a BRAND.md edit.

### 2.7 Glass, blur and rays — the hero reference
He liked a glassmorphism reference ("این تم شیشه‌ای رو کلاً خیلی خوشم اومد") and then
sent one: *"glassy, blurry with rays"* — a dark navy hero with a soft light bleed
spilling in from one corner, a faint grid in the field, glass pills for the nav and
the buttons, and white product cards overlapping the bottom edge of the dark field.

**Take:** the light bleed / ray wash on the dark ground; the faint grid; glass pills
for nav and secondary buttons; white product panels lapping over the hero's bottom
edge at a slight angle. This is exactly the "shadows on your own colour tone" hero he
described twice in the meeting — it is one reference for one idea, not a new palette.

**Reject:** the violet. The reference is web3-purple with green figures — BRAND bans
purple/pink hype, crypto gloss, and reserves green for TP. Our rays are trust-blue and
white on navy, one hue, no second colour. Nothing in the wash may read as a gradient
brand mark.

**Cap it:** the ray/glass treatment is a hero property. Data panels stay flat white
with real figures; the FAQ, calculator and activation rows stay plain. The final CTA
screen may carry a much quieter echo of the wash — no grid, no glass.

### 2.8 The real problem with this page: it is almost all text
> "صفحه کشبک بیشتر اینطوریه، متنه… زیاد نمیشه روش مانور داد… یه سری صفحاتی که خیلی
> خشک و بی‌روحن."

He walked through pages that *do* have somewhere to put craft — a dense visual on the
right, a data panel, real room — and then said Cashback is not one of them. Its
sections are a heading, a paragraph, and a list. Under §2.3's one-section-one-screen
rule that gets worse, not better: a locked screen holding forty words of body copy and
nothing else is a dead screen, and this page has several.

This is the design problem to solve, and it is not solved by motion alone. The fix he
asked for, in his order:

1. **A once-on-entry reveal** for every dry section (§2.3b) — the minimum.
2. **An icon per item** in the text-only lists. He named the slots himself: the
   `01 · 02 · 03 · 04` mechanics, and inside 03 the two factor cards *Account type*
   and *Trading volume*. Add the four fact-strip claims and the four activation steps
   — same problem, same fix.
3. **Something related and quiet** in the sections that are body copy and nothing
   else: "یه سری چیزای مرتبط باهاش پیدا بکنیم که بندازیم اونجا."

### 2.9 Animated icons — Iconly, and what replaces it
The site he was shopping is **https://web.iconly.pro/animations** — *animated* icons,
not static ones. That reframes his "۱ ۲ ۳ یه لحظه به ترتیب" request: he does not want
a static glyph beside each list item, he wants a small icon that **plays once** as the
item arrives. Which is the same `once: true` rule as §2.3b, applied to the icon.

Iconly is $10/month, blocks right-click and drag (he noticed: "بتون سلکت نمیشه…
آنتیگش کرده"), and exports Lottie JSON / GIF / MP4. Taking that route costs the
subscription plus a `lottie-web` dependency the project does not currently have, and
lands ~40 KB of JSON per icon whose colours we then have to override at runtime.

**What we do instead, and it is not a downgrade.** An animated icon of this kind is a
line drawing whose strokes draw themselves on. That is `stroke-dasharray` /
`stroke-dashoffset` on an inline SVG — four lines of CSS, or GSAP which is already
vendored. Inline SVG also gives us the three things Lottie makes hard and BRAND
requires: one colour (`currentColor`, so navy on white and white on navy come free),
legible at 32 px, and weightless. Draw-on, staggered 01 → 02 → 03 → 04, once on entry
— visually the same thing Iconly sells, on our own key rather than a stock house's.

So: **glyphs are inline SVG we draw, animated with the stroke-draw the page already
uses.** Generated raster (§ the OpenRouter pipeline below) is used for the *section
stills* — the quiet related image that fills a body-copy-only screen — where a matte
still is genuinely the right medium and a glyph is not.

If he looks at both and still wants Iconly's exact set, the swap is one `<lottie-player>`
per slot plus the subscription; the markup around it does not change. Worth showing
him ours first — the whole point of "دست تو باشه بهتره تا دست من" is that the library
is editable, and a purchased Lottie is the least editable asset on the page.

**Division of labour he set:** the library is ours, the placement is his. "دست تو باشه
بهتره تا دست من — من انتخاب می‌کنم، میگم اینو بیار اینجا." We produce a sheet, he
points at which one goes where.

### 2.10 The image pipeline
`design/landing/_qa/gen.sh <name> "<prompt>"` — OpenRouter muse-image, run on the prod
server because this Mac's network kills HTTPS responses slower than ~10s; the result
comes back over `ssh cat` (the host has no scp). Output lands in
`design/landing/shared/cb/`.

First asset generated 2026-09-03: **`cb5-hero-field.webp`** (2352×1008) — the navy
field with the pale-blue ray wash and faint grid from his reference, violet and green
stripped. Good enough to build the hero on.

Remaining stills are generated *during* the build, not before it — each one has to fit
a screen whose shape the hard lock decides, and blind generation is the one part of
this that costs real money.


---

## 3. Also said, worth recording

- **Charts are undecided.** He will define the chart language when he reaches the
  Results page — "فرمت نمایش نمودارمون رو شاید بخوام اینطوری بکنم". So Cashback
  invents no chart. The dashboard panel (P4) stays a card with figures, not a plot.
- **Footer last.** Design every page first, count the data, then build the footer.
  He wants an Instagram / Telegram slot in it.
- **Logo.** He will send the file; the Figma file already has it and much else
  reusable ("از فایل فیگما خیلی چیزا می‌تونی استفاده بکنی").
- **Referral arrives next**, and he says its file is better prepared than Cashback's.
- **His weekly limit runs out in ~4 days**, after which no new page files for a
  while — the gap is for the app.
- **App redesign is queued**, white, and he wants first-open onboarding/skip screens.
  He wants a UX pass *before* the redesign.
- **Cost.** He considers the four-variant Home lane not to have paid for itself
  ("۵ تومن الکی رفت… انقدر خروجی نداد"). This is the strongest argument for §4.
- **Off-topic:** he asked about an AI-run LinkedIn presence. Not a website task;
  answer separately. Note that LinkedIn's write API is partner-gated — the pattern
  he described (auto-commenting under in-industry posts) is not available on the
  public API.

---

## 4. The plan

**One build, not a lane.** The four cb builds have done their job: they told us
which idea survives contact. He is now giving theme direction, not asking for
options, and he has said the multi-variant spend did not pay off. Next generation
is a single page, `design/landing/cb5/`.

**Base: cb4 "already trading", with cb3's weekly grammar folded in.**
cb4's hero is literally the animation rule he stated — the trade log stays fixed,
a Cashback column fills in beside it — and it contains no whole-versus-share
geometry. cb3 contributes the week strip and the credits stacking into history, for
the Control step and the calculator. cb1's two-record Meaning stays because it is
the wireframe's own block 4. cb2 contributes nothing; it is retired.

Page skeleton after the rules above:

    1  Nav                   shrink + blur on scroll
    2  Hero                  full-bleed blue, glass hero panel, log + column fills in   [pin]
    3  Fact strip            static row, white
    4  Meaning               two records, settled, no figures on the market side
    5  Chapter 1             NAVY FULL SCREEN, lateral line reveal, nothing else        [pin]
    6  Mechanics 01          one full screen each, one idea per screen, P1..P4          [pin ×4]
       Mechanics 02          no sticky-column layout anywhere
       Mechanics 03
       Mechanics 04
    7  Calculator            form drives one number, 180 ms cross-fade                  [pin]
    8  Chapter 2             full screen, light tint (dark cap already spent)           [pin]
    9  Activation            four rows rise; last row navy
    10 FAQ                   accordion, plain
    11 Final CTA             NAVY FULL SCREEN
    12 Footer                current footer; Instagram/Telegram slot stubbed

Engine unchanged: vendored GSAP + ScrollTrigger + Lenis in `shared/vendor/`, one
`main.js`, no build step, no new dependency. The section-advance behaviour is one
helper in cb5's `main.js` — do **not** promote it to `shared/` until Referral
actually needs it.

---

## 5. Tasks

Ordered. Sizes are rough.

1. **Confirm the two open reads** — the share-bar ban as stated in §2.1 (he was
   pointing at a shot on screen), and the two-dark-screens cap in §2.5. Scroll
   behaviour is settled: hard lock. — *blocking, minutes*
2. **Retire cb2.** Keep the directory for the record, drop it from
   `landing/index.html` and `deploy.sh`'s verify loop, note the reason in
   `CASHBACK-LANE.md`. — *20 min*
3. **Write the ban into `BRAND.md`** under "Visual — what is forbidden": no visual
   that shows the total rebate or Cashback as a slice of a whole. — *10 min*
4. **Scaffold `cb5/`** from cb4 + cb3's week strip; strip every sticky-column
   stage; re-ground the page to the §2.5 colour table. — *half a day*
5. **The hard-lock scroll engine** — wheel/touch capture with a cooldown, section
   index, keyboard (arrows, PageUp/PageDown, Home/End), Tab focus moving the index,
   nav anchors driving the index, plus the two fallback modes (mobile = normal
   scroll, `prefers-reduced-motion` = normal scroll). Build this first; every layout
   decision after it depends on the one-viewport rule. — *1 day*
6. **The two chapter-break screens** — full bleed, nothing else on screen, lateral
   line reveal on chapter 1. — *2h*
7. **Hero** — navy field, blue/white ray wash from one corner, faint grid, glass
   nav + button pills, white Cashback panels lapping the bottom edge; the trade log
   fixed, the Cashback column filling in. Ray wash is CSS radial gradients + blur,
   not a generated image — cheaper, resizes, and stays one hue. — *4h*
8. **Mechanics as four full screens**, P1–P4 rebuilt one per screen, each with one
   thing that fills in place. — *3h*
9. **Notification-arrival treatment** on the Control screen (P4) — credits landing
   as cards, cb3's stacking. — *1h*
9b. **Once-on-entry reveals** on every dry section, staggered for ordered lists
   (§2.3b), `once: true`, nothing hidden behind hover. — *2h*
9c. **The icon + still sheet** (§2.8–2.9) — 14 inline-SVG glyphs for the fact strip,
   the four mechanics, the two factor cards and the four activation steps; plus 3–4
   generated stills for the body-copy-only screens. Contact sheet for him to place. — *4h*
10. **Logo into nav and footer**, pulled from the Figma file. — *1h*
11. **QA pass** — Playwright, ten stops, 1440 + 390, plus `?reduce=1`; one batched
    fix round. `design/landing/_qa/shoot.mjs`. — *2h*
12. **Deploy** via `design/landing/deploy.sh`, confirm the URL 200s. — *20 min*

**Deferred, on purpose:** the footer redesign (task list says after all pages), any
chart language (his Results pass owns it), the typeface swap (one line when he
sends the name), promoting the pin helper to `shared/` (wait for Referral), and the
app redesign / onboarding screens (after Referral, in his 4-day gap).

**Estimate:** tasks 2–12 are about three days of build once task 1 is answered —
the hard lock and the icon sheet are most of the difference from the earlier
day-and-a-half figure. If he wants a date for "کش‌بکو کی می‌تونیم اوکی کنیم" — three working days
from his answers, the last one QA and revision.


---

## 6. Built — 2026-09-03

`design/landing/cb5/` — `index.html`, `style.css`, `main.js`, plus `fields.html`
(the hero-field picker). No new dependency; **no GSAP, ScrollTrigger, Flip or Lenis
on this page at all** — the lock replaces all four, and the reveals are CSS
transitions driven by one IntersectionObserver.

**13 screens**, one viewport each: hero · facts · meaning · chapter 1 · 01 broker ·
02 share · 03 activity · 04 control · calculator · chapter 2 · activation · FAQ ·
final (footer inside it).

### Scroll modes — hard and soft ship on the same build
Forking a second copy of three files to compare two scroll behaviours would have
meant maintaining both. Instead `?lock=` picks the mode:

| URL | Behaviour |
|---|---|
| `cb5/` (default) | **hard lock** — wheel captured, `scroll-snap-type:mandatory` + `scroll-snap-stop:always`. One flick = exactly one screen, measured. |
| `cb5/?lock=soft` | **soft** — no capture, `scroll-snap-type:proximity`. You scroll freely; it snaps only if you come to rest near a screen. One flick crosses two. |
| `cb5/?lock=off` | an ordinary scrolling document |

Soft deliberately uses `proximity`, not `mandatory`: with mandatory snap a wheel flick gets
pulled back at every tick and soft behaves almost identically to the lock, which would have
made the comparison meaningless.

`prefers-reduced-motion` forces `off`. Mobile and viewports under 1024×620 get `off`
regardless. The mode rides on native CSS scroll-snap in a real scroll container, so
the scrollbar, `Home`/`End`, Tab focus and anchor links keep working in every mode —
that is most of the a11y cost §2.3 warned about, avoided rather than paid.

### Ruled decisions, as built
- **Colour budget kept (§2.5):** hero full-bleed navy field; chapter 1 navy; final navy.
  Chapter 2 is a light tint. Nothing else is dark. The nav and the dot rail invert on
  the dark screens — driven off the current screen's ground, which is a bug the first
  pass got wrong (the nav went white on chapter 1).
- **No share-of-a-whole visual (§2.1).** The ladder shows four levels; the calculator
  prints one number; the log prints absolute credits. Nothing shows a total.
- **No sticky-column stage (§2.2).** Each mechanics step owns a screen.
- **Reveals fire once on entry, never on hover (§2.3b)** — `once`, staggered by
  `--i`. Ordered lists arrive 01 → 02 → 03 → 04.
- **Icons drawn, not bought (§2.9).** 10 inline-SVG line icons on `pathLength="1"`,
  drawing themselves on via `stroke-dashoffset` — the Iconly effect, in `currentColor`,
  legible at 32 px, ~0 KB. Slots: the four facts, the two factor cards, the four
  activation steps.
- **A dot rail** replaces the scrollbar as the "there is more below" affordance —
  clickable, labelled, and the only new UI the lock forced.

### The checks
Two, because the lock has a behaviour worth testing and not just a layout.

`design/landing/_qa/lock.test.mjs` drives a real wheel burst — the twelve events one trackpad
flick emits — and asserts hard moves exactly one screen while soft moves more, then that `End`
and `Home` land on the last and first screens. It earned its keep immediately: the first
implementation derived the section index from IntersectionObserver threshold *crossings*, so
during a fast move the last callback could belong to the screen being **left** rather than the
one being entered — `End` settled on screen 11 instead of 12, and a flick was re-marked back to
where it started. The index now comes from whichever screen shows the most pixels, recomputed
on scroll; the observer was left doing only the once-on-entry reveal, which is the one job
crossing semantics are right for.

`?check=1` prints a pass/fail line to the console: the three calculator constants
(`50 lots × 17 × 1 × 10% = $85`, ECN `$30`, Diamond `$255`) and that no screen
overflows its viewport in either axis. `design/landing/_qa/shoot-lock.mjs <url> <out>`
drives the section index (the old harness scrolls the window, which does nothing on a
locked deck) and shoots 1440×900, 1280×720, 390×844 and `?reduce=1`.

Current status: **all 13 screens fit at 1440×900 and 1280×720, mobile has no sideways
overflow, zero console errors, self-check passes in all three modes, and the lock test
passes** (hard: 1 screen per flick, End→12, Home→0; soft: 2 per flick).

### Open
- **The hero field still needs picking.** The first generated still was rejected. Ten
  variations were generated into `shared/cb/cb5-field-01..10.webp` — soft dawn, single
  beam, glass panes, horizon, caustics, vertical columns, lens bloom, grid depth,
  frosted sweep, deep quiet — and are compared **in place** at `cb5/fields.html`, which
  swaps each behind the real hero copy and glass panel rather than showing loose stills;
  a field that reads well as a 21:9 crop can still bury the headline. Once he picks one,
  the rest get deleted. Read so far: several push light behind the *right* half, where the
  glass log sits, and the trade rows stop being readable (06, 08, 09 worst); 02, 07 and 10
  keep that side dark, and 03 is the only one that actually reads as glass.
- **Which scroll mode ships.** Hard is the default and the ruling, but soft is one URL
  away now — worth him feeling both on the same content before it is final.
- ~~Deploy did not run~~ — **deployed 2026-09-03**, all URLs 200.
  `https://trustforex.net/v/landing/cb5/` · `?lock=soft` · `cb5/fields.html`.
- Typeface still Inter, pending his font identification (§2.6).


## 7. Two process bugs worth not repeating — 2026-09-03

**`.field` meant two things.** The hero's ray backdrop was named `.field`; cb4's calculator
already used `.field` for a form input group. Every input group therefore inherited
`position:absolute; inset:0` and expanded to fill the screen, collapsing the form to 0 px and
painting the backdrop's navy gradient over the calculator. It looked like a background bug,
not a layout one. Backdrop renamed `.rayfield`; `?check=1` now asserts the form has real
height. When adding a utility class to a stylesheet inherited from another build, grep the
name first.

**A dropped `ssh cat` looked like a design choice.** `gen.sh` copies generated images back
over `ssh cat` (the host has no scp). Two transfers died mid-copy and left 0-byte `.webp`
files. A 0-byte image renders as nothing, so the tile showed the page's own dark background
and read as a legitimately minimal field — it was reported as one before the file size was
checked. `gen.sh` now deletes a 0-byte result, exits non-zero, and prints that the image is
still on the server so it gets **re-copied rather than regenerated**. Both stranded images
(05, 08) were recovered that way, not re-made.


## 8. Hero field — round two, 2026-09-03

The first ten were rejected: "04 is better but all other ones are awful… instead of ray
should be soft halo like", with the OrbitX reference plus two more of its inner sections.
What those three actually show: a **near-black blue ground**, a soft diffuse glow with no
directional structure, and the treatment used as a *card* ground as much as a hero.

Three rounds, all in `shared/cb/`, all reviewable in place at `cb5/fields.html`:

| Set | Prompt idea | Outcome |
|---|---|---|
| `cb5-field-01..10` | rays, beams, grids | rejected; only 04 survived, the one with no visible shafts |
| `cb5-halo-01..05` | one smooth radial bloom, rays explicitly banned | **01 and 05 are the keepers.** 02/03/04 put the bloom on the right, where the glass log sits, and the trade rows wash out |
| `cb5-cloud-01..05` | "defocused light cloud" | mostly a miss — the model read *cloud* literally and returned fog. Only 05 is usable. The word was the bug, not the idea |

**And a CSS option, `.rayfield.mesh` — no image at all.** The reference glow is a gradient
mesh, which CSS makes natively: four `radial-gradient`s on a near-black ground. Exact colours
(no violet or green leaking out of an image model), crisp at any viewport, no image request,
and re-tuned in seconds instead of a 60s round trip. At full size it is the closest of
everything to the references' depth, with the right half dark enough that the log stays crisp.

Two things learned the hard way, both worth keeping:

- **Judge fields at full size.** The contact sheet renders tiles at 0.5 scale, and that
  flattened the mesh badly enough that two tuning passes were spent on a problem that did not
  exist. Tiles are for sorting; the decision needs a 1440×900 render.
- **The first mesh had a real bug:** `inset:-30%` mapped the gradient positions to a box far
  larger than the visible one, and `blur(70px)` on already-smooth gradients only flattened
  them further. `inset:0`, no blur.

Also removed: the CSS light-wash that sat on top of the hero image. It was a second,
directional light source fighting whatever the field did — the glow now comes from the field
alone, and the only overlay left is the bottom scrim that keeps copy legible.

**Open — a brand question, not a rendering one.** All three references are near-black, and
`BRAND.md` says "No heavy black. White is the transparency signal; navy is the dark end."
Everything above is generated blue-black to stay inside that rule. Going to true OrbitX depth
means amending BRAND.md, deliberately.


## 9. Recreations instead of variations, and two more builds — 2026-09-03

> "you do not need to generate images, can you first try to exactly recreate the images i
> sent you instead of different variations?"

Right call, and cheaper. The three references are reproducible in CSS — layered
`radial-gradient`s on a near-black ground, no image request — and they now live in
`cb5/style.css` as three classes, compared against the originals at **`cb5/refs.html`**:

| Reference | Class | What it is |
|---|---|---|
| #4, the OrbitX hero screen | `.rayfield.orbit` | royal-blue body brightest high-left of centre, cool lift at the top edge, faint 62px grid in the mid-tones, hard fall to near-black across the bottom and right |
| #5, the "Instant, Safe & Seamless" card | `.ground-a` | near-black; one dark-blue mass left of centre, a brighter bloom low-left, black past the middle |
| #6, the wide "Profit Champions" card | `.ground-b` | black on the left, a broad diffuse wash sweeping centre-to-right with paler wisps on it |

The first pass of `.ground-a` / `.ground-b` read at about half the references' intensity;
doubled. `.rayfield.orbit` is now the hero ground on cb6 and cb7 — no image at all.

### cb6 · free scroll, chapter breaks · `design/landing/cb6/`
> "one without any lock/snap, with focus on page break texts, some should go from right
> bottom to left (character by character) and after swiping up fully (break text should be
> the only thing in the page)"

No lock, no snap: the document scrolls. Each chapter break is a **220vh runway with the
sentence pinned** (`position:sticky` inside it) for the whole distance, so once you have
scrolled fully in, the sentence is the only thing on screen — and stays there until you
scroll on. The characters travel in from the **bottom-right corner** (chapter 1) or straight
in **from the right along the line** (chapter 2, `.sweep`), first letter landing first,
driven by scroll progress — one rAF-throttled handler and a cubic ease, no library.

Files: `index.html` (cb5's, with the chapter headlines marked `.chars` and the hero on
`.rayfield.orbit`), `style.css` (imports cb5's, ~20 lines of its own), `chapter.js`. The
engine is cb5's `main.js`, told `window.TF_LOCK = 'off'` before it loads.

One bug worth remembering: cb5 gives `.chapter` `overflow:hidden`, and **any overflow other
than visible on a sticky element's ancestor makes that ancestor the scrollport** — the text
"stuck" to a box that never scrolls, which looks exactly like no pin at all. `overflow:visible`
on the chapter is load-bearing and commented as such.

### cb7 · hard lock, chapter breaks · `design/landing/cb7/`
The same chapter treatment on cb5's lock, so the two can be compared on identical content.
Time-driven on entry (a locked screen has no scroll to scrub against): `.chapter.in .c`
transitions from `translate(var(--dx),var(--dy))` with a 20 ms stagger. Passes the cb5 QA
pass — 13 screens, none overflowing, no console errors. `chapter.js` is twelve lines that
split the headline; cb5's engine and CSS transitions do the rest.

**Assumption stated:** the request named one variation explicitly (no lock). The second is
the same chapter focus on the lock. If the second should be something else, cb7 is the
cheap one to change.

### Two changes to cb5 to make that possible
- `main.js` reads `window.TF_LOCK` before the `?lock=` query, so a build can fix its mode.
- The section index listens to `scroll` on the window as well as the deck, so a build that
  lets the document scroll keeps its nav and dot rail honest.


## 10. Ten CSS glass grounds — 2026-09-03

> "use css and generate 10 different images like showed you but with our blue navy theme
> instead, they should be astonishing and eye appealing and modern, the blur should be glassy"

`design/landing/cb5/grounds.css` — ten portable classes, `.g01` … `.g10`, gallery at
**`cb5/grounds.html`** (each tile is the real hero on that ground; `?g=04` shows one full
size). No images anywhere in them. Markup for any ground is one line:

    <div class="rayfield g g04" aria-hidden="true"><i></i><i></i><i></i><i></i></div>

The four `<i>` are blank; each ground's CSS decides what they become — a blurred blob
(`filter:blur` on a solid or gradient fill, which is what makes the light organic rather
than mechanical), a frosted pane (`backdrop-filter:blur` with a 1px rim and an inset
highlight — the glass), a grid, or a ribbon. Every ground gets a film-grain layer (an inline
SVG `feTurbulence`, screen-blended at low opacity) and a bottom legibility scrim.

| # | Name | Idea | Log panel |
|---|---|---|---|
| 01 | Corner bloom | the OrbitX hero refined: royal body high-left, grid, one pane catching the edge | holds |
| 02 | Twin panes | two frosted planes crossing a dark field, light on their edges | holds, sits on the brighter pane |
| 03 | Aurora | one broad ribbon of pale light, blurred to silk | **washes out** — the ribbon runs through it |
| 04 | Deep pool | reference #5: near-black, three submerged masses | holds — the quietest |
| 05 | Horizon | a bright line low in the frame, a frosted band lying across it | holds, busy behind the button |
| 06 | Orbital | one immense ring off the right edge, frosted rim | holds, ring is strong behind it |
| 07 | Louvre | tall frosted slats over a moving light | **washes out** — slats behind the rows |
| 08 | Drift | four soft masses, two pale two deep | holds |
| 09 | Frosted spotlight | one halo high in the frame, the whole field a sheet of glass | holds |
| 10 | Grid depth | a perspective grid receding into a glow, a pane over the vanishing point | holds |

03 and 07 are the two that fail the only hard test on this page — the trade rows in the glass
log must stay readable — and would need the light moved off the right half to survive.

### Deploying small changes
`design/landing/deploy-inc.sh <paths under design/>…` ships only the named paths straight
into the live `/v/` tree. The full `deploy.sh` pushes the whole 138 MB tree with an atomic
swap and the ssh pipe died mid-`tar` three times today; for a few new builds with no new
shared assets, incremental is the right tool and takes seconds. Use `deploy.sh` when
`shared/` changes.


### Grounds v2 — plain colour, halos only
> "the background should not have a pattern, just plain color with halos that are
> glass/blurry like, 10 different ones"

`cb5/grounds2.css`, classes `.h01` … `.h10`, same one-line markup with the `h` prefix;
gallery at **`cb5/grounds.html?set=2`** (the one gallery serves both sets). No grid, no
grain, no panes, no scrim — a plain navy (`#0B1633`, or the brand `#0F2044` on 05 and 10)
and blurred halos. Each halo is a radial fill (white core → sky → trust blue → nothing)
under 44–140 px of blur, so it reads as frosted light rather than a disc; `--core` sets
how white the centre is and `--bl` the blur, per halo.

| # | Name | Halos |
|---|---|---|
| 01 | One | a single large pale halo high on the left |
| 02 | Point | one tight white-cored halo top-centre |
| 03 | Pair | pale top-left, deep blue bottom-right |
| 04 | Scatter | three small soft halos, none where the words are |
| 05 | Wash | one immense halo, so diffuse it is almost a tint |
| 06 | Rise | light coming up from the bottom-left |
| 07 | Bar | one elongated halo lying along the top edge |
| 08 | Corner | a cool halo bottom-right only; the copy side untouched |
| 09 | Lamps | two halos stacked on the left edge |
| 10 | Ring | one blurred torus, light at the rim, plain inside |

All ten keep the halos off the right-hand third, so the glass log's rows stay crisp on every one.


### Grounds v3 — blurred rays
> "it should look like an image of blue, white rays (and colors in between), but blurred to
> the point it looks like a halo"

`cb5/grounds3.css`, classes `.r01` … `.r10`, gallery at **`cb5/grounds.html?set=3`**.

What the reference actually does, and what v2 was missing: the light is **directional**.
Broad streaks run lower-left to upper-right, overlap at slightly different angles, and each
one carries the whole ramp along its length — deep navy → royal blue → periwinkle →
near-white core → back down. Then it is blurred until no edge survives, which is why it
still reads as a halo rather than a beam. v2's halos were radial, so they could never look
like this no matter how they were placed.

So each `<i>` is an elongated ellipse carrying that ramp, rotated and blurred 28–140 px.
Three ramps: the default, `ice` (near-white core, for where the reference goes brightest)
and `deep` (never reaches white, for rays passing behind the panel). Per-ray variables are
`--rot`, `--bl` and `--a`, so "the same but shallower / softer / fainter" is a one-line edit.

| # | Name | Rays |
|---|---|---|
| 01 | Prism | three parallel, the middle one carrying the white core |
| 02 | Fan | opening from off-frame bottom-left at widening angles |
| 03 | Cross | two broad rays meeting in a shallow X |
| 04 | Sweep | one enormous ray across the frame, a fainter one trailing |
| 05 | Cascade | four narrow rays, cooler and fainter as they climb |
| 06 | Veil | near-vertical — the light standing up rather than lying down |
| 07 | Rise | shallow rays low in the frame, lifting to the right |
| 08 | Shard | two tighter, less-blurred rays over one long soft one |
| 09 | Drape | three very wide rays at scattered angles, the most blurred |
| 10 | Spectrum | one dominant ray at the full ramp, a deep one behind the panel |

**Legibility, measured not eyeballed.** These rays are aimed up and to the right, which is
where the glass log sits, so the trade rows are the thing at risk. Each ground was rendered
at 1440×900 and the contrast between the row glyphs and the panel ground behind them
sampled from the actual pixels (`PIL`, median of the darkest 60 % against the brightest
1.5 %):

    holds (≥3:1):  01 02 03 05 06 08 10
    tight (2.2-3): 04 09
    fails (<2.2):  07

Worth recording that the eyeball read off the contact sheet was **wrong** — it called 07 a
keeper and several of the holds failures, because at 0.5 scale the bright headline area
dominates and the panel is too small to judge. The measurement is the one to trust.

If a "tight" or failed one is the favourite, the fix is one line: shift that ray's `left`
so the white core lands before the panel, or give it the `deep` ramp.


### Grounds v4 — shapes, blurred further
> "make it more blurry, also use different shapes like in the image i sent, instead of just rays"

`cb5/grounds4.css`, classes `.s01` … `.s10`, gallery at **`cb5/grounds.html?set=4`**.

v3 read the reference as straight rays. That was an over-reading: most of the light in it is
**not** straight — billowy irregular masses, soft arcs and wisps, with maybe one streak,
every one defocused past the point where its shape is nameable. So v4 replaces the single
form with a small vocabulary, composed differently per variant:

| Token | What it is |
|---|---|
| `--br-a/b/c` | irregular eight-value `border-radius` → organic blobs, not ellipses |
| `--f-core` | white-cored fill, the brightest patches |
| `--f-blue` | royal-blue mass |
| `--f-deep` | navy mass that never reaches white — for anything passing behind the glass log |
| `--f-streak` | the v3 ray, kept as one member of the vocabulary rather than the whole of it |
| `--f-arc` | a ring, so an arc of light can curve through the frame |

Blur runs **100–200 px** against v3's 28–140.

01 Bloom · 02 Confluence · 03 Nebula · 04 Arc · 05 Tide · 06 Plume · 07 Scatter · 08 Fold ·
09 Halo drift · 10 Composite.

**All ten pass the legibility measurement** (same PIL method as v3): contrast between the
row glyphs and the panel ground runs 3.51 – 5.25:1, no tights, no failures. Heavier blur is
why — spreading the same light over a wider area drops its peak, so the panel never gets a
hot spot. v3's problem solved itself as a side effect of the thing that was asked for.


## 11. One typeface — 2026-09-03

> "make all fonts inter … like https://trustforex.net/v/landing/wireframe-cashback-v24.html"

Checked: the wireframe declares exactly one family, Inter, and no second face. cb5–cb7 were
carrying **Spline Sans Mono** across 22 rules — every label, the trade-log columns, the
dashboard rows, every figure — inherited from the cb1–cb4 scaffold.

Done, in `cb5/style.css` (cb6 and cb7 `@import` it, so all three moved together):

- The `@font-face` for Spline Sans Mono is gone, and so is the `--mono` token. It was
  **retired rather than repointed** — a variable named `--mono` that resolves to a
  proportional face is a trap for whoever reads it next. All 22 uses are now `var(--sans)`.
- `font-variant-numeric: tabular-nums` on `body`. The mono was doing real work aligning the
  log columns, the week strip and the dashboard rows; Inter's tabular figures replace it.
- `font-family` also set on `html`, so the check below can't pass on a technicality.

Verified by computed style rather than by eye: every element in cb5, cb6 and cb7 resolves to
Inter, and `.log-row .num` reports `tabular-nums`. Full QA pass still clean — 13 screens,
none overflowing, no console errors. The review tools (`grounds.html`, `refs.html`,
`fields.html`) had hard-coded `ui-monospace` in their own captions; those moved too.

`BRAND.md` already said "Inter — the default for every website design, no exceptions", with
the mono allowed for numbers and labels. That carve-out is what these builds were using; it
is now unused on this page. Worth deciding whether the carve-out survives at all — the
wireframe suggests not.

### A capture bug, not a layout bug
The first screenshot after the change appeared to show only three of the four week cards on
screen 08. Measured: all four were present and correctly placed, the fourth simply sat at
0.66 opacity when the shutter fired. Its reveal is a 0.70s delay plus a 0.45s fade, and that
clock only starts once the smooth scroll lands and `.in` is added — past the harness's
1250ms wait. `_qa/shoot-lock.mjs` now waits 2100ms. Worth remembering: on a page whose
reveals are deliberately staggered, a screenshot taken too early looks exactly like a
missing element.


## 12. One blue — the Mini App's primary ramp — 2026-09-04

> "also change the colors (all including images) to the primary blue of mini app"

The app's primary is `#144CCD` (`--primary-colors-900` in `src/design-system/tokens.css`),
with a full ramp from `#E7EDFA` up to `#033AB8` and a pressed state at `#002D94`. cb5's
`--accent` already happened to be `#144CCD`; **nothing else was on the ramp** — the navy was
an ad-hoc `#0F2044`, the soft blue an ad-hoc `#E7EEFF`, and the four ground sets carried 107
hand-picked `rgba()` blues that answered to nothing.

All of it now derives from the app's tokens:

- **The ramp is copied verbatim into `cb5/style.css`** as `--p-50` … `--p-950` plus
  `--p-pressed`, with a comment naming its source. Roles point at it: `--accent: var(--p-900)`,
  `--accent-deep: var(--p-950)`, `--accent-soft: var(--p-50)`.
- **Two steps below the app's darkest**, `--p-deep #09225C` and `--p-abyss #06173E`. The app
  never needs them because it has no full-screen dark ground; they are `#144CCD` carried down,
  not a separate navy. `--navy` now resolves to `--p-deep`, so the chapter and final screens
  are the primary hue rather than a colour of their own.
- **The same ramp as RGB triplets** (`--rgb-900: 20,76,205`, …) so the grounds can take an
  alpha off it.
- **107 `rgba()` values and 8 ground base colours** across `grounds.css`, `grounds2.css`,
  `grounds3.css` and `grounds4.css` were rewritten to the nearest ramp step by RGB distance,
  alpha preserved. True neutrals were left alone on purpose — the white rims and black
  shadows on the glass are not "the blue", and tinting them would have muddied the glass.

Verified after: full QA pass clean (13 screens, none overflowing, no console errors) and the
set-4 legibility measurement re-run — 3.2 – 4.4:1, all ten still hold. Contrast dropped
slightly (was 3.5 – 5.3) because the ramp's mid-tones are lighter than the ad-hoc blues they
replaced; still comfortably above the 3:1 bar.

Deployed: `cb5/`, `cb6/`, `cb7/`, all ground galleries and `refs.html`.

**Left alone, deliberately:** the neutrals (`--ink`, `--body`, `--muted`, `--line`, `--paper`)
and the soft-yellow "Estimate" tag. The instruction was the primary blue; the app's own
neutral tokens (`#212121` text, `#7C7C7C` sub-text, `#E4E4E4` stroke, `#F1F1F1` container)
are a separate, larger change and would shift every screen's greys. Say the word and they
move too.


### The construction was backwards — 2026-09-04
> "these aren't the primary blue color of miniapp yet" · the app splash (a solid `#144CCD`
> field) · "ببين اين مثلا تم ابي مارو انداخته رو سفيد / ما بندازيم رو تيره ميكس با رنگ سازمانيمون"

§12 put every value on the app's ramp and the grounds still read as slate. Measuring the
rendered pixels said why, and corrected two wrong guesses on the way:

1. **Hue was already exact** — 222° on all ten, matching `#144CCD`. Saturation was the
   problem: 22-48% against the target's 82%.
2. **First guess: the white cores are washing it out.** Shrinking them from a third of the
   radius to 6% moved saturation by *one point* (23-48%). Wrong.
3. **Actual cause: the construction was inverted.** These were dark fields with small blue
   glows, so the brightest quarter of the frame is the pale transition zone between glow and
   ground — a mid-grey-blue. The app splash and the Premium-Plan reference are the opposite:
   a **blue field** with darker areas in it. Mixing `#144CCD` with near-black *preserves* its
   saturation; the light-on-dark composition simply never produced much saturated area.

So the bases became `#0C2E7B` — `#144CCD` carried down, saturation 82% intact — and the
`--f-deep` masses became actual shadows (`rgba(4,8,26,…)`) instead of dim blues, doing the
darkening that the ground used to do. Result: **hue 222°, saturation 62-69%** across all ten,
against 22-48% before.

**One consequence that had to be fixed with it.** On a bright field the glass log lost its
contrast — four grounds fell to 2.7-3.0:1 — because `.log` was a *light* tint
(`rgba(255,255,255,.07)`) and a light tint takes its brightness from whatever is behind it.
It is now smoked glass (`rgba(5,12,36,.42)`), which keeps the panel's interior dark on any
ground while staying transparent enough to read as glass. Rows are back to **4.4-7.1:1, all
ten passing** — better than they ever were on the dark grounds.

Full QA pass clean. Deployed to cb5, cb6, cb7 and every gallery.


## 13. The consolidated brief — 2026-09-05

Received as one summary plus five OrbitX / wireframe screenshots. Read against the four ground
galleries: "V1 / V2 / V4" are `grounds.html` sets, and V2 is the plain colour with halos.

| His instruction | Built |
|---|---|
| Hero text-only, big, bold, centred; background depth "slightly" enhanced | the log is gone from the hero; `#hero .display` 96px/700 centred, 16ch; every v5 ground carries one same-hue vignette + a top-edge lift |
| V2 palette selected, V4 discarded; keep V2 pages except the white circle | v5 = v2's 01–09 (10 Ring dropped) |
| Move V1 patterns to the V2 palette, excluding 5, 6, 7, 10, include Corner bloom | v5 10–15 = Corner bloom, Twin panes, Aurora, Deep pool, Drift, Frosted spotlight on `#0C2E7B` with v2's halo recipe; grain and black scrim dropped (they were v1's tone) |
| "[hero] and [final] should be full blue, like [v2 · 01 One]" | hero on `k01`; final on `k01` mirrored (`scaleX(-1)`), so the page opens and closes on one ground |
| Blue/white contrast transitions: white-to-blue, solid blue, outlined white | hero · chapter 1 · final = full-bleed blue; facts · m01 · m03 · calculator · activation = white with outlined panels; FAQ and chapter 2 = white-to-blue hand-offs into the blue that follows |
| "white chart blue card" (OrbitX) · "all 4 black pages should be blue with white chart" · layout variation: white outer, blue central block | **`.block`**: a rounded `#0C2E7B` block inset on a white page, copy in white, the data as an opaque WHITE card in a glass rim — on Meaning and all four mechanics. Full-bleed blue stays for the three moments, so the two formats alternate |
| Slim frosted nav, iPad Pro register; same glass on right-side table modules | 48px continuous strip, `saturate(180%) blur(20px)`, hairline, plain text links; dark-tinted on blue screens, white-tinted on paper. The panels' glass is the rim (two ring shadows in cb5, a real refracting frame in cb8) — the card itself stays white for contrast |
| Minimal, subtle accents "at the final stage, following approved reference examples" | **not done** — no reference examples received. The soft-yellow Estimate tag is the only accent on the page |
| Charts: diverse, vibrant colours | recorded in BRAND.md; nothing to build here (Cashback has no chart, Results owns the language) |
| Full discretion over section-by-section contrast | taken; the cap of §2.5 is superseded and BRAND.md says so |

### Files
- `cb5/grounds5.css` — `.k01` … `.k15`, gallery `grounds.html?set=5` (renders the text-only hero).
  `cb5/?ground=kNN` previews any of them on the real page (`main.js`, one line).
- `cb5/index.html`, `cb5/style.css` — hero, nav, `.block`, colour flow, `.split-panel`.
  `#meaning` is a block too (the wireframe's white "One eligible trade" card is the chart).
- `_qa/derive.py` — cb6, cb7 and **cb8** are cb5's page plus a handful of deltas; run it after
  any `cb5/index.html` edit instead of hand-patching three copies.
- **`cb8/`** — the same page with the chrome as **liquid glass**: floating nav capsule, glass
  CTAs on blue, a 14px refracting frame around every white chart, glass cards on the white pages,
  a faint 48px grid in the blue grounds (refraction needs structure behind it — a smooth halo bends
  invisibly). The bend is one SVG `feDisplacementMap` (`#liquid`, animated `feTurbulence`, 24s)
  used inside `backdrop-filter`, which only Chromium honours; the declaration is written after a
  plain blur so other engines keep the frost. `prefers-reduced-transparency`, `@supports not
  (backdrop-filter)` and `reduce` (pauses the SVG animation) all fall back to solid.

Two rendering lessons from cb8: a pseudo-element's `inset` measures from the nearest *positioned*
ancestor — the frame first sized itself to the whole block because `.panel` had no `position`;
and a negative-z pseudo paints above its parent's background, so if the card had a background the
frame's backdrop-filter bent the white edge into a torn outline. The card is transparent and its
white is a second pseudo painted after the frame.

QA: cb5 and cb8 both pass the full pass — 13 screens fit at 1440×900 / 1280×720, mobile and
`?reduce=1` clean, no console errors, lock test green (hard 1 screen per flick, soft 2, End→12,
Home→0). Deployed: cb5, cb6, cb7, cb8, `grounds.html?set=5`.

### Open
- **Pick the hero ground** from `grounds.html?set=5` — `k01` is the default because he pointed
  at it; the other 14 are one query param away.
- **Accents** wait for his reference examples.
- **cb5 or cb8** — same content, same scroll modes; the liquid glass costs a few more
  backdrop-filter layers per screen and its refraction is Chromium-only.

### The lock froze under a finger that kept moving — fixed 2026-09-05
> "in hardlocks sometimes the page stucks in the middle and not moving forward despite
> scrolling, i have to wait and try again"

Exactly what the engine did. It had one 780ms cooldown that **restarted on every wheel tick**
(added to swallow trackpad momentum), so as long as ticks kept arriving — a steady two-finger
drag, a mouse wheel being spun — the cooldown never expired and nothing moved until the user
stopped for most of a second and flicked again.

Two questions now, kept apart in `cb5/main.js`:

- **Is a move in flight?** `busy`, from `go()` until the target screen has actually landed
  (its rect polled each frame, 1200ms hard ceiling) plus 120ms. Nothing can restart it.
- **Is this tick a new gesture?** Momentum from the last flick only decays, so a new gesture is
  a pause of 200ms+ (momentum ticks every 16–100ms) or a delta larger than the previous tick.
  A notched mouse wheel's ticks are equal and steady and would never read as new, so any tick
  ≥40 more than 1.3s after the move counts too — the ceiling is that a very hard trackpad flick
  whose tail is still ≥40 at 1.3s moves two screens.

`_qa/lock.test.mjs` grew three cases beside the original flick: a 1.3s decaying momentum tail
that outlasts the transition still moves exactly one screen; 2.4s of continuous jittering
trackpad ticks moves four (it used to freeze); 1.8s of equal mouse-wheel notches moves two. The
first cut used a 90ms pause and the momentum-tail case caught it — coalesced tails tick at
~100ms and read as three separate gestures. Deployed to cb5–cb8 (`main.js?v=3`/`?v=4`).

## 14. His icons — the placement round begins, 2026-09-05

> "I will provide some icons and the color i want them to be and the place they should be with
> images, use them … green … also icons should be animated"

This is the division of labour from §2.9 in action: the library is ours, the placement is his.
Each icon he sends is rebuilt as an inline SVG in the page's own stroke-draw system, not bought
or embedded — same `currentColor`, same once-on-entry animation, same `--i` stagger.

| # | His pick (Iconly) | Colour | Where | Built as |
|---|---|---|---|---|
| 1 | Check Circle · **two-tone** | green | activation step 04, "Get confirmed and start receiving Cashback" | `.ico.ico-two-tone.ico-success`: a `.tone` disc (fill `currentColor` at .24) that springs in — scale .4 → 1 past size and back, `cubic-bezier(.34,1.6,.64,1)` — then the check draws on. Green is `--success: #48D48A`, the app's `--state-colors-success`; BRAND allows green for success only, and "confirmed" is one |
| 2 | Coins · **two-tone** | green (he offered green or yellow; yellow coins read as gold, which BRAND bans, and one accent colour is quieter than two) | mechanics 03, the "Trading volume" factor | `.ico-two-tone.ico-success`, a three-layer stack with the top face as the disc |
| 3 | User · **Light** | primary blue `#144CCD` (his call to us: "an appropriate color from our brand" — account type is a descriptor, not a state, so it takes the line icons' blue) | mechanics 03, the "Account type" factor | `.ico-light`, 1.35 stroke, draws on; the two factors are staggered `--i:1`, `--i:2` |
| 4 | Dollar Receive · **Bold** (his loop also covered Dollar Circle 2 — same glyph without the arrow) | green | Meaning, the "Cashback record" card, on its heading row | `.ico-bold.ico-success`, 2.1 stroke |
| 5 | Web Page Analytics · **Light** | "orange" → the brand's amber `#FFC300` (`--warning`); the palette has no orange | Meaning, the "Market record" card, on its heading row | `.ico-light.ico-warning`. Thin amber on white is faint by nature — if it needs to carry more, Bold weight is the lever, not a darker colour |

**The disc is the icon's own colour at 28% opacity**, not the palette's pale companion: over white
that lands on the companion anyway (`#48D48A` at .28 ≈ `#E9F9F1`), and over navy it becomes a
dark tint that keeps the stroke legible — the opaque mint disc washed the green check out.

**Two-tone is now a style any icon can take:** add `.ico-two-tone` and give the SVG a
`<circle class="tone">` (or any shape) under its strokes. The disc pops 100ms before the strokes
start drawing, so the pair reads as one Iconly motion rather than two effects.

### "colors are not there for icons, they're white" — two causes, 2026-09-05
1. **Cascade.** `.pstep.last .ico{stroke:#fff}` and `.pstep.last .ico-success{stroke:green}` have the
   same specificity, and the white rule came later in the file, so the check drew white on its green
   disc. The icon-colour block now lives after the activation rules. When colouring an icon inside a
   row that already recolours icons, put the rule after the row's, or it never applies.
2. **Stale sheet at the edge.** Cloudflare caches CSS for 4h by URL, and `style.css?v=2` had been
   edited all day without a bump — the live page had the new SVG markup with a 24-minute-old
   stylesheet (`cf-cache-status: HIT`). `_qa/derive.py` now stamps every stylesheet and script link
   in cb5–cb8 with a content hash (`?v=2103924c`), including the `@import` of cb5's sheet inside the
   derived builds, so a changed file is a new URL. **Run derive.py before every deploy**, even when
   only cb5 changed. HTML itself is `DYNAMIC` (uncached), so the new links always reach the browser.


## 15. Back to the wireframe's structure, soft scroll — 2026-09-05

> "remove sections that doesn't exist in wireframe-cashback-v24.html … structure is the wireframe,
> also remove these data that is not in the url … also make it soft scroll, remove hard lock"

Diffed section by section against the wireframe's text (annotations stripped). Removed from cb5:

| Screen | Was added by the lane, not in the wireframe |
|---|---|
| Facts | the whole "What Cashback gives you" screen — the wireframe has a **fact strip** (a 34s marquee of the four labels) under the hero, now pinned to the foot of the hero screen |
| Meaning | the five trade rows in each record card, "Sample · Standard 10% share" |
| 01 | broker names (GTCFX / B / C → three "Partner broker" rows, no selected state), "Sample partner brokers"; page numbers are the bare `01`–`04` |
| 02 | the durations under each level (No paid plan / 1 month / 3 months / 12 months) |
| 03 | the chips (Standard · ECN, 50 lots / month) and the note |
| 04 | the week strip and "Sample overview…"; the cards are in the wireframe's order, rate first |
| Calculator | "Your setup / Estimate" header, "Lots per month", the note; levels read "10% share"; "View rules for each broker" moved after the estimate, where the wireframe has it |
| FAQ | the subtitle; answer 3 regained the wireframe's last sentence |
| Footer | the risk line (the Telegram/Instagram slot stays — he asked for it, §3) |

Kept: the icons he placed (§14), the hero/blue-block/glass theme — "only the theme is ours".
12 screens now, the wireframe's blocks exactly.

**Soft scroll is the default** (`main.js`: `?lock=hard` opts back in, `?lock=off` is a plain document).
cb7 pins `window.TF_LOCK = 'hard'` so it stays the lock variant; cb6 stays `off`. The lock test still
runs both modes by explicit `?lock=`.

## 16. Five rulings in one sitting — 2026-09-05, evening

| His words | Built |
|---|---|
| "padding should be this much" (a mock with the block 20px off the nav and the edges, filling the screen) · "for the 4 sections that we already have" | `.fill`: the block is `min-height: 100dvh − nav − 40px`, 20px from the nav, the sides and the bottom, content centred inside. The four mechanics; Meaning keeps its inset card |
| "make background blue here with white chart" (the calculator) | the calculator is a `.screen-blue.fill` block too, the form as the white chart in the glass rim. cb8's paper-page glass no longer applies to it |
| "remove all lines in chapter break texts" | `.chapter-rule` gone from both chapters, and from cb6/cb7's chapter CSS |
| "when chapter break goes out of the page, increase its size as it goes out" | a **native scroll-driven animation**: the chapter section names a view timeline, its `.h2` scales 1 → 1.8 over `animation-range: exit`. No JS. Measured in Chromium: 733 → 908 → 1084 px wide at 0 / 30 / 60 % out. Desktop snap modes only |
| "make this 4 sections to be over each other … section 1 should stay and section 2 should go over it (a little bit of section one visible from the sides)" | `position: sticky; top: 0` on the four mechanics screens. The incoming block enters at scale .92 → 1 over its own `entry` range, so the pinned one shows at the sides while it comes; the pinned one dims (brightness 1 → .55) over the *next* screen's entry — its timeline is hoisted with `timeline-scope` on `#deck` so a sibling can read it. Proximity snap still lands on the sticky screens' own offsets (measured: scrollTop 3600 = m2's offset) |

**One engine change that the sticky forced.** The section index used "whichever screen shows the
most pixels", and a pinned screen never stops showing pixels — the rail would have stayed on 01
under 02, 03, 04 and the calculator. It now reads the scroll position against each screen's layout
offset: the last screen whose top has passed the middle of the viewport is current. Same answer
everywhere else, honest under sticky.

Scroll-driven animations are Chromium and Safari 26; Firefox is still behind a flag. Every use here
is a garnish on a layout that stands without it — the stack still stacks, the chapter still leaves.

Lock test green in both modes; full pass clean at 1440×900 and 1280×720, mobile, reduced motion.

### "look below the cards, something is wrong at the bottom" — 2026-09-05
His screenshot (cb8, the calculator) showed 04's text peeking under the calculator's card, and a
grey band with a shadow line under the whole page. Two causes:

1. **A pinned screen never let go.** Sticky kept 04 under every later screen, so any gap under the
   calculator — the 20px gutter, or resting a few pixels off the snap — revealed it. The four
   mechanics now sit in a `.stack` wrapper: a sticky screen only sticks inside its parent, so 01–03
   pin under the next card and the whole stack is released as the calculator scrolls it away; 04
   never pins under anything. The calculator has its white ground back. Measured settled on the
   calculator: 03's and 04's blocks both end 20px above the viewport.
2. **The grey band is macOS rubber-banding the document.** The deck could not be reproduced short
   of the window in headless Chromium at his viewport (deck 1200 of 1200, no document overflow) —
   what he caught is the trackpad's elastic overscroll chaining out of the deck to the page and
   Arc painting its own ground under it. `overscroll-behavior: contain` on the deck and `none` on
   the document stop the chain.

## 17. FAQ, the stack zone, and three small cuts — 2026-09-05, late

| His words | Built |
|---|---|
| "faq structure should be exactly like this" (the wireframe) | one centred 900px column: heading, a rule, one question per 70px row with a muted plus at the right that turns into a cross when open; first item open. The wireframe's own metrics (19px question, 15px answer to 770px). The two-column grid is gone; cb8 no longer wraps it in a glass card. Fits 1440×900 and 1280×720 |
| "this 4 sections should work with a little scroll and should not stuck in the middle of transition" | **the stack zone** in `main.js`: while one of the four stacked mechanics is current, the wheel is captured and any gesture completes the slide to the next card — the hard lock's engine, scoped to four screens. Free scroll that carries the page into the zone is landed the same way (`travel()` on entry). Everywhere else the page scrolls free. Measured: a 3-tick nudge on 01 lands 02 at top 0; the same nudge on the calculator moves nothing; scrolling 40% into 01 from chapter 1 finishes on 01 |
| "this shadow is not good. remove it" | the blocks' drop shadow is gone |
| "these moving texts should be in the blue background" | the fact strip has no white bar: white type at .72 and hairline dividers on the hero's blue |
| "also use the brand logo in the top bar" | he sent the lockup as two SVGs minutes later: the TRUST wordmark (its T is the shield, 119×26) and the spaced FOREX (113×11). Both sit inline in `.brand`, stacked, 78×17 over 74×7.2, `fill: currentColor` so the mark is white on the blue screens and navy on paper. The T-shield alone is the favicon now. No logo file existed in the repo before this — the app favicon is a chart mark and the old nav shield was our own drawing |

The one-viewport self-check (`?check=1`) now only fails in hard mode — a soft-scrolling page may hold a
screen taller than the viewport, and the wireframe's FAQ is the first that might on a short laptop.


## 18. Bidirectional scrolling and a shared sizing scale — 2026-09-06

The main reference remains `landing/wireframe-cashback-v24.html`. cb5 is the
implementation source; cb6–cb8 are generated from it. The reusable sizing contract
now lives in [landing/shared/README.md](landing/shared/README.md), with the actual
values in [landing/shared/scale.css](landing/shared/scale.css).

- **Scrolling first:** a sticky screen's `offsetTop` changes as it pins; all four
  mechanics can report the same position. Navigation and the section index now
  use zero-height siblings in normal flow. The same transition and gesture rules
  apply up and down, including entry/exit at both ends of the stack. Reversal can
  interrupt a transition, momentum stays with its gesture, and sustained input
  continues advancing. Tall FAQ content, touch and reduced motion remain scrollable.
- **One type scale:** hero/final/chapter statements share the display role
  (40–80px, weight 650), section headings share the title role (32–56px, weight
  650), and paragraphs share 16–18px at weight 400. Card titles, controls, labels
  and figures have named roles too. These replace per-section sizing overrides.
- **Reference composition:** common desktop columns and gaps, 2 × 2 share levels,
  three calculator setup fields on one row, and a continuous activation list.
  The existing section order, copy, blue grounds, icons and variant treatments remain.
- **Future edits:** change the shared token, then run `landing/_qa/derive.py` from
  the project root with its full path. The generator now hashes the scale import
  before the base and variant stylesheets. Deploy the shared scale with the pages.
- **Regression entry points:** `landing/_qa/lock.test.mjs` and
  `landing/_qa/scroll-scale.test.mjs`, against the local landing server on 5311.

## 15. The icons are Iconly's own now — 2026-09-08

> "It's ok it's my website … use this [the Iconly MCP key], replace current icons in cb8 with their
> actual ones from here, also they should animate once when hovered."

The §2.9 fallback is over: he bought the set, so the four drawn glyphs are replaced by Iconly's
Lottie files, pulled through their MCP server (`_qa/iconly.py`, key in `ICONLY_KEY`) into
`cb8/ico/`, played by `lottie_light` (already a dependency of the Mini App, vendored beside them).

| Slot | Iconly animation | File |
|---|---|---|
| Meaning · Market record (amber) | Web page analyze 2 · Light, id 2383 | `analytics.json` |
| Meaning · Cashback record (green, on navy) | Dollar receive · Light, id 4609, strokes ×1.4 — Iconly animates Light only, so "Bold" is the Light file widened | `dollar-receive.json` |
| 03 · Account type (white on glass) | user · Light, id 3988 (his favourite; the circled one that pops in) | `user.json` |
| 03 · Trading volume (green) | Coins 2 · Two-Tone, id 631 (his favourite) | `coins.json` |

**Behaviour:** each icon rests on its last frame (the complete glyph), plays once when its screen
reveals (the reveal's own `--i` stagger), and once more each time the pointer enters the tile or
card it sits on. Reduced motion: the rest frame only. **Colour is still the page's** — the player
writes `stroke="rgb(0,0,0)"` on every path, so `.ico svg [stroke]{stroke:inherit}` hands the
`.ico`'s stroke down; the `.ico-success` / `.ico-warning` / `.glass` rules are unchanged. Fills are
left alone: the only ones in these files are a matte (in `<defs>`, never painted) and the coins'
pop-in disc, masked by it. The stroke-draw CSS (`pathLength`, `.tone`, the weight classes' widths)
is gone with the glyphs; `.ico-light` / `.ico-bold` / `.ico-two-tone` stay as the record of his pick.
Step 04's Check Circle (§14 #1) has no slot in the current markup and was not added.
Cost: +168 KB player, +57 KB of JSON.
