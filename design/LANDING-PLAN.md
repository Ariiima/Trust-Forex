# Landing page — three animated versions

Plan written 2026-09-02 against `design/landing/wireframe-v9.html` (Amir's
bare-text wireframe v9, copied in from the session scratchpad). Brief: three
different builds of the same page, each with Apple-grade scroll choreography,
images and video generated through OpenRouter. Copy and section order stay
pinned to the wireframe; only the world, the assets and the motion differ.

**Brand note.** `design/BRAND.md` bans gloss, black, neon and cinematic motion.
This brief asks for exactly that, so the brief wins for A and C, and B is built
brand-legal on purpose. Whichever is chosen decides which document gets revised.

---

## 0. What the wireframe gives us

Fourteen blocks, top to bottom. The right-hand column of the Protocol steps
(`1.35fr`, empty) and the two chapter breaks are the only places the wireframe
leaves room for a big visual, so that is where the cinema goes in every version.

| # | Block | Content | Motion slot |
|---|---|---|---|
| 1 | Nav | brand, 4 links, `Open the App` pill | shrink on scroll, blur |
| 2 | Hero | title, one body, one CTA `View Results` | **the set piece** |
| 3 | Trust strip | 4-claim marquee | mask-reveal, static after |
| 4 | Results | h2, copy, CTA + panel (week, 5 metrics) | bars draw once, panel tilt |
| 5 | Chapter 1 | "Transparency starts before the result." | **pinned scrub** |
| 6 | Protocol 01–04 | Prepare / Enter / Stay fixed / Measure | **sticky + sequence** |
| 7 | Focused service | 3 tiles | stagger rise |
| 8 | Benefits | Cashback, Referral rows + 10/15/20/30 rate track | sweep line |
| 9 | Chapter 2 | "Same service. More value with longer access." | **pinned scrub** |
| 10 | Plans | Silver / Gold / Diamond | columns slide, hover lift |
| 11 | FAQ | 5 items | accordion |
| 12 | Final CTA | `Open the App` | reverse of the hero |
| 13 | Footer | — | — |
| 14 | Wireframe notes | Persian annotations toggle | dropped in all builds |

Rules that hold in all three: numbers appear at their final value, never count
up (standing note); TP bars grow once on first reveal; green only marks TP,
red only marks SL; no text ever rendered inside generated imagery.

---

## 1. Shared foundation

Same scaffold for A, B and C so they can be compared honestly.

- **Files.** `design/landing/{a,b,c}/index.html` + `design/landing/shared/`
  (fonts from the earlier prototype, tokens.css, vendored libs). Plain HTML, one
  JS file per version, no framework, no build step. Deploy target is the apex
  docroot `/var/www/tf-root/landing/{a,b,c}` which `npm run deploy` never touches.
- **Scroll engine.** Lenis for scroll feel + GSAP ScrollTrigger for pin and
  scrub (GSAP and all its plugins are free since 3.13). Wire them the documented
  way: `lenis.on('scroll', ScrollTrigger.update)`, Lenis raf on `gsap.ticker`,
  `lagSmoothing(0)`.
- **Reveals.** CSS scroll-driven animations (`animation-timeline: view()`) inside
  `@supports`, GSAP fallback. Support is ~84% (Chrome/Edge 115+, Firefox 132+,
  Safari 18+), good enough with the fallback.
- **Degrade.** `prefers-reduced-motion`: no pins, no scrubs, poster frames.
  Under 768px or `saveData`: posters instead of sequences, one hero video at
  most. This is also what Apple does on small screens.
- **Budget per version.** LCP < 2.5s, ≤ 6 MB transferred on desktop, ≤ 1.5 MB on
  mobile, hero sequence loads after first paint, everything else lazy.
- **Asset pipeline** (all through OpenRouter, run on the prod server because
  this Mac's network kills responses slower than 10s — see
  `design/landing-assets/blue/gen-sets-def.sh` for the pattern):
  - Stills: `meta/muse-image`, 1920×1280, white ground for cut-outs, navy for
    scenes. 30 already exist in `design/landing-assets/blue/` (sets A–F).
  - Video: `bytedance/seedance-2.0-mini` ($0.013/s, 720p, up to 15s) for scrub
    clips; `google/veo-3.1-lite` ($0.05/s, 1080p, 8s) or `alibaba/wan-3.0`
    ($0.04/s, 30s) for hero loops. **Use image-to-video with our own stills as
    the first frame** so video and stills share one look.
  - Frames: `ffmpeg -i clip.mp4 -vf fps=24,scale=1280:-2 f_%03d.webp -q:v 75`
    → ≤ 120 frames ≈ 4 MB per sequence, drawn to `<canvas>` with
    `createImageBitmap`. Video-scrub alternative: `-g 1` all-keyframe mp4 loaded
    as a blob (already proven in the earlier prototype).
- **QA.** Playwright screenshots at ten scroll stops per version, desktop and
  mobile, Lighthouse, a reduced-motion pass. One batched fix round, then stop.

