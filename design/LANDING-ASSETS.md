# Landing assets — direction and generation prompts

For the apex landing page (Amir's wireframe v9 → the prototype in the session
scratchpad `tf-landing/`). Rewritten 2026-09-01 against `design/BRAND.md`, which
supersedes the earlier "crypto glossy / blue neon" pass in this file.

---

## 1. What the brand retires from the current prototype

`design/BRAND.md` forbids gold, luxury cues, crypto gradients, heavy black, neon,
glow, and cinematic motion. Measured against that, **7 of the 12 assets on the
page today are off-brand**, and so is most of the motion:

| On the page now | Brand rule it breaks | Verdict |
|---|---|---|
| `coin-gold` hero coin (large, glossy, warm) | "no gold, no luxury register" | **Remove.** XAUUSD is named in text, never rendered as treasure. |
| `chapter-flow` / `rate-glass` / `final-glow` dark glossy scenes | "no heavy black", "no crypto gradients" | **Remove.** |
| `chapter-scrub.mp4`, `final-scrub.mp4` (Apple scroll-scrub) | "motion: minimal — hover, soft transition, sorting" | **Remove.** Cinematic scrubbing is the opposite of a calm dashboard. |
| 6 glossy 3D crypto coin cut-outs | "no crypto gradients"; glossy register | **Keep the payment row, reduce to flat monochrome marks.** |
| Primary CTA `Open the App`, five times | Explicitly a **superseded** decision; the trust path leads with *View Results* | **Change.** |
| Hero copy "XAUUSD signals with a record you can check" | — | **Keep.** On-brand, and better than the draft line. |
| Results panel, TP1–TP4 bars, "sample week" label | — | **Keep and grow.** This is the brand's hero. |

Structural gaps against the brand's Home order, while we're here:

- No **Problem** section ("The problem is not losing trades. The problem is hiding them.").
- No **risk note** anywhere. Required, and required to be calm rather than scary.
- No free public **Results** page and no **Transparency / methodology** page — the
  brand says the free dashboard *is* the trust mechanism, and the path is
  Home → Results → Transparency → Pricing.
- Plans list **Scalp Levels** with no note that it is Demo with no public results yet.
- The hero says XAUUSD only; the founder's reference says the focus is Forex **and** Gold.

## 2. The consequence for assets

Under this brand the page does not want a big generated-image programme. It wants
**designed UI**. "Dashboard-first. Calm dashboard, not sales funnel. Hero visual =
a preview of the Results dashboard, not a render."

**Build these — they are worth more than every prompt below, and none is generated:**

1. **Results dashboard preview.** Real markup, real layout, screenshot or live
   embed. The hero. Summary cards (total signals, TP1–TP4 hit rate, SL,
   Not Activated), a readable table, the methodology line.
2. **Signal anatomy diagram** — one SVG: entry, stop loss, TP1–TP4, drawn to
   scale with the fixed vocabulary. Solves the protocol section, which is four
   empty viewports today and carries the whole argument.
3. **The badge set** — Published/Active blue, TP Hit green, SL/Failed red,
   Not Activated/Closed grey, Pending soft yellow. CSS, used everywhere,
   identical on the landing and in the app.
4. **TP-by-TP chart set** — line, bar, progress. No decoration.
5. **Shield + T logo, favicon, OG card.** A link to this page previews as a blank
   card today.
6. **Methodology diagram** for the Transparency page: how a TP is counted, what
   Not Activated means, why near-TP is not a win.
7. **Flat payment marks** for the pricing row, replacing the glossy cut-outs.
8. **A real screenshot of the Mini App** in a plain device frame. The highest-trust
   asset on the page, and no model can fake it.

Generated imagery keeps a narrow, honest role: **quiet grounds, structure, and
record-keeping objects.** That is what the five sets below are for.

## 3. Motion, rebuilt for "minimal"

The brand allows hover, soft transition and sorting, and bans confetti, exploding
animation and flashing numbers. That also matches the standing note *animate only
what changed — no count-ups from zero*.

- **Keep:** one-shot fade-and-rise reveals on section entry, ~200–300ms, no stagger
  theatre; hairline rules drawing in; hover states on plans and table rows;
  the FAQ accordion.
