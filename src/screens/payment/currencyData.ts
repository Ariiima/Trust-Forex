import btc from '../../assets/crypto/btc.png';
import usdt from '../../assets/crypto/usdt.png';
import sol from '../../assets/crypto/sol.png';
import usdc from '../../assets/crypto/usdc.png';
import eth from '../../assets/crypto/eth.png';

export interface Currency {
  id: string;
  symbol: string;
  name: string;
  icon: string;
}

/** Order + selection match 552-3121 (BTC/USDT/SOL/USDC/ETH, BTC selected). */
export const CURRENCIES: readonly Currency[] = [
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin', icon: btc },
  { id: 'usdt', symbol: 'USDT', name: 'Tether', icon: usdt },
  { id: 'sol', symbol: 'SOL', name: 'Solana', icon: sol },
  { id: 'usdc', symbol: 'USDC', name: 'USD coin', icon: usdc },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum', icon: eth },
];
