import type { ReactNode } from 'react';
import { Glyph } from './icons';
import './PlansHeader.css';

/**
 * In-app back-arrow header shared by `/plans` and `/checkout` (Figma
 * instance "Telegram header", overridden per-screen with a back button +
 * title — see 552:3126 / 552:3115). The chevron-down + kebab glyphs baked
 * into that Figma component are Telegram WebView chrome (persistent,
 * non-app-content) and are intentionally omitted here, matching the
 * convention already established in `src/screens/broker/BrokerDetail.tsx`.
 */
export interface PlansHeaderProps {
  title: string;
  onBack?: () => void;
}

export function PlansHeader({ title, onBack }: PlansHeaderProps): ReactNode {
  return (
    <header className="scr-plans-header">
      <button className="scr-plans-back" type="button" onClick={onBack} aria-label="Back">
        <Glyph name="back" size={20} />
      </button>
      <span className="scr-plans-headtitle">{title}</span>
    </header>
  );
}
