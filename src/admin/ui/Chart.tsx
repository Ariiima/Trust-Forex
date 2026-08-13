/**
 * Charts. Thin wrapper over recharts so every chart in the admin shares one
 * legend, one tooltip and one series-colour assignment.
 *
 * Series colours are assigned by position in the `series` array and never
 * cycled — hiding a series through the legend must not repaint the others.
 *
 * On the multiple Y axes: the frames plot counts, rates and USD on one plot,
 * so the axes are what the design asks for. Every series is named in the
 * legend and again in the tooltip with its own unit, which is what keeps the
 * reading unambiguous; the axis a series belongs to is written into its
 * tooltip row.
 */
import { useState, type ReactNode } from 'react';
import {
  Brush, CartesianGrid, Line, LineChart as RLineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Area, AreaChart,
} from 'recharts';
import { fmtNum, fmtPct, fmtUsd } from './index';

export const SERIES_COLORS = [
  '#2563eb', '#f59e0b', '#0d9488', '#ef4444',
  '#7c3aed', '#22c55e', '#06b6d4', '#db2777',
] as const;

export type AxisId = 'count' | 'rate' | 'usd';

export interface Series {
  key: string;
  label: string;
  /** Which Y scale the series is read against. Defaults to `count`. */
  axis?: AxisId;
  /** Secondary encoding — rates are dashed in the frames, so they stay legible
   *  when the colour pair is hard to separate. */
  style?: 'solid' | 'dashed' | 'dotted';
}

const DASH: Record<string, string | undefined> = {
  solid: undefined,
  dashed: '6 4',
  dotted: '2 4',
};

const AXIS_LABEL: Record<AxisId, string> = { count: 'Users', rate: 'Rate (%)', usd: 'USD' };

export const axisFormat = (axis: AxisId, v: number) =>
  axis === 'usd' ? fmtUsd(v) : axis === 'rate' ? fmtPct(v) : fmtNum(v);

const tick = (axis: AxisId) => (v: number) =>
  axis === 'usd' ? (Math.abs(v) >= 1000 ? `$${v / 1000}K` : `$${v}`)
    : axis === 'rate' ? `${v}%`
      : fmtNum(v);

interface TooltipPayload {
  dataKey: string;
  value: number;
  color: string;
}

