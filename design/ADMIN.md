# Trust Forex — Admin Dashboard

Extracted from the 30 frames in `admin panel/`. Source frames are grouped by
filename suffix; each group is one section of the product.

| Files | Section |
|---|---|
| `1.png`–`5.png` | User detail + activity log (6 tabs) |
| `1 (2)`–`5 (2)` | Brokers: grid, sort modal, charts, cashback cycles, review queue |
| `1 (3)`–`3 (3)` | Subscription: analysis, subscribers, extra-day grants |
| `1 (4)`–`3 (4)` | Referral: growth, campaigns, campaign builder |
| `1 (5)`–`3 (5)` | Signals: result history, add-result modal |
| `c1`–`c3` | Marketing campaigns: list + 2-step builder |
| `p1`–`p4` | Per-broker user management |
| `p1 (2)`–`p4 (2)` | Subscription dashboard variants + event modals |

---

## 1. Functional extraction

### 1.1 Users
**All users** (`p1`) — counts strip (all 5,300 / active 3,000 / pending 2,000 /
rejected 30), search by name/email/broker ID, table: `# · user (plan glyph +
name + id) · email/broker ID · status (inline dropdown: Active/Pending/Rejected)
· last action · total rebate ⇅ · last month rebate ⇅`.

**User detail** (`1`–`5`) — three summary cards:
- Profile: plan glyph, name, id, joined at, last activity at
- Cashback: total cashback net (our monthly net) / total cashback sale (paid to user)
- Referral: invited users, active users, plan $, cashback $, referral revenue, referral earnings

Activity log below, tabs `All · Subscription · Cashback · Referral · Wallet ·
Campaign`, table `Time · Activity · Category · Amount`. Amount is signed and
colour-coded (green +, red −, `—` for non-financial rows).

### 1.2 Brokers
Top tabs: `All Brokers · Cashback Cycle · Broker Charts · Unreviewed Users`.

**All brokers** (`1 (2)`) — card grid, each card: rank (or `-` when unranked),
logo, name, status chip (Public / Private / Stopped), active users, pending
users, drafted payment, unreviewed-requests badge, last updated. Search,
`Sort brokers`, `Add broker`. Sticky footer bar: total rebate amount, drafted
payment, total brokers, `Publish all`.

**Sort brokers modal** (`2 (2)`) — drag-reorder rows, per-row status select,
Cancel / Save changes. Rank only applies to Public brokers.

**Broker charts** (`3 (2)`) — 6 toggleable series (active users, pending users,
cashback users, gross rebate USD, shared cashback USD, net revenue USD), dual
Y axis (Users left / USD right), broker multi-select with search + Clear/Apply,
granularity select, brush strip, hover tooltip. Right rail: Events and notes +
`Add event`.

**Cashback cycle** (`4 (2)`) — table `# · cycle (name + date range) · gross
rebate · shared cashback · net revenue · cashback users · published at`.

**Unreviewed users** (`5 (2)`) — *Users under review*: `# · user · broker ·
requested at · email/broker ID · last status · actions [Approve][Waiting for
deposit][Reject]`. *Recent users*: broker + status filters, row kebab menu.

**Per-broker management** (`p1`–`p4`) — broker identity chip top-right, tabs
`All Users · Active Users · Manage User Flow`.
- *Active users* (`p2`): rebate drafting. Editable "last week rebate" input per
  row → computed shared rebate → `Add to Draft`. Draft Rebate List below with
  inline edit, delete, and a running total.
- *Manage user flow → Status Message* (`p3`): four states (Rejected from no
  account, Waiting for deposit, Rejected deposit, Approved) each with a rich-text
  message editor, Edit / Cancel / Save.
- *Manage user flow → Broker Preview* (`p4`, `p4 (2)`): broker information
  (name, logo + replace, status, optional badge toggle + text + colour),
  links & referral (create-account link, go-to-broker link, optional referral
  code), broker details (regulation, platform, account types, leverage, deposit
  bonus, spread level, cashback level, execution speed), required user
  information (email / user ID checkboxes), Cancel / Save changes.

