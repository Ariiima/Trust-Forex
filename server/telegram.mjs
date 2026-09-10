/**
 * Telegram Bot API, the four calls this product actually makes.
 *
 * Everything no-ops without TF_BOT_TOKEN so the server runs, and the jobs tick,
 * on a laptop with no bot. Failures are logged and swallowed: a campaign send
 * that cannot reach Telegram must not roll back the ledger work beside it.
 */
// TF_TELEGRAM_API lets the e2e test point the bot at a local mock.
const API = process.env.TF_TELEGRAM_API ?? 'https://api.telegram.org/bot';

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

/**
 * The admin's rich-text editor hands us browser HTML; Telegram's HTML mode is
 * a much smaller language. Keep the tags it knows, turn the marks browsers
 * express as inline styles (<span style="font-weight:700">) into those tags,
 * drop every other tag and every attribute except a link's href. A single
 * unknown tag or attribute makes Telegram reject the whole message, so this
 * must be exhaustive, not polite.
 *
 * Newlines: Telegram has only "\n", so every block boundary — the START of a
 * <div> as much as its end — is one. Pressing Enter in a contenteditable
 * produces `line one<div>line two</div>`, where the break belongs BEFORE the
 * div's text; emitting it only at </div> put it after, and the two lines
 * arrived run together. Both edges mark a break, adjacent marks collapse to
 * one, and an explicit <br> survives as its own — which is what keeps a blank
 * line (`<div><br></div>`) blank.
 */
const BREAK = '\u0000';
const TG_TAGS = /^(b|strong|i|em|u|ins|s|strike|del|code|pre|a|blockquote|tg-spoiler)$/;
const BLOCK_END = /^(p|div|li|h[1-6]|blockquote|pre)$/;
const marksOf = (style) => [
  /font-weight\s*:\s*(bold|[6-9]00)/i.test(style) && 'b',
  /font-style\s*:\s*italic/i.test(style) && 'i',
  /text-decoration(?:-line)?\s*:[^;"]*underline/i.test(style) && 'u',
  /text-decoration(?:-line)?\s*:[^;"]*line-through/i.test(style) && 's',
].filter(Boolean);
export const clean = (html) => {
  const open = []; // what each styled <span>/<font> was turned into, so its close matches
  const links = []; // whether each <a> survived (had an href), so its close matches
  return String(html ?? '')
    .replaceAll(BREAK, '')  // the marker below is ours; never trust it from input
    .replace(/&nbsp;/gi, ' ')
    .replace(/<(\/?)([a-z][\w-]*)\b([^>]*)>/gi, (m, close, tag, attrs) => {
      tag = tag.toLowerCase();
      if (tag === 'br') return '\n';
      if (tag === 'a') {
        if (close) return links.pop() ? '</a>' : '';
        const href = /href\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? '';
        links.push(!!href);
        if (!href) return '';
        return `<a href="${/^[a-z][\w+.-]*:/i.test(href) ? href : `https://${href}`}">`;
      }
      if (TG_TAGS.test(tag)) {
        if (!BLOCK_END.test(tag)) return `<${close}${tag}>`;
        return close ? `</${tag}>${BREAK}` : `${BREAK}<${tag}>`;
      }
      if (tag === 'span' || tag === 'font') {
        if (!close) {
          const marks = marksOf(/style\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? '');
          open.push(marks);
          return marks.map((t) => `<${t}>`).join('');
        }
        return (open.pop() ?? []).map((t) => `</${t}>`).reverse().join('');
      }
      return BLOCK_END.test(tag) ? BREAK : '';
    })
    // A run of boundaries is one newline, and a boundary eats the spaces
    // around it so a line never ends in whitespace.
    .replace(/[ \t]*\u0000[ \t\u0000]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const sendMessage = (chatId, text, extra = {}) =>
  // ponytail: no link previews anywhere — bot and broker messages both go through here
  call('sendMessage', {
    chat_id: chatId, text: clean(text), parse_mode: 'HTML',
    link_preview_options: { is_disabled: true }, ...extra,
  });

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
    text: 'Open App', url: `https://t.me/${bot}?startapp=${startParam}`,
  }]] } };
}

