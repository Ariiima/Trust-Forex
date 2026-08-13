/**
 * Admin icon set — 24-grid stroke glyphs, drawn at stroke-width 2 in viewBox
 * units so a single path scales to every call site.
 *
 * Deliberately separate from `design-system/components/Icon`: that one is
 * pixel-matched to the Figma mini-app frames and its paths are offset to a
 * (16,16) origin. Extending it for admin-only glyphs would risk regressions in
 * screens that are already signed off.
 */

export type IconName =
  | 'alert' | 'award' | 'bank' | 'bell' | 'bold' | 'bookmark' | 'briefcase'
  | 'calendar' | 'chart' | 'check' | 'check-circle' | 'chevron-down'
  | 'chevron-left' | 'chevron-right' | 'chevron-up' | 'clock' | 'close'
  | 'copy' | 'dollar' | 'dots' | 'external' | 'file' | 'filter' | 'gem'
  | 'gift' | 'grip' | 'image' | 'infinity' | 'info' | 'italic' | 'link'
  | 'list' | 'list-numbers' | 'mail' | 'megaphone' | 'minus' | 'pause'
  | 'pencil' | 'percent' | 'play' | 'plus' | 'quote' | 'robot' | 'search'
  | 'send' | 'settings' | 'shield' | 'smile' | 'sort' | 'star' | 'stop'
  | 'target' | 'trash' | 'trending-up' | 'underline' | 'undo' | 'upload'
  | 'user' | 'user-check' | 'user-plus' | 'users' | 'wallet' | 'x-circle';

