# Cashback lane — four builds of the Cashback page, each built on one truth of the content

Written 2026-09-02 against `design/landing/wireframe-cashback-v24.html` (Amir's
"TrustForex Cashback Wireframe v24", received as `final cashback.html` — the
`message.txt` beside it is a byte-identical copy). Same brief as the second home
run (`design/LANDING-LANE.md`): copy pinned to the wireframe, palette brand-legal,
one signature idea per build. The signatures are **not** the home lane's four
(object / floating phone / notification feed / editorial photo). Each build takes
one thing the Cashback page actually says and lets it organise the hero, the
four mechanics pages, the calculator and the activation path. The lane's shared
traits — rounded panels, soft shadows, staggered slide-up, word-by-word headline
reveals, product UI built in HTML with labelled sample data — are the floor, not
the idea.

| Build | The truth it is built on (from the copy) | Signature |
|---|---|---|
| **cb1 · Two records** | one eligible trade has two records; Cashback is recorded apart from profit or loss | the hero splits one trade into two ledgers; the mechanics write the setup into the Cashback record line by line |
| **cb2 · The share** | Cashback is *your share* of the broker rebate, 10% → 30% | one instrument — the rebate bar and your share of it — carried hero → mechanics → calculator, where it goes live |
| **cb3 · Week by week** | credits arrive weekly and every one stays visible | the dashboard with a week strip; credits stack into history; setup and activation sit on the same timeline before Week 1 |
| **cb4 · Already trading** | the trading you already do, unchanged, gains a second layer | a trader's own trade log with Cashback switched off → on; the four steps stack as layers over the unchanged log |

---

## 0. What the wireframe gives us

Twelve blocks plus a notes toggle. The four full-height "mechanics" pages and the
two chapter breaks are where the choreography goes; the calculator is the one
interactive component this page has that Home did not.

| # | Block | Content (pinned) | Motion slot |
|---|---|---|---|
| 1 | Nav | brand · Home / Results / **Cashback** / Referral · `Open the App` pill | shrink + blur on scroll |
| 2 | Hero | "Get more value from the trading you already do" · one body · CTA `Explore Cashback` → #meaning | **the set piece** |
| 3 | Fact strip | Start without a paid plan · Grow your share to 30% · Receive credits every week · See every credit clearly | static row; no perpetual marquee |
| 4 | Meaning | "Your market result is only one side of the trade" · split visual: *One eligible trade* → **Market record** / **Cashback record** | the split animates once |
| 5 | Chapter 1 | "Cashback should add value without adding complexity" | word reveal / navy band |
| 6 | Mechanics 01–04 | 01 Choose the broker setup · 02 Start at 10% without a paid plan (10/15/20/30) · 03 Trading you already do counts (account type, volume) · 04 Stay in control (dashboard) | **sticky stage** |
| 7 | Calculator | broker · account type (Standard ×1, ECN ×.35) · XAUUSD volume · level 10/15/20/30 → "Estimated monthly Cashback **$85** / month" · link *View rules for each broker* | result cross-fades |
| 8 | Chapter 2 | "Ready to activate?" | word reveal |
| 9 | Activation | "Four clear steps to activate Cashback" · copy · CTA `Start Cashback setup` · 4-row path, last row dark | rows rise staggered |
| 10 | FAQ | 7 items | accordion |
| 11 | Final | "Let every eligible trade deliver more" · CTA `Activate Cashback` | soft |
| 12 | Footer | Home · Results · Referral · Partner Broker Rules · Cashback Terms · Terms · Privacy · Risk Disclosure | — |
| 13 | Wireframe notes | annotations toggle | dropped; the notes become build rules (§1) |

The four product visuals the mechanics pages describe are built once as HTML with
sample data and placed differently in each build: **P1** broker picker (partner
list + "Review broker details / Open an account directly"), **P2** rate ladder
(Standard 10% · Silver 15% · Gold 20% · Diamond 30%), **P3** factor cards
(Account type · Trading volume), **P4** dashboard (Current rate 30% Diamond ·
Cashback balance $150.00 · Latest weekly credit +$37.50 · Credits recorded 4 ·
Withdrawal $150.00 available).

## 1. Brand pass applied to every build

The wireframe is a wireframe: its colours are placeholders, its copy is not.

- **Black → navy.** The wireframe's `#0d0f11` chapter and mechanics pages become
  navy `#0F2044` panels (BRAND.md: no heavy black; navy is the dark end).
- **No green, no red** anywhere on this page — there is no TP/SL here, and
  green/red mean only that. Pending = soft yellow, used once in the activation
  path. Everything else is navy, trust blue and its tints, grey rules. The
  market side of any "two records" visual shows **no profit/loss figures** —
  the wireframe never does, and the brand bans exaggerated charts.
