/**
 * Telegram Bot API, the four calls this product actually makes.
 *
 * Everything no-ops without TF_BOT_TOKEN so the server runs, and the jobs tick,
 * on a laptop with no bot. Failures are logged and swallowed: a campaign send
 * that cannot reach Telegram must not roll back the ledger work beside it.
 */
const API = 'https://api.telegram.org/bot';

const token = () => process.env.TF_BOT_TOKEN ?? '';
/** The VIP group/channel subscribers are added to and removed from. */
const groupId = () => process.env.TF_GROUP_ID ?? '';

async function call(method, params) {
  if (!token()) return { ok: false, reason: 'no_token' };
  try {
    const res = await fetch(`${API}${token()}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
    });
    const body = await res.json();
    if (!body.ok) console.warn(`[telegram] ${method}: ${body.description}`);
    return body;
  } catch (err) {
    console.warn(`[telegram] ${method} failed: ${err.message}`);
    return { ok: false, reason: err.message };
  }
}

/** HTML is what the admin's rich-text editor produces; strip what Telegram rejects. */
const clean = (html) => String(html ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div)>/gi, '\n')
  .replace(/<(?!\/?(b|strong|i|em|u|s|code|pre|a)\b)[^>]*>/gi, '')
  .trim();

export const sendMessage = (chatId, text, extra = {}) =>
  call('sendMessage', { chat_id: chatId, text: clean(text), parse_mode: 'HTML', ...extra });

export const sendPhoto = (chatId, photo, caption, extra = {}) =>
  call('sendPhoto', { chat_id: chatId, photo, caption: clean(caption), parse_mode: 'HTML', ...extra });

/**
 * The "Open App" button every user-facing message carries — pass as `extra`
 * to sendMessage/sendPhoto. `startParam` rides the deep link so a tap can be
 * told apart later ("c_<campaignId>" for a campaign; recordCampaignOpen
 * depends on that exact shape); anything else just opens the app. No-ops
 * (returns {}) without TF_BOT_USERNAME — a message still sends, just bare.
 */
export function appButton(startParam = 'app') {
  const bot = process.env.TF_BOT_USERNAME;
  if (!bot) return {};
  return { reply_markup: { inline_keyboard: [[{
    text: 'Open App', url: `https://t.me/${bot}/app?startapp=${startParam}`,
  }]] } };
}

/**
 * A personal invite to the VIP group, minted per buyer after purchase. The
 * link asks Telegram for a *join request* instead of admitting directly, and
 * the buyer's Telegram id rides in the link's `name` — Telegram echoes the
 * link object back inside every chat_join_request, so the gate below can match
 * requester to owner without a lookup table. A forwarded link is useless: the
 * request comes from the wrong id and is declined.
 */
export async function groupInvite(expiresAt, tgId) {
  if (!groupId()) return null;
  const res = await call('createChatInviteLink', {
    chat_id: groupId(),
    creates_join_request: true,
    name: `tf:${tgId}`,
    expire_date: Math.floor((expiresAt ?? Date.now() + 86_400_000) / 1000),
  });
  return res.ok ? res.result.invite_link : null;
}

/**
 * Judge one chat_join_request. Only requests that arrived through our own
 * `tf:<id>` links are judged at all — links an admin made by hand, existing
 * members, folder links and every other route return null and are left for a
 * human. Ours are approved only when the requester IS the link's owner and
 * the subscription is still live (re-checked on every request, so leaving and
 * re-joining after expiry is declined).
 */
export function joinVerdict(jr, isSubscribed) {
  if (String(jr.chat?.id) !== String(groupId())) return null;
  const name = jr.invite_link?.name ?? '';
  if (!name.startsWith('tf:')) return null;
  return name === `tf:${jr.from.id}` && isSubscribed(jr.from.id) ? 'approve' : 'decline';
}

/**
 * The doorman: long-polls Telegram for join requests and applies joinVerdict.
 * ponytail: offset lives in memory — after a restart Telegram redelivers the
 * still-unconfirmed updates and approve/decline are idempotent, so nothing is
 * lost or doubled.
 */
export function startJoinGate(isSubscribed) {
  if (!token() || !groupId()) return;
  let offset = 0;
  (async () => {
    for (;;) {
      const res = await call('getUpdates', {
        offset, timeout: 50, allowed_updates: ['chat_join_request'],
      });
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      for (const u of res.result) {
        offset = u.update_id + 1;
        const jr = u.chat_join_request;
        if (!jr) continue;
        let verdict = null;
        try {
          verdict = joinVerdict(jr, isSubscribed);
        } catch (err) {
          console.warn(`[telegram] join gate check failed: ${err.message}`);
        }
        if (!verdict) continue;
        await call(`${verdict}ChatJoinRequest`, { chat_id: jr.chat.id, user_id: jr.from.id });
        console.log(`[telegram] join request ${verdict}d: ${jr.from.id} via "${jr.invite_link?.name ?? '?'}"`);
      }
    }
  })();
}

/** Ban-then-unban removes without blocking a future renewal from rejoining. */
export async function removeFromGroup(telegramId) {
  if (!groupId() || !telegramId) return false;
  const banned = await call('banChatMember', { chat_id: groupId(), user_id: telegramId });
  await call('unbanChatMember', { chat_id: groupId(), user_id: telegramId, only_if_banned: true });
  return !!banned.ok;
}

export const hasBot = () => !!token();
