// Broker partnership requests — the form at the foot of trustforex.net/v/landing/partnership/.
// POST /api/partnership (index.mjs) reads the body through parseRequest, books the row and tells the
// admins on Telegram. Cross-origin from the apex to app.trustforex.net: the page posts JSON as
// text/plain (a "simple" request, no preflight) and the route answers with allow-origin *. Nothing here
// is secret — a request is a sales lead, and the honeypot + field caps are the whole spam defence.
// ponytail: no admin page yet — the Telegram alert is the inbox; add a Money-style list if leads pile up.
import { sendMessage } from './telegram.mjs';

export const PARTNERSHIP_SCHEMA = `
CREATE TABLE IF NOT EXISTS partnership_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, role TEXT, broker TEXT NOT NULL,
  website TEXT NOT NULL, email TEXT NOT NULL, contact TEXT NOT NULL, contact_detail TEXT NOT NULL,
  goals TEXT NOT NULL, proposal TEXT, ip TEXT, created_at INTEGER NOT NULL);
`;

// the six checkboxes on the form, by value
export const GOALS = {
  reactivate: 'Reactivate inactive clients', funded: 'Encourage account funding',
  vip: 'Reward active or VIP clients', retention: 'Strengthen client retention',
  campaign: 'Promote a broker campaign', custom: 'Explore a custom partnership',
};
const REQUIRED = ['name', 'broker', 'website', 'email', 'contact_detail'];
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Body → { row } or { error }. `company` is the honeypot: a bot that fills it is answered 200 and dropped. */
export function parseRequest(body = {}) {
  if (body.company) return { error: 'spam' };
  const row = {
    name: str(body.name, 120), role: str(body.role, 120), broker: str(body.broker, 120),
    website: str(body.website, 300), email: str(body.email, 200),
    contact: body.contact === 'whatsapp' ? 'whatsapp' : 'telegram',
    contact_detail: str(body.contact_detail, 120),
    goals: (Array.isArray(body.goals) ? body.goals : []).filter((g) => g in GOALS),
    proposal: str(body.proposal, 2000),
  };
  for (const k of REQUIRED) if (!row[k]) return { error: `${k}_required` };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return { error: 'email_invalid' };
  if (!/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(row.website)) return { error: 'website_invalid' };
  return { row };
}

export function saveRequest(db, row, ip = '') {
  db.exec(PARTNERSHIP_SCHEMA);
  const r = db.prepare(`INSERT INTO partnership_requests
    (name, role, broker, website, email, contact, contact_detail, goals, proposal, ip, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    row.name, row.role, row.broker, row.website, row.email, row.contact, row.contact_detail,
    row.goals.join(','), row.proposal, ip, Date.now());
  return Number(r.lastInsertRowid);
}

/** The Telegram text — sendMessage runs it through clean(), so HTML in a field is only ever text. */
export const describe = (row, id) => [
  `🤝 Partnership request #${id} — ${row.broker}`,
  `${row.name}${row.role ? `, ${row.role}` : ''} · ${row.email}`,
  row.website,
  `${row.contact === 'whatsapp' ? 'WhatsApp' : 'Telegram'}: ${row.contact_detail}`,
  row.goals.length ? `Goals: ${row.goals.map((g) => GOALS[g]).join(', ')}` : '',
  row.proposal ? `\n${row.proposal}` : '',
].filter(Boolean).join('\n');

/** TF_ADMIN_CHAT_ID when set; otherwise every id in TF_ADMIN_IDS (prod has the ids, not the chat). */
export const adminChats = (env = process.env) => (env.TF_ADMIN_CHAT_ID
  ? [env.TF_ADMIN_CHAT_ID]
  : (env.TF_ADMIN_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean));

export const notifyAdmins = (text, env = process.env) =>
  Promise.allSettled(adminChats(env).map((chat) => sendMessage(chat, text)));

/* self-check: node server/partnership.mjs */
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const { strict: assert } = await import('node:assert');
  const ok = {
    name: ' Dana ', broker: 'GTCFX', website: 'https://gtcfx.com', email: 'dana@gtcfx.com',
    contact: 'whatsapp', contact_detail: '+1 555', goals: ['funded', 'bogus', 'vip'], proposal: 'x'.repeat(3000),
  };
  const { row } = parseRequest(ok);
  assert.equal(row.name, 'Dana');
  assert.deepEqual(row.goals, ['funded', 'vip']);
  assert.equal(row.proposal.length, 2000);
  assert.equal(parseRequest({ ...ok, contact: 'signal' }).row.contact, 'telegram');
  assert.equal(parseRequest({ ...ok, email: 'nope' }).error, 'email_invalid');
  assert.equal(parseRequest({ ...ok, website: 'gtcfx.com' }).error, 'website_invalid');
  assert.equal(parseRequest({ ...ok, broker: '' }).error, 'broker_required');
  assert.equal(parseRequest({ ...ok, company: 'Acme' }).error, 'spam');
  assert.equal(parseRequest().error, 'name_required');
  assert.match(describe(row, 7), /#7 — GTCFX[\s\S]*WhatsApp: \+1 555[\s\S]*Goals: Encourage account funding, Reward/);
  assert.deepEqual(adminChats({ TF_ADMIN_CHAT_ID: '-100' , TF_ADMIN_IDS: '1,2' }), ['-100']);
  assert.deepEqual(adminChats({ TF_ADMIN_IDS: ' 1, 2 ,' }), ['1', '2']);
  const { connect } = await import('./sqlite.mjs');
  const db = connect(':memory:');
  const id = saveRequest(db, row, '10.0.0.1');
  assert.equal(id, 1);
  assert.equal(db.prepare('SELECT goals, ip FROM partnership_requests WHERE id = ?').get(id).goals, 'funded,vip');
  console.log('partnership: ok');
}
