import { useEffect, useState } from 'react';

/**
 * Read one value from `api`. Returns `undefined` until it resolves — screens
 * render a skeleton or nothing for that frame. Deliberately not a cache: the
 * fixtures resolve synchronously today, and a real fetch layer will bring its
 * own caching decision with it.
 *
 * A rejected fetch (a dropped connection, a cold backend) used to leave the
 * value `undefined` forever — nothing depends on `deps` changing again to
 * retry, so a screen gated on this (e.g. BrokerManage's "Delete broker"
 * button) could stay silently blank for the rest of that page visit. Retry
 * a couple of times before giving up.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let live = true;
    const attempt = (n: number) => fn().then((v) => live && setValue(v)).catch((err) => {
      if (!live) return;
      if (n >= 2) { console.error(err); return; }
      setTimeout(() => live && attempt(n + 1), 500 * (n + 1));
    });
    attempt(0);
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
