// Tron adapter (native TRX + TRC-20) — Tronscan public API, keyless.
// confirmed flag means effectively final -> confirmations 1e9 satisfies any threshold.
// Field names here are the lowest-confidence external surface; the live smoke test in
// watcher.test.mjs verifies them — adjust the mapping there, never the interface.
import { fetchJson } from './http.mjs';

const FINAL = 1e9;

export async function listIncoming({ address, tokenContract, sinceTs, rpc }) {
  const base = rpc || 'https://apilist.tronscanapi.com/api';
  if (tokenContract) {
    const json = await fetchJson(
      `${base}/token_trc20/transfers?toAddress=${address}&contract_address=${tokenContract}&limit=50&start=0`,
    );
    return (json.token_transfers ?? [])
      .filter((r) => r.to_address === address && r.contract_address === tokenContract)
      .map((r) => ({
        txid: r.transaction_id,
        amountRaw: String(r.quant), // already base units
        confirmations: r.confirmed ? FINAL : 0,
        from: r.from_address,
        timestamp: Math.floor(r.block_ts / 1000),
      }))
      .filter((t) => t.timestamp >= sinceTs);
  }
  const json = await fetchJson(`${base}/transaction?address=${address}&limit=50&start=0`);
  return (json.data ?? [])
    .filter((r) => r.contractType === 1 /* TransferContract */ && r.toAddress === address)
    .map((r) => ({
      txid: r.hash,
      amountRaw: String(r.contractData?.amount ?? r.amount), // sun
      confirmations: r.confirmed ? FINAL : 0,
      from: r.ownerAddress,
      timestamp: Math.floor(r.timestamp / 1000),
    }))
    .filter((t) => t.timestamp >= sinceTs);
}