- **Keep, because it is data:** TP bars growing to their measured value once, on
  first reveal — that is a chart transition, which the brand sanctions. The number
  beside the bar appears at its final value; it never counts up.
- **Remove:** the pinned hero, the scrub engine, both scrub videos, the parallax
  coins, the blur-in chapter titles, and the marquee's perpetual motion (make it a
  static row of the four claims).
- **Add, quietly:** a sortable, filterable Results table. Sorting *is* the sanctioned
  interaction, and it proves the archive is real.

## 4. Palette for anything generated

| | Value | Use |
|---|---|---|
| Ground | white → `#F7F8FA` | nearly everything |
| Primary | trust blue, non-neon (`#144CCD`, low presence, never emissive) | one accent |
| Depth | navy `#0F2044`–`#14264F` | headings; at most one section band |
| Structure | greys `#C3C9D6` / `#646E7E` | rules, tables, instruments |
| Green | only a TP mark | never decorative |
| Red | only an SL mark | never decorative |

No gold. No glow. No gloss. No black. Matte, lit by soft daylight.

## 5. Five prompt sets

```
[Q] = calm editorial product photography, matte finish, soft even daylight,
      generous negative space, precise and understated, no text, no letters,
      no numbers, no logo, no watermark, no gold, no neon, no glow, no lens flare,
      not luxurious, not dramatic
```

---

### Set 1 — The Record *(recommended — it is the brand essence)*

*"Trust Through Records." Archive and paper, white and quiet. Section grounds,
the Problem section, the Transparency page, OG.*

Style suffix: `white and pale grey paper, matte, soft raking daylight, fine shadows, calm archival mood, [Q]`

1. **`rec-sheet`** — "A single sheet of white ruled record paper lying flat on a
   pale grey surface, dozens of fine printed horizontal rules, a few faint blue
   tick marks in one column, soft raking daylight from the left, + style suffix"
2. **`rec-stack`** — "A neat stack of identical white record cards seen from a low
   angle, each card edge crisp, one card very slightly proud of the others, pale
   grey background, + style suffix"
3. **`rec-drawer`** — "An open white archive drawer filled with upright index
   cards seen from directly above, uniform and complete, pale neutral light,
   + style suffix"
4. **`rec-punch`** — "A row of plain white punched record cards overlapping
   slightly on a light grey surface, small precise rectangular perforations,
   soft daylight, macro, + style suffix"
5. **`rec-wall`** — "A wall of identical thin white archive folders in a shallow
   grid, perfectly aligned, receding gently, soft even daylight, minimal,
   + style suffix"

---

### Set 2 — Structure & Measure

*The blueprint made light instead of dark. Grids, rules, plotted points — grey
structure with one blue. Section grounds, the How-it-works band, the tiles.*

Style suffix: `fine blue printed grid lines on white paper, matte grey steel instruments, soft even daylight, technical and calm, [Q]`

1. **`str-grid`** — "A large sheet of white graph paper with a fine pale blue
   printed grid, a few small solid blue points plotted across it and joined by a
   thin straight blue line, flat top-down view, + style suffix"
2. **`str-rule`** — "A matte grey steel engineer's rule laid across white graph
   paper, four small blue markers placed at four different graduations along it,
   flat lay, soft daylight, + style suffix"
3. **`str-caliper`** — "A matte grey steel vernier caliper resting closed on white
   paper beside a fine blue printed grid, macro, no reflections, + style suffix"
4. **`str-axis`** — "A minimal white surface with two thin grey axis lines and a
   series of small evenly spaced blue tick marks along the horizontal axis,
   abstract and precise, + style suffix"
5. **`str-plate`** — "A flat matte grey metal plate on white with a fine engraved
   linear scale running across it, evenly divided, macro, + style suffix"

---

### Set 3 — The Levels

*The signal anatomy as a quiet physical object — the one idea from the earlier
pass that survives the brand, rebuilt matte and light. Protocol 01–04, OG.
This set supports the SVG diagram; it does not replace it.*

Style suffix: `matte white ceramic and pale grey aluminium on a white surface, soft daylight, precise, engineering not luxury, [Q]`

1. **`lev-stack`** — "Six flat matte white rectangular bars of different lengths
   laid in a perfectly aligned vertical stack on a white surface, evenly spaced,
   soft shadows beneath each, top-down view, + style suffix"
