# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Trust Forex has two distinct audiences and two separate front ends in one repo.

**The Telegram Mini App** (`src/screens`, `index.html`) serves retail traders —
customers who subscribe to a plan, register with a broker to earn cashback, and
refer other traders. Phone-sized, Telegram WebView, 24 screens, already shipped.

**The admin dashboard** (`src/admin`, `admin.html`) — the subject of current
work — serves a small internal ops team of roughly 1–5 staff, in the product
every day. They know it deeply and move fast: they are running the weekly
cashback cycle, reviewing broker registrations, drafting and publishing rebate
payouts, managing referral and marketing campaigns, and recording trading-signal
results. Desktop only, in an office, on large monitors.

## Product Purpose

Trust Forex sits between retail traders and forex brokers. Brokers pay it a
rebate on the volume its users trade; it pays a share of that rebate back to the
user as cashback, and keeps the difference. It also sells subscription plans
(Silver / Gold / Diamond), runs a referral programme where users earn a share of
what their invitees generate, and publishes trading signals.

The admin dashboard exists so that money can be measured, drafted, checked and
released. Success is that an operator can see where every figure came from and
publish a payout run without hesitating.

## Positioning

The mechanism a neighbouring product could not truthfully copy: the rebate split
is per-broker and the payout is a two-stage instrument. Nothing pays out
directly — an operator enters a broker's last-week rebate per user, the broker's
own `share_rate` derives what that user is owed, the row is committed to a draft
ledger, and only an explicit publish releases the run. Draft and published are
different states of the same money.

## Operating Context

- **The weekly cashback cycle** is the heartbeat. A cycle has a gross rebate, a
  shared cashback, a net revenue and a cashback-user count, and is published on
  a date.
- **Broker registration review** is a queue with real consequences: approving a
  request changes that user's account status, in the same transaction.
- Six working areas: Users, Brokers, Subscription, Referral, Campaigns, Signals.
- The source of record for what the dashboard must contain is 30 design frames
  in `admin panel/`, extracted and specified in `design/ADMIN.md`.

## Capabilities and Constraints

- React 19 + TypeScript + Vite. Two entries: the Mini App and `admin.html`, so
  Telegram users never download the admin bundle.
- `recharts` for charts; no other UI dependency.
- Backend is plain `node:http` + `node:sqlite` (`server/admin.mjs`,
  `server/admin-routes.mjs`), session-cookie auth with scrypt, seeded by
  `npm run admin:seed`.
- Chart data is stored per dataset, per dimension, per day; all rollups happen
  server-side because stocks, flows and rates aggregate by different rules.
- **Undecided:** roles and permissions. There is one admin role today. Partner
  or broker-side accounts are not a current requirement.
- **Undecided:** production deployment of the admin app. It runs locally; the
  server has no admin account seeded yet.

## Brand Commitments

- The company name is **Trust Forex**.
- The Telegram Mini App's identity (Sora, `#144CCD`, the token set in
  `src/design-system/tokens.css`) is binding **on the Mini App only**.
- The admin dashboard's visual identity is explicitly **free**: it is seen by
  staff and never by customers, and may commit to its own palette, typeface and
  material language, provided it still reads as the same company's tool.

## Evidence on Hand

- 30 source design frames in `admin panel/` (the user's own material).
- A working seeded database: 20 users, 8 brokers, 12 subscribers, 6 referral
  campaigns, 8 marketing campaigns, 10 signal periods, 120 days of daily series
  across 8 brokers / 3 plans / 6 campaigns.
- All figures in the running app are **synthetic seed data**, not real customer
  or financial records. Nothing in it may be presented as a real payout,
  customer, or benchmark.
- No real broker contracts, rebate rates, or user records exist in this repo.

## Product Principles

1. **Every number is derived, or it is not shown.** Counts that a table already
   owns are computed from that table, never stored alongside it.
2. **Draft before release.** Money-moving actions are staged, visible, and
   reversible until an explicit publish.
3. **A control that does nothing is worse than a control that is absent.**
4. **State changes cascade honestly.** If a decision changes an account, both
   places that show it move together.
5. **Density is a feature.** These operators want the whole picture at once;
   this is not a surface to simplify by hiding.

## Accessibility & Inclusion

No product-specific standard was established. Baseline: visible keyboard focus
on every control, colour never the sole carrier of state, and text contrast at
or above 4.5:1 — the operators use this all day on large monitors.
