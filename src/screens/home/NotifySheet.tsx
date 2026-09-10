import { useEffect, useState } from 'react';
import { BottomSheet, Button, Icon } from '../../design-system/components';
import { getTg } from '../../telegram';
import { REF, cachedMyReferral, getMyReferral } from '../../api/client';
import './NotifySheet.css';

/* ---------------------------------------------------------------------------
 * "Join channel" sheet — get the user into the bot's chat.
 *
 * Two audiences, one sheet:
 *   - Inside Telegram but never pressed Start (Telegram signs that into
 *     initData as `user.allows_write_to_pm === false`): the bot cannot DM
 *     them, so payment confirmations, reminders and cashback updates all
 *     bounce. The CTA is Telegram's own `requestWriteAccess` prompt, which
 *     grants exactly what /start would, without leaving the app.
 *   - In a plain browser (guest): the CTA opens `t.me/<bot>?start=<ref>`,
 *     carrying the website link's `?ref=` into the bot's /start so the
 *     inviter is credited when they land in Telegram — a guest identity
 *     cannot follow them there otherwise.
 *
 * Shown at most once per launch — Home remounts on every return to `/`, and
 * a prompt that rises each time reads as a bug, not a reminder. In dev the
 * guest case stays off: the design-review harness shoots Home in a plain
 * browser. `?sheet=notify` forces it for a look. ponytail: no cross-launch
 * backoff — one open, one tap to end it.
 * ------------------------------------------------------------------------- */

let asked = false;

const startLink = (bot: string | null | undefined) =>
  bot ? `https://t.me/${bot}?start=${REF ?? ''}` : null;

export function NotifySheet({ force = false }: { force?: boolean }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState(() => startLink(cachedMyReferral()?.bot));
  const tg = getTg();
  const inTelegram = !!tg?.initData;

  useEffect(() => {
    const notStarted = inTelegram && tg?.initDataUnsafe.user?.allows_write_to_pm === false && !!tg.requestWriteAccess;
    const guest = !inTelegram && !import.meta.env.DEV;
    if (!(force || ((notStarted || guest) && !asked))) return;
    asked = true;
    if (!inTelegram) void getMyReferral().then((r) => setLink(startLink(r?.bot)));
    // A beat after the home page has settled, so it reads as a prompt, not
    // as part of the page's own entrance.
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [force, inTelegram, tg]);

  const join = () => {
    // Granted or declined, we asked — the native prompt was the last word.
    if (inTelegram && tg?.requestWriteAccess) tg.requestWriteAccess(() => setOpen(false));
    else if (link) window.location.href = link;
    else setOpen(false);
  };

  return (
    <BottomSheet open={open} onClose={() => setOpen(false)} className="scr-notify-sheet">
      <div className="scr-notify-banner">
        <Icon name="send" size={24} className="scr-notify-banner-icon" />
        <p className="scr-notify-banner-text">Join channel</p>
      </div>
      <p className="scr-notify-body type-text-sm">
        Start the bot to get notifications — payment confirmations, subscription reminders and cashback updates arrive in your Telegram chat.
      </p>
      <div className="scr-notify-actions">
        <Button variant="primary" size="small" fullWidth onClick={join}>
          Join channel
        </Button>
        <Button variant="ghost" size="small" fullWidth onClick={() => setOpen(false)}>
          Not now
        </Button>
      </div>
    </BottomSheet>
  );
}

export default NotifySheet;
