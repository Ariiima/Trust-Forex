# Wiring the admin dashboard to the Mini App

Where things stand, and the order to close the gap. Written 2026-08-03.

## The shape of the problem

The Mini App renders almost entirely from hardcoded TypeScript constants. The
admin dashboard already manages most of the same data in SQLite. Three routes
exist between them today:

| Route | Auth | Feeds |
|---|---|---|
| `GET /api/promos?section=…` | none | promo carousel (home / cashback / referral) |
| `GET /api/me/flags` | Telegram initData | once-only intro screens |
| `POST /api/me/flags/:flag` | Telegram initData | ditto |

Everything else on screen is a constant. `src/api/client.ts` also defines
`getGateways` / `createOrder` / `selectGateway` / `submitOrder` /
`getSubscription` with full mock implementations — **none of them have a server
route, and no mounted screen calls them.** `src/screens/payment/status/` is
scaffolding that `App.tsx` never mounts.

### Two blockers to name up front

**1. There is no link between a Telegram user and an admin user.** The app
keeps `server/data.sqlite` (`orders`, `user_flags`, keyed by Telegram id as
INTEGER); the admin keeps `server/admin.sqlite` (`users`, `brokers`,
`subscribers`, `campaigns`, … keyed by a TEXT id of its own). Nothing joins the
two id spaces. Every per-user feature below is blocked on Phase 0.

**2. Production serves static files only.** `trustforex.net` is nginx over a
built `dist/`; no node process runs there. `/api/*` 404s, which is why the app
is written to fall back to its constants. Nothing in Phase 1 onward is visible
in production until `server/index.mjs` is deployed and proxied.

### The pattern to follow

`PromoCarousel` is the reference implementation and every step below copies it:

- static constant renders **immediately**, so the screen is never empty;
- the fetch swaps real data in when it lands;
- failure is not an error state — it falls back to the constant;
- the result is cached module-level (`cachedPromos` / `cachedFlags`) so a tab
  switch doesn't re-fetch and re-swap.

Keep the constants. They are the offline story, not debt to delete.

---

## Phase 0 — identity bridge

Blocks all per-user work. Small.

1. `ALTER TABLE users ADD COLUMN telegram_id INTEGER` + unique index, applied
   guarded (the schema uses `CREATE TABLE IF NOT EXISTS`, so this needs a
   `PRAGMA table_info` check or a `try/catch`).
2. `store.userByTelegramId(id)` and `store.ensureUser({ id, first_name, … })` —
   upsert on first authenticated request, taking the display name from
   `initData`'s `user` object.
3. `me(req)` helper in `server/index.mjs`: `userIdFrom(req)` → `ensureUser` →
   the admin user row, or 401.

Deliberately *not* merging the two SQLite files. One column and an upsert is a
smaller change than reconciling two schemas, and the payment DB has a different
write pattern (the watcher) that is better left alone.

---

## Phase 1 — global content (no identity needed, ships independently)

| # | What | Server | Replaces |
|---|---|---|---|
| 1.1 | Broker catalogue + spec sheets | `GET /api/brokers`, `GET /api/brokers/:id` from `store.brokers()` + `store.preview(id)` | `BROKER_INFO`, `XM_SPECS`, `BrokerDetail`'s hardcoded XM binding and `REFERRAL_CODE` |
| 1.2 | Signal performance | `GET /api/signals` from `store.signals()` + `store.series('signal-spark', …)` | Home's `TP_TABS` stats (80 / 50 / 62.0%) and the traced `CHART_LINE` |
| 1.3 | Plan catalogue | **new admin section + table**, then `GET /api/plans` | `PLANS`, `FEATURE_LABELS` |

**1.1** is the best value per unit of work — `store.preview(id)` already returns
`details: { regulation, platform, accountTypes, leverage, depositBonus, spread,
cashbackLevel, execution }`, a field-for-field match for `XM_SPECS`, plus
`logoUrl`, `name`, `badgeText`, `createAccountLink`, `goToBrokerLink`. The one
gap: the `brokers` table has no logo column, so the list view should take
`logoUrl` off the preview doc or gain a column.