/** Round-cap dots render from a zero-length segment; used for grip/kebab. */
const ICONS: Record<IconName, string> = {
  alert: 'M12 9v4M12 17h.01M10.24 4.5L2.51 18a2 2 0 0 0 1.73 3h15.52a2 2 0 0 0 1.73 -3L13.76 4.5a2 2 0 0 0 -3.52 0',
  award: 'M12 15a5 5 0 1 0 0 -10a5 5 0 0 0 0 10M8.5 13.5L7 21l5 -2.5L17 21l-1.5 -7.5',
  bank: 'M3 21h18M3 10h18M5 6l7 -3l7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3',
  bell: 'M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6M9 17v1a3 3 0 0 0 6 0v-1',
  bold: 'M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z',
  bookmark: 'M6 4a1 1 0 0 1 1 -1h10a1 1 0 0 1 1 1v17l-6 -4l-6 4z',
  briefcase: 'M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2H5a2 2 0 0 1 -2 -2zM8 7V5a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2M3 13h18',
  calendar: 'M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2H6a2 2 0 0 1 -2 -2zM16 3v4M8 3v4M4 11h16',
  chart: 'M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-3',
  check: 'M5 12l5 5l9 -9',
  'check-circle': 'M12 21a9 9 0 1 0 0 -18a9 9 0 0 0 0 18M9 12l2 2l4 -4',
  'chevron-down': 'M6 9l6 6l6 -6',
  'chevron-left': 'M15 6l-6 6l6 6',
  'chevron-right': 'M9 6l6 6l-6 6',
  'chevron-up': 'M6 15l6 -6l6 6',
  clock: 'M12 21a9 9 0 1 0 0 -18a9 9 0 0 0 0 18M12 7v5l3 3',
  close: 'M18 6L6 18M6 6l12 12',
  copy: 'M8 10a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2zM16 8V6a2 2 0 0 0 -2 -2H6a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2',
  dollar: 'M12 3v18M16.5 7.5A4 4 0 0 0 13 6h-2a3 3 0 0 0 0 6h2a3 3 0 0 1 0 6h-2a4 4 0 0 1 -3.5 -1.5',
  dots: 'M12 6h.01M12 12h.01M12 18h.01',
  external: 'M12 6H6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6M11 13l9 -9M15 4h5v5',
  file: 'M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1 -2 -2V5a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2',
  filter: 'M4 4h16l-6 7v7l-4 2v-9z',
  gem: 'M6 3h12l3 6l-9 12L3 9zM3 9h18',
  gift: 'M3 12h18M12 12v9M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-7M4 8h16a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1H4a1 1 0 0 1 -1 -1V9a1 1 0 0 1 1 -1M12 8a3 3 0 1 1 3 -3a3 3 0 0 1 -3 3a3 3 0 1 1 -3 -3a3 3 0 0 1 3 3',
  grip: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
  image: 'M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2H6a2 2 0 0 1 -2 -2zM9 10a1 1 0 1 0 0 -2a1 1 0 0 0 0 2M5 17l4 -4a2 2 0 0 1 3 0l4 4M14 14l1 -1a2 2 0 0 1 3 0l2 2',
  infinity: 'M9.83 9.17a4 4 0 1 0 0 5.66a10 10 0 0 0 2.17 -2.83a10 10 0 0 1 2.17 -2.83a4 4 0 1 1 0 5.66a10 10 0 0 1 -2.17 -2.83a10 10 0 0 0 -2.17 -2.83',
  info: 'M12 9h.01M11 12h1v4h1M12 21a9 9 0 1 0 0 -18a9 9 0 0 0 0 18',
  italic: 'M11 5h6M7 19h6M14 5l-4 14',
  link: 'M9 15l6 -6M11 6l.46 -.54a5 5 0 0 1 7.07 7.07l-.53 .47M13 18l-.4 .53a5.07 5.07 0 0 1 -7.13 0a4.97 4.97 0 0 1 0 -7.07l.53 -.46',
  list: 'M9 6h11M9 12h11M9 18h11M5 6h.01M5 12h.01M5 18h.01',
  'list-numbers': 'M11 6h9M11 12h9M11 18h9M4 4h1v5M4 14h2a1 1 0 0 1 0 2l-2 2h3',
  mail: 'M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2H5a2 2 0 0 1 -2 -2zM3 7l9 6l9 -6',
  megaphone: 'M3 10v4a1 1 0 0 0 1 1h3l7 4V5L7 9H4a1 1 0 0 0 -1 1M18 9a3 3 0 0 1 0 6',
  minus: 'M5 12h14',
  pause: 'M9 5v14M15 5v14',
  pencil: 'M4 20h4l10.5 -10.5a2.83 2.83 0 1 0 -4 -4L4 16v4M13.5 6.5l4 4',
  percent: 'M17 17a1 1 0 1 0 0 -2a1 1 0 0 0 0 2M7 9a1 1 0 1 0 0 -2a1 1 0 0 0 0 2M6 18L18 6',
  play: 'M7 4v16l13 -8z',
  plus: 'M12 5v14M5 12h14',
  quote: 'M6 15h3a1 1 0 0 0 1 -1v-3a1 1 0 0 0 -1 -1H7a1 1 0 0 1 -1 -1V8a1 1 0 0 1 1 -1h1M15 15h3a1 1 0 0 0 1 -1v-3a1 1 0 0 0 -1 -1h-2a1 1 0 0 1 -1 -1V8a1 1 0 0 1 1 -1h1',
  robot: 'M7 7h10a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2H7a2 2 0 0 1 -2 -2V9a2 2 0 0 1 2 -2M12 4v3M9 12h.01M15 12h.01M9.5 16h5',
  search: 'M10 17a7 7 0 1 0 0 -14a7 7 0 0 0 0 14M21 21l-6 -6',
  send: 'M10 14l11 -11M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1z',
  settings: 'M12 15a3 3 0 1 0 0 -6a3 3 0 0 0 0 6M10.3 3.6a1 1 0 0 1 .95 -.6h1.5a1 1 0 0 1 .95 .6l.4 1.2a7 7 0 0 1 1.6 .93l1.25 -.2a1 1 0 0 1 1 .5l.75 1.3a1 1 0 0 1 -.05 1.1l-.8 1a7 7 0 0 1 0 1.85l.8 1a1 1 0 0 1 .05 1.1l-.75 1.3a1 1 0 0 1 -1 .5l-1.25 -.2a7 7 0 0 1 -1.6 .93l-.4 1.2a1 1 0 0 1 -.95 .6h-1.5a1 1 0 0 1 -.95 -.6l-.4 -1.2a7 7 0 0 1 -1.6 -.93l-1.25 .2a1 1 0 0 1 -1 -.5l-.75 -1.3a1 1 0 0 1 .05 -1.1l.8 -1a7 7 0 0 1 0 -1.85l-.8 -1a1 1 0 0 1 -.05 -1.1l.75 -1.3a1 1 0 0 1 1 -.5l1.25 .2a7 7 0 0 1 1.6 -.93z',
  shield: 'M12 3l7 3v6c0 4.5 -3 7.7 -7 9c-4 -1.3 -7 -4.5 -7 -9V6z',
  smile: 'M12 21a9 9 0 1 0 0 -18a9 9 0 0 0 0 18M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0',
  sort: 'M3 8l4 -4l4 4M7 4v16M13 16l4 4l4 -4M17 20V4',
  star: 'M12 3l2.6 5.6l6.4 .8l-4.7 4.3l1.2 6.3l-5.5 -3l-5.5 3l1.2 -6.3L3 9.4l6.4 -.8z',
  stop: 'M9 9h6v6H9zM12 21a9 9 0 1 0 0 -18a9 9 0 0 0 0 18',
  target: 'M12 21a9 9 0 1 0 0 -18a9 9 0 0 0 0 18M12 16a4 4 0 1 0 0 -8a4 4 0 0 0 0 8M12 13a1 1 0 1 0 0 -2a1 1 0 0 0 0 2',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12M9 7V4a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3',
  'trending-up': 'M3 17l6 -6l4 4l8 -8M15 7h6v6',
  underline: 'M7 5v6a5 5 0 0 0 10 0V5M5 19h14',
  undo: 'M9 14l-4 -4l4 -4M5 10h9a5 5 0 0 1 0 10h-4',
  upload: 'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2M7 9l5 -5l5 5M12 4v12',
  user: 'M12 7a4 4 0 1 0 0 8a4 4 0 0 0 0 -8M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2',
  'user-check': 'M9 7a4 4 0 1 0 0 8a4 4 0 0 0 0 -8M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2M16 11l2 2l4 -4',
  'user-plus': 'M9 7a4 4 0 1 0 0 8a4 4 0 0 0 0 -8M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2M16 11h6M19 8v6',
  users: 'M9 7a4 4 0 1 0 0 8a4 4 0 0 0 0 -8M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0 -3 -3.85',
  wallet: 'M19 7V5a2 2 0 0 0 -2 -2H5a2 2 0 0 0 -2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2M21 12h-5a2 2 0 0 0 0 4h5v-4',
  'x-circle': 'M12 21a9 9 0 1 0 0 -18a9 9 0 0 0 0 18M10 10l4 4M14 10l-4 4',
};

export interface IconProps {
  name: IconName;
  size?: number;
  /** Dot-style glyphs (grip, dots) read better a touch thicker. */
  strokeWidth?: number;
  className?: string;
}

export function Icon({ name, size = 20, strokeWidth, className }: IconProps) {
  const dotty = name === 'grip' || name === 'dots';
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? (dotty ? 2.5 : 2)}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}
