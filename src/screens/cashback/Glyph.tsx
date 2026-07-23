import type { ReactNode, SVGProps } from 'react';

/**
 * Inline Tabler-style glyphs not covered by the shared design-system Icon set
 * (`src/design-system/components/Icon.tsx`). Per the screen-building brief,
 * new glyphs are inlined here with `currentColor` so the consuming CSS
 * colours them. Mirrors the pattern already used in
 * `src/screens/broker/BrokerDetail.tsx` / `src/screens/plans/icons.tsx`.
 * Shared by both cashback screens (`Cashback.tsx`, `CashbackHistory.tsx`).
 */
export type GlyphName = 'back' | 'shield' | 'calendar' | 'trending-up';

const GLYPHS: Record<GlyphName, readonly string[]> = {
  back: ['M5 12l14 0', 'M5 12l6 6', 'M5 12l6 -6'],
  // Same path as BrokerDetail's "shield" spec-list icon (850:1913 step 1).
  shield: ['M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3'],
  calendar: [
    'M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z',
    'M16 3v4',
    'M8 3v4',
    'M4 11h16',
    'M11 15h1',
    'M12 15v3',
  ],
  // Same path as plans/icons.tsx "trending-up".
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
