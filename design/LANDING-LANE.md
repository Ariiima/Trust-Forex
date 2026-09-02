# Landing lane — "product-first SaaS" (from the two references), four builds on Version B

Written 2026-09-02 after frame-by-frame reads of the two reference videos (a crypto
savings landing on Dribbble, and zelt.app's launch video). Base = `design/landing/b/`
(the version chosen). Copy stays pinned to wireframe v9; palette stays brand-legal.

## What the references actually do

**Reference 1 — light fintech page**
- White / pale-grey page, every section a rounded (28–32px) panel with soft layered shadow.
- Hero: full-bleed photo, big headline, small floating **chips** (asset pills) scattered with parallax, pill CTA.
- A **phone rises** from the bottom edge; coin icons orbit it; then a **fan of phone screens** slides in from both sides, staggered.
- A pale-blue **gradient panel** holds an interactive card (inputs → bar chart → one number).
- Headlines reveal **word by word** (grey → ink).
- Photo panels carry one **floating UI card** each (ticker card, mini chart card).
- Closing: hand holding a phone + store badges + rating chips; a full-bleed sky photo for "Important to know"; dark footer.

**Reference 2 — Zelt**
- Warm off-white ground, black type, one accent colour, everything else neutral.
- Hero: a **pinned 3D object** (white egg cracks, a golden yolk emerges) while the headline **swaps through three statements** ("Give your people a platform" → "Not another HR tool" → "…all in one place").
- Logos strip, then **Product Overview**: a sticky left menu whose active item follows scroll and swaps the right-hand product UI (dark cards) with floating tooltip chips.
- "Why" sections alternate: dark data panel with **stacking notification cards**, a 3D coin, a scattered **devices grid**, icon tile grid.
- Horizontal **card rail** (testimonials), "As seen on" logos, three stats, dark closing band repeating the hero line.
- Motion everywhere is the same verb: slide-up + fade, staggered by index, plus the pinned hero object.

## Lane traits every build inherits
Rounded panels, soft shadows, floating chips and UI cards with parallax, staggered slide-up entrances,
word-by-word headline reveals, product UI built in HTML with sample data (labelled), real Mini App
screens in phone frames only where a real screen reads well (`shared/app/*.png` — guest state, so
avoid the plans screen's test prices and the home modal), one signature idea per build.
Brand stays: white ground, navy, one trust blue and its tints, green/red only as TP/SL marks,
no people photos (quiet grounds only), no fake testimonials, no counting numbers.

## The four builds (`design/landing/b1..b4/`)
| | Signature idea | From |
|---|---|---|
| **b1 · The object** | Pinned hero object (white sphere cracks → navy core) while the headline swaps three beats; sticky-menu product tour of the app | Zelt |
| **b2 · Floating product** | Phone rises with the badge set as floating chips; fanned real app screens; gradient "your rate" panel; word-by-word headlines | Reference 1 |
| **b3 · Live record** | Notification cards stack in as the record is written; sticky Publish→Measure→Record→Pay tour; dark data panel; horizontal rail of sample signal cards | Zelt "data-driven" |
| **b4 · Editorial** | Full-bleed quiet photo panels (sky, paper, desk) with big type and one floating UI card each; risk note on the sky | Reference 1 |

Assets made for this lane: `shared/lane/obj-crack/` (121-frame canvas sequence, sphere cracking
to a navy core, seedance image-to-video from `obj-sphere.png`), `shared/lane/ground-{sky,paper,desk}.png`,
`shared/app/{home,plans,cashback,referral,earning,history}.png` (390×844 @2x, guest mode).
