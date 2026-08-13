// TON adapter (native TON + jettons e.g. USDT-TON) — TonCenter v3 public
// indexer API, keyless (rate-limited without an API key, fine at one call
// per group per tick). TonCenter only returns transactions once they're
// included in a masterchain block, so any hit here is already final — same
// FINAL-sentinel convention as tron.mjs/sol.mjs.
import { fetchJson } from './http.mjs';

const FINAL = 1e9;
const BASE = 'https://toncenter.com/api/v3';

/** User-friendly TON address (UQ.../EQ...) -> `${workchain}:${hex hash}`, the
 *  form TonCenter echoes back in in_msg/transfer fields — decoded by hand
 *  (base64url, 36 bytes: 1 flag byte, signed workchain byte, 32-byte hash,
 *  2-byte crc16) rather than pulling in a ton library for one comparison. */
export function toRaw(address) {
  if (address.includes(':')) return address.toLowerCase();
  const buf = Buffer.from(address.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  return `${buf.readInt8(1)}:${buf.subarray(2, 34).toString('hex')}`.toLowerCase();
}

export async function listIncoming({ address, tokenContract, sinceTs, rpc }) {
  const base = rpc || BASE;
  const raw = toRaw(address);
  return tokenContract
    ? listJetton({ base, address, raw, tokenContract, sinceTs })
    : listNative({ base, address, raw, sinceTs });
}

async function listNative({ base, address, raw, sinceTs }) {
  const json = await fetchJson(`${base}/transactions?account=${address}&limit=50&sort=desc`);
  const out = [];
  for (const tx of json.transactions ?? []) {
    const inMsg = tx.in_msg;
    // No source = an external message the account itself sent (outgoing), not a deposit.
    if (!inMsg?.source || toRaw(inMsg.destination) !== raw) continue;
    const value = BigInt(inMsg.value ?? 0);
    if (value <= 0n) continue;
    const timestamp = Number(tx.now ?? 0);
    if (timestamp < sinceTs) continue;
    out.push({ txid: tx.hash, amountRaw: value.toString(), confirmations: FINAL, from: inMsg.source, timestamp });
  }
  return out;
}

async function listJetton({ base, address, raw, tokenContract, sinceTs }) {
  const json = await fetchJson(
    `${base}/jetton/transfers?owner_address=${address}&jetton_master=${tokenContract}&limit=50&sort=desc`,
  );
  const out = [];
  for (const t of json.jetton_transfers ?? []) {
    // owner_address matches transfers on either side of the owner; keep credits only.
    if (toRaw(t.destination) !== raw) continue;
    const amount = BigInt(t.amount ?? 0);
    if (amount <= 0n) continue;
    const timestamp = Number(t.transaction_now ?? 0);
    if (timestamp < sinceTs) continue;
    out.push({ txid: t.transaction_hash, amountRaw: amount.toString(), confirmations: FINAL, from: t.source ?? '', timestamp });
  }
  return out;
}

// Self-check for the one non-trivial bit here (the hand-rolled address decode) —
// verified live against TonCenter's own address_book echo for these two accounts.
// `node server/chains/ton.mjs`
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const assert = await import('node:assert/strict').then((m) => m.default);
  assert.equal(
    toRaw('EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'),
    '0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe',
    'USDT-TON jetton master decodes to the raw form TonCenter reports for it',
  );
  assert.equal(toRaw('0:B113A994B5024A16719F69139328EB759596C38A25F59028B146FECDC3621DFE'), toRaw('EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'));
  console.log('ton: all checks passed');
}
