# Landing-page sizing and structure

The main Cashback page is [cb8](../cb8/index.html) and uses [scale.css](scale.css).
Its structure follows [the main cashback wireframe](../../reference/wireframe-cashback-v24.html).
The Mini App retains its separate tokens under `src/design-system/`.

Use these roles on future landing pages. Change the token once instead of adding a
hero, section, variant, or mobile font-size override. All sizes use `rem`; the
desktop figures below assume a 16px browser font size and a 1440px viewport.

| Role | Token | Size | Line height | Tracking |
| --- | --- | --- | --- | --- |
| Hero statement | `--text-display` | clamp(54px, 7.2vw, 92px) | .95 | −.067em |
| Final statement | `--text-display-final` | clamp(48px, 6vw, 78px) | .95 | −.067em |
| Chapter break | `--text-chapter` | clamp(42px, 6vw, 76px) | 1 | −.058em |
| Short chapter ("Ready to activate?") | `--text-chapter-compact` | clamp(52px, 7vw, 88px) | 1 | −.058em |
| Mechanics heading | `--text-title-mech` | clamp(48px, 5vw, 68px) | .99 | −.058em |
| Section heading | `--text-title` | clamp(40px, 5vw, 66px) | 1.02 | −.055em |
| Activation heading | `--text-title-compact` | clamp(38px, 4.4vw, 58px) | 1.02 | −.055em |
| Calculator result | `--text-estimate` | 44px | 1 | −.05em |
| Share figures | `--text-number` | 34px | inherited | −.03em |
| Dashboard figures | `--text-stat` | 30px | 1 | −.04em |
| Record card title | `--text-card-title` | 24px | 1.12 | −.035em |
| Hero / final paragraph | `--text-lede` | clamp(18px, 2vw, 23px) | 1.5 | |
| Mechanics paragraph | `--text-mech-copy` | 19px | 1.5 | |
| FAQ question | `--text-question` | 19px | 1.5 | |
| Section paragraph | `--text-copy` | 18px | 1.5 | |
| Activation step | `--text-step` | 17px | 1.25 | −.02em |
| Body default, estimate label, phone form values | `--text-body` | 16px | 1.5 | |
| Factor / dashboard titles, buttons, FAQ answer, split source | `--text-panel-title` | 15px | 1.2 / 1.5 | |
| Nav, record card copy, panel titles, dashboard values | `--text-ui` | 14px | 1.5 | |
| Page number, footer, estimate unit | `--text-meta` | 13px | 1 / 1.5 | |
| Options, routes, factor / dashboard copy, level names | `--text-small` | 12px | 1.5 | |
| Fact strip, field labels, notes, step numbers | `--text-label` | 11px | 1 | |
| Share names, level shares | `--text-micro` | 10px | 1 | |

Roles the later wireframes added (2026-09-09, each page's wireframe verbatim — see the comments
in scale.css for Results, Referral and About). Broker Partnership (`Broker Partnership.html`):

| Role | Token | Size | Line height | Tracking |
| --- | --- | --- | --- | --- |
| Partnership hero | `--text-display-pitch` | clamp(56px, 8vw, 96px) | .91 | −.072em |
| Partnership section heading | `--text-title-pitch` | clamp(42px, 5.5vw, 70px) | .99 | −.058em |
| Partnership chapter breaks | `--text-chapter-pitch` | clamp(44px, 6.4vw, 80px) | .98 | −.062em |
| "How it works" headings 01–03 | `--text-title-how` | clamp(44px, 5vw, 66px) | .98 | −.06em |
| Partnership hero paragraph | `--text-lede-pitch` | clamp(19px, 2vw, 23px) | 1.5 | |
| Campaign title in the app preview | `--text-campaign` | clamp(27px, 3vw, 38px) | 1.03 | −.045em |
| Pilot card heading | `--text-pilot` | clamp(27px, 2.8vw, 38px) | 1.04 | −.045em |
| "Request received" | `--text-received` | 26px | 1.2 | −.04em |

