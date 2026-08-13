// EVM adapter (Ethereum/BSC/Polygon/Avalanche) — keyless public JSON-RPC.
// Tokens via eth_getLogs Transfer topics; native coin via recent-block scan.
import { rpc } from './http.mjs';

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'; // keccak Transfer(address,address,uint256)
const LOG_CHUNK = 1000; // per eth_getLogs call — public RPCs cap ranges around here
const MAX_LOOKBACK_S = 2 * 60 * 60; // logs older than this are archive territory on public RPCs
const NATIVE_WINDOW = 40; // max blocks back-scanned for native transfers
const CACHE_TTL_S = 2 * 60 * 60;

const blockTsCache = new Map(); // `${rpc}|${blockNum}` -> unix seconds
const nativeCache = new Map(); // `${rpc}|${addrLower}` -> { lastScanned, txs: Map<txid, {...}> }
const tokenCache = new Map(); // `${rpc}|${addrLower}|${token}` -> { lastScanned, txs: Map<txid, {...}> }
const fromBlockCache = new Map(); // `${rpc}|${targetTs}` -> block number

const hex = (n) => '0x' + n.toString(16);

/** Public RPCs 403 on bursts (publicnode cools off for a spell after one).
 *  A breath between calls keeps a tick under every limiter we've met. */
const pace = () => new Promise((resolve) => setTimeout(resolve, 250));

export async function listIncoming({ address, tokenContract, decimals, sinceTs, rpc: url }) {
  if (!url) throw new Error('evm adapter requires an rpc url (set per network in gateways.json)');
  const tip = Number(await rpc(url, 'eth_blockNumber', []));
  return tokenContract
    ? listToken({ url, address, tokenContract, sinceTs, tip })
    : listNative({ url, address, sinceTs, tip });
}

/**
 * First block at-or-after `targetTs`, by timestamp bisection. A fixed block
 * window broke the day BSC moved to sub-second blocks — 2500 blocks stopped
 * covering the 40-minute order window and payments scrolled past unseen. Time
 * is the contract here, so time is what we search on. Cached per (rpc, ts):
 * sinceTs is an order's created_at, constant across ticks.
 */
async function blockAt(url, targetTs, tip) {
  const key = `${url}|${targetTs}`;
  if (fromBlockCache.has(key)) return fromBlockCache.get(key);
  const tipTs = await blockTimestamp(url, tip);
  // Probe the recent block rate, then bracket the target generously.
  const probe = Math.max(0, tip - 10_000);
  const blockSec = Math.max((tipTs - (await blockTimestamp(url, probe))) / (tip - probe), 0.05);
  let lo = Math.max(0, tip - Math.ceil(((tipTs - targetTs) / blockSec) * 2) - 1000);
  let hi = tip;
  // Stop once the bracket is under ~2 min of blocks and take the early edge —
  // block-exact precision costs ~10 more RPC calls and buys nothing here.
  const closeEnough = Math.max(Math.ceil(120 / blockSec), 1);
  while (hi - lo > closeEnough) {
    const mid = Math.floor((lo + hi) / 2);
    await pace();
    if ((await blockTimestamp(url, mid)) < targetTs) lo = mid + 1;
    else hi = mid;
  }
  lo = Math.max(0, lo - closeEnough); // early edge: overscan beats a missed payment
  if (fromBlockCache.size > 500) fromBlockCache.clear();
  fromBlockCache.set(key, lo);
  return lo;
}

/** Reorg safety margin re-scanned every tick — cheap, it's one chunk. */
const OVERLAP = 200;

