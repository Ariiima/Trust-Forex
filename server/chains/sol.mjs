// Solana adapter — mainnet-beta RPC, native SOL only, commitment finalized (= final).
import { rpc } from './http.mjs';

const FINAL = 1e9;
const CACHE_TTL_S = 2 * 60 * 60;
const solCache = new Map(); // signature -> { at, val: {amountRaw, from, timestamp} | null }

export async function listIncoming({ address, tokenContract, sinceTs, rpc: rpcUrl }) {
  // ponytail: SPL (USDT/USDC on sol) skipped in v1 — needs deriving the ATA for (wallet, mint)
  // and watching that account; gateways.json marks those networks manualOnly:true.
  if (tokenContract) throw new Error('SPL tokens are manualOnly in v1');
  const url = rpcUrl || 'https://api.mainnet-beta.solana.com';
  const nowSec = Math.floor(Date.now() / 1000);
  for (const [sig, entry] of solCache) {
    if (entry.at < nowSec - CACHE_TTL_S) solCache.delete(sig);
  }
  const sigs = await rpc(url, 'getSignaturesForAddress', [address, { limit: 25, commitment: 'finalized' }]);
  const out = [];
  for (const s of sigs) {
    if (s.err !== null) continue;
    if (s.blockTime != null && s.blockTime < sinceTs) continue;
    if (!solCache.has(s.signature)) {
      let tx;
      try {
        tx = await rpc(url, 'getTransaction', [
          s.signature,
          { encoding: 'jsonParsed', commitment: 'finalized', maxSupportedTransactionVersion: 0 },
        ]);
      } catch (e) {
        // mainnet-beta rate-limits aggressively; leave uncached, retry next poll
        console.warn(`[sol] getTransaction ${s.signature} failed: ${e.message}`);
        continue;
      }
      let val = null;
      if (tx) {
        const keys = tx.transaction.message.accountKeys;
        const i = keys.findIndex((k) => (k.pubkey ?? k) === address);
        if (i >= 0) {
          // receiver pays no fee, so a positive delta equals the transferred lamports
          const delta = BigInt(tx.meta.postBalances[i]) - BigInt(tx.meta.preBalances[i]);
          if (delta > 0n) {
            val = {
              amountRaw: delta.toString(),
              from: keys[0]?.pubkey ?? keys[0] ?? '',
              timestamp: tx.blockTime ?? s.blockTime ?? nowSec,
            };
          }
        }
      }
      solCache.set(s.signature, { at: nowSec, val });
    }
    const val = solCache.get(s.signature)?.val;
    if (val && val.timestamp >= sinceTs) {
      out.push({ txid: s.signature, ...val, confirmations: FINAL });
    }
  }
  return out;
}
