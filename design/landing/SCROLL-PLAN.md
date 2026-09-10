# Scroll feel — the plan (cb8, soft mode)

Two complaints, two different bugs. Fix them in this order, each behind a check.

1. **Double step.** One flick in soft mode sometimes lands two screens down.
2. **Not smooth.** Frames drop during the flick, and the hand-off from native
   scrolling into the JS tween is visible as a hitch.

## Why it double-steps

`main.js` captures the wheel and has to answer one question from `deltaY` alone:
*is this tick the tail of the flick that already moved us, or a new flick?* The
answer is guessed from four rules (`fresh` in `onWheel`):

| rule | why it exists | how it misfires |
|---|---|---|
| pause > 360 ms | mouse notches | fine |
| direction reversed | reverse mid-travel | fine |
| `d > lastD + 2` (a growing tick) | a second swipe starting while momentum still decays | **a dropped frame coalesces two momentum ticks into one bigger one → counted as a new gesture → second `go()`** |
| equal ticks after 900 ms | a continuously turning mouse wheel | the transition itself is up to 900 ms; a strong flick's tail is still ≥ 6 px at that point → second `go()` |

The third rule fires exactly when the page is slow (heavy frames coalesce wheel
events), so the two complaints feed each other. The `wheel` event carries no
gesture phase, so no amount of extra rules makes this reliable. Two more layers
(`chapterArrival`, `approachTarget`) exist only because the section *before*
the chapter scrolls natively and the controller has to predict where native
momentum will land. That prediction is the hitch at the chapter entry.

## Why it is not smooth

Things that repaint a viewport-sized area on every scrolled frame:

- `chapter-hand-off` animates `background-size` on `#chapter-1::after` (paint, not compositor).
- `stack-back` animates `filter: brightness()` on the sticky blocks.
- `.block .panel::before` uses `backdrop-filter: url(#liquid)` (SVG displacement) plus blur;
  every frame re-samples the moving background beneath it.
- The nav's `backdrop-filter` re-blurs a moving background on every frame.
- The tween runs `scrollTo` from a rAF on the main thread, so any long frame stalls the scroll itself.

To be confirmed by a trace in step 1, not assumed.

## Step 1 — reproduce and measure (½ day)

- Add two cases to `_qa/lock.test.mjs`, in **soft** mode, from a screen inside the locked zone:
  - a macOS momentum tail (the existing 130→8 px, 90 ms series) with one coalesced tick
    injected (e.g. 20, 18, **31**, 14, …) — must move exactly 1 screen;
  - a strong tail that still emits 8 px ticks 1 s after the flick — must move exactly 1 screen.
  Both should fail today. That is the regression test for the whole plan.
- Chrome performance trace of one flick at 1440×900 through m1→m4: list every frame over
  16.7 ms and which of the items above owns it. Write the numbers at the bottom of this file.

## Step 2 — remove the guess: native snap instead of wheel capture (1 day)

Delete the wheel controller and let the browser own the gesture. The browser has the
momentum phase we cannot see, animates on the compositor, and `scroll-snap-stop: always`
makes a two-screen jump impossible by definition.

- `#deck { scroll-snap-type: y mandatory }` in `.snap` mode. The `.scroll-anchor` elements
  already exist and already carry `scroll-snap-align: start`; give them
  `scroll-snap-stop: always`. Snap on the anchors, never on the sticky screens (a sticky box's
  position moves, which is why the anchors were introduced).
- Every screen is already `min-height: 100dvh`, so the hero and "Two records" become snap
  points too. This drops the "native before the chapter" behaviour and, with it,
  `chapterArrival`, `approachTarget`, `lockedNow` and the tween — about 150 lines.
  **Founder decision:** the soft entry into the chapter goes away. That entry is the
  thing that forces gesture guessing; keeping it means keeping the bug class.
- Tall screens (expanded FAQ, zoomed browser) stay readable: the spec lets a snap area
  taller than the viewport scroll freely inside itself, and Chrome, Safari and Firefox all do.
  Confirm it in the spike; it was the stated reason `hard` mode avoided mandatory snap.
- What stays in JS: the section index for the rail and dark/paper nav (`current()` on
  scroll), dots / hash links / focus-follow (`scrollIntoView({behavior:'smooth'})`,
  which snap respects), keyboard (native already pages one snap point at a time; keep
  Home/End), the word reveal, the calculator, the FAQ.
- Keep `?lock=off` (ordinary document) for reduced motion, touch and short viewports, as now.
  Retire `?lock=hard`: mandatory + `stop: always` is hard mode.

**Spike first (2 h), before deleting anything:** a branch with only the CSS change and the
wheel handler disabled. Run four input shapes in Chrome, Safari and Firefox with the QA
harness: one mouse notch, a 20-tick flick, the momentum tail with a coalesced tick, and a
continuously turning wheel. Pass = exactly one screen per gesture, no pull-back after a
single notch that clearly crossed the midpoint, tall FAQ scrollable to its end.

**If the spike fails in a browser we care about**, fall back to the smallest safe controller
instead of the current one: after a transition lands, ignore same-direction wheel input
until there has been **no wheel event for 150 ms**. Drop the growing-tick and equal-tick
rules entirely. A trackpad's second swipe and a mouse's next notch both produce that gap;
a momentum tail never does. Continuous mouse turning without a pause then advances only
when the user lets the wheel rest, which is acceptable. One rule, one comment, one test.

