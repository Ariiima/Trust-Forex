/**
 * One clock for the whole system.
 *
 * Timestamps are stored as epoch ms, but almost everything an operator reads is
 * a *string* — `requested_at`, `purchased_at`, the day keys the charts bucket
 * on. Those used to be cut from `toISOString()` (UTC) in some places and from
 * `Asia/Tehran` in others, while the dashboard re-formatted a few more in the
 * browser's own zone. Three clocks, three answers for the same instant.
 *
 * Now there is one, stored in `app_settings.tz` and editable from the Wallets
 * page. Every date/time the server writes or renders goes through here.
 */
import { connect } from './sqlite.mjs';

const db = connect();
db.exec('CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');

const DEFAULT_TZ = 'Asia/Tehran';

/** Throws on a zone Intl does not know, so a bad PUT can never poison the clock. */
export const validTz = (z) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: z });
    return true;
  } catch {
    return false;
  }
};

let tz = (() => {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'tz'").get();
  return row && validTz(row.value) ? row.value : DEFAULT_TZ;
})();

export const getTz = () => tz;

export function setTz(z) {
  if (!validTz(z)) throw new Error('bad_timezone');
  db.prepare("INSERT INTO app_settings (key, value) VALUES ('tz', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(z);
  tz = z;
  return tz;
}

// en-CA yields YYYY-MM-DD, en-GB + h23 yields HH:mm — no manual part assembly.
const dayFmt = new Map();
const timeFmt = new Map();
const fmt = (cache, locale, opts) => {
  let f = cache.get(tz);
  if (!f) cache.set(tz, f = new Intl.DateTimeFormat(locale, { ...opts, timeZone: tz }));
  return f;
};

/** `YYYY-MM-DD` in the configured zone. The day key charts and `purchased_at` use. */
export const fmtDay = (ms = Date.now()) =>
  fmt(dayFmt, 'en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);

/** `HH:mm`, 24h. */
export const fmtTime = (ms = Date.now()) =>
  fmt(timeFmt, 'en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms);

/** `YYYY-MM-DD · HH:mm` — the stamp every admin table renders. */
export const fmtStamp = (ms = Date.now()) => `${fmtDay(ms)} · ${fmtTime(ms)}`;

/** The zone's UTC offset at that instant, as `+03:30`. */
export function offsetAt(ms) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
    .formatToParts(ms).find((p) => p.type === 'timeZoneName').value;
  return name === 'GMT' ? '+00:00' : name.slice(3);
}

/**
 * Wall clock in the configured zone (`YYYY-MM-DDTHH:mm`, what a datetime-local
 * field yields) → epoch ms, or null.
 *
 * ponytail: the offset is looked up once, from the UTC reading of that wall
 * time. Within an hour of a DST jump that can land an hour off; add a second
 * pass (re-read the offset at the first answer) if a DST zone ever matters.
 */
export function wallMs(wall) {
  if (typeof wall !== 'string' || !wall) return null;
  const guess = Date.parse(`${wall}Z`);
  if (!Number.isFinite(guess)) return null;
  const ms = Date.parse(`${wall}${offsetAt(guess)}`);
  return Number.isFinite(ms) ? ms : null;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const assert = await import('node:assert/strict');
  const was = getTz();
  setTz('Asia/Tehran');
  // 2026-08-18T05:16Z is 08:46 in Tehran (+03:30) — the stamp in the screenshot.
  assert.default.equal(fmtStamp(Date.parse('2026-08-18T05:16:00Z')), '2026-08-18 · 08:46');
  assert.default.equal(fmtDay(Date.parse('2026-08-17T21:00:00Z')), '2026-08-18', 'late UTC evening is already tomorrow in Tehran');
  assert.default.equal(wallMs('2026-08-18T08:46'), Date.parse('2026-08-18T05:16:00Z'));
  setTz('UTC');
  assert.default.equal(fmtStamp(Date.parse('2026-08-18T05:16:00Z')), '2026-08-18 · 05:16');
  assert.default.equal(wallMs('2026-08-18T05:16'), Date.parse('2026-08-18T05:16:00Z'));
  assert.default.throws(() => setTz('Mars/Olympus'), /bad_timezone/);
  setTz(was);
  console.log('tz ok');
}
