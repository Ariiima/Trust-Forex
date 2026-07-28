// Bitcoin adapter — mempool.space public API, keyless.
import { fetchJson } from './http.mjs';

export async function listIncoming({ address, sinceTs, rpc }) {
  const base = rpc || 'https://mempool.space/api';
  // ponytail: 50-tx window — a wallet busier than 50 incoming txs between detection and
  // confirmation can push a pending match out of view; admin override covers.
  const tip = await fetchJson(`${base}/blocks/tip/height`);
  const txs = await fetchJson(`${base}/address/${address}/txs`);
  const out = [];
  for (const tx of txs) {
    let sum = 0n; // sats received by our address in this tx
    for (const vout of tx.vout ?? []) {
      if (vout.scriptpubkey_address === address) sum += BigInt(vout.value);
    }
    if (sum === 0n) continue; // outgoing / unrelated
    const confirmed = tx.status?.confirmed;
    const timestamp = confirmed ? tx.status.block_time : Math.floor(Date.now() / 1000);
    if (timestamp < sinceTs) continue;
    out.push({
      txid: tx.txid,
      amountRaw: sum.toString(),
      confirmations: confirmed ? tip - tx.status.block_height + 1 : 0,
      from: tx.vin?.[0]?.prevout?.scriptpubkey_address ?? '',
      timestamp,
    });
  }
  return out;
}
