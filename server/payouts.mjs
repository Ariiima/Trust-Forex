/**
 * Automated withdrawals — the money that LEAVES.
 *
 * A withdrawal debits the ledger the moment it is accepted (the reserve), then
 * a worker pays it out on-chain from a hot wallet. The state machine is
 * deliberately conservative:
 *
 *   queued ──► sending ──► sent (txid recorded, user + admin notified)
 *      │           │
 *      └───────────┴─────► manual (admin pings; NOTHING is ever auto-retried)
 *
 * Any anomaly mid-send — RPC error, timeout, weird response — parks the row as
 * `manual` instead of retrying, because after an ambiguous broadcast the only
 * safe assumption is "the money may already be gone". Rows found in `sending`
 * at boot (crash mid-send) are swept to `manual` for the same reason. A human
 * resolves `manual` rows: send by hand / verify on-chain, then set the status
 * in the DB. Double-send risk is what this design spends its complexity on.
 *
 * Hot wallets (env, never logged): TF_TRON_HOT_KEY (TRC-20), TF_EVM_HOT_KEY
 * (BEP-20 + ERC-20, one key for both). A chain with no key parks as manual.
 * Caps: TF_PAYOUT_MAX_TX (USD per withdrawal, default 500) — larger goes to
 * manual; TF_PAYOUT_MAX_DAY (USD per UTC day, default 2000) — beyond it rows
 * WAIT in queue until the day rolls over. Caps bound what a compromised box
 * can drain before someone notices.
 */
import { randomInt } from 'node:crypto';
import { sendMessage, appButton } from './telegram.mjs';
// Pure data + a pure function only, like jobs.mjs's import of the same two —
// payouts.test.mjs constructs its own in-memory db and must never have this
// module reach for the real one as a side effect of import.
import { MESSAGE_TEMPLATES, renderTemplate } from './admin.mjs';

const DEFAULT_TPL = Object.fromEntries(MESSAGE_TEMPLATES.map((t) => [t.key, t.body]));

export const PAYOUT_SCHEMA = `
CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, tg_user_id INTEGER,
  amount_usd REAL NOT NULL, fee_usd REAL NOT NULL,
  currency TEXT NOT NULL, network TEXT NOT NULL, address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', txid TEXT, error TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
`;

/** Server-side mirror of src/screens/earning/withdraw-data.ts — fees and
 *  minimums must be enforced here, or the client could skip them. Stablecoins
 *  only, so USD converts 1:1 to token units. */
