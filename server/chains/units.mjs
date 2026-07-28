// BigInt-only conversion between display decimal strings and integer base units.
// Amounts NEVER pass through parseFloat/Number anywhere in the watcher.
// Note: backend-core owns order creation but MAY import ditherAmount/DISPLAY from here
// so both clusters share bit-identical dither semantics.

export function toBaseUnits(display, decimals) {
  const s = String(display).trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`bad amount: ${display}`);
  const [whole, frac = ''] = s.split('.');
  if (frac.length > decimals) throw new Error(`amount ${display} exceeds ${decimals} decimals`);
  return (BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, '0') || '0')).toString();
}

export function fromBaseUnits(raw, decimals) {
  const v = BigInt(raw);
  const d = 10n ** BigInt(decimals);
  const frac = (v % d).toString().padStart(decimals, '0').replace(/0+$/, '');
  return frac ? `${v / d}.${frac}` : (v / d).toString();
}

// Per-currency display/dither config (CONTRACT "UNIQUE-AMOUNT matching").
export const DISPLAY = {
  USDT: { displayDecimals: 4, ditherDigits: 3 },
  USDC: { displayDecimals: 4, ditherDigits: 3 },
  BTC: { displayDecimals: 8, ditherDigits: 3 },
  ETH: { displayDecimals: 6, ditherDigits: 3 },
  BNB: { displayDecimals: 6, ditherDigits: 3 },
  SOL: { displayDecimals: 6, ditherDigits: 3 },
  TRX: { displayDecimals: 6, ditherDigits: 3 },
};

// Randomize the last ditherDigits of baseDisplay's displayDecimals. r is never 0, so a
// dithered amount never equals the round base figure (distinguishes from someone
// coincidentally paying the exact round amount). Retries on collision via isTaken.
export function ditherAmount(baseDisplay, { displayDecimals, ditherDigits }, isTaken, rand = Math.random) {
  const base = BigInt(toBaseUnits(baseDisplay, displayDecimals));
  const mod = 10n ** BigInt(ditherDigits);
  for (let i = 0; i < 100; i++) {
    const r = 1 + Math.floor(rand() * (Number(mod) - 1));
    const candidate = (base / mod) * mod + BigInt(r);
    const display = fromBaseUnits(candidate.toString(), displayDecimals);
    if (!isTaken(display)) return display;
  }
  throw new Error('dither space exhausted');
}