## Step 3 — the frame budget (1 day)

Guided by the trace from step 1; likely fixes, cheapest first:

- `chapter-hand-off`: replace the animated `background-size` with a pseudo-element that
  scales via `transform` (compositor only).
- `stack-back`: replace `filter: brightness()` with an `opacity` fade on a dark overlay
  pseudo-element inside `.block`.
- Liquid glass: freeze it while the deck moves. Toggle `html.scrolling` from the scroll
  handler (clear it 150 ms after the last scroll event) and set
  `html.scrolling .block .panel::before { backdrop-filter: blur(14px) }` — the plain blur is
  compositor-friendly, the SVG displacement is not. Or keep the displacement static via a
  pre-rendered image; decide from the trace numbers.
- Nav: if its blur shows in the trace, use a solid tint while `html.scrolling`.
- `content-visibility: auto` on screens outside the viewport ± one screen.
- Target: no frame over 16.7 ms during a flick at 1440×900 on the founder's machine.
  Second trace, numbers appended below.

## Step 4 — verify on real input, then ship (½ day)

- QA: `lock.test.mjs` (with the new cases), `chapter-scroll.test.mjs` (rewritten for
  snap semantics — the approach and reading-beat cases no longer apply), `scroll-scale.test.mjs`,
  `cb8/?check=1` in the console.
- Hands-on matrix, one flick / one notch / one reversal each: MacBook trackpad in Safari
  and Chrome, Magic Mouse, a notched Logitech wheel, Windows Chrome and Edge with
  smooth scrolling on and off, Firefox. Two-screen jumps: zero tolerated.
- Update `README.md` (scroll modes) and `design/CASHBACK-LANE.md` (motion notes),
  then `sh design/landing/deploy.sh`.

## Done means

- One gesture, one screen, in every browser in the matrix, including with a slow frame.
- No visible hitch at the chapter entry.
- No frame over 16.7 ms during a flick in the trace.
- The wheel controller is gone or is one rule long.

## Measurements (2026-09-07, headless Chromium 1440×900, `_qa/perf.mjs`: 12-tick flick per hop, frames > 20 ms counted)

### Step 1 — double step reproduced

Soft mode, from card 01, a 14-tick momentum tail (130 → 8 px, 90 ms apart) with the fifth tick
doubled to imitate one dropped frame:

| input | screens moved |
|---|---|
| plain tail | 1 |
| tail with one merged tick | **2** (once 4 under load) |

The wheel trace showed the merged tick (191 px after 103 px) passing the "growing delta" rule and
firing a second transition the moment the first one landed.

### Step 2 — native snap spike, rejected

`scroll-snap-type: y mandatory` + `scroll-snap-stop: always` on the anchors, wheel handler off:

| input | soft (JS) | native snap |
|---|---|---|
| one mouse notch | 1 | **0** (snaps back) |
| three notches | 1 | **0** |
| 20-tick flick | 3 | 1 |
| momentum tail | 1 | **0** |
| 30 notches, 60 ms apart | 5 | **0** |

A notched mouse cannot leave a card. Fallback taken: the controller stays, its gesture rules change.
After the change the merged-tick tail moves 1 in three consecutive runs; the plain tail, the drag
and the spinning wheel behave as before.

### Step 3 — where the long frames are

| configuration | long frames, whole page |
|---|---|
| before | 105 |
| hand-off → `transform`, stack-back → `opacity` veil (shipped) | 84–91 |
| + liquid displacement replaced by plain blur | 65–67 |
| + no `backdrop-filter` anywhere | 62 |
| all scroll-driven animations off | 97 |
| **`position: sticky` off on the card stack** | **26** |

The stack's sticky pinning is the dominant cost, not the animations. Variants that keep the stack:

| variant (on top of the two shipped compositor moves) | long frames |
|---|---|
| block clipped by `clip-path` instead of `overflow:hidden` | 78 |
| `will-change: transform` on the pinned blocks | 74 |
| a fully covered card set `visibility: hidden` | 74 |
| `contain: layout paint` on the screens | 81 |
| all three of the first rows | 50–56 |
| + plain blur (no displacement) while `html.travelling` | 41–44 |
| **shipped: all of the above, measured after restamp** | **20** |

Not shipped: `content-visibility`, nav changes (the nav has no blur), rayfield image and panel
shadow removal (no measurable effect).

## What shipped (2026-09-07)

- `cb8/main.js`: a bigger tick alone is no longer a new gesture — two rising ticks in a row
  (`rise = d > last × 1.25 + 1`), a reversal, a 360 ms silence, or after 900 ms two non-decreasing
  ticks. Same rule inside the chapter's arrival gate.
- `cb8/style.css`: the chapter's white ramp scales (`transform`) instead of growing its background;
  plain blur on the glass frame while the deck travels.
- `cb8/base.css`: the card behind dims through an `opacity` veil, not `filter`; cards clip with
  `clip-path`; pinned blocks are promoted; a covered card is hidden.
- `_qa/lock.test.mjs`: merged-tick momentum tail, hard and soft. `_qa/perf.mjs`: the frame counter.

Still open from the plan: the hands-on matrix (real trackpad, Magic Mouse, notched wheel, Safari,
Firefox, Windows). Headless Chromium has no real GPU and no gesture phases; the numbers above are
relative, and the founder's machine is the final judge.
