import type { ReactNode, SVGProps } from 'react';

/**
 * Inline Tabler-style glyphs not covered by the shared design-system Icon set
 * (`src/design-system/components/Icon.tsx`). Per the screen-building brief,
 * new glyphs are inlined here with `currentColor` so the consuming CSS
 * colours them. Mirrors the pattern already used in
 * `src/screens/broker/BrokerDetail.tsx`.
 */
export type GlyphName = 'back' | 'close' | 'trending-up';

const GLYPHS: Record<GlyphName, readonly string[]> = {
  back: ['M5 12l14 0', 'M5 12l6 6', 'M5 12l6 -6'],
  close: ['M18 6l-12 12', 'M6 6l12 12'],
  'trending-up': ['M3 17l6 -6l4 4l8 -8', 'M14 7l7 0l0 7'],
};

export interface GlyphProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: GlyphName;
  size?: number;
  strokeWidth?: number;
}

export function Glyph({ name, size = 24, strokeWidth = 1.75, ...rest }: GlyphProps): ReactNode {
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
      {GLYPHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
