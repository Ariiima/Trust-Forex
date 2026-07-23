import bnbSmartChain from '../../assets/crypto/bnb-smart-chain.png';
import tron from '../../assets/crypto/tron.png';
import ethereumErc20 from '../../assets/crypto/ethereum-erc20.png';
import polygon from '../../assets/crypto/polygon.png';
import avalanche from '../../assets/crypto/avalanche.png';
import solana from '../../assets/crypto/solana.png';

export interface Network {
  id: string;
  label: string;
  icon: string;
}

/** Order + selection match 552-3122 (BNB/Tron/ETH/Polygon/Avalanche/Solana,
 *  BNB Smart Chain selected). Note: the BNB row reuses the same orange
 *  Bitcoin-glyph icon as the BTC currency ("BTC" component instance in the
 *  Figma source, not a true BNB diamond logo) — cropped verbatim for
 *  pixel fidelity; flagged in the report. */
export const NETWORKS: readonly Network[] = [
  { id: 'bnb-smart-chain', label: 'BNB Smart Chain (BEP20)', icon: bnbSmartChain },
  { id: 'tron', label: 'Tron (TRC20)', icon: tron },
  { id: 'ethereum-erc20', label: 'Ethereum (ERC20)', icon: ethereumErc20 },
  { id: 'polygon', label: 'Polygon (POL)', icon: polygon },
  { id: 'avalanche', label: 'Avalanche C-Chain', icon: avalanche },
  { id: 'solana', label: 'Solana (SOL)', icon: solana },
];
