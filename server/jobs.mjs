/**
 * The background tick. One interval, everything time-driven hangs off it:
 * booking confirmed payments, lapsing subscriptions, firing campaigns, and
 * taking a backup.
 *
 * ponytail: setInterval, not cron. Every step is idempotent and keyed, so a
 * missed tick catches up on the next one and a double tick changes nothing —
 * which is what makes a scheduler unnecessary here.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { sendMessage, removeFromGroup, sendPhoto, appButton } from './telegram.mjs';
// Pure data + a pure function only — no db.mjs, no openAdminDb() call at the
// top of admin.mjs — so importing this never opens a connection. That matters:
// this module's own runnable self-check at the bottom is `node server/jobs.mjs`
// with no db file around, and it must keep working exactly that way.
import { MESSAGE_TEMPLATES, renderTemplate } from './admin.mjs';
import { fmtDay } from './tz.mjs';

const HOUR_MS = 3_600_000;

const DEFAULT_TPL = Object.fromEntries(MESSAGE_TEMPLATES.map((t) => [t.key, t.body]));
/** The admin's edited copy for `key`, or the shipped default when `templates`
 *  (admin.messageTemplate) wasn't supplied — the tests' path. */
const tpl = (templates, key) => templates?.(key) ?? DEFAULT_TPL[key];

const money = (n) => `$${Number(n).toFixed(2)}`;

/** A campaign's {code} token wins over the append-at-end fallback, so the
 * admin can place the discount code mid-sentence; campaigns written before
 * this token existed have no {code} and keep sending exactly as they did. */
export function composeCampaignBody(message, code, includeCode) {
  if (!message) return null;
  if (code && message.includes('{code}')) return message.replaceAll('{code}', `<code>${code}</code>`);
  return includeCode !== false && code ? `${message}\n\nYour code: <code>${code}</code>` : message;
}

export function startJobs({ db, ledger, campaigns, dbPath, templates, intervalMs = HOUR_MS }) {
  let lastBackupDay = '';
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    const now = Date.now();
    try {
      // 1. Confirmed payments become subscriptions, revenue and referral shares.
      const booked = ledger.reconcileOrders(now, (code, userId, orderId) =>
        campaigns.redeem(code, userId, orderId, now));

      // 2. Lapse the due ones, tell them, and take the group seat back.
      const expired = ledger.expireDue(now);
      for (const s of expired) {
        if (!s.telegram_id) continue;
        await sendMessage(s.telegram_id,
          renderTemplate(tpl(templates, 'subscription_lapsed'), { plan: s.plan }), appButton());
        await removeFromGroup(s.telegram_id);
      }

      // 3. Campaigns: match, mint codes, deliver.
      campaigns.evaluate(now);
      for (const send of campaigns.pendingDeliveries()) {
        const c = send.campaign ?? {};
        const body = composeCampaignBody(c.message, send.code, c.includeCode);
        if (send.telegramId && body) {
          /* The "Open App" button is how the open rate exists at all: its
             `startapp=c_<id>` is what recordCampaignOpen counts. No bot
             username configured -> plain message, opens simply go unmeasured. */
          const extra = appButton(`c_${send.campaignId}`);
          const res = c.messageImage
            ? await sendPhoto(send.telegramId, c.messageImage, body, extra)
            : await sendMessage(send.telegramId, body, extra);
          // A campaign with no bot configured still counts as delivered — the
          // in-app card is the other half of the send and it is already live.
          if (!res.ok && res.reason !== 'no_token') continue;
        }
        campaigns.markDelivered(send.campaignId, send.userId);
      }

      // 4. One backup a day. This file is the only copy of every balance.
      const day = fmtDay(now);
      if (dbPath && day !== lastBackupDay) {
        lastBackupDay = day;
        const dir = join(dirname(dbPath), 'backups');
        mkdirSync(dir, { recursive: true });
        const file = join(dir, `trustforex-${day}.sqlite`);
        // VACUUM INTO refuses to overwrite, and a restart re-runs this step.
        if (!existsSync(file)) db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
      }

      if (booked || expired.length) {
        console.log(`[jobs] booked ${booked} order(s), expired ${expired.length}`);
      }
    } catch (err) {
      console.error('[jobs]', err);
    } finally {
      running = false;
    }
  }

  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  return { tick, stop: () => clearInterval(timer) };
}

export { money };

// node --experimental-strip-types server/jobs.mjs (plain node works too, no types here)
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  console.assert(composeCampaignBody('Hi! Use {code} today.', 'ABCD', true) === 'Hi! Use <code>ABCD</code> today.',
    '{code} token substitutes in place');
  console.assert(composeCampaignBody('Hi!', 'ABCD', true) === 'Hi!\n\nYour code: <code>ABCD</code>',
    'no token + includeCode falls back to append');
  console.assert(composeCampaignBody('Hi!', 'ABCD', false) === 'Hi!',
    'includeCode:false sends the message untouched');
  console.assert(composeCampaignBody('Hi!', null, true) === 'Hi!',
    'no code minted (e.g. codes exhausted) sends the message untouched');
  console.assert(composeCampaignBody('', 'ABCD', true) === null, 'empty message never sends');
  console.log('jobs.mjs: composeCampaignBody ok');
}