function ChartTooltip({
  active, payload, label, series,
}: { active?: boolean; payload?: TooltipPayload[]; label?: string; series: Series[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="a-tooltip">
      <div className="a-tooltip__title">{label}</div>
      {payload.map((p) => {
        const s = series.find((x) => x.key === p.dataKey);
        if (!s) return null;
        return (
          <div key={p.dataKey} className="a-tooltip__row">
            <span className="a-tooltip__dot" style={{ background: p.color }} />
            {s.label}
            <b>{axisFormat(s.axis ?? 'count', p.value)}</b>
          </div>
        );
      })}
    </div>
  );
}

export function ChartLegend({
  series, hidden, onToggle,
}: { series: Series[]; hidden: string[]; onToggle: (key: string) => void }) {
  return (
    <div className="a-chart__legend">
      {series.map((s, i) => {
        const off = hidden.includes(s.key);
        const color = SERIES_COLORS[i % SERIES_COLORS.length];
        return (
          <button
            key={s.key}
            type="button"
            className={`a-legenditem${off ? ' is-off' : ''}`}
            aria-pressed={!off}
            onClick={() => onToggle(s.key)}
            style={{ '--c': color } as React.CSSProperties}
          >
            <span className={`a-legenditem__box${off ? '' : ' a-legenditem__box--on'}`}>
              {!off && (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3.5 8.5l3 3 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

export interface LineChartProps<T extends Record<string, unknown>> {
  data: T[];
  series: Series[];
  /** Field holding the category (week, day) shown on the X axis. */
  xKey: string;
  height?: number;
  /** Range selector under the plot. */
  brush?: boolean;
  legend?: boolean;
  /** Controlled hidden-series list; omit to let the chart own it. */
  hidden?: string[];
  onHiddenChange?: (keys: string[]) => void;
  toolbar?: ReactNode;
  /** Filters are server round trips; dim the plot instead of blanking it. */
  loading?: boolean;
}

export function LineChart<T extends Record<string, unknown>>({
  data, series, xKey, height = 320, brush = true, legend = true,
  hidden: hiddenProp, onHiddenChange, toolbar, loading,
}: LineChartProps<T>) {
  const [hiddenOwn, setHiddenOwn] = useState<string[]>([]);
  const hidden = hiddenProp ?? hiddenOwn;
  const setHidden = onHiddenChange ?? setHiddenOwn;

  /* The brush under the plot is the ONE range control. There is no From/To
     pair above the chart duplicating it — two controls for one range meant an
     operator could set a window in one and read a different one in the other.
     What sits above is a readout of what is currently drawn, not a filter. */
  const [window, setWindow] = useState<{ startIndex?: number; endIndex?: number }>({});

  const toggle = (key: string) =>
    setHidden(hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key]);

  const visible = series.filter((s) => !hidden.includes(s.key));
  // Only render an axis that a visible series actually reads against.
  const axes = (['count', 'rate', 'usd'] as AxisId[]).filter((a) =>
    visible.some((s) => (s.axis ?? 'count') === a));

  const from = data[window.startIndex ?? 0]?.[xKey];
  const to = data[window.endIndex ?? data.length - 1]?.[xKey];

  return (
    <div>
      {/* Each end is emphasised separately rather than joined into one string:
          a cycle label is itself a span ("Jul 27–Aug 2"), so a plain dash
          between the two ends read as part of the label. */}
      <div className="a-chart__range">
        Displayed range:{' '}
        {data.length ? (
          from === to ? <b>{String(from)}</b> : <><b>{String(from)}</b> to <b>{String(to)}</b></>
        ) : <b>—</b>}
      </div>
      {(legend || toolbar) && (
        <div className="a-row" style={{ alignItems: 'flex-start' }}>
          {legend && <ChartLegend series={series} hidden={hidden} onToggle={toggle} />}
          {toolbar && <div className="a-row a-spacer">{toolbar}</div>}
        </div>
      )}
      <div className="a-chart__axes">
        <span>{axes[0] ? AXIS_LABEL[axes[0]] : ''}</span>
        <span>{axes.slice(1).map((a) => AXIS_LABEL[a]).join('  ·  ')}</span>
      </div>
      <div className={`a-chart__plot${loading ? ' is-loading' : ''}`}>
      <ResponsiveContainer width="100%" height={height}>
        <RLineChart data={data} margin={{ top: 8, right: 8, bottom: brush ? 0 : 8, left: 0 }}>
          <CartesianGrid stroke="#eef0f3" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={{ stroke: '#e4e4e4' }}
            tick={{ fontSize: 12, fill: '#7c7c7c' }}
          />
          {axes.map((a, i) => (
            <YAxis
              key={a}
              yAxisId={a}
              orientation={i === 0 ? 'left' : 'right'}
              tickLine={false}
              axisLine={false}
              width={64}
              tick={{ fontSize: 12, fill: '#7c7c7c' }}
              tickFormatter={tick(a)}
            />
          ))}
          <Tooltip content={<ChartTooltip series={series} />} cursor={{ stroke: '#c4c4c4', strokeDasharray: '4 4' }} />
          {series.map((s, i) => (
            hidden.includes(s.key) ? null : (
              <Line
                key={s.key}
                yAxisId={s.axis ?? 'count'}
                dataKey={s.key}
                name={s.label}
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeWidth={2}
                strokeDasharray={DASH[s.style ?? 'solid']}
                dot={{ r: 3, strokeWidth: 0, fill: SERIES_COLORS[i % SERIES_COLORS.length] }}
                activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            )
          ))}
          {brush && data.length > 4 && visible[0] && (
            <Brush
              dataKey={xKey}
              height={44}
              travellerWidth={12}
              stroke="var(--primary-colors-200)"
              fill="var(--plate-sunk)"
              tickFormatter={() => ''}
              onChange={(next) => setWindow(next as { startIndex?: number; endIndex?: number })}
            >
              {/* Preview strip. One series is enough to show the shape of the
                  range being dragged; drawing all eight is unreadable at 44px. */}
              <RLineChart>
                <Line
                  dataKey={visible[0].key}
                  stroke={SERIES_COLORS[series.findIndex((s) => s.key === visible[0].key) % SERIES_COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </RLineChart>
            </Brush>
          )}
        </RLineChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Single-series area strip — the signal-performance card.
 *
 * `tooltip` receives the whole datum, not just the plotted number, so a caller
 * can read out the same rows the Mini App shows its users. Without it the strip
 * falls back to naming the one value it drew.
 */
export function Sparkline<T extends Record<string, unknown>>({
  data, xKey, yKey, height = 120, color = SERIES_COLORS[0], tooltip,
}: {
  data: T[]; xKey: string; yKey: string; height?: number; color?: string;
  tooltip?: (row: T) => ReactNode;
}) {
  /* Pad the scale by a share of the data's own SPREAD, not of its values.
     A run of rates in the high seventies spans three points; padding by a
     share of 79 would swamp that spread and draw a flat line. The floor
     keeps an all-equal series off the centre line rather than at the edge. */
  const ys = data.map((d) => Number(d[yKey])).filter(Number.isFinite);
  const lo = ys.length ? Math.min(...ys) : 0;
  const hi = ys.length ? Math.max(...ys) : 1;
  const pad = Math.max((hi - lo) * 0.18, 0.5);

  return (
    <ResponsiveContainer width="100%" height={height}>
      {/* Margins clear the dot radius, so the first and last points are drawn
          whole instead of sliced by the container edge. */}
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey={xKey} hide />
        <YAxis hide domain={[lo - pad, hi + pad]} />
        <Tooltip
          cursor={{ stroke: color, strokeDasharray: '4 4', strokeWidth: 1 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as T;
            return (
              <div className="a-tooltip" style={{ minWidth: 0 }}>
                <div className="a-tooltip__title">{String(label)}</div>
                {tooltip ? tooltip(row) : (
                  <div className="a-tooltip__row">
                    <span className="a-tooltip__dot" style={{ background: color }} />
                    <b>{fmtNum(Number(payload[0].value))}</b>
                  </div>
                )}
              </div>
            );
          }}
        />
        {/* Dots, like the Mini App's: the strip shows where its data actually
            is, so nobody reads a smooth curve as more samples than there are. */}
        <Area
          type="monotone"
          dataKey={yKey}
          stroke={color}
          strokeWidth={2}
          fill="url(#spark)"
          dot={{ r: 3, strokeWidth: 0, fill: color }}
          activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: color }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
