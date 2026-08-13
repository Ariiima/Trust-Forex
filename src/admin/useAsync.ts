import { useEffect, useState } from 'react';

/**
 * Read one value from `api`. Returns `undefined` until it resolves — screens
 * render a skeleton or nothing for that frame. Deliberately not a cache: the
 * fixtures resolve synchronously today, and a real fetch layer will bring its
 * own caching decision with it.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    let live = true;
    fn().then((v) => live && setValue(v));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
