// EVM adapter (Ethereum/BSC/Polygon/Avalanche) — keyless public JSON-RPC.
// Tokens via eth_getLogs Transfer topics; native coin via recent-block scan.
import { rpc } from './http.mjs';

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'; // keccak Transfer(address,address,uint256)
const LOG_WINDOW = 2500; // trailing blocks scanned for token transfers
const LOG_CHUNK = 1000; // per eth_getLogs call — public RPCs cap ranges (bsc-dataseed 5000, others ~1000)
const NATIVE_WINDOW = 40; // max blocks back-scanned for native transfers
const CACHE_TTL_S = 2 * 60 * 60;

const blockTsCache = new Map(); // `${rpc}|${blockNum}` -> unix seconds
const nativeCache = new Map(); // `${rpc}|${addrLower}` -> { lastScanned, txs: Map<txid, {...}> }

const hex = (n) => '0x' + n.toString(16);

export async function listIncoming({ address, tokenContract, decimals, sinceTs, rpc: url }) {
  if (!url) throw new Error('evm adapter requires an rpc url (set per network in gateways.json)');
  const tip = Number(await rpc(url, 'eth_blockNumber', []));
  return tokenContract
    ? listToken({ url, address, tokenContract, sinceTs, tip })
    : listNative({ url, address, sinceTs, tip });
}

async function listToken({ url, address, tokenContract, sinceTs, tip }) {
  const paddedTo = '0x' + '0'.repeat(24) + address.toLowerCase().slice(2);
  const from = Math.max(0, tip - LOG_WINDOW + 1);
  const logs = [];
  for (let a = from; a <= tip; a += LOG_CHUNK) {
    const chunk = await rpc(url, 'eth_getLogs', [{
      fromBlock: hex(a),
      toBlock: hex(Math.min(a + LOG_CHUNK - 1, tip)),
      address: tokenContract,
      topics: [TRANSFER_TOPIC, null, paddedTo],
    }]);
    logs.push(...chunk);
  }
  const out = [];
  for (const log of logs) {
    const blockNum = Number(log.blockNumber);
    const ts = await blockTimestamp(url, blockNum);
    if (ts < sinceTs) continue;
    out.push({
      txid: log.transactionHash,
      amountRaw: BigInt(log.data).toString(),
      confirmations: tip - blockNum + 1,
      from: '0x' + log.topics[1].slice(26),
      timestamp: ts,
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
