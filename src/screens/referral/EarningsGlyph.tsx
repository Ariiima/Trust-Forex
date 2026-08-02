import { useId } from 'react';
import type { ReactNode } from 'react';

/* The two earnings stats on the referral card use glyphs the icon pack does not
 * carry: a base symbol with a percent badge set into its lower-right corner and
 * the base's own stroke cut away around it. Matching all 779 pack icons against
 * the frame's pixels (design/icons/match.mjs) confirms it — the same matcher
 * identifies "Active users" as `user-check` at 0.044, while the best score for
 * either of these is 0.21, i.e. nothing close.
 *
 * So they are assembled from the pack's own geometry instead of approximated by
 * a single wrong icon: `shopping-bag2` / `cash2` for the base, `percent` for the
 * badge, all in the pack's 16 16 24 24 space at stroke-width 2.
 *
 * The cut is a mask rather than a background-coloured disc, so the glyph stays
 * correct on any surface — these sit on a tinted badge here, but the component
 * shouldn't care.
 */

const BASE = {
  plan: 'M32 25V22C32 19.7909 30.2091 18 28 18C25.7909 18 24 19.7909 24 22V25M23 38H33C34.6569 38 36 36.6569 36 35V25C36 23.3431 34.6569 22 33 22H23C21.3431 22 20 23.3431 20 25V35C20 36.6569 21.3431 38 23 38Z',
  cashback:
    'M34 21H20C18.8954 21 18 21.8954 18 23V31M24 35H36C37.1046 35 38 34.1046 38 33V27C38 25.8954 37.1046 25 36 25H24C22.8954 25 22 25.8954 22 27V33C22 34.1046 22.8954 35 24 35ZM32 30C32 31.1046 31.1046 32 30 32C28.8954 32 28 31.1046 28 30C28 28.8954 28.8954 28 30 28C31.1046 28 32 28.8954 32 30Z',
} as const;

const PERCENT = [
  'M34.125 21.875L21.875 34.125',
  'M25.375 23.1875C25.375 24.3956 24.3956 25.375 23.1875 25.375C21.9794 25.375 21 24.3956 21 23.1875C21 21.9794 21.9794 21 23.1875 21C24.3956 21 25.375 21.9794 25.375 23.1875Z',
  'M35 32.8125C35 34.0206 34.0206 35 32.8125 35C31.6044 35 30.625 34.0206 30.625 32.8125C30.625 31.6044 31.6044 30.625 32.8125 30.625C34.0206 30.625 35 31.6044 35 32.8125Z',
];

/* The pack's percent ink spans 21..35 and centres on 27.6; T is set so the
 * scaled badge still centres on (33,33), the lower-right corner of the 24-unit
 * box where the frame draws it. Stroke width is divided back out so the badge
 * keeps the pack's 2px weight regardless of S.
 *
 * S was fitted, not guessed: sweeping 0.70/0.74/0.78/0.84 against the frame's
 * own pixels gives a mean badge difference of 7.51/7.76/7.77/8.23. */
const S = 0.7;
const T = 13.71;
const CUT = { cx: 33, cy: 33, r: 6.9 };

export function EarningsGlyph({
  kind,
  size = 18,
}: {
  kind: keyof typeof BASE;
  size?: number;
}): ReactNode {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="16 16 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <mask id={id} maskUnits="userSpaceOnUse" x="16" y="16" width="24" height="24">
        <rect x="16" y="16" width="24" height="24" fill="white" />
        <circle cx={CUT.cx} cy={CUT.cy} r={CUT.r} fill="black" />
      </mask>
      <path d={BASE[kind]} mask={`url(#${id})`} />
      <g transform={`translate(${T} ${T}) scale(${S})`} strokeWidth={2 / S}>
        {PERCENT.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
