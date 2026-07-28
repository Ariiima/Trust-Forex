import type { ReactNode, SVGProps } from 'react';

/* Tabler-style glyphs used by the referral screens that the DS Icon set does
 * not cover (1333:8366 layer names in comments). Same currentColor contract as
 * the payment/cashback Glyph modules. */
export type ReferralGlyphName =
  | 'user-receive'
  | 'user-check'
  | 'shopping-bag'
  | 'cash'
  | 'send'
  | 'globe'
  | 'copy'
  | 'user'
  | 'swap-vertical';

const GLYPHS: Record<ReferralGlyphName, readonly string[]> = {
  'user-receive': [
    'M12 11m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
    'M6 21v-1a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v1',
    'M12 3v5',
    'M9.5 6l2.5 2.5l2.5 -2.5',
  ],
  'user-check': [
    'M9 8m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
    'M3 21v-1a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v1',
    'M16 12l2 2l4 -4',
  ],
  // Bag outline with a "%" inside — Figma "shopping-bag3".
  'shopping-bag': [
    'M6.5 7h11l1 13h-13z',
    'M9 7a3 3 0 0 1 6 0',
    'M10.5 13.5h.01',
    'M13.5 16.5h.01',
    'M14 13l-4 4',
  ],
  // Banknote with a "%" — Figma "cash1".
  cash: [
    'M3 8m0 1a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z',
    'M10 11.5h.01',
    'M13 14.5h.01',
    'M13.5 11l-3 4',
  ],
  send: ['M10 14l11 -11', 'M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1z'],
  globe: [
    'M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0',
    'M3.6 9h16.8',
    'M3.6 15h16.8',
    'M11.5 3a17 17 0 0 0 0 18',
    'M12.5 3a17 17 0 0 1 0 18',
  ],
  copy: [
    'M8 8m2 0a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2z',
    'M4 16a2 2 0 0 1 -2 -2v-8a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2',
  ],
  user: ['M12 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2'],
  'swap-vertical': ['M7 3l0 18', 'M10 6l-3 -3l-3 3', 'M17 21l0 -18', 'M20 18l-3 3l-3 -3'],
};

interface Props extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: ReferralGlyphName;
  size?: number;
  strokeWidth?: number;
}

export function Glyph({ name, size = 24, strokeWidth = 1.75, ...rest }: Props): ReactNode {
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
