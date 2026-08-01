import type { ReactNode, SVGProps } from 'react';

/**
 * Icon — inline SVG primitive for the mini-app design system.
 *
 * Names match the Figma "Global icons" component set (Style=Stroke). The mini
 * app's icons are a Tabler-style stroke set drawn on a 24x24 grid with
 * `currentColor`, so the consuming component's CSS controls the colour. The
 * exact same path data is mirrored as standalone files in
 * `src/assets/icons/<name>.svg` for reuse outside React.
 *
 * (The Figma REST export endpoint was rate-limited when this was authored, so
 * the vector paths were reconstructed from the reference renders rather than
 * exported; they are visually verified against the component screenshots.)
 */
export type IconName =
  | 'home'
  | 'currency-dollar'
  | 'users'
  | 'award'
  | 'check'
  | 'info'
  | 'arrow-up'
  | 'chevron-right'
  | 'alert-circle'
  | 'alert-triangle'
  | 'close'
  | 'report'
  | 'scan'
  | 'wallet';

const ICONS: Record<IconName, readonly string[]> = {
  // Plain pentagon house — the Figma "home" nav glyph (no door/window).
  home: ['M12 4.5L19 11V20H5V11Z'],
  'currency-dollar': [
    'M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2',
    'M12 3v3m0 12v3',
  ],
  // Figma's set fills more of the 24 grid than stock Tabler: this spans
  // x2..22, not x3..21.
  users: [
    'M8.7 6.8m-4.4 0a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0',
    'M2 21.4v-2.2a4.4 4.4 0 0 1 4.4 -4.4h4.4a4.4 4.4 0 0 1 4.4 4.4v2.2',
    'M16.4 2.8a4.4 4.4 0 0 1 0 8.5',
    'M22 21.4v-2.2a4.4 4.4 0 0 0 -3.3 -4.2',
  ],
  // Compact medal: circle over a straight-sided pendant with a cross-bar and a
  // V-notch in the bottom edge. Frame bbox is 16x22 on the 24 grid; Tabler's
  // splayed-ribbon award renders 20x20 and is the wrong drawing entirely.
  award: [
    'M12 8m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0',
    'M8 13.4v8.6l4 -2.6l4 2.6v-8.6',
    'M8 16.6h8',
  ],
  check: ['M5 12l5 5l10 -10'],
  // Ring is r=10 on the 24 grid (22px of ring in a 24 box), not Tabler's r=9.
  info: ['M2 12a10 10 0 1 0 20 0a10 10 0 0 0 -20 0', 'M12 8h.01', 'M11 12h1v4h1'],
  'arrow-up': ['M12 5l0 14', 'M18 11l-6 -6', 'M6 11l6 -6'],
  'chevron-right': ['M9 6l6 6l-6 6'],
  /* placeholder icon */
  'alert-circle': ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 8v4', 'M12 16h.01'],
  /* placeholder icon */
  'alert-triangle': [
    'M12 9v4',
    'M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z',
    'M12 16h.01',
  ],
  /* placeholder icon */
  close: ['M18 6l-12 12', 'M6 6l12 12'],
  // Rounded square framing a rising zig-zag — the "report" glyph used by the
  // referral preview's third benefit row (1341:5202).
  // Landscape frame (20x16 units), not Tabler's 16x16 square.
  report: [
    'M2 6a2 2 0 0 1 2 -2h16a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2z',
    'M7 14l3 -3l2 2l5 -5',
  ],
  // Rounded body with a flap and a stud — the earning nav tab (711:2400).
  wallet: [
    'M2.5 8.5a2.5 2.5 0 0 1 2.5 -2.5h14a2.5 2.5 0 0 1 2.5 2.5v9a2.5 2.5 0 0 1 -2.5 2.5h-14a2.5 2.5 0 0 1 -2.5 -2.5z',
    'M5 6V5a2 2 0 0 1 2 -2h9',
    'M17.5 13h.01',
  ],
  // Viewfinder corners — the wallet-address field's scan affordance (1402:7345).
  scan: [
    'M4 8v-2a2 2 0 0 1 2 -2h2',
    'M4 16v2a2 2 0 0 0 2 2h2',
    'M16 4h2a2 2 0 0 1 2 2v2',
    'M16 20h2a2 2 0 0 0 2 -2v-2',
  ],
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  /** Rendered width and height in px. Defaults to 24. */
  size?: number;
  /** Stroke width on the 24x24 grid. Defaults to 1.75 (matches the design). */
  strokeWidth?: number;
}

export function Icon({ name, size = 24, strokeWidth = 1.75, ...rest }: IconProps): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
