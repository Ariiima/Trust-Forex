# Design System — Tokens Cheat-Sheet

Source: Figma `wRpTrsYbng1DgKVYjDTgkp` (Trust Forex mini app design system).
Import once (already done in `src/index.css` if wired): `@import './design-system/tokens.css';`
Always reference values with `var(--token)`; hardcode a raw px/hex only when no token exists.

Color tokens are named exactly after their Figma variable (kebab-case, `/` → `-`).
Radius and spacing are style-guide scales (no Figma variables exist for them).

---

## Colors

### Primary (`Primary colors/*`)
| Token | Value |
|---|---|
| `--primary-colors-900` | `#144CCD` (brand blue) |
| `--primary-colors-800` | `#2C5ED2` |
| `--primary-colors-700` | `#4370D7` |
| `--primary-colors-600` | `#5B82DC` |
| `--primary-colors-500` | `#7294E1` |
| `--primary-colors-400` | `#89A5E6` |
| `--primary-colors-300` | `#A1B7EB` |
| `--primary-colors-200` | `#B8C9F0` |
| `--primary-colors-100` | `#D0DBF5` |
| `--primary-colors-50`  | `#E7EDFA` |

### Typography colors (`Typography colors/*`)
| Token | Value |
|---|---|
| `--typography-colors-main-text` | `#212121` |
| `--typography-colors-sub-text`  | `#7C7C7C` |

### Stroke (`Stroke colors/*`)
| Token | Value |
|---|---|
| `--stroke-colors-default` | `#E4E4E4` |
| `--stroke-colors-primary` | `#144CCD` |

### Background (`BG Colors/*`)
| Token | Value |
|---|---|
| `--bg-colors-container-p` | `#FFFFFF` (primary surface) |
| `--bg-colors-container-s` | `#F1F1F1` (secondary surface)¹ |

### Base (`Base color/*`)
| Token | Value |
|---|---|
| `--base-color-black` | `#040404` |
| `--base-color-white` | `#FFFFFF` |

### State (`State Colors/*`) — Figma keeps the "Eror" spelling
| Token | Value | | Token | Value |
|---|---|---|---|---|
| `--state-colors-success`    | `#48D48A` | | `--state-colors-success-bg` | `#E9F9F1` |
| `--state-colors-eror`       | `#FF334C` | | `--state-colors-eror-bg`    | `#FFEFF1` |
| `--state-colors-danger`     | `#FFC300` | | `--state-colors-danger-bg`  | `#FFFBEF` |
| `--state-colors-info`       | `#0099FF` | | `--state-colors-info-bg`    | `#EBF7FF` |

¹ `--bg-colors-container-s` uses the resolved Figma variable value `#F1F1F1`. The static
color-palette swatch in the style guide is labeled `#F5F5F5` (an unbound hardcoded fill).
Trust the token; use `#F1F1F1`.

---

## Radius (`--radius-*`)
| Token | Value | Style-guide name |
|---|---|---|
| `--radius-small`    | `8px`   | Small |
| `--radius-medium`   | `12px`  | Medium |
| `--radius-large`    | `20px`  | Large |
| `--radius-xlarge`   | `32px`  | Xlarge |
| `--radius-xxlarge`  | `48px`  | XXlarge |
| `--radius-xxxlarge` | `56px`  | XXXlarge |
| `--radius-infinity` | `999px` | infinity (pill / fully round) |

## Spacing (`--spacing-<n>` where n = px)
`4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 104`
e.g. `--spacing-16` → `16px`. (Full scale, step names match the pixel value.)

---

## Typography

**Font family:** Sora (variable font, weights 100–800). Token: `--font-family-base`
(`'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`).
Files: `src/assets/fonts/Sora-latin.woff2`, `Sora-latin-ext.woff2` (declared via `@font-face`
in `tokens.css`). Note: Sora has no Persian/Arabic glyphs — RTL text falls back to the system font.

**Weight tokens:** `--font-weight-regular` 400 · `--font-weight-semibold` 600 · `--font-weight-bold` 700 · `--font-weight-extrabold` 800

### Typography utility classes
Each class sets font-family, font-size, line-height, font-weight, letter-spacing (0).
Base class = lightest weight the specimen defines; add `-semibold` / `-bold` / `-extrabold`
for heavier cuts. Apply directly, e.g. `<span class="type-text-base-semibold">`.

| Base class | size / line-height | Weight variants | Figma variable (mini app) |
|---|---|---|---|
| `.type-text-xs-10` | 10 / 20 | — | `Mini app/text-xs/10` |
| `.type-text-xs`    | 12 / 24 | `-semibold` `-bold` `-extrabold` | `Mini app/text-xs/*` |
| `.type-text-sm`    | 14 / 28 | `-semibold` `-bold` `-extrabold` | `Mini app/text-sm/*` |
| `.type-text-base`  | 16 / 32 | `-semibold` `-bold` `-extrabold` | `Mini app/text-base/*` |
| `.type-text-lg`    | 18 / 36 | `-semibold` `-bold` `-extrabold` | — |
| `.type-text-xl`    | 20 / 40 | `-semibold` `-bold` `-extrabold` | — |
| `.type-text-2xl`   | 24 / 44 | `-semibold` `-bold` `-extrabold` | — |
| `.type-text-3xl`   | 30 / 56 | `-semibold` `-bold` `-extrabold` | — |
| `.type-text-4xl`   | 36 / 64 | base = **semibold**; `-extrabold` | `Mini app/text-4xl/*` |
| `.type-text-5xl`   | 44 / 72 | extrabold only | — |
| `.type-text-6xl`   | 56 / 88 | extrabold only | — |

Regular-weight base classes (`.type-text-xs` … `.type-text-3xl`) are weight 400.
`text-4xl` has no Regular cut in the specimen — its base class is SemiBold (600),
matching the mini app's `text-4xl` usage. `text-5xl`/`text-6xl` are ExtraBold display titles.
