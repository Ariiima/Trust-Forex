import type { Gateway } from '../../api/client';
import btc from '../../assets/crypto/btc.png';
import usdt from '../../assets/crypto/usdt.png';
import sol from '../../assets/crypto/sol.png';
import usdc from '../../assets/crypto/usdc.png';
import eth from '../../assets/crypto/eth.png';
import bnbSmartChain from '../../assets/crypto/bnb-smart-chain.png';
import tron from '../../assets/crypto/tron.png';
import ethereumErc20 from '../../assets/crypto/ethereum-erc20.png';
import solana from '../../assets/crypto/solana.png';
import ton from '../../assets/crypto/ton.png';

/**
 * Display metadata for the live payment options served by GET /api/gateways,
 * keyed by the exact currency / network strings in server/gateways.json.
 * Adding a currency there means adding its icon here — an entry with no icon
 * is dropped from the picker (and logged) rather than rendered broken.
 */
const CURRENCY_META: Record<string, { name: string; icon: string }> = {
  BTC: { name: 'Bitcoin', icon: btc },
  USDT: { name: 'Tether', icon: usdt },
  USDC: { name: 'USD coin', icon: usdc },
  ETH: { name: 'Ethereum', icon: eth },
  SOL: { name: 'Solana', icon: sol },
  BNB: { name: 'BNB', icon: bnbSmartChain },
  TRX: { name: 'TRON', icon: tron },
  TON: { name: 'Toncoin', icon: ton },
};

const NETWORK_META: Record<string, { label: string; icon: string }> = {
  'BEP-20': { label: 'BNB Smart Chain (BEP20)', icon: bnbSmartChain },
  'TRC-20': { label: 'Tron (TRC20)', icon: tron },
  'ERC-20': { label: 'Ethereum (ERC20)', icon: ethereumErc20 },
  Bitcoin: { label: 'Bitcoin', icon: btc },
  TRON: { label: 'Tron', icon: tron },
  Solana: { label: 'Solana (SOL)', icon: solana },
};

export interface CurrencyOption {
  id: string; // gateway currency symbol, e.g. 'USDT'
  symbol: string;
  name: string;
  icon: string;
}

export interface NetworkOption {
  id: string; // gateway network string, e.g. 'TRC-20'
  label: string;
  icon: string;
}

/** Live gateways → picker rows. Currencies without icon metadata are dropped. */
export function currencyOptions(gateways: Gateway[]): CurrencyOption[] {
  return gateways.flatMap((g) => {
    const meta = CURRENCY_META[g.currency];
    if (!meta) {
      console.warn(`[gateways] no icon metadata for currency ${g.currency}; hidden`);
      return [];
    }
    return [{ id: g.currency, symbol: g.currency, name: meta.name, icon: meta.icon }];
  });
}

/** Networks of one gateway currency → picker rows. Unknown networks keep the
 *  raw config string as label and fall back to the currency's own icon. */
export function networkOptions(gateways: Gateway[], currency: string): NetworkOption[] {
  const gw = gateways.find((g) => g.currency === currency);
  const fallbackIcon = CURRENCY_META[currency]?.icon ?? btc;
  return (gw?.networks ?? []).map((n) => ({
    id: n.network,
    label: NETWORK_META[n.network]?.label ?? n.network,
    icon: NETWORK_META[n.network]?.icon ?? fallbackIcon,
  }));
}