### 1.3 Subscription
Top actions: `Subscription analysis · View subscribers · Add extra subscription`.

**Analysis** (`1 (3)`, `p1 (2)`, `p2 (2)`) — series: total subscribers, renewals,
renewal rate %, reactivations, reactivation rate %, net revenue USD (a second
variant adds ARPPU and churn rate). Plan filter glyphs (Silver/Gold/Diamond),
granularity (Daily/Weekly), date-range picker, triple axis (Users / Rate % /
USD), brush, tooltip. Events-and-notes rail with:
- *Add event modal*: title (≤30), description, icon picker (5 icons), date
- *Event detail modal*: description + Edit / Delete

**View subscribers** (`2 (3)`) — segment chips (All 124 / Active 86 / Expired 38),
plan checkboxes with counts, table `# · user · last action ⇅ · days left ⇅ ·
total paid ⇅ · status`. Paginated variant: 10-per-page select, page numbers,
"Showing 1 to 10 of 124 entries".

**Add extra subscription** (`3 (3)`, `p3 (2)`) — *Recent extra-day subscriptions*
table `# · added at · extra days · eligible before · affected subscriptions`, and
a modal: extra days, "purchased before" datetime, Telegram message rich-text with
emoji picker, "Notify users" toggle, Cancel / Confirm.

### 1.4 Referral
Tabs: `Referral Overview · Referral Campaign Overview`.

**Overview** (`1 (4)`) — Referral Growth chart: introduced users, invited users,
active users, plan %, cashback %, revenue, revenue shared, revenue net; campaign
multi-select (All referrals + per campaign) with Clear/Apply; Cycle granularity;
brush; tooltip. *All Referrals* table: `id · user · invited users · plan (n + %)
· cashback (n + %) · revenue · revenue shared · revenue net`, sortable.

**Campaign overview** (`2 (4)`) — table with grouped headers (Referral Activity:
invited / plan / cashback · Revenue Activity: revenue / shared / net · Share
Percentage: plan / cashback), status chip (Active/Paused/Ended), link code.
Right panel: campaign links (website + Telegram bot, each with Copy), end date,
Edit / Pause / Stop.

**Create campaign** (`3 (4)`) — name, referral code (optional select), plan
revenue share %, cashback revenue share %, end date; *Broker Display* table
(drag order, badge on/off, badge text, badge colour, remove); *Excluded Brokers*
list (status chip, Hide, Add broker to exclude); Publish.

### 1.5 Marketing campaigns
**All campaigns** (`c1`) — custom-list chips (New List, All Campaign 128, and
saved lists with counts), table `# · campaign name · audience (icon cluster) ·
message sent (n + %) · app sent · code sent · start · end · created · actions`.
Right panel: 3 stat tiles, campaign information, audience summary, timing
trigger, limit, offering discount (value + applicable plans), Start / Stop /
Edit / Delete.

**Create — step 1** (`c2`): campaign info (name, start, end); audience
restriction (All Users | Referral Campaign List | Broker List); user type matrix
— Subscribers (no / active / expired + Silver/Gold/Diamond), Brokers (no /
pending / active), Referrals (no / pending / active); timing trigger (10 options:
after start robot, after subscription started, after subscription expired,
remaining subscription, after pending broker, no cashback received, after pending
referral, last referral joined, after active referral, last active referral) with
N + unit; expiry period N + unit; Next.

**Create — step 2** (`c3`): offer/discount (enable, unique vs public code, public
code, applicable plans, discount value %); message to user (include discount
code, rich text ≤1024, image upload); in-app card content (show discount code,
title ≤60, description ≤120, image, CTA enable + destination); display location
(subscription / referral / cashback sections); resend/usage/expiry (no limit |
send limit | usage limit, each with a per-user select); Publish Campaign.

