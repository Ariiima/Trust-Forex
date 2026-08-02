# Design vs build review

Side-by-side of every designed screen and its implementation, with a comment
box per screen.

    python3 -m http.server 5300 --bind 127.0.0.1 -d design/review
    open http://127.0.0.1:5300/

- **Left** = the committed 1:1 frame render from `ref/`. It used to be a live
  Figma embed, which meant being logged in and reloading 24 iframes every time.
- **Right** = the built screen, deep-linked to the same state via query params
  (`?sheet=`, `?state=`, `?amount=`). Served from `.../review/` it uses the app
  sitting next to it; otherwise the public build. `?app=http://localhost:5199`
  always wins, which is how you point it at a dev server.
- **Comments** autosave to localStorage. "Copy all comments" puts them on the
  clipboard as markdown.
- **Overlay mode** stacks the two with a difference blend for spotting drift.

The query params are read in `src/App.tsx` (the `*Q` wrappers). They are inert
without a param, so they cost nothing in normal use.

## Scoring a screen

`ref/*.png` are the frames at 1:1. `sweep.sh` diffs every one of them against
the dev server:

    npm run dev                       # must be on 5199
    sh design/review/sweep.sh         # all screens
    sh design/review/sweep.sh pay     # names containing "pay"

Under ~3.0 mean is a match; what is left at that point is glyph
anti-aliasing, which Figma rasterises a few percent heavier than Chromium.

The two pieces underneath, for working one screen at a time:

    node design/review/shoot.mjs <url> <out.png> 360 <height> [waitMs]
    python3 design/review/compare.py <ref.png> <build.png> <heatmap.png>

**The capture height is always the frame height minus 76** — 32px iOS status
bar + 44px Telegram header, which the webview does not render and `compare.py`
crops off the reference for you.

`boxes.mjs` dumps `getBoundingClientRect` plus computed padding/gap/line-height
for any selector at the capture viewport. Reach for it before trying to solve a
box model out of pixels:

    node design/review/boxes.mjs http://localhost:5199/plans 984 ".scr-plans-card > *"

Three more, for the questions those two cannot answer:

    # same region out of both, magnified, design-left build-right
    python3 design/review/zoom.py <ref-name> <build.png> <x> <y> <w> <h> [scale] [out]

    # ink bbox + cap height + width of a text run in both
    python3 design/review/ink.py <ref-name> <build.png> <x> <y> <w> <h> [label]

    # renders the whole icon pack so a design crop can be matched by pixels
    node design/icons/match.mjs <px> <fg> <bg> [strokeWidth]

`ink.py` measures **width**, not just height: at 10-14px a font-size change
moves the cap height by ~1px but the run width by 20%, so width is what
actually identifies the size.

`flash.mjs` checks that no navigation shows a blank frame — it samples frames
across each tab swap and flags any that is nearly flat.

## Things that were wrong on nearly every screen

- **Inside strokes.** Figma draws a 1px border *inside* the padding box, so a
  frame reading "12px padding, 1px stroke" is `padding: 11px; border: 1px` in
  CSS. Getting this wrong shifts a row's contents 1px and its height 2px.
- **Duplicate headers.** Several screens drew their own back-chevron bar over
  Telegram's native one. Telegram's BackButton (`src/telegram`) drives `onBack`.
- **Cancelling errors.** A box 18px too tall above one 2px too short still
  lines everything below up. Aligned landmarks do not mean correct boxes.
- **Dashed rules read as absent.** Scanning a frame for a continuous run of a
  colour will never find a dashed line. The cashback card's divider was called
  missing for exactly that reason; it is 4-on-4 at 8% white.
- **Not every glyph is in the icon pack.** The cashback tier badges and the two
  referral earnings icons are not, and no amount of matching will find them. At
  those sizes what reads is ink weight and box size, so match those and say the
  approximation is an approximation.

## Review-only states

Some frames capture a state a first-time user would not see. Those are reached
with a query param so the live default stays honest — never by changing the
default:

| param | screen | state |
|---|---|---|
| `?tip` | `/` | "Choose your plan" info callout open |
| `?switcher` | `/` | subscription-state switcher (dev only) |
| `?account=submitted` | `/cashback/broker/:id` | pending verification |
| `?tip` | `/earning` | chart readout pinned open (it follows the finger otherwise) |
| `?state=` `?sheet=` `?amount=` | referral, earning, withdraw | see `src/App.tsx` |

## Motion

Everything animated degrades through `prefers-reduced-motion`, because
`shoot.mjs` captures with `reducedMotion: 'reduce'` — that is what keeps the
diff deterministic. CSS goes behind the media query; motion components sit
under `<MotionConfig reducedMotion="user">` in `src/App.tsx`. An animation that
ignores it will make the sweep non-reproducible rather than merely fail.
