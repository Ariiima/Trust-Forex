import type { ReactNode } from 'react';

/* The two earnings glyphs on the referral card, taken verbatim from the
 * design's own SVG exports ("Trust Forex Shopping Bag.svg" for plan,
 * "Trust Forex.svg" for cashback), recoloured from white to currentColor. */
export function EarningsGlyph({
  kind,
  size = 18,
}: {
  kind: 'plan' | 'cashback';
  size?: number;
}): ReactNode {
  return kind === 'plan' ? (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M11.375 6.75C11.375 7.09518 11.6548 7.375 12 7.375C12.3452 7.375 12.625 7.09518 12.625 6.75H12H11.375ZM5.375 6.75C5.375 7.09518 5.65482 7.375 6 7.375C6.34518 7.375 6.625 7.09518 6.625 6.75H6H5.375ZM5.25 4.5V5.125H12.75V4.5V3.875H5.25V4.5ZM3 14.25H3.625V6.75H3H2.375V14.25H3ZM5.25 16.5V15.875C4.35254 15.875 3.625 15.1475 3.625 14.25H3H2.375C2.375 15.8378 3.66218 17.125 5.25 17.125V16.5ZM12.75 4.5V5.125C13.6475 5.125 14.375 5.85254 14.375 6.75H15H15.625C15.625 5.16218 14.3378 3.875 12.75 3.875V4.5ZM5.25 4.5V3.875C3.66218 3.875 2.375 5.16218 2.375 6.75H3H3.625C3.625 5.85254 4.35254 5.125 5.25 5.125V4.5ZM6 4.5H6.625C6.625 3.18832 7.68832 2.125 9 2.125V1.5V0.875C6.99797 0.875 5.375 2.49797 5.375 4.5H6ZM9 1.5V2.125C10.3117 2.125 11.375 3.18832 11.375 4.5H12H12.625C12.625 2.49797 11.002 0.875 9 0.875V1.5ZM12 4.5H11.375V6.75H12H12.625V4.5H12ZM6 4.5H5.375V6.75H6H6.625V4.5H6Z"
        fill="currentColor"
      />
      <path
        d="M15.5527 10.4476L10.4486 15.5518M11.9069 10.9945C11.9069 11.4979 11.4988 11.9059 10.9954 11.9059C10.4921 11.9059 10.084 11.4979 10.084 10.9945C10.084 10.4911 10.4921 10.083 10.9954 10.083C11.4988 10.083 11.9069 10.4911 11.9069 10.9945ZM15.9173 15.0049C15.9173 15.5083 15.5092 15.9163 15.0059 15.9163C14.5025 15.9163 14.0944 15.5083 14.0944 15.0049C14.0944 14.5015 14.5025 14.0934 15.0059 14.0934C15.5092 14.0934 15.9173 14.5015 15.9173 15.0049Z"
        stroke="currentColor"
        strokeWidth="1.04167"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 19 19" fill="none" aria-hidden="true">
      <path
        d="M17 9V6C17 4.89543 16.1046 4 15 4H3C1.89543 4 1 4.89543 1 6V12C1 13.1046 1.89543 14 3 14H8"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M1 7C2.44218 6.62869 3.57692 5.51651 3.9771 4.08207L4 4" stroke="currentColor" />
      <path d="M1 11C2.44218 11.3713 3.57692 12.4835 3.9771 13.9179L4 14" stroke="currentColor" />
      <path d="M17 7C15.5578 6.62869 14.4231 5.51651 14.0229 4.08207L14 4" stroke="currentColor" />
      <rect x="7.5" y="7.5" width="3" height="3" rx="1.5" stroke="currentColor" />
      <path
        d="M16.5527 11.4476L11.4486 16.5518M12.9069 11.9945C12.9069 12.4979 12.4988 12.9059 11.9954 12.9059C11.4921 12.9059 11.084 12.4979 11.084 11.9945C11.084 11.4911 11.4921 11.083 11.9954 11.083C12.4988 11.083 12.9069 11.4911 12.9069 11.9945ZM16.9173 16.0049C16.9173 16.5083 16.5092 16.9163 16.0059 16.9163C15.5025 16.9163 15.0944 16.5083 15.0944 16.0049C15.0944 15.5015 15.5025 15.0934 16.0059 15.0934C16.5092 15.0934 16.9173 15.5015 16.9173 16.0049Z"
        stroke="currentColor"
        strokeWidth="1.04167"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