### 1.6 Signals
**Result history** (`1 (5)`) — table `# · period (name + range) · total signals ·
SL (n + %) · TP1–TP4 (n + %) · status (Draft/Published) · published at · edit /
delete`.

**Add result modal** (`2 (5)`, `3 (5)`) — period select with a week-picker
calendar; tally buttons TP1–TP4 + SL; Recent list with Undo last and per-entry
delete; Current Batch Summary (counts + computed %); Clear all / Save draft / Publish.

**Right rail** — *Signal performance*: TP1–TP4 tabs with RR ratios, last-4-weeks
overview (total signals, TP1 reached, TP1 hit rate), area sparkline + tooltip,
Weekly/Monthly/Yearly toggle. *Overall results*: TP1–TP4 win rate rows (`x / y`
+ %).

---

## 2. Design system

The frames use four different tab styles, three fonts, two blues and two badge
treatments. Normalising onto the mini app's existing tokens
(`src/design-system/tokens.css`) — same brand, one source of truth.

### 2.0 The world: a precision instrument for money

A deep ink command rail (`--admin-rail` `#0E1A33`, tinted from the brand blue
rather than black) holds the constants; the work happens on cool paper beside
it. That second neutral is what separates this from a default admin template —
the rail is the app, the paper is the data.

Four decisions carry the identity, and each is also a correctness fix:

| Decision | Why it is not decoration |
|---|---|
| **Tabular figures everywhere** (`font-variant-numeric: tabular-nums`) | Sora's proportional digits meant money columns did not align on the decimal and shimmered as values changed. The single most visible craft failure in a financial dashboard. |
| **Tight radii** — 6px controls, 10px panels, 4px chips | 12px on a dense grid of controls reads as a toy. |
| **Real depth** — offset + blur, tinted with the rail navy | The old `0 1px 2px rgba(…,.04)` was invisible, so cards had no elevation and every surface sat on one plane. |
| **Reserved accent** — blue only for primary action, current selection, live state | Blue was previously on tabs, chips, links and numbers at once, so nothing read as primary. |

Supporting: uppercase 12px table headers with letter-spacing (structure without
weight), sort carets that appear only on hover or when active (a header row of
eight arrows competes with the data), one `:focus-visible` ring for the whole
surface, and skeleton rows so a loading table never renders the empty state's
claim that there is nothing there.

### 2.0.1 Motion

Motion serves state; there is no page-load choreography. 120ms on a press,
180ms on a state change, 320ms on an overlay, exits faster than entrances,
`cubic-bezier(0.16, 1, 0.3, 1)` for arrivals. Everything collapses under
`prefers-reduced-motion`.

**The one authored moment is the rebate handoff** — the only place in this
product where money actually moves. A figure is typed, the broker's share
resolves, the row arrives in the draft ledger from above and settles, and the
payable total shifts by exactly its delta. The delta is news for two seconds
and then it is just the total; it never counts up from zero, because only the
change is information (see [[trust-forex-animate-only-what-changed]]).

### 2.1 Inconsistencies resolved
| Seen in frames | Resolution |
|---|---|
| Boxed-pill tabs, underline tabs, filled-blue tabs, outline-pill tabs | One `Tabs` component, boxed-pill (the majority style) |
| Sora vs Inter vs system font | Sora everywhere (already loaded) |
| `#144CCD`, `#1652F0`, `#0B5CFF` blue | `--primary-colors-900` `#144CCD` |
| Outline chips vs soft-filled chips | Soft-filled `StatusChip` |
| Radii 6 / 8 / 10 / 12 px | `--radius-small` (controls), `--radius-medium` (cards) |
| Photo avatars (`p1 (2)`) vs plan-glyph avatars (`p1`) | Plan glyph — no avatar storage needed |
| Mini-app line-heights (16/32) | Compact admin ramp, below |

