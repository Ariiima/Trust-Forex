/**
 * Usage overview: how many people there are, and how many of them are
 * actually opening the app. First pass — total users plus 1/3/7-day active
 * counts (from `users.last_seen`, a live snapshot) and a daily-active trend
 * (from `daily_actives`, exact per-day history). Every read hits the API
 * fresh (useAsync owns no cache), so this never shows a stale number.
 */
import { api } from '../data';
import { useAsync } from '../useAsync';
import { Card, Readings, Reading, Skeleton, fmtNum } from '../ui';
import { LineChart } from '../ui/Chart';

export default function Analytics() {
  const data = useAsync(() => api.analytics(), []);
  const loading = !data;

  return (
    <>
      <header className="a-pagehead">
        <div>
          <h1 className="a-pagehead__title">Analytics</h1>
          <p className="a-pagehead__sub">
            Who's actually opening the app. Every number here is read live, not cached.
          </p>
        </div>
      </header>

      <Readings>
        <Reading label="Total users" value={loading ? <Skeleton width={64} height={22} /> : fmtNum(data.totalUsers)} />
        <Reading label="Active today" value={loading ? <Skeleton width={48} height={22} /> : fmtNum(data.activeToday)} />
        <Reading label="Active last 3 days" value={loading ? <Skeleton width={48} height={22} /> : fmtNum(data.active3d)} />
        <Reading label="Active last 7 days" value={loading ? <Skeleton width={48} height={22} /> : fmtNum(data.active7d)} />
      </Readings>

      <Card title="Daily actives" subtitle="Distinct users who opened the app, per day">
        {loading ? (
          <Skeleton width="100%" height={320} />
        ) : (
          <LineChart
            data={data.daily}
            xKey="day"
            series={[{ key: 'active', label: 'Active users' }]}
            legend={false}
          />
        )}
      </Card>
    </>
  );
}
