# Trust Forex

Telegram Mini App (React 19 + Vite + react-router 7) for forex plan subscriptions,
crypto payments, cashback and referrals — plus an admin dashboard on a second entry.
`design/CONTRACT.md` is the spec for the payment API, the chain watcher and the API client.
Where it and the code disagree, read the code and fix the contract.

## Commands

    npm run dev          # vite on 5173, proxies /api → localhost:8787
    npm run server       # node server/index.mjs (the API + watcher + payouts + jobs)
    npm run build        # tsc -b && vite build — two entries: index.html, admin.html
    npm run lint         # oxlint
    node --test server/*.test.mjs             # payment / payouts / telegram / admin
    node --test server/referral.e2e.test.mjs  # invite → /start → app → purchase → share, same harness as:
    node --test server/campaigns.e2e.test.mjs # boots the real server + a mock Bot API,
                                              # drives every campaign-editor config (~30s)
    node --test server/campaigns.matrix.test.mjs   # 27 user states × all 512 type combos,
                                              # 10 triggers, 8 chip subsets: who gets messaged (~3s)
    node server/ledger.mjs                    # the money rules' own self-check
    node server/tz.mjs                        # the system clock's self-check
    node server/mcp.mjs                       # the agent surface: JSON-RPC + route/doc drift
    node --experimental-strip-types <f>.check.ts   # results-math, signal-buckets, earnings-axis
    npm run admin:seed   # TF_ADMIN_USER=… TF_ADMIN_PASS=… creates the admin login
    npm run deploy [web|api]   # scripts/deploy.sh — build, ship, verify, print rollback

Non-trivial logic leaves one runnable check beside it — a `*.check.ts` run directly,
or a `process.argv[1] === …` block at the foot of the module. Plain throws/asserts,
no framework. `node --test server/` (no glob) does not work on node 22.

Both HTML entries build together. Telegram users only load `index.html`; the admin
bundle (recharts) is deliberately kept off that page.

## Frontend map — `src/`

`App.tsx` owns every route and the boot splash. Routes:

    /                          Home            screens/home/Home.tsx
    /plans → /checkout         plan picker → order creation
    /payment/currency → /network → /receive    the pay flow, order id in ?order=
    /cashback, /cashback/history, /cashback/broker/:brokerId
    /referral
    /earning → /earning/withdraw → /withdraw/amount
    /splash, /loading          the two states on their own, for design review

Route wrappers take `?state=`, `?sheet=`, `?amount=` etc. so `design/review/index.html`
can deep-link every designed state. No param = normal default state.

    api/client.ts              every backend call, typed. Nothing else calls fetch.
                               `cachedMe` / `cachedBrokers` / `cachedSignals` are the
                               warm reads screens use; the plain `get*` always hits.
    design-system/             Button, Input, BottomSheet, NavigationBar, … one .tsx +
                               one .css each, all re-exported from components/index.ts
    design-system/tokens.css   colours, spacing, type. Screens use tokens, not literals.
    screens/<feature>/         one folder per tab; *-data.ts is static/demo content
    screens/home/signal-buckets.ts  the chart's data: weekly result rows folded into
                               one point per week/month/quarter, max 30, oldest first;
                               overview tiles = fixed window (4wk/3mo/12mo), not the plot
    telegram/index.ts          getTg / getInitData / useBackButton — the only WebApp access
    ../public/telegram-web-app.js  self-hosted Telegram SDK (index.html loads it, not
                               telegram.org, which many users' networks block — without it
                               a real Telegram user silently degrades to a Guest)
    admin/                     the dashboard SPA (admin.html entry), sections/ = one per page
    index.css                  #root is the scroller, not body. `is-typing` on <body>
                               hides the nav bar and sticky CTAs while the on-screen
                               keyboard is up (viewport shrank with a field focused —
                               not on focus alone, so desktop keeps its buttons).

## Server map — `server/` (plain node:http + node:sqlite, no framework)

    index.mjs        route dispatcher + Telegram initData auth. Starts payouts,
                     watcher, join gate and jobs at the bottom of the file.
    sqlite.mjs       one connection, one file, for everything. DB_PATH lives here.
    tz.mjs           the system clock. One timezone (app_settings.tz, set from the
                     Settings page) behind every date/time the system writes or
                     renders — stamps, day keys, wall-clock cutoffs. `node
                     server/tz.mjs` self-checks. Never format a date any other way.
    db.mjs           orders + user_flags + unmatched_txs. PAYMENT_SCHEMA, rowToOrder.
    orders.mjs       /api/orders*: pricing, unique-amount dithering, gateway select.
                     Also loadGateways / validateGateways / saveGateways — the
                     Wallets page writes gateways.json through them (atomic rename).
    watcher.mjs      polls chains every 20s, matches by exact base-unit amount,
                     promotes to confirmed. chains/{evm,btc,sol,tron,ton}.mjs do the RPC.
                     `creditPartial` is the ONE place partial money books — both the
                     watcher and the admin's manual attribution go through it.
    notify.mjs       what runs the moment a payment confirms (credit, message, refund).
    ledger.mjs       the money spine — balances, tiers (TIER_PCT), plan days.
    payouts.mjs      withdrawals leaving: reserve → send → confirm, with caps.
    partnership.mjs  POST /api/partnership — the broker partnership form on the
                     landing site (design/landing/partnership/). No initData, open
                     CORS; honeypot + caps; row in partnership_requests, alert to
                     TF_ADMIN_CHAT_ID or every TF_ADMIN_IDS. `node server/partnership.mjs`.
    admin.mjs        admin schema, auth, users, brokers, signals, campaigns store.
                     Also API keys: `tfk_…` bearer tokens (sha256 stored, never
                     the key) and `keyDenial` — the ONE place a key's scope is
                     decided. read = GET only, write = everything but money,
                     money = all of it. No key ever touches /api-keys.
    admin-routes.mjs the admin HTTP surface (cookie session or bearer key, not
                     initData). One dispatcher applies keyDenial, so a route
                     added tomorrow is scoped today.
    mcp.mjs          POST /api/mcp — the same admin API spoken to an AI agent, over
                     MCP Streamable HTTP (single JSON response, no SSE, no
                     sessions). Two tools: `admin_endpoints` hands over the
                     route table + campaign doc schema, `admin_call` issues one
                     request — re-entering handleAdmin() in-process, so auth,
                     scope and validation run in the place they already live.
                     Keys are minted in the dashboard's Settings page.
    series.mjs       the dashboard's three charts (subscription / broker /
                     referral), replayed live from ledger + review_queue +
                     users into dense per-day rows, then rolled up per grain
                     (stocks last-day, flows summed, ratios recomputed).
                     Nothing stored; `node server/series.mjs` self-checks.
    campaigns.mjs    campaign JSON doc → the rules the engine actually fires on.
                     Fires once per occurrence of the trigger per user; "Send
                     Limit" caps that per user, "Usage Limit" caps redemptions
                     per user. Env seams for the e2e test: TF_TELEGRAM_API
                     (Bot API base) and TF_JOBS_INTERVAL_MS (tick period).
    jobs.mjs         one interval: expiry, lapsing, reminders, campaigns, backup.
    telegram.mjs     the Bot API calls used + the one getUpdates loop: VIP join
                     gate and `/start <code>` (referral links are t.me/<bot>?start=CODE;
                     Start is where the invitee is created + attributed and gets
                     the Open App button). No-ops without TF_BOT_TOKEN.
    gateways.json    the wallet addresses and confirmation depths. Not in git, and
                     now editable from the dashboard's Wallets page — deploys must
                     never overwrite it.

All timestamps are epoch **milliseconds**. Crypto amounts are decimal **strings**,
never floats — unique-amount matching depends on exact digits.

Two id spaces: `orders.user_id` is the **Telegram** id, `users.id` is the admin's own
key — `tg<telegram id>` only for accounts the Mini App created, so resolve it with
`ledger.userIdForTelegram`, never by string-building. `users.user_no` (from 1) is the
number shown to operators; `users.id` is never displayed.

Every buyer on a network pays the **same** address, so the dithered amount is the
only identity a payment carries. A transfer whose amount matches nothing, arriving
while 2+ orders are live on that wallet, is therefore undecidable — the sender is no
help either, since exchange withdrawals all share one hot wallet. Those land in
`unmatched_txs` and an admin attributes them from Money → Unmatched. Per-order deposit
addresses are the real fix; this queue is the stopgap until then.

An order priced against the earning balance stores the wallet leg in
`orders.balance_used` and only the on-chain remainder in `amount_usd`. The wallet is
debited when the order **confirms** (`ledger.spendBalance`), so no expiry path owes a
reversal.

## Design review

`design/review/` diffs each built screen against its 1:1 Figma frame in `ref/`:

    npm run dev                                       # must be on the port sweep.sh expects
    sh design/review/sweep.sh [name-filter]           # score every screen
    python3 -m http.server 5300 -d design/review      # side-by-side + comment boxes

`shoot.mjs` captures with `reducedMotion:'reduce'`, so anything animated must
degrade cleanly through `MotionConfig reducedMotion="user"` or the diff drifts.

## Env

`TF_PORT`, `TF_DEV=1` (bypass Telegram auth with a fake user), `TF_BOT_TOKEN`,
`TF_BOT_USERNAME`, `TF_ADMIN_IDS`, `VITE_BASE`, `TF_PUBLIC_URL`. See `.env.example`.

The app and the dashboard are served from **app.trustforex.net** (nginx vhost
`app-trustforex.conf`, HTTP-only behind Cloudflare's TLS). The apex is the
landing page — its own docroot `/var/www/tf-root/landing`, which `npm run
deploy` never touches — and forwards only `?ref=` requests to the app, so
referral links minted before the move still attribute.