export const WITHDRAW_RULES = {
  'USDT|TRC20': { fee: 1, min: 10, chain: 'tron', contract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', decimals: 6 },
  'USDT|BEP20': { fee: 1, min: 10, chain: 'evm', rpc: 'https://bsc-rpc.publicnode.com', contract: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
  'USDT|ERC20': { fee: 1, min: 10, chain: 'evm', rpc: 'https://cloudflare-eth.com', contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  'USDC|TRC20': { fee: 1, min: 10, chain: 'tron', contract: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8', decimals: 6 },
  'USDC|BEP20': { fee: 1, min: 10, chain: 'evm', rpc: 'https://bsc-rpc.publicnode.com', contract: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
  'USDC|ERC20': { fee: 1, min: 10, chain: 'evm', rpc: 'https://cloudflare-eth.com', contract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
};

const ADDR_RE = {
  tron: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  evm: /^0x[0-9a-fA-F]{40}$/,
};

const MAX_TX = () => Number(process.env.TF_PAYOUT_MAX_TX ?? 500);
const MAX_DAY = () => Number(process.env.TF_PAYOUT_MAX_DAY ?? 2000);

const round2 = (n) => Math.round(n * 100) / 100;

/** USD → token base units, via integer cents — no float exponents. */
export function usdToUnits(usd, decimals) {
  return (BigInt(Math.round(usd * 100)) * 10n ** BigInt(decimals - 2)).toString();
}

/** queued/sending/manual are one thing to the user: it's being processed. */
const UI_STATUS = { sent: 'completed', refunded: 'rejected' };

export function rowToWithdrawal(row) {
  return {
    id: row.id,
    currency: row.currency,
    network: row.network,
    amount: row.amount_usd,
    fee: row.fee_usd,
    address: row.address,
    status: UI_STATUS[row.status] ?? 'pending',
    txid: row.txid ?? undefined,
    createdAt: row.created_at,
  };
}

/**
 * Validate + reserve + queue. `ledger.withdraw` is the existing overdraw-safe
 * debit; the row is inserted in the same synchronous run, so there is no
 * window where money is reserved with nothing to show for it.
 */
export function enqueueWithdrawal({ db, ledger, userId, tgUserId, amount, currency, network, address }) {
  const rule = WITHDRAW_RULES[`${currency}|${network}`];
  if (!rule) return { error: 'unknown_option' };
  const value = round2(Number(amount));
  if (!Number.isFinite(value) || value <= 0) return { error: 'invalid_amount' };
  if (value < rule.min) return { error: 'below_minimum', minimum: rule.min };
  if (typeof address !== 'string' || !ADDR_RE[rule.chain].test(address.trim())) {
    return { error: 'invalid_address' };
  }

  const reserved = ledger.withdraw(userId, value, `${currency} ${network} ${address.trim()}`);
  if (reserved.error) return reserved;

  const now = Date.now();
  const id = `w${now.toString(36)}${randomInt(1e6).toString(36)}`;
  db.prepare(
    `INSERT INTO withdrawals (id, user_id, tg_user_id, amount_usd, fee_usd, currency, network, address, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, userId, tgUserId ?? null, value, rule.fee, currency, network, address.trim(), now, now);

  return { ok: true, balance: reserved.balance, withdrawal: rowToWithdrawal(db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(id)) };
}

export function listWithdrawals(db, userId) {
  return db
    .prepare('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 100')
    .all(userId)
    .map(rowToWithdrawal);
}

/* ---- senders ------------------------------------------------------------ */

/** Real on-chain senders, built lazily so tests inject fakes and boot never
 *  loads a signing lib a missing env key makes unusable. Each returns a txid
 *  or throws — the worker treats every throw as "state unknown". */
function buildSenders() {
  const senders = {};
  if (process.env.TF_TRON_HOT_KEY) {
    senders.tron = async ({ rule, address, units }) => {
      const { TronWeb } = await import('tronweb');
      const tw = new TronWeb({ fullHost: 'https://api.trongrid.io', privateKey: process.env.TF_TRON_HOT_KEY });
      const contract = await tw.contract().at(rule.contract);
      return await contract.transfer(address, units).send();
    };
  }
  if (process.env.TF_EVM_HOT_KEY) {
    senders.evm = async ({ rule, address, units }) => {
      const { JsonRpcProvider, Wallet, Contract } = await import('ethers');
      const wallet = new Wallet(process.env.TF_EVM_HOT_KEY, new JsonRpcProvider(rule.rpc));
      const erc20 = new Contract(rule.contract, ['function transfer(address to, uint256 value) returns (bool)'], wallet);
      const tx = await erc20.transfer(address, units);
      return tx.hash;
    };
  }
  return senders;
}

const notifyAdmin = (text) => {
  const chat = process.env.TF_ADMIN_CHAT_ID;
  if (chat) sendMessage(chat, text).catch(() => undefined);
};
const notifyUser = (tgId, text) => {
  if (tgId) sendMessage(tgId, text, appButton()).catch(() => undefined);
};

/** The admin's edited copy for `key`, or the shipped default when `templates`
 *  (admin.messageTemplate) wasn't supplied — the tests' path. */
const tpl = (templates, key) => templates?.(key) ?? DEFAULT_TPL[key];

const describe = (row) =>
  `$${row.amount_usd.toFixed(2)} ${row.currency} ${row.network} → ${row.address}\nWithdrawal ${row.id}`;

/** Move a row to manual + tell both sides. The admin resolves it by hand. */
function park(db, row, reason, now, templates) {
  db.prepare(`UPDATE withdrawals SET status='manual', error=?, updated_at=? WHERE id=? AND status IN ('queued','sending')`)
    .run(reason, now, row.id);
  console.warn(`[payouts] ${row.id} -> manual: ${reason}`);
  notifyAdmin(`⚠️ Withdrawal needs manual handling (${reason})\n${describe(row)}`);
  notifyUser(row.tg_user_id, tpl(templates, 'withdrawal_manual'));
}

/** USD already paid or in flight this UTC day — the day-cap accumulator. */
function sentToday(db, now) {
  const dayStart = new Date(now).setUTCHours(0, 0, 0, 0);
  const r = db.prepare(
    `SELECT COALESCE(SUM(amount_usd), 0) AS total FROM withdrawals
     WHERE status IN ('sending', 'sent') AND updated_at >= ?`,
  ).get(dayStart);
  return r.total;
}

/** One pass over the queue. Sequential on purpose: EVM nonces and the day cap
 *  both assume one send at a time. Exported for tests. */
export async function processQueue({ db, senders, now = Date.now(), templates }) {
  const rows = db.prepare(`SELECT * FROM withdrawals WHERE status='queued' ORDER BY created_at`).all();
  for (const row of rows) {
    const rule = WITHDRAW_RULES[`${row.currency}|${row.network}`];
    if (!rule) { park(db, row, 'unknown_option', now, templates); continue; }
    if (row.amount_usd > MAX_TX()) { park(db, row, `over_tx_cap_${MAX_TX()}`, now, templates); continue; }
    const sender = senders[rule.chain];
    if (!sender) { park(db, row, `no_hot_wallet_${rule.chain}`, now, templates); continue; }
    if (sentToday(db, now) + row.amount_usd > MAX_DAY()) {
      // Not an anomaly — the queue simply waits for the next UTC day.
      if (row.error !== 'day_cap') {
        db.prepare(`UPDATE withdrawals SET error='day_cap' WHERE id=?`).run(row.id);
        notifyAdmin(`⏳ Daily payout cap ($${MAX_DAY()}) reached — withdrawal waits until tomorrow\n${describe(row)}`);
      }
      continue;
    }

    const payout = round2(row.amount_usd - row.fee_usd);
    if (payout <= 0) { park(db, row, 'fee_exceeds_amount', now, templates); continue; }

    // Mark BEFORE broadcasting: a crash after this line must read as
    // "maybe sent", never as "safe to retry".
    db.prepare(`UPDATE withdrawals SET status='sending', updated_at=? WHERE id=? AND status='queued'`).run(now, row.id);
    try {
      const txid = await sender({ rule, address: row.address, units: usdToUnits(payout, rule.decimals) });
      db.prepare(`UPDATE withdrawals SET status='sent', txid=?, error=NULL, updated_at=? WHERE id=?`)
        .run(String(txid), now, row.id);
      console.log(`[payouts] sent ${row.id}: ${payout} ${row.currency} ${row.network} tx ${txid}`);
      notifyUser(row.tg_user_id, renderTemplate(tpl(templates, 'withdrawal_sent'), {
        amount: `$${payout.toFixed(2)}`, currency: row.currency, network: row.network, txid,
      }));
      notifyAdmin(`💸 Withdrawal paid\n${describe(row)}\ntx ${txid}`);
    } catch (e) {
      // Ambiguous by definition — the broadcast may or may not have happened.
      db.prepare(`UPDATE withdrawals SET status='manual', error=?, updated_at=? WHERE id=?`)
        .run(`send_failed: ${e.message}`.slice(0, 300), now, row.id);
      console.error(`[payouts] ${row.id} send failed:`, e.message);
      notifyAdmin(`🚨 Withdrawal send FAILED mid-flight — verify on-chain before resending!\n${describe(row)}\n${e.message}`);
      notifyUser(row.tg_user_id, tpl(templates, 'withdrawal_manual'));
    }
  }
}

export function startPayouts({ db, senders = buildSenders(), intervalMs = 30_000, templates } = {}) {
  db.exec(PAYOUT_SCHEMA);

  // Crash sweep: `sending` rows mean a broadcast was in flight when we died.
  const stuck = db.prepare(`SELECT * FROM withdrawals WHERE status='sending'`).all();
  for (const row of stuck) park(db, row, 'crashed_mid_send_verify_on_chain', Date.now(), templates);

  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await processQueue({ db, senders, templates });
    } catch (e) {
      console.error('[payouts] pass failed:', e);
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  return { stop: () => clearInterval(timer) };
}
