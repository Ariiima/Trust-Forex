/* ---------------------------------------------------------------------------
 * Frontend client for the crypto payment gateway REST API (CONTRACT §"Frontend
 * API client"). Base '/api' — Vite dev proxies to the node server on :8787.
 * Auth: `Authorization: tma <initData>` header when running inside Telegram.
 * `VITE_MOCK=1` swaps every fn for canned in-memory responses (pending →
 * submitted → confirmed on a timer) so the UI runs without a server.
 * ------------------------------------------------------------------------- */

export type OrderStatus = 'pending' | 'submitted' | 'confirmed' | 'failed' | 'expired';

export interface GatewayNetwork {
  network: string;
  address: string;
  memo?: string;
}

export interface Gateway {
  currency: string;
  name: string;
  networks: GatewayNetwork[];
}

export interface Order {
  id: string;
  planId: string;
  billing: 'monthly' | 'yearly';
  amountUsd: number;
  currency?: string;
  network?: string;
  /** Decimal string — unique-amount matching needs exact digits, never float. */
  amountCrypto?: string;
  address?: string;
  memo?: string;
  status: OrderStatus;
  txid?: string;
  confirmations?: number;
  requiredConfirmations?: number;
  detectedAt?: number;
  confirmedAt?: number;
  createdAt: number;
}

export interface Subscription {
  status: 'active' | 'expired' | 'none';
  planId?: string;
  billing?: 'monthly' | 'yearly';
  expiresAt?: number;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, body: string) {
    super(`API error ${status}${body ? `: ${body}` : ''}`);
    this.name = 'ApiError';
    this.status = status;
  }
}

const MOCK = import.meta.env.VITE_MOCK === '1';

/** GET when `body` is undefined, JSON POST otherwise. */
async function request<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const initData = window.Telegram?.WebApp?.initData;
  if (initData) headers.Authorization = 'tma ' + initData;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch('/api' + path, {
    method: body !== undefined ? 'POST' : 'GET',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => ''));
  return (await res.json()) as T;
}

/* ---- Mock mode (VITE_MOCK=1) --------------------------------------------
 * One in-memory Map of orders; the pending → submitted → confirmed lifecycle
 * is computed on read from the select timestamp (no timers to leak). */

const MOCK_GATEWAY: Gateway = {
  currency: 'BNB',
  name: 'BNB',
  networks: [
    { network: 'BEP-20', address: '0x1C42f9aA71bCa2Fb04E2c19E344aE4A248Hf7f8b', memo: '28442536' },
  ],
};

const mockOrders = new Map<string, Order>();
const mockSelectedAt = new Map<string, number>(); // module-local, not on the Order type

function mockSelect(order: Order, currency?: string, network?: string): Order {
  const net = MOCK_GATEWAY.networks[0];
  const next: Order = {
    ...order,
    currency: currency ?? MOCK_GATEWAY.currency,
    network: network ?? net.network,
    address: net.address,
    memo: net.memo,
    amountCrypto: '0.00350773',
  };
  mockOrders.set(next.id, next);
  mockSelectedAt.set(next.id, Date.now());
  return next;
}

function mockRead(id: string): Order {
  let order = mockOrders.get(id);
  if (!order) {
    // ponytail: unknown id auto-seeds a selected order so /payment/status/:orderId
    // deep-links work standalone in dev; upgrade path: throw new ApiError(404, ...)
    order = mockSelect({ id, planId: 'gold', billing: 'monthly', amountUsd: 2, status: 'pending', createdAt: Date.now() });
  }
  const selectedAt = mockSelectedAt.get(id);
  if (selectedAt !== undefined && (order.status === 'pending' || order.status === 'submitted')) {
    const elapsed = Date.now() - selectedAt;
    if (elapsed > 30_000) order = { ...order, status: 'confirmed', confirmedAt: selectedAt + 30_000 };
    else if (elapsed > 15_000) order = { ...order, status: 'submitted' };
    mockOrders.set(id, order);
  }
  return order;
}

/* ---- API surface -------------------------------------------------------- */

export function getGateways(): Promise<Gateway[]> {
  if (MOCK) return Promise.resolve([MOCK_GATEWAY]);
  return request<{ gateways: Gateway[] }>('/gateways').then((r) => r.gateways);
}

export function createOrder(input: {
  planId: string;
  billing: 'monthly' | 'yearly';
  amountUsd: number;
}): Promise<Order> {
  if (MOCK) {
    const order: Order = { id: crypto.randomUUID(), status: 'pending', createdAt: Date.now(), ...input };
    mockOrders.set(order.id, order);
    return Promise.resolve(order);
  }
  return request<{ order: Order }>('/orders', input).then((r) => r.order);
}

export function selectGateway(
  orderId: string,
  input: { currency: string; network: string },
): Promise<Order> {
  if (MOCK) return Promise.resolve(mockSelect(mockRead(orderId), input.currency, input.network));
  return request<{ order: Order }>(`/orders/${orderId}/select`, input).then((r) => r.order);
}

export function submitOrder(orderId: string, input?: { txid?: string }): Promise<Order> {
  if (MOCK) {
    let order = mockRead(orderId);
    if (order.status === 'pending' || order.status === 'submitted') {
      order = { ...order, status: 'submitted', txid: input?.txid ?? order.txid };
      mockOrders.set(orderId, order);
    }
    return Promise.resolve(order);
  }
  return request<{ order: Order }>(`/orders/${orderId}/submit`, input ?? {}).then((r) => r.order);
}

export function getOrder(orderId: string): Promise<Order> {
  if (MOCK) return Promise.resolve(mockRead(orderId));
  return request<{ order: Order }>(`/orders/${orderId}`).then((r) => r.order);
}

export function getSubscription(): Promise<Subscription> {
  if (MOCK) {
    const confirmed = [...mockOrders.values()].find((o) => o.status === 'confirmed');
    if (!confirmed) return Promise.resolve({ status: 'none' });
    return Promise.resolve({
      status: 'active',
      planId: confirmed.planId,
      billing: confirmed.billing,
      expiresAt:
        (confirmed.confirmedAt ?? Date.now()) +
        (confirmed.billing === 'yearly' ? 365 : 30) * 86_400_000,
    });
  }
  return request<Subscription>('/me/subscription');
}

/* ---- once-only preview flags --------------------------------------------
 * Server-side (see server/index.mjs) so "already saw the intro" follows the
 * Telegram account rather than one device's localStorage. */

export type UserFlag = 'referral_preview_seen' | 'cashback_preview_seen';

// Mock mode keeps them per-tab; a reload replays the intro, which is what you
// want when reviewing the preview screens.
const mockFlags = new Set<UserFlag>();

export function getFlags(): Promise<UserFlag[]> {
  if (MOCK) return Promise.resolve([...mockFlags]);
  return request<{ flags: UserFlag[] }>('/me/flags').then((r) => r.flags);
}

export function setFlag(flag: UserFlag): Promise<UserFlag[]> {
  if (MOCK) {
    mockFlags.add(flag);
    return Promise.resolve([...mockFlags]);
  }
  return request<{ flags: UserFlag[] }>(`/me/flags/${flag}`, {}).then((r) => r.flags);
}