2. **`lev-marked`** — "The same stack of matte white bars, the middle bar marked
   with a single thin blue line, the lowest bar marked with a small red dot, the
   four upper bars each marked with a small green dot, top-down, + style suffix"
3. **`lev-scatter`** — "Six matte white rectangular bars lying scattered and
   unaligned on a white surface, soft shadows, waiting to be ordered, + style suffix"
4. **`lev-fixed`** — "Six aligned matte white bars held in a plain grey aluminium
   jig that fixes their spacing, engineering fixture, top-down, + style suffix"
5. **`lev-edge`** — "Macro of the cut edge of a stack of matte white plates,
   perfectly parallel, one thin blue line running along a single plate,
   + style suffix"

---

### Set 4 — Shield & Seal

*Identity groundwork for the T-in-shield mark, the favicon and the OG card.
Generate the **silhouette and the seal**, never the letter — models cannot draw
letterforms; the T is a design job.*

Style suffix: `single centred object on a pure white seamless background, matte, soft top light, subtle contact shadow, monoline and simple, [Q]`

1. **`sh-emboss`** — "A plain shield silhouette debossed into thick white paper,
   no marking inside it, soft raking daylight revealing the impression, macro,
   + style suffix"
2. **`sh-plate`** — "A small flat matte grey metal shield-shaped plate lying on
   white paper, plain and unmarked, thin bevelled edge, + style suffix"
3. **`sh-stamp`** — "A matte grey steel hand stamp standing upright on white paper,
   its face a plain shield shape, plain and industrial, + style suffix"
4. **`sh-seal`** — "A plain deep blue wax seal pressed onto white paper, smooth
   and unmarked, matte not glossy, macro, + style suffix"
5. **`sh-outline`** — "A simple monoline shield outline drawn in a single thin navy
   line on white paper, geometric and balanced, flat, + style suffix"

---

### Set 5 — Calm Navy

*The brand allows navy, not black. One section band at most — the Transparency
section or the risk note — plus the OG card. Matte, hairlines, zero glow.*

Style suffix: `matte deep navy #0F2044 surface, fine pale blue hairlines, no gloss, no reflections, soft even light, quiet and institutional, [Q]`

1. **`nav-grid`** — "A matte deep navy surface with a very fine pale blue printed
   grid, one thin lighter blue line running horizontally across it, flat,
   + style suffix"
2. **`nav-paper`** — "A sheet of matte deep navy paper with fine debossed
   horizontal rules catching soft raking light, no ink, + style suffix"
3. **`nav-cards`** — "Rows of identical matte deep navy cards arranged in an even
   grid, uniform, soft shadow between them, top-down, + style suffix"
4. **`nav-edge`** — "Macro of the edge of a stack of matte deep navy plates,
   perfectly parallel, one pale blue hairline along one plate, + style suffix"
5. **`nav-field`** — "A plain matte deep navy field with a single small pale blue
   square marker positioned off centre, extreme minimalism, + style suffix"

---

## 6. Running them

`openrouter-image-gen` (muse-image, ~1920×1280) for grounds and scenes;
`avalai-image-gen` with `BACKGROUND=transparent` for the set 4 objects and any
cut-out. Same shape as `gen-8-sets.sh`:

```bash
GEN=~/.claude/skills/openrouter-image-gen/scripts/gen_image.sh
gen(){ "$GEN" "$2" "$OUT/$1.png" >"$OUT/$1.log" 2>&1 && echo "OK $1" || echo "FAIL $1"; }
gen rec-sheet "…prompt…" &   # four at a time, then `wait`
```

Style consistency inside a set: generate prompt 1, then pass it as a reference to
AvalAI's `/images/edits` for the rest ("same style and lighting as the reference,
now …"). That is what stops a set drifting.

## 7. Notes

- Models over-light everything. If a result comes back glossy, dramatic, gold-tinted
  or glowing, it is off-brand — regenerate with the negatives strengthened rather
  than keeping it because it looks impressive.
- Green and red appear **only** as TP and SL marks, never as decoration.
- Sample figures stay labelled ("Sample week — live figures in the app").
- Never let a model render text, digits, or the logo.
- Nothing on the page may imply guaranteed profit, ease, luxury or excitement.
