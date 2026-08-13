# Trust Forex — Shared Build Contract (all agents build against THIS)

## Project
- App root: /Users/hamidrezanasrabadi/Documents/Projects/Trust-Forex
- Vite + React 19 + TS, plain CSS files per component, design tokens in `src/design-system/tokens.css` (CSS custom props, Sora font). Screens are components with callback props; `App.tsx` owns routing (react-router). DO NOT EDIT: App.tsx, main.tsx, index.html, package.json, vite.config.ts, tsconfig*.json — integration is done by the orchestrator. If you need a route or a dep, write it in your manifest.
- Figma frame specs (geometry+layer names XML): /private/tmp/claude-501/-Users-hamidrezanasrabadi-Documents-Projects-Trust-Forex/dbd65ad8-85fd-4cdd-a658-3095c1910860/scratchpad/frames/<id-with-dash>.xml
- NO Figma renders are available (API quota). Build from XML geometry + existing tokens + existing screen conventions. Text layer names ARE the copy. Sizes/positions in XML are exact px at 360×852 viewport. Match existing code style (see any existing screen: CSS classes, BEM-ish naming, tokens var() usage).
- Icons: reuse `src/screens/*/Glyph.tsx` patterns / `src/assets/icons`. New icons: draw minimal 24px SVG inline (Tabler style), mark `/* placeholder icon */`.
- Every agent MUST write a manifest at .../scratchpad/manifests/<cluster>.md: files created/changed, routes needed (path → component + props), integration notes, TODOs.

## New design-system component APIs (owner: ds-components cluster; consumers import from 'src/design-system/components')
```ts
Input:        { label?: string; value: string; onChange: (v: string) => void; placeholder?: string; error?: string; hint?: string; rightSlot?: ReactNode; disabled?: boolean }
Switch:       { checked: boolean; onChange: (c: boolean) => void; disabled?: boolean }
Radio:        { checked: boolean; onChange: () => void; disabled?: boolean }
Notification: { variant: 'success' | 'error' | 'warning' | 'info'; title: string; description?: string; onClose?: () => void }
```
Button/NavigationBar/ProgressBar/BottomSheet/BrokerState/CashbackOverview already exist — check `src/design-system/components/index.ts` for APIs; extend, don't break.

