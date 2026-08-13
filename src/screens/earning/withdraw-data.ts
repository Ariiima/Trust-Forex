import usdt from '../../assets/crypto/usdt.png';
import bep20 from '../../assets/crypto/bnb-smart-chain.png';
import trc20 from '../../assets/crypto/tron.png';

export interface WithdrawOption {
  id: string;
  symbol: string;
  network: string;
  icon: string;
  networkIcon: string;
  networkFee: number;
  minimum: number;
}

/** Only two withdrawal rails for now — mirrors server/payouts.mjs WITHDRAW_RULES. */
export const WITHDRAW_OPTIONS: readonly WithdrawOption[] = [
  { id: 'usdt-bep20', symbol: 'USDT', network: 'BEP20', icon: usdt, networkIcon: bep20, networkFee: 1, minimum: 10 },
  { id: 'usdt-trc20', symbol: 'USDT', network: 'TRC20', icon: usdt, networkIcon: trc20, networkFee: 3, minimum: 10 },
];