### 2.2 Added tokens (`src/admin/tokens.css`)
Desktop density on top of the shared palette:

```
--admin-page-bg      #F7F8FA     --admin-row-h        48px
--admin-surface      #FFFFFF     --admin-control-h    36px
--admin-border       #E4E4E4     --admin-sidebar-w    240px
--admin-row-hover    #F7F8FA     --admin-header-h     56px
--admin-pos          #16A34A     (positive money)
--admin-neg          --state-colors-eror
--admin-series-1..8              (chart palette, fixed order)
```

Compact type ramp — `.at-11/16 .at-12/18 .at-13/20 .at-14/20 .at-16/24
.at-20/28 .at-24/32`. The mini-app `.type-*` classes stay untouched.

### 2.3 Components (`src/admin/ui/`)
Shell & layout: `AdminShell` (sidebar + header), `Tabs`, `Card`, `SidePanel`,
`Modal`, `Pagination`.

Data: `DataTable` (column config, sortable headers, sticky header, scroll body,
row hover, action slot, grouped headers for the referral table), `StatCard`,
`StatusChip`, `Money` (sign + colour), `PlanGlyph`, `BrokerLogo`, `EmptyState`.

Controls: `Button` (primary / outline / ghost / success / danger), `TextInput`,
`SearchInput`, `Select`, `NumberStepper`, `DateInput`, `DateRangeInput`,
`WeekPicker`, `Checkbox`, `Radio`, `Toggle`, `ColorSwatch`, `MultiSelect`
(search + checkboxes + Clear/Apply), `DragList`, `RichText` (toolbar +
`contenteditable`, used 3×), `EmojiPicker`, `ImageUpload`.

Charts: `LineChart` (series config, 1–3 Y axes, brush, hover tooltip, legend
toggles), `Sparkline`.

Roughly 30 components; every one of them appears in ≥2 frames.

---

## 3. Implementation plan

### Phase 0 — scaffold
- `admin.html` as a second Vite entry (`rollupOptions.input`), so the Telegram
  bundle never ships admin code. Builds to `dist/admin.html`.
- `src/admin/main.tsx`, `AdminApp.tsx`, `HashRouter` (no server rewrite rules).
- `src/admin/tokens.css`, sidebar shell with the 6 sections.
- `src/admin/data/` — typed fixtures per section, read through
  `src/admin/api.ts`. Every screen is built against that one module, so wiring
  real endpoints later is a per-function swap, not a rewrite.

### Phase 1 — design system
Build the component list in 2.3 against a `/ui` kitchen-sink route.

### Phase 2–7 — sections, in this order
2. Users — list, detail, activity log (simplest; validates `DataTable`)
3. Brokers — grid, sort modal, cycles, review queue, per-broker management (largest)
4. Subscription — analysis, subscribers, extra-day grants, event modals
5. Referral — growth, campaign table, campaign builder
6. Marketing campaigns — list + 2-step builder
7. Signals — history, add-result modal, performance rail

### Phase 8 — API + auth ✅

`server/admin.mjs` (schema, store, auth) + `server/admin-routes.mjs` (routes),
mounted ahead of the Mini App dispatcher in `server/index.mjs`. Plain
`node:sqlite` and `node:http` — no framework.

**Speed.** Every statement is prepared once at open; the router is a flat array
matched with one regex `test` per entry; reads are synchronous SQLite against a
local file with `journal_mode=WAL` and `synchronous=NORMAL`. Indices cover the
columns that are actually filtered (`users.status`, `activity(user_id, category)`,
`subscribers(status, plan)`, `review_queue.broker_id`). Measured ~4.5 ms
end-to-end for a full user-list read. Document-shaped records (broker preview,
campaign definitions, chart series) are stored as JSON columns — nothing filters
on their internals, so a column per field would only buy migrations.

