import type { Order } from '../../api/client';

/**
 * Wallet deep links for a live order — prefilled with the exact address and
 * unique amount so the watcher's amount-matching still works after a
 * one-tap send. Chain/token constants mirror server/gateways.json (public
 * token contracts, same mirror pattern as gatewayDisplay.ts): a network the
 * maps don't know simply builds no link and the button stays hidden.
 */

/** EVM chain ids for the networks we serve. */
const EVM_CHAIN_ID: Record<string, number> = { 'ERC-20': 1, 'BEP-20': 56 };

/** Trust Wallet universal asset ids (SLIP-44 coin per network). */
const TRUST_COIN: Record<string, string> = {
  Bitcoin: 'c0',
  'ERC-20': 'c60',
  'BEP-20': 'c20000714',
  'TRC-20': 'c195',
  TRON: 'c195',
  Solana: 'c501',
};

/** Token contract + on-chain decimals per (currency, network). */
const TOKEN: Record<string, { contract: string; decimals: number }> = {
  'USDT|TRC-20': { contract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', decimals: 6 },
  'USDT|BEP-20': { contract: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
  'USDT|ERC-20': { contract: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
};

/** '0.00350773' × 10^18 → '3507730000000000' — string math, never floats. */
export function shiftDecimal(amount: string, decimals: number): string {
  const [int, frac = ''] = amount.split('.');
  const digits = int + frac.padEnd(decimals, '0').slice(0, decimals);
  return digits.replace(/^0+(?=\d)/, '');
}

/** Trust Wallet handles every chain we serve. Both the modern `asset` UAI and
 *  the legacy `coin`/`token_id` params are sent — old app versions only parse
 *  the latter, and extra params are ignored, so prefill works on both. */
export function trustWalletUrl(o: Order): string | undefined {
  if (!o.currency || !o.network || !o.address || !o.amountCrypto) return undefined;
  const coin = TRUST_COIN[o.network];
  if (!coin) return undefined;
  const token = TOKEN[`${o.currency}|${o.network}`];
  const p = new URLSearchParams({
    asset: token ? `${coin}_t${token.contract}` : coin,
    coin: coin.slice(1),
    address: o.address,
    amount: o.amountCrypto,
  });
  if (token) p.set('token_id', token.contract);
  if (o.memo) p.set('memo', o.memo);
  return `https://link.trustwallet.com/send?${p.toString()}`;
}

/**
 * Payment-request URI for the "Payment QR" tab — a scan hands the wallet the
 * address AND the exact amount. EIP-681 for EVM, BIP-21 for BTC, Solana Pay
 * for SOL. TRON has no commonly-scanned URI standard: return undefined and the
 * caller falls back to the plain address QR.
 */
export function paymentUri(o: Order): string | undefined {
  if (!o.network || !o.address || !o.amountCrypto) return undefined;
  const chainId = EVM_CHAIN_ID[o.network];
  if (chainId) {
    const token = TOKEN[`${o.currency}|${o.network}`];
    if (token) {
      return `ethereum:${token.contract}@${chainId}/transfer?address=${o.address}&uint256=${shiftDecimal(o.amountCrypto, token.decimals)}`;
    }
    return `ethereum:${o.address}@${chainId}?value=${shiftDecimal(o.amountCrypto, 18)}`;
  }
  if (o.network === 'Bitcoin') return `bitcoin:${o.address}?amount=${o.amountCrypto}`;
  if (o.network === 'Solana') return `solana:${o.address}?amount=${o.amountCrypto}`;
  return undefined;
}

/** MetaMask is EVM-only: ERC-20 / BEP-20 (tokens and natives). */
export function metamaskUrl(o: Order): string | undefined {
  const chainId = EVM_CHAIN_ID[o.network ?? ''];
  if (!chainId || !o.address || !o.amountCrypto) return undefined;
  const token = TOKEN[`${o.currency}|${o.network}`];
  if (token) {
    const raw = shiftDecimal(o.amountCrypto, token.decimals);
    return `https://metamask.app.link/send/${token.contract}@${chainId}/transfer?address=${o.address}&uint256=${raw}`;
  }
  return `https://metamask.app.link/send/${o.address}@${chainId}?value=${shiftDecimal(o.amountCrypto, 18)}`;
}

