/**
 * Self-check for ./wallet-checks.ts. Nothing imports this file; run it directly:
 *
 *   node --experimental-strip-types src/admin/sections/wallet-checks.check.ts
 *
 * These rules are a copy of server/orders.mjs validateGateways. If that file
 * changes and this one still passes unchanged, the two have drifted.
 */
import { checkWallets, locateServerError } from './wallet-checks.ts';
import type { Gateway } from '../data.ts';

const deq = (got: unknown, want: unknown, why = 'check failed') => {
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    throw new Error(`${why}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
};

const ok = (): Gateway[] => [{
  currency: 'USDT',
  name: 'Tether',
  networks: [{
    network: 'TRC-20',
    address: 'TApPG3ozMjK9Ky3tn6FC8ngGGkCCY6jaH3',
    chain: 'tron',
    decimals: 6,
    requiredConfirmations: 1,
  }],
}];

deq(checkWallets(ok()), [], 'a valid doc has no problems');

const evmNoRpc = ok();
evmNoRpc[0].networks[0].chain = 'evm';
deq(checkWallets(evmNoRpc).map((p) => p.field), ['rpc'], 'an EVM network with no RPC is flagged');

const manual = ok();
manual[0].networks[0].chain = 'evm';
manual[0].networks[0].manualOnly = true;
deq(checkWallets(manual), [], 'manual-only skips the chain and RPC rules');

const badChain = ok();
badChain[0].networks[0].chain = 'xrpl';
deq(checkWallets(badChain).map((p) => p.field), ['chain'], 'a chain with no adapter is flagged');

const dupeCurrency = [...ok(), ...ok()];
deq(checkWallets(dupeCurrency).map((p) => p.field), ['currency'], 'duplicate ticker');

const dupeNetwork = ok();
dupeNetwork[0].networks.push({ ...dupeNetwork[0].networks[0] });
deq(checkWallets(dupeNetwork).map((p) => p.field), ['network'], 'the same network twice on one currency');

const empty = ok();
empty[0].networks = [];
deq(checkWallets(empty).map((p) => p.field), ['networks'], 'a currency with no networks');

const bad = ok();
bad[0].networks[0].address = 'too-short';
bad[0].networks[0].decimals = 99;
bad[0].networks[0].requiredConfirmations = -1;
deq(
  checkWallets(bad).map((p) => p.field),
  ['address', 'decimals', 'requiredConfirmations'],
  'address length, decimals range and confirmations',
);

const httpRpc = ok();
httpRpc[0].networks[0].rpc = 'http://rpc.example';
deq(checkWallets(httpRpc).map((p) => p.field), ['rpc'], 'plaintext RPC is rejected');

deq(
  locateServerError('invalid_address:USDT/TRC-20', ok()),
  { ci: 0, ni: 0, field: 'invalid_address', message: 'The server rejected this: invalid address.' },
  'a server code points at its row',
);
deq(locateServerError('duplicate_currency:BTC', ok()), null, 'an unknown currency locates nothing');
deq(locateServerError('gateways_must_be_array', ok()), null, 'a code with no location returns null');

console.log('wallet-checks ok');
