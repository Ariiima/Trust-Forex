import type { ReactNode, SVGProps } from 'react';

/* Inline Tabler glyphs — the DS Icon set (home/currency-dollar/users/award/
 * check/info/arrow-up/chevron-right) does not cover the header back arrow,
 * the header's trailing chevron-down / dots-vertical, the bottom-sheet
 * close (x), the warning triangle / copy / success-check-circle used on the
 * receive screen. Per the brief, new glyphs are inlined here with
 * currentColor so the consuming CSS colours them. Shared by all payment
 * screens (PaymentCurrency, PaymentNetwork, PaymentReceive). */
export type GlyphName =
  | 'back'
  | 'chevron-down'
  | 'dots-vertical'
  | 'close'
  | 'alert-triangle'
  | 'copy'
  | 'check-circle';

const GLYPHS: Record<GlyphName, readonly string[]> = {
  back: ['M5 12l14 0', 'M5 12l6 6', 'M5 12l6 -6'],
  'chevron-down': ['M6 9l6 6l6 -6'],
  // Three round-cap zero-length strokes — the standard Tabler technique for
  // drawing filled dots via a stroke-only renderer (each "M x yv.01" paints
  // one dot whose diameter equals strokeWidth).
  'dots-vertical': ['M12 5v.01', 'M12 12v.01', 'M12 19v.01'],
  close: ['M18 6l-12 12', 'M6 6l12 12'],
  'alert-triangle': [
    'M12 9v4',
    'M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.535a1.914 1.914 0 0 0 -3.274 0z',
    'M12 16h.01',
  ],
  copy: [
    'M10 8h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2v-8a2 2 0 0 1 2 -2z',
    'M6 16a2 2 0 0 1 -2 -2v-8a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2',
  ],
  'check-circle': ['M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M9 12l2 2l4 -4'],
};

interface GlyphProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
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
