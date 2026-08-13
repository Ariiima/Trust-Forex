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
    node --test server/*.test.mjs             # payment / payouts / telegram
    node server/ledger.mjs                    # the money rules' own self-check
    node --experimental-strip-types <f>.check.ts   # results-math, signal-buckets
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
    admin/                     the dashboard SPA (admin.html entry), sections/ = one per page
    index.css                  #root is the scroller, not body. `is-typing` on <body>
                               hides the nav bar and sticky CTAs while a field has focus.

## Server map — `server/` (plain node:http + node:sqlite, no framework)

    index.mjs        route dispatcher + Telegram initData auth. Starts payouts,
                     watcher, join gate and jobs at the bottom of the file.
    sqlite.mjs       one connection, one file, for everything. DB_PATH lives here.
    db.mjs           orders + user_flags. PAYMENT_SCHEMA, rowToOrder (snake→camel).
    orders.mjs       /api/orders*: pricing, unique-amount dithering, gateway select.
    watcher.mjs      polls chains every 20s, matches by exact base-unit amount,
                     promotes to confirmed. chains/{evm,btc,sol,tron}.mjs do the RPC.
    notify.mjs       what runs the moment a payment confirms (credit, message, refund).
    ledger.mjs       the money spine — balances, tiers (TIER_PCT), plan days.
    payouts.mjs      withdrawals leaving: reserve → send → confirm, with caps.
    admin.mjs        admin schema, auth, users, brokers, signals, campaigns store.
    admin-routes.mjs the admin HTTP surface (cookie session, not initData).
    campaigns.mjs    campaign JSON doc → the rules the engine actually fires on.
    jobs.mjs         one interval: expiry, lapsing, reminders, campaigns, backup.
    telegram.mjs     the four Bot API calls used. No-ops without TF_BOT_TOKEN.
    gateways.json    the wallet addresses and confirmation depths. Not in git.

All timestamps are epoch **milliseconds**. Crypto amounts are decimal **strings**,
never floats — unique-amount matching depends on exact digits.

Two id spaces: `orders.user_id` is the **Telegram** id, `users.id` is the admin's own
key — `tg<telegram id>` only for accounts the Mini App created, so resolve it with
`ledger.userIdForTelegram`, never by string-building. `users.user_no` (from 1) is the
number shown to operators; `users.id` is never displayed.

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
`TF_BOT_USERNAME`, `TF_ADMIN_IDS`, `VITE_BASE`. See `.env.example`.