### Skills to install before building

| Skill pack | Install | What it brings |
|---|---|---|
| iart-ai/web-animation-skills | `npx skills add iart-ai/web-animation-skills` | `gsap-web` (timelines, ScrollTrigger, SplitText, Lenis), `svg-animation` (stroke draw-on, morph), `60fps-animation`, `accessible-animation`, `glassmorphism` |
| emilkowalski/skills | `npx skills@latest add emilkowalski/skills` | `animate` (curves, durations), `apple-design`, `prototype` (multi-version switcher), `review-animations` |
| freshtechbro/claudedesignskills | `/plugin install core-3d-animation` | `threejs-webgl`, `gsap-scrolltrigger`, `rive-interactive`, `lottie-animations`, `spline-interactive` (needed for C only) |
| impeccable (installed) | `/impeccable animate` · `/impeccable overdrive` | the craft floor, the bans, batched QA |
| frontend-design (installed plugin) | auto | direction and the "less is more" check on motion |

---

## 2. Version A — Filmed record

*Apple product-page grammar: one physical object, filmed, and scroll is the
playhead.* Light paper page, navy only inside the film frames.

**Hero.** Pinned 300vh. A canvas image sequence (120 frames) of the levels
ladder assembling: five blue glass slabs tumble in and lock into alignment, one
gets the blue entry line, the lowest a red dot, the upper four green dots. Title
and body ride fixed frame ranges: title at f0–30, body at f40–70, CTA at f90.
Exactly the AirPods-page mechanic (canvas + ScrollTrigger scrub).

**Section by section.**
- Trust strip: static row, characters mask-reveal once, no perpetual marquee.
- Results: panel enters with a 6° perspective tilt that flattens as it centres,
  five bars scale-x once, values fade in already final.
- Chapter 1: pinned, `net-blocks` chain scrub (video, 5s) behind the title,
  title blur 10px → 0 over the first third.
- Protocol 01–04: left column sticky, right column one continuous sequence
  (the ladder being marked) scrubbed across the four steps. Step 1 slabs blank,
  step 2 entry line draws, step 3 a grey jig closes around them ("stays fixed"),
  step 4 the TP dots light one by one.
- Tiles, benefits, plans: CSS view-timeline rises, 300ms, no stagger theatre;
  rate track draws one sweep line.
- Chapter 2: `flow-tiers` staircase scrub, camera rising step to step.
- Final: the hero sequence played backwards, slabs dissolving into a blue
  horizon under the CTA.

**Assets to generate.** 3 clips: ladder assemble (10s, image-to-video from
`ladder-scatter` → `ladder-hero`), ladder marking (10s, from `lev-marked`
direction), tier climb (5s, from `flow-tiers`). Plus 1 chain clip (5s, from
`net-blocks`). ≈ 30s of seedance-2.0-mini ≈ $0.40. Retry at 5s when a 10s job
fails (known behaviour).

**Stack.** GSAP ScrollTrigger + Lenis, canvas sequence, CSS view timelines.
**Risks.** Frame weight (cap at 1280px webp q75); iOS canvas decode (use
`createImageBitmap`, decode ahead); clip-to-clip continuity (image-to-video
from the same still fixes most of it).

---

## 3. Version B — Live instrument

*Brand-legal, dashboard-first, and still Apple: the way the iPhone page handles
specs, not the way it handles the film.* White ground, one blue, no renders.

**Hero.** The Results panel itself, full-bleed, as an instrument. An SVG
signal-anatomy diagram draws itself with scroll (`stroke-dashoffset`): entry
line, SL, TP1–TP4 in order, each level's win-rate bar growing as its dot
lights. Kinetic headline: words mask-rise on load, the line "a record you can
check" gets a hairline underline that draws.

**Section by section.**
- Trust strip: four claims, each with a small drawn tick, in one static row.
- Results: sortable table below the metrics. Sorting is the sanctioned
  interaction and it proves the archive is real. FLIP the rows on sort.
- Chapter 1 and 2: **card stack**. Each section is a card; as the next scrolls
  in, the previous scales to 0.94 and dims (sticky stacking, CSS
  `animation-timeline: view()`), so the page feels like turning records.
- Protocol 01–04: pinned horizontal scroll, four panels slide across while the
  step number counts 01 → 04 as a typographic object, and the anatomy diagram
  gains one element per panel.
- Benefits: the 10/15/20/30 rate track as a stepped line chart that draws.
- Plans: columns rise, top-edge blue bar on hover, the "pay in crypto" row uses
  set D coin cut-outs flattened to monochrome blue via CSS `filter`.
- FAQ, final: soft, 250ms, nothing else.

**Assets.** No new generation. Set B stills (`matte-phone`, `matte-wallet`) as
two quiet punctuation images; set D cut-outs for the payment row (key them with
the existing `dekey.py`). Optional: one Rive file for the shield mark hover
state, one Lottie for the badge set.