**Auth.** `admins` (scrypt, per-row salt, `timingSafeEqual`) and
`admin_sessions` (opaque 32-byte token, 12 h TTL, swept on login). The token
rides in an HttpOnly + SameSite=Lax + Secure cookie. `/api/admin/login` is the
only route reachable without a session; a miss still runs the hash so the
endpoint cannot be used to enumerate usernames, and the client message never
says which half was wrong. There is no dev bypass. Any 401 anywhere in the app
drops the shell straight back to the login screen.

**Endpoints** — `/api/admin` + `login · logout · session · users[/counts,/:id]
· brokers[/order, /:id/preview, /:id/flow-messages, /:id/rebates,
/:id/rebate-drafts] · cashback-cycles · review-queue · subscribers ·
extra-grants · events · referrals · referral-campaigns · campaign-lists ·
campaigns · signals · series/:name`.

Writes are validated at the boundary (status enums, non-negative amounts,
required names, a 4 MB body cap) and the reorder runs in one transaction —
a partial reorder would leave duplicate ranks.

Screens mutate optimistically and roll back on failure, so the UI never shows
a state the server rejected.

**Setup**

```
TF_ADMIN_USER=admin TF_ADMIN_PASS='<12+ chars>' npm run admin:seed
TF_DEV=1 npm run server      # TF_DEV only relaxes the cookie's Secure flag
npm run dev                  # /admin.html, proxied to the API
```

`npm run admin:seed` is idempotent (`INSERT OR REPLACE` on natural ids) and
never drops a table. Re-run it with just `TF_ADMIN_USER`/`TF_ADMIN_PASS` to add
or rotate an admin.

### Dependency
One addition: **recharts**. The charts need multi-series, 2–3 Y axes, a brush
range selector and hover tooltips; hand-rolled SVG for that is several hundred
lines with worse edge cases. Everything else uses the stdlib/platform
(`<input type="date">`, `contenteditable`, HTML5 drag events, `Intl.NumberFormat`,
`node:sqlite`, `node:crypto`).

## 4. What the frames left implicit

The frames are static, so several controls had no defined behaviour. These were
resolved rather than left as decoration — a control that does nothing is worse
than a control that is absent.

**Chart filters are queries, not labels.** Series are stored per dataset, per
dimension, per day (`series(name, dim, day)`); the broker multi-select, the plan
chips, the campaign filter, the granularity select and the date range all become
query params and the server aggregates. That rollup needs three distinct rules,
and using one for all three is how a dashboard quietly lies:

- **stocks** (a level: users on the books) sum across dimensions, take the *last*
  day across time — adding Monday's headcount to Tuesday's would double the users;
- **flows** (an amount accrued: revenue, renewals) sum across both;
- **rates** are never averaged. Percentages are recomputed from their own
  numerator and denominator *after* aggregation, so the denominators
  (`renewalsDue`, `lapsed`, `invited`) are stored alongside the counts.

Leading and trailing partial buckets are dropped: a week holding two days of
revenue is not a low week, and plotting it reads as a crash.

**Numbers are derived where a table already owns them.** `draftedPayment` and
`unreviewed` are counted from `rebate_drafts` and `review_queue` rather than
stored, so a broker card cannot disagree with the tables it summarises. The
rebate overview bar sums the real rows; it previously multiplied headcount by an
invented constant.

**A decision is an account change.** Approving a review request writes the queue
row and the user's status in one transaction, so the two tables on that page can
never disagree.

**Other resolutions.** `purchased_at` on a subscriber is what an extra-day
grant's "purchased before" is actually measured against. Users carry the broker
they registered with — the Recent-users column previously derived it from the
row index.

**The cashback split is the user's tier**, not a per-broker `share_rate` (which
this document previously asserted). The figure an admin types in is what the
broker paid *us* for that account — already net of the broker's own cut — so
applying a second broker rate to it would take the same margin twice. The
column survives as broker metadata; nothing pays off it.

