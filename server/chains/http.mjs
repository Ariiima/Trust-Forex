// Shared fetch helpers for chain adapters. 15s timeout, non-2xx throws — errors
// propagate to the watcher's per-group catch; adapters do not swallow them.

export async function fetchJson(url, init) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

export async function rpc(url, method, params) {
  const json = await fetchJson(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (json.error) throw new Error(`${url} ${method}: ${json.error.message ?? JSON.stringify(json.error)}`);
  return json.result;
}