**Stack.** CSS scroll-driven animations first, GSAP only for the pin and the
horizontal section, `svg-animation` skill, Lenis.
**Risks.** Reads as "less fancy" beside A and C. Counter with the card stack,
kinetic type and the self-drawing diagram; it is the only version that can ship
under the current brand document unchanged.

---

## 4. Version C — Glass world

*One continuous 3D scene behind the whole page; scroll moves the camera through
the chapters.* Deep navy, blue glass, the crypto register in full.

**Hero.** A real Three.js glass coin (`MeshPhysicalMaterial` with
`transmission`, thickness, blue tint) slowly turning, the generated `coin-*`
faces as its normal/emissive maps, particles and a GLSL volumetric blue haze
behind it. Title overlaid in HTML. As you scroll the coin recedes and the camera
starts down a path.

**Camera path (ScrollTrigger progress → curve position).**
1. Hero coin → 2. Results: camera swings to a floating glass panel that holds
the real HTML panel via CSS3D → 3. Chapter 1: the `net-blocks` chain, camera
travelling along it → 4. Protocol: the ladder slabs as real meshes, marked step
by step (line, jig, dots) → 5. Benefits: `flow-cashback` / `flow-referral`
scenes as parallax sprite layers with depth fog → 6. Chapter 2: the
`flow-tiers` staircase climbed → 7. Plans: three glass plinths, hovered column
lifts in 3D → 8. Final: the `state-confirmed` ring closes around the CTA.

**Assets.** Sets A, C, D, E, F already generated become textures and sprite
layers. Generate: one seamless navy nebula ground (or a shader, preferred), one
8s `veo-3.1-lite` image-to-video from `state-confirmed` for the final section
(≈ $0.40), and 3 extra `coin-*` angles for the hero maps.

**Stack.** Three.js (plain, ~150 KB gz, no React on the landing), GSAP
ScrollTrigger driving a single `progress` uniform, Lenis, optional Theatre.js
for authoring the camera path, `threejs-webgl` + `gsap-scrolltrigger` skills.
**Risks.** GPU on low-end phones: detect `WebGL2` and
`hardwareConcurrency < 4` and fall back to Version A posters. Contrast of
overlaid copy on moving dark scenes: give every text block a solid navy
backdrop band. Strongest brand collision of the three.

---

## 5. Build order

1. Install the three skill packs (5 min). Read `craft-floor.md` from impeccable
   before touching UI.
2. Scaffold `design/landing/shared/` from the earlier prototype's fonts and
   tokens; write `serve.sh` (any server with Range support, or the blob loader).
3. Generate the Version A clips and C's extras on the server; run the ffmpeg
   frame pipeline; commit the frames under `design/landing/a/frames/`.
4. Build **B first** (≈ 1 day, no asset wait, brand-legal baseline), then
   **A** (≈ 1.5 days), then **C** (≈ 2–3 days).
5. QA each: 10 scroll-stop screenshots desktop + mobile, Lighthouse, reduced
   motion. One batched fix round.
6. rsync all three to `/var/www/tf-root/landing/{a,b,c}` for side-by-side review
   and pick. The winner replaces the apex landing and its document (BRAND.md or
   this plan) gets revised to match.

Cost of all generated media for the three versions: under $5.

---

## Sources

- [CSS-Tricks — Apple-style scrolling animations](https://css-tricks.com/lets-make-one-of-those-fancy-scrolling-animations-used-on-apple-product-pages/)
- [GSAP Vault — scroll image sequence tutorial](https://gsapvault.com/blog/scroll-image-sequence-tutorial)
- [Builder.io — 3D scrolling animation with GSAP and Veo 3](https://www.builder.io/blog/3d-gsap)
- [Lenis (darkroomengineering)](https://github.com/darkroomengineering/lenis)
- [Next.js smooth scrolling with Lenis & GSAP, 2026](https://devdreaming.com/blogs/nextjs-smooth-scrolling-with-lenis-gsap)
- [MDN — CSS scroll-driven animations](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations)
- [Josh Comeau — scroll-driven animations](https://www.joshwcomeau.com/animation/scroll-driven-animations/)
- [Codrops — sticky grid scroll (2026)](https://tympanus.net/codrops/2026/03/02/sticky-grid-scroll-building-a-scroll-driven-animated-grid/)
- [iart-ai/web-animation-skills](https://github.com/iart-ai/web-animation-skills)
- [emilkowalski/skills](https://github.com/emilkowalski/skills)
- [freshtechbro/claudedesignskills](https://github.com/freshtechbro/claudedesignskills)
- [Anthropic frontend-design skill](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md)
- [Rive vs Lottie, 2026](https://unicornicons.com/learn/rive-vs-lottie)
- [React animation libraries compared, 2026](https://spell.sh/blog/best-react-animation-libraries)
- [OpenRouter video models](https://openrouter.ai/collections/video-models)
- [OpenRouter — choose a video model](https://openrouter.ai/docs/cookbook/video-generation/choose-video-model)