## Crypto gateway REST API (owner: backend-core cluster; server at http://localhost:8787, Vite dev proxies /api → 8787)
This is a REAL payment system with automatic on-chain verification (see Chain watcher below), not a UI mock. Admin Approve/Reject via Telegram bot is the manual OVERRIDE, not the primary mechanism.
Auth: header `Authorization: tma <window.Telegram.WebApp.initData>`; server validates HMAC vs bot token; env TF_DEV=1 skips validation (dev).
```
GET  /api/gateways                     → { gateways: [{ currency, name, networks: [{ network, address, memo? }] }] }
POST /api/orders                       { planId, billing: 'monthly'|'yearly', amountUsd } → { order }
POST /api/orders/:id/select           { currency, network } → { order }   // rate via CoinGecko (60s cache, stablecoins=1), then UNIQUE-AMOUNT dithering (below), assigns address+memo
POST /api/orders/:id/submit           { txid? } → { order }               // status → submitted; notifies admin via bot
GET  /api/orders/:id                   → { order }                        // lazy-expires stale pending/submitted orders
GET  /api/me/subscription              → { status: 'active'|'expired'|'none', planId?, billing?, expiresAt? }  // derived from newest confirmed order: monthly=30d, yearly=365d from confirmedAt
order = { id, planId, billing, amountUsd, currency?, network?, amountCrypto?, address?, memo?, status: 'pending'|'submitted'|'confirmed'|'failed'|'expired', txid?, confirmations?, requiredConfirmations?, detectedAt?, confirmedAt?, createdAt }
```
Status→screen: pending→QR screen, submitted→Waiting, confirmed→Confirmed, failed/expired→Error. Watcher can move pending OR submitted → confirmed directly (user never tapped "I've paid" — still fine).
Storage: `node:sqlite` (DatabaseSync) at server/data.sqlite. EXACT schema (both backend clusters depend on it):
```sql
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, user_id INTEGER, username TEXT, plan_id TEXT NOT NULL, billing TEXT NOT NULL,
  amount_usd REAL NOT NULL, currency TEXT, network TEXT, amount_crypto TEXT, address TEXT, memo TEXT,
  status TEXT NOT NULL DEFAULT 'pending', txid TEXT, confirmations INTEGER DEFAULT 0,
  detected_at INTEGER, confirmed_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS seen_txs (txid TEXT PRIMARY KEY, order_id TEXT);
```
Gateways config: server/gateways.json (manual admin file), per network: { network, address, memo?, tokenContract?, decimals, chain: 'evm'|'btc'|'tron'|'sol'|'ton', rpc?, requiredConfirmations, manualOnly? }. Admin verify override: Telegram bot inline Approve/Reject (long-polling, stdlib fetch, no SDK); on confirm (auto or manual) bot messages the paying user too. Env: TF_BOT_TOKEN, TF_ADMIN_CHAT_ID, TF_PORT, TF_DEV.
backend-core owns: server/index.mjs, server/db.mjs, server/notify.mjs (bot send/edit + user notify), server/bot.mjs (long-poll + callbacks), server/gateways.json, server/README.md, server/test.mjs, src/telegram/**, src/telegram.d.ts. index.mjs starts the watcher: `const { startWatcher } = await import('./watcher.mjs'); startWatcher({ db, notify, loadGateways })` guarded by try/catch (missing watcher file must not kill the API during parallel build).

## UNIQUE-AMOUNT matching (how payments are identified — both backend clusters implement to this)
Many users pay the SAME wallet, so each active order gets a unique crypto amount: base = amountUsd/rate rounded per currency display decimals, then add a random dither in the last 2-3 decimal places (stablecoins: 4 decimals, e.g. 25 → 25.0137; BTC/ETH/BNB/SOL/TRX: last 3 of their 6-8 display decimals). Regenerate on collision with any non-final order of same (currency, network, address). amount_crypto stored as DECIMAL STRING, never float. A transfer matches an order iff to-address matches AND normalized on-chain amount === amount_crypto exactly AND tx time ≥ order created_at AND txid not in seen_txs. Memo (where the design shows one) is display-only extra identification, NOT required for matching (EVM/TRON/BTC wallets can't send memos).

## Chain watcher (owner: chain-watcher cluster) — automatic on-chain verification, NO API keys
chain-watcher owns: server/watcher.mjs, server/chains/** , server/watcher.test.mjs.
Adapter interface (server/chains/<chain>.mjs): `export async function listIncoming({ address, tokenContract, decimals, sinceTs, rpc }) → [{ txid, amountRaw: string(base units), confirmations: number, from, timestamp }]` — read-only public endpoints:
- evm (Ethereum/BSC/Polygon/Avalanche): JSON-RPC. Tokens (USDT/USDC ERC-20/BEP-20 etc.): eth_getLogs Transfer(address,address,uint256) with to=our address over a trailing block window (~2500 blocks, chunked to respect RPC caps); native coin: scan recent blocks eth_getBlockByNumber(full txs) match to+value — cap scan window, note ceiling in a ponytail comment. Default rpc per network in gateways.json (eth: https://cloudflare-eth.com, bsc: https://bsc-dataseed.binance.org, polygon: https://polygon-rpc.com, avalanche: https://api.avax.network/ext/bc/C/rpc). confirmations = tip - txBlock + 1.
- btc: mempool.space public API /api/address/:addr/txs (+ /api/blocks/tip/height for confs).
- tron (native TRX + TRC-20): Tronscan public API (apilist.tronscanapi.com) token_trc20/transfers?toAddress= and /api/transaction?address=; confirmed flag → confirmations = required (treat as final when confirmed=true).
- sol: mainnet-beta RPC getSignaturesForAddress + getTransaction(jsonParsed), commitment=finalized → final. Native SOL only in v1; SPL tokens (USDT/USDC on sol) marked manualOnly:true in gateways.json with a ponytail comment (upgrade: derive ATA and watch it).
- ton (native TON + jettons e.g. USDT-TON): TonCenter v3 public indexer API (toncenter.com/api/v3), keyless. Native: GET /transactions?account=. Jetton transfers: GET /jetton/transfers?owner_address=&jetton_master=. Both only return included (finalized) transactions, so any hit is final.
Watcher loop: every 20s gather awaiting orders (pending|submitted, not expired), group by (chain, address, tokenContract), one adapter call per group, match per UNIQUE-AMOUNT rules, record txid+confirmations+detected_at, promote to confirmed when confirmations ≥ requiredConfirmations (insert into seen_txs first — double-credit guard), then notify(order) (admin + user). Per-group errors: log + continue (public endpoints flake; never crash the loop). Expiry: pending/submitted older than 40min with no detected tx → expired.
Tests (server/watcher.test.mjs, node:test or asserts, MUST pass): stub-adapter tests for match/confirm/dither-uniqueness/expiry/double-credit; plus a live read-only smoke test per adapter against a known busy address (Binance hot wallets etc.) that SKIPS with a warning on network failure instead of failing.

## Frontend API client (owner: payment-status cluster) — src/api/client.ts
Typed fns: getGateways(), createOrder(), selectGateway(), submitOrder(), getOrder(). Base '/api'. Sends Authorization header from Telegram initData when present.

## Broker account verification (server/admin.mjs review_queue + server/index.mjs)
POST /api/me/brokers/:id/submit {email, brokerAccountId} → review_queue row (last_status 'No account'; a rejected row re-enters as 'Registration rejected'). POST /api/me/brokers/:id/deposit → re-enters as 'Deposit required' / 'Deposit rejected'. Both return {brokers} (refreshed MeBrokerLink[]). States: pending → waiting-for-deposit → deposit-review → cashback-active, rejected on account rejection; a rejected deposit maps back to waiting-for-deposit. Admin decision (approved|waiting|rejected) DMs the broker's flow message (key resolved from decision + deposit phase). client.ts: submitBrokerAccount(), confirmBrokerDeposit(); BrokerDetail polls getMe() every 15s while a review is open.

## Telegram Mini App module (owner: backend+telegram cluster) — src/telegram/
`initTelegram()` (ready+expand+theme params→CSS vars on :root), `getTg()`, `getInitData()`, `useBackButton(cb)`, `useMainButton(opts)`, haptic helpers. Guidelines: layouts start below Telegram native header; keyboard-open state must keep content scrollable (see frames/564-1922.xml). Existing `src/telegram.d.ts` has WebApp typings — extend there.
QR rendering: `qrcode` npm package (installed), `QRCode.toDataURL`.
