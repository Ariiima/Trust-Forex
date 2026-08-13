import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type ActivityCategory, type ActivityRow } from '../data';
import { useAsync } from '../useAsync';
import {
  Button, Card, Cell2, CopyValue, EmptyState, Money, PlanGlyph, Skeleton, SkeletonText, Tabs,
  fmtNum, fmtSigned, fmtUsd, type TabItem,
} from '../ui';
import { DataTable, type Column } from '../ui/DataTable';

type Filter = 'all' | ActivityCategory;

const TABS: TabItem<Filter>[] = [
  { id: 'all', label: 'All' },
  { id: 'Subscription', label: 'Subscription' },
  { id: 'Cashback', label: 'Cashback' },
  { id: 'Referral', label: 'Referral' },
  { id: 'Wallet', label: 'Wallet' },
  { id: 'Campaign', label: 'Campaign' },
];

const COLUMNS: Column<ActivityRow>[] = [
  { id: 'at', header: 'Time', width: 220, render: (a) => a.at, sort: (a) => a.at },
  { id: 'activity', header: 'Activity', wrap: true, render: (a) => a.activity },
  { id: 'category', header: 'Category', width: 140, render: (a) => a.category },
  {
    id: 'amount',
    header: 'Amount',
    align: 'right',
    width: 140,
    render: (a) => <Money value={a.amount} signed={a.signed} />,
    sort: (a) => a.amount ?? 0,
  },
];

export default function UserDetail() {
  const nav = useNavigate();
  const { id = '' } = useParams();
  const detail = useAsync(() => api.user(id), [id]);
  const [tab, setTab] = useState<Filter>('all');

  if (!detail) {
    return (
      <>
        <header className="a-pagehead">
          <Button icon="chevron-left" onClick={() => nav('/users')}>Back to users</Button>
        </header>

        <div className="a-grid" style={{ gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr) minmax(0,1.2fr)' }}>
          <Card>
            <div className="a-row" style={{ gap: 16, alignItems: 'center' }}>
              <Skeleton width={56} height={56} radius={28} />
              <span style={{ flex: 1 }}>
                <Skeleton width={150} height={22} />
                <div style={{ marginTop: 6 }}><Skeleton width={80} height={14} /></div>
              </span>
            </div>
            <div className="a-row" style={{ marginTop: 20, gap: 24 }}>
              <SkeletonText lines={2} width={70} />
              <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--admin-border)' }} />
              <SkeletonText lines={2} width={70} />
            </div>
          </Card>

          <Card title="Cashback">
            <div className="a-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Skeleton width={64} height={26} style={{ margin: '0 auto' }} />
              <Skeleton width={64} height={26} style={{ margin: '0 auto' }} />
            </div>
          </Card>

          <Card title="Referral">
            <div className="a-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <Skeleton width={36} height={22} style={{ margin: '0 auto' }} />
              <Skeleton width={36} height={22} style={{ margin: '0 auto' }} />
              <SkeletonText lines={2} width={80} />
            </div>
          </Card>
        </div>

        <Tabs items={TABS} value={tab} onChange={setTab} />

        <Card flush>
          <DataTable columns={COLUMNS} rows={[]} rowKey={(a) => a.id} loading />
        </Card>
      </>
    );
  }
  const { user, cashback, referral, activity } = detail;

  const rows = tab === 'all' ? activity : activity.filter((a) => a.category === tab);

  return (
    <>
      <header className="a-pagehead">
        <Button icon="chevron-left" onClick={() => nav('/users')}>Back to users</Button>
      </header>

      <div className="a-grid" style={{ gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr) minmax(0,1.2fr)' }}>
        {/* Profile */}
        <Card>
          <div className="a-row" style={{ gap: 16, alignItems: 'flex-start' }}>
            <PlanGlyph plan={user.plan} size={56} />
            <div>
              <div className="at-24 at-bold">{user.name}</div>
              {/* The account number, not users.id — that is an opaque internal
                  key ("tg1234567890" for anyone who arrived via the bot) and
                  nothing an operator can read out. */}
              <div className="at-16 at-muted">{user.userNo != null ? `#${user.userNo}` : user.id}</div>
              <div className="at-13 at-muted" style={{ marginTop: 4 }}>
                Telegram ID: <CopyValue value={user.telegramId != null ? String(user.telegramId) : null} label="Telegram ID" />
              </div>
            </div>
          </div>
          <div className="a-row" style={{ marginTop: 20, gap: 24 }}>
            <Cell2 top={<>Joined — <b>{user.joinedAt}</b></>} bottom="10:30 AM" />
            <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--admin-border)' }} />
            <Cell2 top={<>Last Activity — <b>{user.lastActionAt.split(' · ')[0]}</b></>} bottom={user.lastActionAt.split(' · ')[1]} />
          </div>
        </Card>

        {/* Cashback */}
        <Card title="Cashback">
          <div className="a-grid" style={{ gridTemplateColumns: '1fr 1fr', textAlign: 'center' }}>
            <div>
              <div className="at-13 at-muted">Total Cashback Net</div>
              <div className="at-24 at-bold at-pos">{fmtSigned(cashback.netTotal)}</div>
              <div className="at-12 at-muted">Our Monthly Net</div>
            </div>
            <div>
              <div className="at-13 at-muted">Total Cashback Sale</div>
              <div className="at-24 at-bold at-neg">{fmtSigned(cashback.saleTotal)}</div>
              <div className="at-12 at-muted">Paid to User</div>
            </div>
          </div>
        </Card>

        {/* Referral */}
        <Card title="Referral">
          <div className="a-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center' }}>
            <div>
              <div className="at-13 at-muted">Invited Users</div>
              <div className="at-24 at-bold">{fmtNum(referral.invited)}</div>
            </div>
            <div>
              <div className="at-13 at-muted">Active Users</div>
              <div className="at-24 at-bold">{fmtNum(referral.active)}</div>
            </div>
            <dl className="a-deflist" style={{ alignContent: 'center' }}>
              <dt>Plan</dt><dd>{fmtUsd(referral.plan)}</dd>
              <dt>Cashback</dt><dd>{fmtUsd(referral.cashback)}</dd>
            </dl>
          </div>
          <div className="a-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--admin-hairline)', textAlign: 'center' }}>
            <div>
              <div className="at-13 at-muted">Referral Revenue</div>
              <div className="at-20 at-bold at-pos">{fmtSigned(referral.revenue)}</div>
              <div className="at-12 at-muted">Our Monthly Revenue</div>
            </div>
            <div>
              <div className="at-13 at-muted">Referral Earnings</div>
              <div className="at-20 at-bold at-neg">{fmtSigned(referral.earnings)}</div>
              <div className="at-12 at-muted">Paid to User</div>
            </div>
          </div>
        </Card>
      </div>

      <Tabs items={TABS} value={tab} onChange={setTab} />

      <Card flush>
        <DataTable
          columns={COLUMNS}
          rows={rows}
          rowKey={(a) => a.id}
          empty={
            <EmptyState
              icon="clock"
              title={`No ${tab === 'all' ? '' : tab.toLowerCase()} activity recorded`.replace('  ', ' ')}
              hint="Activity appears here as this user transacts."
            />
          }
        />
      </Card>
    </>
  );
}