async function listToken({ url, address, tokenContract, sinceTs, tip }) {
  const paddedTo = '0x' + '0'.repeat(24) + address.toLowerCase().slice(2);
  const key = `${url}|${address.toLowerCase()}|${tokenContract.toLowerCase()}`;
  let cache = tokenCache.get(key);
  if (!cache) tokenCache.set(key, (cache = { lastScanned: -1, txs: new Map() }));

  /* First sight of this address: cover the full order window by time (clamped
     so a months-old latched order can't drag the scan into ranges public RPCs
     refuse as archive queries). Every tick after that scans only the blocks
     mined since — the watcher runs every few seconds, and re-reading an hour
     of history each tick is what got us rate-limited into a blackout. */
  let from;
  if (cache.lastScanned >= 0) {
    from = Math.max(0, Math.min(cache.lastScanned - OVERLAP + 1, tip));
  } else {
    const fromTs = Math.max(sinceTs, Math.floor(Date.now() / 1000) - MAX_LOOKBACK_S);
    from = await blockAt(url, fromTs, tip);
  }

  for (let a = from; a <= tip; a += LOG_CHUNK) {
    await pace();
    const chunk = await rpc(url, 'eth_getLogs', [{
      fromBlock: hex(a),
      toBlock: hex(Math.min(a + LOG_CHUNK - 1, tip)),
      address: tokenContract,
      topics: [TRANSFER_TOPIC, null, paddedTo],
    }]);
    for (const log of chunk) {
      const blockNum = Number(log.blockNumber);
      if (cache.txs.has(log.transactionHash)) continue;
      await pace();
      cache.txs.set(log.transactionHash, {
        amountRaw: BigInt(log.data).toString(),
        from: '0x' + log.topics[1].slice(26),
        timestamp: await blockTimestamp(url, blockNum),
        blockNumber: blockNum,
      });
    }
  }
  cache.lastScanned = tip;

  // Emit from the cache so an already-seen tx keeps reporting growing
  // confirmations — same contract as the native scan below.
  const cutoff = Math.floor(Date.now() / 1000) - CACHE_TTL_S;
  const out = [];
  for (const [txid, t] of cache.txs) {
    if (t.timestamp < cutoff) {
      cache.txs.delete(txid);
      continue;
    }
    if (t.timestamp < sinceTs) continue;
    out.push({
      txid,
      amountRaw: t.amountRaw,
      confirmations: tip - t.blockNumber + 1,
      from: t.from,
      timestamp: t.timestamp,
    });
  }
  return out;
}

async function blockTimestamp(url, blockNum) {
  const key = `${url}|${blockNum}`;
  if (blockTsCache.has(key)) return blockTsCache.get(key);
  const block = await rpc(url, 'eth_getBlockByNumber', [hex(blockNum), false]);
  const ts = Number(block.timestamp);
  if (blockTsCache.size > 2000) blockTsCache.clear();
  blockTsCache.set(key, ts);
  return ts;
}

async function listNative({ url, address, sinceTs, tip }) {
  // ponytail: native scan ceiling — we only ever look NATIVE_WINDOW (~40) blocks back (~8 min on ETH,
  // ~2 min on BSC/Polygon). A native deposit older than that at first sight (watcher down, RPC dead)
  // is missed by auto-watch; the Telegram admin Approve override covers it.
  const addrLower = address.toLowerCase();
  const key = `${url}|${addrLower}`;
  let cache = nativeCache.get(key);
  if (!cache) nativeCache.set(key, (cache = { lastScanned: -1, txs: new Map() }));
  let start = cache.lastScanned >= 0 ? cache.lastScanned + 1 : tip - NATIVE_WINDOW + 1;
  start = Math.max(start, tip - NATIVE_WINDOW + 1, 0);
  for (let n = start; n <= tip; n++) {
    // a failed block fetch throws here, before lastScanned advances — no gaps
    const block = await rpc(url, 'eth_getBlockByNumber', [hex(n), true]);
    const ts = Number(block.timestamp);
    for (const tx of block.transactions ?? []) {
      if (tx.to?.toLowerCase() === addrLower && BigInt(tx.value) > 0n) {
        cache.txs.set(tx.hash, {
          amountRaw: BigInt(tx.value).toString(),
          from: tx.from,
          timestamp: ts,
          blockNumber: n,
        });
      }
    }
  }
  cache.lastScanned = tip;
  // return ALL cached txs so a detected tx keeps reporting growing confirmations
  const cutoff = Math.floor(Date.now() / 1000) - CACHE_TTL_S;
  const out = [];
  for (const [txid, t] of cache.txs) {
    if (t.timestamp < cutoff) {
      cache.txs.delete(txid);
      continue;
    }
    if (t.timestamp < sinceTs) continue;
    out.push({
      txid,
      amountRaw: t.amountRaw,
      confirmations: tip - t.blockNumber + 1,
      from: t.from,
      timestamp: t.timestamp,
    });
  }
  return out;
}
