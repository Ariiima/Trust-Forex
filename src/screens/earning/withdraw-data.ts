import usdt from '../../assets/crypto/usdt.png';
import usdc from '../../assets/crypto/usdc.png';
import bep20 from '../../assets/crypto/bnb-smart-chain.png';
import trc20 from '../../assets/crypto/tron.png';
import erc20 from '../../assets/crypto/ethereum-erc20.png';

export interface WithdrawOption {
  id: string;
  symbol: string;
  network: string;
  icon: string;
  networkIcon: string;
  networkFee: number;
  minimum: number;
}

/** Order matches frame 1379:6901 — USDT then USDC, each BEP20/TRC20/ERC20. */
export const WITHDRAW_OPTIONS: readonly WithdrawOption[] = [
  { id: 'usdt-bep20', symbol: 'USDT', network: 'BEP20', icon: usdt, networkIcon: bep20, networkFee: 1, minimum: 10 },
  { id: 'usdt-trc20', symbol: 'USDT', network: 'TRC20', icon: usdt, networkIcon: trc20, networkFee: 1, minimum: 10 },
  { id: 'usdt-erc20', symbol: 'USDT', network: 'ERC20', icon: usdt, networkIcon: erc20, networkFee: 1, minimum: 10 },
  { id: 'usdc-bep20', symbol: 'USDC', network: 'BEP20', icon: usdc, networkIcon: bep20, networkFee: 1, minimum: 10 },
  { id: 'usdc-trc20', symbol: 'USDC', network: 'TRC20', icon: usdc, networkIcon: trc20, networkFee: 1, minimum: 10 },
  { id: 'usdc-erc20', symbol: 'USDC', network: 'ERC20', icon: usdc, networkIcon: erc20, networkFee: 1, minimum: 10 },
];