Every value is the wireframe's, verbatim (founder, 2026-09-07). Phones (≤560px) use the
wireframe's own overrides: hero 48px, final 50px, chapters 42 / 54px, mechanics heading 42px,
mechanics paragraph 16px, fact strip 10px. Form values stay 16px on phones to avoid focus zoom.
No page writes a font-size literal; if a size fits no role, add the role here first.

Layout is the wireframe's too: a 1200px wrap with 28px gutters; Meaning .88fr / 1.12fr, 78px
apart; the four mechanics and the calculator 1fr / 1fr, 92px apart, with a hairline 38px right
of the copy (the wireframe's visual border); Activation 1fr / 1fr, 64px apart, the path 560px
wide against the right edge; the calculator panel 600px wide against the right edge. Headings
carry 26px (display) or 21px (section) below them, the mechanics heading 24px, the hero
paragraph 34px before its button. Card interiors (record cards, broker columns, share cells,
factor cards, dashboard tiles and rows, calculator fields, activation steps) use the wireframe's
own paddings and minimum heights. Below 1024px every grid stacks 42px apart.

Spacing steps are 4, 8, 12, 16, 24, 32, 48 and 64px. Related controls use the
smaller steps; heading-to-body spacing is 24px and paragraph-to-action spacing
is 32px. Cards use 24px padding, controls a 46px minimum height and icons 24px.
The slim navigation retains its compact action style.

Content has one 1240px outer width, fluid side gutters and a 32–64px column gap.
The meaning, mechanics, calculator and activation sections share equal desktop
columns and stack below 1024px. Full-screen blocks keep their 20px outer inset
and align their content to the same page grid.

Cashback section order:

1. Centred hero with its fact strip.
2. Meaning: introduction beside two equal records.
3. Chapter statement.
4. Four mechanics: broker, share (2 × 2), activity, control.
5. Calculator: introduction beside the three setup fields, level selection and estimate.
6. Activation chapter, then introduction beside a continuous four-step list.
7. One centred FAQ column.
8. Centred final action, followed by footer navigation within that screen.

The blue fields, sticky mechanics, icons and liquid-glass surface treatments
remain part of the current design. The reference controls information order and
composition; it is not edited when the implementation changes.

Scrolling uses zero-height flow anchors before each section. Never use a sticky
card's `offsetTop` or `scrollIntoView()` as a navigation target: once pinned,
several cards can report the same viewport position. Wheel/keyboard transitions
use those anchors and the same easing in both directions. Soft mode captures the
four mechanics and the chapter approach. The chapter transition starts with the
first wheel event in either adjacent section, before any native scroll occurs.
The chapter holds the incoming gesture, while a fresh gesture or reversal uses
its usual noise floor; there is no extra chapter-only distance threshold. Scroll
observers only report position and never pull the reader back into the chapter.
Hard mode applies the same engine to every screen. Mobile, coarse pointers and
reduced motion use native scrolling, and tall sections remain scrollable.

Edit `cb8/index.html`, `cb8/main.js`, `cb8/base.css` (layout), `cb8/grounds.css`
(backgrounds), or `cb8/style.css` (glass treatment) directly. cb8 is the only
landing page and has no dependency on a retired experimental page. The landing
entry opens it directly. Wireframes are kept in `design/reference/`.

After changes, refresh asset cache keys:

```sh
python3 design/landing/_qa/stamp.py
```

This hashes shared tokens, the base stylesheet, the glass stylesheet and the
HTML's scripts/styles in dependency order. The full deploy script ships only
cb8 and its required shared font/scale files, replacing the old preview tree.

Verification (with the landing directory served on port 5311):

```sh
node design/landing/_qa/lock.test.mjs
node design/landing/_qa/scroll-scale.test.mjs
node design/landing/_qa/chapter-scroll.test.mjs
```

The second check covers both scroll directions, stack boundaries, gesture
reversal, momentum, keyboard navigation, matching typography, structure and
overflow at desktop, laptop and phone widths, plus reduced motion.
The chapter check covers arrival from either direction, a sustained gesture that
outlasts the transition, light gestures in either direction, and frame-by-frame entry/reversal checks.
