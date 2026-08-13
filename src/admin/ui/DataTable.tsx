/**
 * The one table. Every list in the frames — users, brokers, cycles, campaigns,
 * signals, referrals — is this component with a different column config.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export interface Column<T> {
  id: string;
  header: ReactNode;
  render: (row: T, index: number) => ReactNode;
  /** Providing this makes the header clickable. */
  sort?: (row: T) => number | string;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  /** Let this cell wrap. Every other cell is single-line — see admin.css. */
  wrap?: boolean;
  /** Groups adjacent columns under a shared spanning header row. */
  group?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Renders a leading "#" column numbered from 1 in the *displayed* order. */
  showIndex?: boolean;
  /** Use a value from the row instead of the display position (referral ids). */
  indexOf?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  selectedKey?: string;
  /** Height the body scrolls within. Defaults so every table shows its whole
   *  list on one page — no pager, no page size, header stays put. */
  maxHeight?: number;
  empty?: ReactNode;
  /** True until the rows have arrived. Without it the empty state claims
   *  "nothing here" before anything has been fetched. */
  loading?: boolean;
}

/* Every row on one page, reached by scrolling the table body rather than by
   paging. Tall enough to show a long list, short enough that the surrounding
   page furniture stays in view. */
const DEFAULT_MAX_HEIGHT = 620;

export function DataTable<T>({
  columns, rows, rowKey, showIndex, indexOf, onRowClick, selectedKey,
  maxHeight = DEFAULT_MAX_HEIGHT, empty, loading,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ id: string; dir: 1 | -1 } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.id === sort.id);
    if (!col?.sort) return rows;
    const key = col.sort;
    // Copy first: sorting `rows` in place would mutate the caller's array.
    return [...rows].sort((a, b) => {
      const x = key(a);
      const y = key(b);
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * sort.dir;
      return String(x).localeCompare(String(y)) * sort.dir;
    });
  }, [rows, columns, sort]);

  const toggle = (id: string) =>
    setSort((s) => (s?.id === id ? (s.dir === 1 ? { id, dir: -1 } : null) : { id, dir: 1 }));

  const groups = columns.some((c) => c.group);

  /* Which columns sit at the edge of a labelled group. The divider between
     groups is drawn on these, so each group reads as its own column block
     rather than as a run of cells under one continuous rule. */
  const edges = useMemo(() => {
    const map = new Map<string, string>();
    if (!groups) return map;
    columns.forEach((c, i) => {
      if (!c.group) return;
      const cls = [
        columns[i - 1]?.group === c.group ? '' : 'is-groupstart',
        columns[i + 1]?.group === c.group ? '' : 'is-groupend',
      ].filter(Boolean).join(' ');
      if (cls) map.set(c.id, cls);
    });
    return map;
  }, [columns, groups]);

  return (
    <div className="a-tablewrap" style={{ maxHeight }}>
      <table className="a-table">
        <thead>
          {groups && (
            <tr>
              {showIndex && <th rowSpan={2} className="a-table__num" />}
              {groupSpans(columns).map((g, i) =>
                g.label ? (
                  <th key={`${g.label}${i}`} colSpan={g.span} className="at-center" style={{ textAlign: 'center' }}>
                    {g.label}
                  </th>
                ) : (
                  <th key={`blank${i}`} rowSpan={2} colSpan={g.span} />
                ),
              )}
            </tr>
          )}
          <tr>
            {showIndex && !groups && <th className="a-table__num">#</th>}
            {columns.map((c) =>
              groups && !c.group ? null : (
                <th
                  key={c.id}
                  className={[c.sort ? 'is-sortable' : '', edges.get(c.id) ?? ''].filter(Boolean).join(' ') || undefined}
                  style={{ width: c.width, textAlign: c.align }}
                  onClick={c.sort ? () => toggle(c.id) : undefined}
                  aria-sort={sort?.id === c.id ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}
                >
                  <span>
                    {c.header}
                    {c.sort && (
                      <Icon
                        name={sort?.id === c.id ? (sort.dir === 1 ? 'chevron-up' : 'chevron-down') : 'sort'}
                        size={14}
                      />
                    )}
                  </span>
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {loading && Array.from({ length: 5 }, (_, r) => (
            <tr key={`skeleton-${r}`}>
              {showIndex && <td className="a-table__num"><span className="a-skel" style={{ width: 16 }} /></td>}
              {columns.map((c, i) => (
                <td key={c.id}>
                  {/* Widths vary so the placeholder reads as a table of
                      different values, not as a loading bar. */}
                  <span className="a-skel" style={{ width: `${[70, 45, 60, 35, 50][(i + r) % 5]}%` }} />
                </td>
              ))}
            </tr>
          ))}
          {!loading && sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length + (showIndex ? 1 : 0)}>
                {empty ?? <div className="a-empty">Nothing to show yet.</div>}
              </td>
            </tr>
          )}
          {!loading && sorted.map((row, i) => {
            const key = rowKey(row);
            return (
              <tr
                key={key}
                className={selectedKey === key ? 'is-selected' : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {showIndex && <td className="a-table__num">{indexOf ? indexOf(row) : i + 1}</td>}
                {columns.map((c) => (
                  <td
                    key={c.id}
                    className={[c.wrap ? 'is-wrap' : '', edges.get(c.id) ?? ''].filter(Boolean).join(' ') || undefined}
                    style={{ textAlign: c.align }}
                  >
                    {c.render(row, i)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Collapse the column list into spanning header cells for the group row. */
function groupSpans<T>(columns: Column<T>[]) {
  const out: { label?: string; span: number }[] = [];
  for (const c of columns) {
    const last = out[out.length - 1];
    if (last && last.label === c.group) last.span += 1;
    else out.push({ label: c.group, span: 1 });
  }
  return out;
}