- **Numbers land final.** The calculator result swaps with a 180 ms cross-fade,
  bars fill once on first reveal, nothing counts up. Money renders `$150.00`.
- **Broker names.** The grey "Partner broker ×3" placeholders read unfinished in
  a polished build; use the three names the wireframe's own calculator lists
  (GTCFX, Broker B, Broker C), labelled *Sample partner brokers*. Confirm (§5).
- **App links.** Both `#app-link-required` anchors → `https://app.trustforex.net/cashback`
  (the Mini App's `/cashback` route opens in guest mode from a browser). Swap
  for the Telegram deep link once decided — the wireframe's own note.
- **Real screens, carefully.** The captured app screens are guest empty states
  (`cashback.png` is the intro with a glossy green $ icon; `history.png` and
  `earning.png` show $0.00 / "No cashback activity yet"). None reads as a
  cashback dashboard, so every screen on this page is **HTML-built with the
  sample data in the app's own language** (blue `#144CCD` balance card, "Total
  cashback", "Cashback history" rows). No real screenshots on this page.
- **The calculator stays.** BRAND.md bans "profit calculators"; this one
  estimates a *rebate share*, never profit, and the wireframe's FAQ already
  bounds it ("How accurate is the Cashback estimate?"). Keep it, label it
  *Estimate*, flag it for the founder (§5). Formula stays the wireframe's:
  `volume × 17 × account factor × rate` → `$85` at the defaults. Every sample
  credit on the page is derived from the same constants, so the page never
  contradicts itself.
- Fact strip: a static ticked row in every build (b-lane rule: no marquee).

## 2. Shared foundation

- **Files.** `design/landing/cb{1,2,3,4}/{index.html,style.css,main.js}` — flat
  beside `b1..b4`, so `../shared/` paths and `deploy.sh`'s tar work unchanged.
  `landing/index.html` gets a third list, *Cashback lane*; `deploy.sh`'s verify
  loop gets the four URLs. Live at `https://trustforex.net/v/landing/cb1/` … `cb4/`.
- **Scaffold = Version B** (`design/landing/b/`, the chosen base): its
  `style.css` tokens, type, nav, footer, buttons, panel radius and shadow; its
  `main.js` gates (REDUCE / MOBILE / FINE), Lenis + ScrollTrigger wiring,
  `wrapWords`, `.rv` reveals, FAQ and nav. Nav: Home → `../b/`, Cashback =
  current, Results / Referral → the home anchors. When a home lane build is
  chosen, the winner's tokens get merged into the chosen Cashback build.
- **Engine.** Vendored GSAP + ScrollTrigger + Flip + Lenis (already in
  `shared/vendor/`). No new dependency, no build step, one JS file per build.
- **Degrade.** `?reduce=1` or `prefers-reduced-motion`: no Lenis, no pins,
  the finished state in CSS (the default state *is* the finished state; JS only
  adds motion). Mobile: no pins; the one signature moment plays once on enter.
- **One sample dataset** for all four, so they compare honestly:

  | Item | Value |
  |---|---|
  | Levels | Standard 10% (no paid plan) · Silver 15% · Gold 20% · Diamond 30% — matches `ledger.TIER_PCT` |
  | Dashboard | rate 30% Diamond · balance $150.00 · latest weekly credit +$37.50 · 4 credits · $150.00 available |
  | History | Aug 7 / 14 / 21 / 28 · +$37.50 each · GTCFX · = $150.00 |
  | Calculator default | GTCFX · Standard · 50 lots XAUUSD · Standard 10% → $85 / month; ECN factor .35 |
  | Per-trade credit (cb4) | Standard 10% → $1.70 per lot: 0.50 lot $0.85 · 1.00 $1.70 · 1.50 $2.55 · 2.00 $3.40 |
  | Brokers | GTCFX · Broker B · Broker C (sample) |

- **QA per build.** Playwright, ten scroll stops, 1440 and 390 wide, plus a
  `?reduce=1` pass; one batched fix round, then stop.
- **Assets.** None. Everything is HTML, SVG and type on white and navy. No
  generation, no photo grounds, no phone frames of real screens.

## 3. The four builds

### cb1 · Two records

*One eligible trade. Two records. Cashback is written apart from profit or loss.*

- **Hero + Meaning, one pinned sequence** (≈ 200 vh). Centre stage: one trade
  card — *One eligible trade* · XAUUSD · Buy · 1.00 lot · GTCFX Standard ·
  closed Aug 26 — under the h1 (word reveal), body and CTA. On the scrub the
  card splits along a vertical hairline and the halves slide apart: left
  **Market record** (white: "The trade's profit or loss, shaped by price
  movement, trading costs and your execution" — no figure), right **Cashback
  record** (navy: "+$1.70 · 10% share · recorded separately"). In the last
  third the Meaning h2 and copy fade in beside the settled pair — the wireframe's
  Meaning section is the landing of the hero, not a repeat of it. The hairline
  stays on the page as its spine.
- **Chapter lines** are ledger dividers: a rule draws across, the sentence set
  into it like a ruled page header.
- **Mechanics = entries written into the Cashback record.** Right, sticky: a
  navy ledger panel. Left, the four copy blocks scroll by; each one writes a
  line and shows its detail card above the ledger: **01** `Broker · GTCFX ·
  Standard` (P1), **02** `Share · 10% · no paid plan` with the ladder to 30%
  (P2), **03** `Activity · 50 lots · account ×1` (P3), **04** `Credit · +$37.50
  · Aug 28 · balance $150.00` (P4). Lines slide in one by one; nothing edits a
  line already written.
- **Calculator** writes one more line, dashed and labelled *Estimate*:
  `Estimated monthly Cashback · $85`. Same row grammar as the ledger, so the
  estimate reads as provisional next to the recorded lines.
- **Activation.** The four steps as the record's opening entries; last row navy.
- **Final.** Copy + CTA on white; the spine ends under the button.

### cb2 · The share

*Cashback is your share of the broker rebate — 10% to start, 30% at the top.*

- **Hero.** h1 (word reveal), body, CTA; beneath, the **share instrument**: one
  wide bar = "the eligible broker rebate on your trading", light grey; from
  the left, your share fills in navy with a marker and label; four ticks along
  it — 10 Standard · 15 Silver · 20 Gold · 30 Diamond. Short pin (≈ 180 vh):
  the fill steps 10 → 15 → 20 → 30, the label cross-fades, each level chip
  lights as it is reached. Caption: *Your Cashback share of the eligible
  rebate*. Discrete steps, never a counter. Reduced motion / mobile: settled
  at 30% with all ticks on.
- **Meaning.** Two cards slide apart from the source pill (lane verb).
- **Mechanics = the instrument, one dimension per step.** Sticky right stage
  holds the bar; left copy scrolls: **01** the bar gets its source (`GTCFX ·
  Standard`, P1 beneath); **02** the share fills to 10% and the four ticks
  appear (P2); **03** the bar's *length* becomes the second axis — it grows
  with volume (20 → 50 lots) and shrinks ×.35 for ECN (P3); **04** the filled
  share detaches as a credit chip `+$37.50 · weekly` and drops into a balance
  row `$150.00` (P4).
- **Calculator = the instrument, live.** The wireframe's form drives the bar:
  base length from volume × account factor, fill from the level; the one number
  `$85 / month` cross-fades. The reader already knows how to read it.
- **Chapter 2 → Activation.** Words grey → navy; the path rows rise; last row navy.
- **Final.** Soft; the bar at 30% sits faint under the CTA.

### cb3 · Week by week

*Credits every week. Every credit visible.*

- **Hero, dashboard-first.** Left: h1 (word reveal), body, CTA. Right: the
  Cashback dashboard as the app draws it — blue card, *Total cashback*
  `$150.00`, `30% · Diamond`, *Latest weekly credit* `+$37.50` — with a
  **week strip** under it: four dated ticks, Aug 7 · 14 · 21 · 28. On load the
  four credit rows stack into the card's history one by one (120 ms apart),
  each lighting its tick; the total is `$150.00` from the first frame. The
  fact strip beneath doubles as the four claims, ticked.
- **Meaning.** Two cards; the Cashback card carries the four-credit mini history.
- **Chapters.** Navy bands, big white type, word reveal.
- **Mechanics = the timeline before Week 1.** A vertical rail down the left
  with 01–04 as milestones — *the four things that must be true before the
  first credit* — filling as you scroll; the sticky right stage shows P1 → P4.
  At 04 the rail reaches the Week 1 tick and the first credit card lands.
- **Calculator.** The wireframe's form and number, plus a dashed four-week
  strip under the estimate (no per-week figures) — a month is four credits.
- **Activation = the first week's calendar.** The four steps sit on the same
  rail before Week 1; the last row, navy, sits on the Week 1 tick: "Get
  confirmed and start receiving Cashback".
- **Final.** The strip continues faintly off the right edge under the CTA.

### cb4 · Already trading

*Nothing about your trading changes. A second layer switches on over it.*

- **Hero.** Left: h1 (word reveal), body, CTA. Right: a trader's own **trade
  log** — five closed XAUUSD trades (side, lots, date, *closed*), no P/L, no
  colour — with a toggle above it: **Cashback · off**. Short pin (≈ 160 vh):
  at a third of the scrub the toggle flips **on** (the one state change on the
  page), and a second column slides in beside every trade: `+$0.85`, `+$1.70`,
  `+$2.55`, `+$3.40`, `+$1.70`, headed *Cashback record* and footed *Sample ·
  Standard 10% share*. No total. Mobile: plays once, 600 ms after it enters.
- **Meaning.** The two columns the hero just showed, settled, beside the h2
  and copy — market column left, Cashback column right.
- **Chapter 1.** Word reveal.
- **Mechanics = layers over the unchanged log.** The trade log stays fixed and
  dimmed behind a sticky stage; each step slides a card over it and the
  previous card recedes (scale .96, dims): **01** Broker (P1), **02** Share
  (P2), **03** Activity (P3), **04** Control (P4). The log never moves — that
  is the point.
- **Calculator.** The wireframe's form; the estimate reads as the log's
  monthly Cashback line: `Estimated monthly Cashback · $85 / month`.
- **Activation.** The four rows rise; the last row, navy, carries the toggle
  glyph in its *on* state.
- **Final.** Soft, on white.

## 4. Build order

1. Scaffold `cb1..cb4` from `b/`'s `style.css` / `main.js`; wire the nav; drop
   the four product panels P1–P4 in as HTML partials (copied per build, placed
   and skinned per build).
2. Four parallel forks build cb1–cb4 (as b1–b4 were), each ending with its own
   screenshot pass (desktop, mobile, `?reduce=1`) and a short report.
3. One batched fix round across the four.
4. `landing/index.html` third list, `deploy.sh` verify loop, `sh
   design/landing/deploy.sh`, confirm four 200s. Rollback line prints as before.

Roughly half a day with the forks; nothing to generate.

## 4b. Built and deployed — 2026-09-03

Live for review at `https://trustforex.net/v/landing/cb1/` … `cb4/`, listed on
`/v/landing/`. Four parallel forks, one fix round, zero console errors on the
desktop / mobile / `?reduce=1` passes (`design/landing/_qa/shoot.mjs`).

Image generation was added to the brief mid-build (user request) with one rule:
only where a still says the build's truth better than HTML can. Pipeline
`design/landing/_qa/gen.sh` (muse-image on the prod server, copied back over
`ssh cat` — the host has no scp/sftp). Outcome, all brand-quiet matte stills on
warm grey, no text: **cb2** `shared/cb/cb2-beam.webp` — a white bar with a navy
segment, the instrument made physical, as the chapter-1 panel; **cb3**
`cb3-four-tokens.webp` — four navy discs, the four weekly credits, as the
chapter-1 ground; **cb4** `cb4-desk-still.webp` — one closed navy notebook, the
routine undisturbed, as the chapter-1 ground; **cb1** none by decision (the
split already *is* the two records; `cb1-two-sheets.webp` exists unused).

Small deviations, all deliberate: cb1 merges hero and Meaning into one pinned
sequence and moves the fact strip after it; cb2/cb3/cb4 drive the mechanics
with per-step ScrollTriggers on a sticky stage rather than a pin; UI labels
inside product panels ("Your trades never change", "Before week 1", "Four
weekly credits", "Estimate") are not wireframe copy. Known: mid-pin QA stops
read slightly behind nominal progress (harness settle time, not the pages);
cb1's stage reserves P4's height so P1–P3 leave a navy gap above the ledger.
The full `deploy.sh` mirror dropped mid-transfer once on this link; the four
builds shipped incrementally with `tar | ssh` into the live tree.

Post-review fix (2026-09-03): in cb4 the receded layers stayed visible at 28%
behind the active card, so the whole stack showed through — they now fade out
completely as they recede (`.layer.is-back{opacity:0}`), only the active layer
sits over the dimmed log. Cloudflare caches `*.css` for 4 h at the edge, so the
page references `style.css?v=2` / `main.js?v=2`; bump the query on the next
asset change.

## 5. Open — confirm, do not invent

- **Partner broker names.** GTCFX is the only real name in the wireframe;
  "Broker B / C" are placeholders. Prod has no brokers configured yet.
- **The $17-per-lot constant and the ECN ×.35 factor.** Wireframe placeholders
  standing in for the per-broker rebate table behind *View rules for each
  broker*. Every sample credit on the page derives from them.
- **Weekly cadence.** The copy promises credits every week (cb3 is built on
  it); confirm that is the operating cadence before it goes live.
- **The calculator under the brand rules.** Rebate estimate, not profit — kept
  on that reading; the founder decides.
- **The app deep link** (`t.me/<bot>?startapp=…` vs `app.trustforex.net/cashback`).