/**
 * Pure so the edit-vs-mint choice is testable without a network call.
 *
 * `creates_join_request` goes on BOTH calls: editChatInviteLink resets every
 * field it is not given, so an edit that omits it turns a gated link into one
 * that admits instantly — the gate then never sees the join at all. No
 * expire_date either: the link never dies, joinVerdict is the only check.
 */
export function inviteLinkCall(existingLink, tgId) {
  const params = { chat_id: groupId(), creates_join_request: true, name: `tf:${tgId}` };
  return existingLink
    ? ['editChatInviteLink', { ...params, invite_link: existingLink }]
    : ['createChatInviteLink', params];
}

/**
 * One personal invite per Telegram user, reused for the life of the account —
 * across the first purchase, every renewal past expiry and every resubscribe.
 * `existingLink` (the caller's own storage, keyed by tgId) is renewed in place
 * via editChatInviteLink so a user only ever holds one link; a fresh one is
 * only minted the first time, or if the stored one was revoked/edited away by
 * hand. The link asks Telegram for a *join request* instead of admitting
 * directly, and the buyer's Telegram id rides in the link's `name` — Telegram
 * echoes the link object back inside every chat_join_request, so the gate
 * below can match requester to owner without a lookup table. A forwarded link
 * is useless: the request comes from the wrong id and is declined.
 *
 * The link itself never expires. Expiry is enforced at the door instead:
 * joinVerdict re-reads the subscription on every request, so a dead link and
 * a live one behave identically for someone who has not paid.
 */
export async function groupInvite(tgId, existingLink = null) {
  if (!groupId()) return null;
  const [method, params] = inviteLinkCall(existingLink, tgId);
  const res = await call(method, params);
  if (res.ok) return res.result.invite_link;
  if (!existingLink) return null;
  // Stored link no longer edits (revoked, or hand-touched in Telegram) — mint once.
  const fresh = await call(...inviteLinkCall(null, tgId));
  return fresh.ok ? fresh.result.invite_link : null;
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
 * The bot's one long-poll loop: join requests for the VIP channel doorman
 * (joinVerdict, only when TF_GROUP_ID is set) and `/start <payload>` in
 * private chats — the referral link is `t.me/<bot>?start=<code>`, so pressing
 * Start is where a new user is created, attributed and handed the app button
 * (`onStart(from, payload, chatId)`). Group chatter and anything else is
 * skipped by type, never parsed.
 * ponytail: offset lives in memory — after a restart Telegram redelivers the
 * still-unconfirmed updates and approve/decline/ensureUser are idempotent, so
 * nothing is lost or doubled.
 */
export function startJoinGate(isSubscribed, onStart) {
  if (!token()) return;
  let offset = 0;
  (async () => {
    for (;;) {
      const res = await call('getUpdates', {
        offset, timeout: 50, allowed_updates: ['chat_join_request', 'message'],
      });
      if (!res.ok) {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      // A mock that answers instantly (the e2e tests) would otherwise spin.
      const updates = Array.isArray(res.result) ? res.result : [];
      if (!updates.length) await new Promise((r) => setTimeout(r, 250));
      for (const u of updates) {
        offset = u.update_id + 1;
        const msg = u.message;
        if (msg?.chat?.type === 'private' && /^\/start\b/.test(msg.text ?? '')) {
          const payload = msg.text.split(/\s+/)[1] ?? '';
          console.log(`[telegram] /start from ${msg.from?.id} payload="${payload}"`);
          try {
            await onStart?.(msg.from, payload, msg.chat.id);
          } catch (err) {
            console.warn(`[telegram] /start handler failed: ${err.message}`);
          }
          continue;
        }
        const jr = u.chat_join_request;
        if (!jr || !groupId()) continue;
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