**1.3** is the only item here with no admin counterpart at all — `PlanId`
(`silver`/`gold`/`diamond`) exists solely as a tag on users and campaigns, never
as an editable price/duration/boost record. Needs a real CRUD section.

**Not recommended:** admin CRUD for `WITHDRAW_OPTIONS`, `CURRENCIES`,
`NETWORKS`. They are protocol facts (TRC-20 exists; its network fee changes
rarely) and an admin screen for them is more surface than the problem deserves.
Leave them as constants until someone actually needs to change one without a
deploy.

---

## Phase 2 — per-user reads (needs Phase 0)

| # | What | Server | Replaces |
|---|---|---|---|
| 2.1 | Subscription state | `GET /api/me/subscription` from `store.subscribers()` | Home's `initialSubscription` prop, `days={22}`, "Silver / 1 Month", "Expires on Aug 24,2026" |
| 2.2 | Cashback overview | `GET /api/me/cashback` from `user_summary` | `OVERVIEW` (the permanent `$0.00`) |
| 2.3 | Per-broker card state | same route from `review_queue` + `rebates` | `BROKERS` card states, banners, `totalEarned` |
| 2.4 | Referrals list | `GET /api/me/referrals` | `REFERRALS` |
| 2.5 | Earnings summary | `GET /api/me/earnings` | `EarningMain`'s default props (245 / 360 / 288 / 72 — `App.tsx` passes none, so those defaults are what ship) |
| 2.6 | Earnings chart series | `GET /api/me/earnings-series` | `makeSeries()` / `pinTo()`, currently synthetic from a fixed seed |
| 2.7 | Cashback history rows | **new per-user table**, then `GET /api/me/cashback/history` | `HISTORY_ROWS` |

**2.1** is the cheapest: `subscribers` already has `plan`, `daysLeft`, `status`,
`purchasedAt` — exactly the hero's fields — and `getSubscription()` is already
written client-side and unused.

**2.7** needs new storage. The admin's `cashback_cycles` holds per-cycle
aggregates (gross/shared/net), not the per-user per-broker line items the sheet
lists. Same for **2.3**'s notion of "this user's connection state per broker",
which no admin table models as one object.

---

## Phase 3 — per-user writes (the money paths)

| # | What | Notes |
|---|---|---|
| 3.1 | Orders / crypto gateway | The client functions and `data.sqlite`'s `orders` table + `server/watcher.mjs` all exist; `server/index.mjs` has no routes on top of them. `Checkout`'s "Review order" just navigates — no order is ever created. Wire `design/CONTRACT.md`'s routes, then mount the `payment/status/` scaffolding. |
| 3.2 | Withdrawal requests | No admin table exists at all. Needs a `withdrawals` table, an admin review section, and the Mini App submit route. `WITHDRAW_HISTORY` is pure mock. |
| 3.3 | Broker account linking | `review_queue` already models the admin side (it stores `email`, `broker_account_id` per user). The Mini App has no submit route — `BrokerDetail` hardcodes both values. Closes the loop on 2.3. |

---

## Suggested order

Phase 0 → 1.1 → 2.1 → 2.2/2.3 → 1.2 → 2.4/2.5 → 3.1 → the rest.

Rationale: Phase 0 unblocks everything and is an afternoon. 1.1 and 2.1 are the
two places where admin data already matches the app's shape exactly, so they are
mostly plumbing. 3.1 is the largest and the only one that can lose money if it
is wrong, so it wants the most settled foundation under it.

## Cross-cutting, do once

- **Deploy the API.** Nothing above is visible on `trustforex.net` until
  `server/index.mjs` runs there behind nginx. Currently the only reason the app
  works is that every fetch failure falls back to a constant.
- **Rotate the bot token** before `userIdFrom` guards anything real — without
  `TF_BOT_TOKEN`, initData validation cannot succeed and every per-user route
  401s outside dev.
- **One cache helper.** Three copies of the `cachedX` / `getX` pattern is the
  point at which it should become one small function rather than a fourth copy.
