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

/* Path data reconstructed pixel-for-pixel from the 1:1 frame render (the Figma
 * REST export is rate-limited). Every icon is drawn on the standard 24 grid but
 * the Figma set fills more of that grid than stock Tabler does, so the numbers
 * below are the measured centre-lines, not the upstream ones. */
const GLYPHS: Record<ReferralGlyphName, readonly string[]> = {
  // "Invited users": head + open shoulder + a down-left arrow in the corner.
  'user-receive': [
    'M10.5 6.9m-3.8 0a3.8 3.8 0 1 0 7.6 0a3.8 3.8 0 1 0 -7.6 0',
    'M3.1 20.8v-2a4 4 0 0 1 4 -4h4.7',
    'M20.8 14.3l-4.7 4.9',
    'M19.6 19.6h-4v-4',
  ],
  // "Active users": same body, tick instead of the arrow.
  'user-check': [
    'M10.5 6.9m-3.8 0a3.8 3.8 0 1 0 7.6 0a3.8 3.8 0 1 0 -7.6 0',
    'M3.1 20.8v-2a4 4 0 0 1 4 -4h4.7',
    'M13.5 17.8l1.8 2.2l5.2 -5',
  ],
  // "Plan earnings": shopping bag whose lower-right is knocked out by a %.
  'shopping-bag': [
    'M8.5 9.6v-3a3.6 3.6 0 0 1 7.2 0v3',
    'M19.8 10v-1.9a1.5 1.5 0 0 0 -1.5 -1.5h-12.5a1.5 1.5 0 0 0 -1.5 1.5v10.8a1.5 1.5 0 0 0 1.5 1.5h4',
    'M15 13.8m-1.7 0a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0',
    'M18.6 19.2m-1.7 0a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0',
    'M20 13.2l-5.4 6.6',
  ],
  // "Cashback earnings": banknote + coin, again notched for the %.
  cash: [
    'M22 11.4v-3.6a2.4 2.4 0 0 0 -2.4 -2.4h-14.9a2.4 2.4 0 0 0 -2.4 2.4v9.4a2.4 2.4 0 0 0 2.4 2.4h5.5',
    'M11.4 11m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0',
    'M14.5 15.3m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0',
    'M19.3 19.5m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0',
    'M20.3 14.1l-5 5.6',
  ],
  send: ['M10 14l11 -11', 'M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1z'],
  // One equator, not the stock pair of latitude lines.
  globe: [
    'M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0',
    'M3 12h18',
    'M11.5 3a17 17 0 0 0 0 18',
    'M12.5 3a17 17 0 0 1 0 18',
  ],
  // Front sheet is flush with the bottom-right of the box; the back one is an
  // open L behind its top-left corner.
  copy: [
    'M8.9 6.6h10a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2z',
    'M13.5 2.4h-9.1a2 2 0 0 0 -2 2v12.1',
  ],
  user: [
    'M12 8.5m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0',
    'M6 19.6v-2a3.7 3.7 0 0 1 3.7 -3.7h4.6a3.7 3.7 0 0 1 3.7 3.7v2',
  ],
  // Figma draws this one square (≈19.6 units each way); Tabler's is 16x18.
  'swap-vertical': [
    'M5.9 2.2v19.6',
    'M9.6 5.5l-3.7 -3.3l-3.7 3.3',
    'M18.1 21.8v-19.6',
    'M21.8 18.5l-3.7 3.3l-3.7 -3.3',
  ],
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
