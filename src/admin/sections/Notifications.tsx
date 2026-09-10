/**
 * What is waiting on a human. Nothing is stored: the rows are the same live
 * counts the sidebar badges poll (`/api/admin/alerts`), and each one links to
 * the page that actually clears it. A queue at zero is simply not listed.
 */
import { Link } from 'react-router-dom';
import { api, type Alerts } from '../data';
import { useAsync } from '../useAsync';
import { Card, EmptyState, Icon, SkeletonText, type IconName } from '../ui';

const ITEMS: {
  key: keyof Alerts; icon: IconName; to: string; where: string; cta: string;
  label: (n: number) => string;
}[] = [
  {
    key: 'reviews', icon: 'user-check', to: '/brokers?tab=review',
    where: 'Brokers → Unreviewed users', cta: 'Review',
    label: (n) => `${n} broker account${n === 1 ? '' : 's'} waiting for review`,
  },
  {
    key: 'withdrawals', icon: 'wallet', to: '/money?tab=out',
    where: 'Money → Withdrawals', cta: 'Pay out',
    label: (n) => `${n} withdrawal${n === 1 ? '' : 's'} still to pay`,
  },
  {
    key: 'unmatched', icon: 'alert', to: '/money?tab=unmatched',
    where: 'Money → Unmatched', cta: 'Attribute',
    label: (n) => `${n} payment${n === 1 ? '' : 's'} nobody could be matched to`,
  },
  {
    key: 'campaignBrokers', icon: 'briefcase', to: '/referral?tab=campaigns',
    where: 'Referral → Campaigns', cta: 'Place it',
    label: (n) => `${n} campaign${n === 1 ? '' : 's'} has a broker you haven't placed`,
  },
];

export default function Notifications() {
  const alerts = useAsync(api.alerts);
  const open = ITEMS.filter((i) => (alerts?.[i.key] ?? 0) > 0);

  return (
    <>
      <header className="a-pagehead">
        <div>
          <h1 className="a-pagehead__title">Notifications</h1>
          <p className="a-pagehead__sub">Everything waiting on a decision from you.</p>
        </div>
      </header>

      <Card>
        {!alerts ? <SkeletonText lines={3} /> : open.length === 0 ? (
          <EmptyState icon="check-circle" title="Nothing waiting" hint="Every queue is clear." />
        ) : open.map((i) => (
          <Link key={i.key} to={i.to} className="a-notice">
            <Icon name={i.icon} size={18} />
            <span className="a-notice__text">{i.label(alerts[i.key])}</span>
            <span className="a-notice__where">{i.where}</span>
            <span className="a-notice__cta">{i.cta}<Icon name="chevron-right" size={14} /></span>
          </Link>
        ))}
      </Card>
    </>
  );
}
