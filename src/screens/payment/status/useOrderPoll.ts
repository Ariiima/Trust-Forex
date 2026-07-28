import { useEffect, useState } from 'react';
import { getOrder } from '../../../api/client';
import type { Order } from '../../../api/client';

const TERMINAL = new Set(['confirmed', 'failed', 'expired']);

/** Fetch the order immediately, then every 5s; stops on a terminal status or
 *  unmount. Per-tick errors are swallowed — the last good order is kept and
 *  the next tick retries (no dedicated error design exists). */
export function useOrderPoll(orderId: string): Order | null {
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const tick = (): void => {
      getOrder(orderId)
        .then((o) => {
          if (cancelled) return;
          setOrder(o);
          if (TERMINAL.has(o.status)) window.clearInterval(timer);
        })
        .catch(() => undefined);
    };
    tick();
    timer = window.setInterval(tick, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [orderId]);

  return order;
}