### Deferred
- Real-time updates (polling/websockets) — nothing in the frames requires it
- Role/permission levels — one admin role until asked
- Pagination on the wire: lists are returned whole. Fine at thousands of rows;
  add `?limit/offset` when a table passes ~10k.
- CSV export, audit log of admin actions, i18n — not in the frames

---

## 5. The engine (2026-08-04)

The frames describe a dashboard; the walkthrough describes a business. These
four modules are the difference — everything above was a view over numbers that
only `seed.mjs` ever wrote.

### 5.1 `server/ledger.mjs` — the money spine

One append-only table. Every balance, tier, payout and revenue figure derives
from it; nothing that moves money is stored as a running total, because a total
and its own history can disagree and only one of them is right.

Rows are signed from the user's side (`amount` credits them, `revenue` is our
gross) and carry a UNIQUE `key`. Publishing a week twice, or reconciling the
same confirmed order twice, is a no-op instead of a double payment.

**The three rules it enforces**

| Rule | Consequence in code |
|---|---|
| Tier is 10 / 15 / 20 / 30% by live subscription | `tierOf()` reads `expires_at` against the clock, never a stored `plan` column. An expired Diamond is `none` that same moment. |
| Cashback splits on the tier | `addDraft` computes `gross × TIER_PCT[tier]`; the tier is frozen onto the published row so a later expiry cannot rewrite what was paid. |
| Referral pays off OUR net | `payReferral` takes `revenue - amount`. Off the gross, a Diamond inviting a Diamond would hand out 60% of a trade. A campaign link overrides the inviter's tier with the campaign's negotiated share. |

Self-check: `node server/ledger.mjs` — tiers, expiry, the split, the referral
cut, replay safety, overdraw.

### 5.2 `server/campaigns.mjs` — the campaign engine

Turns a builder doc into an audience: audience restriction ∧ state matrix ∧
timing trigger. All ten triggers resolve to an anchor timestamp plus an offset;
"Remaining Subscription" is the one that counts backwards from expiry.

Firing writes `campaign_sends` (PK'd campaign+user, so once each) and mints a
discount code — `unique` binds one code to one account and one use, `public`
shares one row and is never burned.

### 5.3 `server/orders.mjs` + `notify.mjs` — payments

The CONTRACT routes, which had never been written: gateways, order creation,
currency selection, submit, status, `/api/me/subscription`. Rates from
CoinGecko (60s cache, stablecoins pinned, a failed lookup refuses the order),
unique dithered amounts as the watcher's matching key. Discounts are applied
server-side against the code's own record — trusting the client's total would
let anyone post `amountUsd: 1`.

`server/gateways.json` ships with **every address blank**. A network with no
address is filtered out of `/api/gateways` and cannot be selected; a short
currency list beats a payment sent to an address nobody controls.

### 5.4 `server/jobs.mjs` — the tick

Hourly, and once at boot. Books confirmed payments, warns 3 days before expiry,
lapses what is due (message + remove from the Telegram group), fires campaigns,
and takes a daily `VACUUM INTO` backup. Every step is idempotent and keyed, so
a missed tick catches up and a double tick changes nothing — which is what
makes a scheduler unnecessary.

### 5.5 Environment

```
TF_BOT_TOKEN      bot messages, group invites (everything no-ops without it)
TF_BOT_USERNAME   builds the user's t.me/<bot>/app?startapp=<code> referral link
TF_GROUP_ID       the VIP group subscribers join and are removed from
TF_ADMIN_CHAT_ID  where payment receipts go
```

### 5.6 Still open

- `user_summary` / `referral_rows` remain as a read fallback for seeded users
  with no ledger history. Delete both once `seed.mjs` writes ledger rows.
- Withdrawals debit immediately and appear in Money → Withdrawals as a payout
  worklist. There is no approve/reject step; add one if payouts stop being
  same-day.
- The `series` table is still seeded, so the charts are the last screens
  showing numbers the ledger did not produce.
