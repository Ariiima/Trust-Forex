/**
 * The same rules `orders.validateGateways` enforces, run in the browser as you
 * type. The server is still the authority — this only exists so an operator
 * sees "RPC is required for an EVM network" under the field instead of a
 * `rpc_required:USDT/ERC-20` string after a failed save.
 *
 * Keep in step with server/orders.mjs validateGateways.
 */
import type { Gateway, GatewayNetwork } from '../data';

export const CHAINS = ['evm', 'btc', 'tron', 'sol', 'ton'] as const;
export type Chain = typeof CHAINS[number];

export type Problem = { ci: number; ni: number | null; field: string; message: string };

const int = (v: unknown) => Number.isInteger(v);

export function checkWallets(gateways: Gateway[]): Problem[] {
  const out: Problem[] = [];
  const seenCurrency = new Map<string, number>();

  gateways.forEach((g, ci) => {
    const ticker = (g.currency ?? '').trim();
    if (!ticker) out.push({ ci, ni: null, field: 'currency', message: 'A ticker is required.' });
    else if (seenCurrency.has(ticker)) out.push({ ci, ni: null, field: 'currency', message: `${ticker} is already configured above.` });
    else seenCurrency.set(ticker, ci);

    if (!g.networks?.length) {
      out.push({ ci, ni: null, field: 'networks', message: 'Add at least one network, or remove the currency.' });
      return;
    }

    const seenNetwork = new Map<string, number>();
    g.networks.forEach((n: GatewayNetwork, ni) => {
      const label = (n.network ?? '').trim();
      if (!label) out.push({ ci, ni, field: 'network', message: 'A network label is required.' });
      else if (seenNetwork.has(label)) out.push({ ci, ni, field: 'network', message: `${label} is listed twice for ${ticker || 'this currency'}.` });
      else seenNetwork.set(label, ni);

      if ((n.address ?? '').trim().length < 20) {
        out.push({ ci, ni, field: 'address', message: 'Not a plausible address — under 20 characters.' });
      }
      if (!int(n.decimals) || (n.decimals as number) < 0 || (n.decimals as number) > 24) {
        out.push({ ci, ni, field: 'decimals', message: 'A whole number, 0–24.' });
      }
      if (!int(n.requiredConfirmations) || (n.requiredConfirmations as number) < 0) {
        out.push({ ci, ni, field: 'requiredConfirmations', message: 'A whole number, 0 or more.' });
      }
      if (!n.manualOnly) {
        if (!CHAINS.includes(n.chain as Chain)) {
          out.push({ ci, ni, field: 'chain', message: 'No watcher adapter for this chain — pick one, or switch the network to manual only.' });
        }
        if (n.chain === 'evm' && !n.rpc) {
          out.push({ ci, ni, field: 'rpc', message: 'An EVM network needs an RPC endpoint for the watcher to poll.' });
        }
      }
      if (n.rpc && !/^https:\/\//.test(n.rpc)) {
        out.push({ ci, ni, field: 'rpc', message: 'Must start with https://' });
      }
    });
  });

  return out;
}

/** `invalid_address:USDT/BEP-20` → the row it belongs to, so a rejected save
 *  can open and flag the offending network instead of printing a code. */
export function locateServerError(code: string, gateways: Gateway[]): Problem | null {
  const [kind, at] = code.split(':');
  if (!at) return null;
  const [currency, network] = at.split('/');
  const ci = gateways.findIndex((g) => g.currency === currency);
  if (ci < 0) return null;
  const ni = network ? gateways[ci].networks.findIndex((n) => n.network === network) : -1;
  return { ci, ni: ni < 0 ? null : ni, field: kind, message: `The server rejected this: ${kind.replace(/_/g, ' ')}.` };
}
