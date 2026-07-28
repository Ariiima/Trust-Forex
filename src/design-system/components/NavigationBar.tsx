import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { NavigationItem } from './NavigationItem';
import './NavigationBar.css';

export type NavigationTab = 'home' | 'cashback' | 'referral' | 'earning';

interface TabDef {
  key: NavigationTab;
  label: string;
  icon: IconName;
}

const TABS: readonly TabDef[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'cashback', label: 'Cashback', icon: 'currency-dollar' },
  { key: 'referral', label: 'Referrals', icon: 'users' },
  { key: 'earning', label: 'Earning', icon: 'award' },
];

export interface NavigationBarProps {
  /** The currently selected tab (Figma nav-bar state = home/cashback/referral/earning). */
  active: NavigationTab;
  onChange?: (tab: NavigationTab) => void;
  className?: string;
}

export function NavigationBar({ active, onChange, className }: NavigationBarProps): ReactNode {
  const classes = ['ds-navbar', className ?? ''].filter(Boolean).join(' ');

  return (
    <nav className={classes} aria-label="Primary">
      {TABS.map((tab) => (
        <NavigationItem
          key={tab.key}
          icon={<Icon name={tab.icon} size={24} />}
          label={tab.label}
          state={active === tab.key ? 'active' : 'default'}
          onClick={onChange ? () => onChange(tab.key) : undefined}
        />
      ))}
    </nav>
  );
}
