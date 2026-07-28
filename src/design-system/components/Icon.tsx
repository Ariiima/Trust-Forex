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
  | 'report';

const ICONS: Record<IconName, readonly string[]> = {
  // Plain pentagon house — the Figma "home" nav glyph (no door/window).
  home: ['M12 4.5L19 11V20H5V11Z'],
  'currency-dollar': [
    'M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2',
    'M12 3v3m0 12v3',
  ],
  users: [
    'M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
    'M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2',
    'M16 3.13a4 4 0 0 1 0 7.75',
    'M21 21v-2a4 4 0 0 0 -3 -3.85',
  ],
  award: [
    'M12 9m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0',
    'M12 15l3.4 5.89l1.598 -3.233l3.598 .232l-3.4 -5.889',
    'M6.802 12l-3.4 5.89l3.598 -.233l1.598 3.232l3.4 -5.889',
  ],
  check: ['M5 12l5 5l10 -10'],
  info: ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 9h.01', 'M11 12h1v4h1'],
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
  report: [
    'M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z',
    'M7 14l3 -3l2 2l5 -5',
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
