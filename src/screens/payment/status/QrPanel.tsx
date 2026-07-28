import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import QRCode from 'qrcode';

export interface QrPanelProps {
  /** String encoded into the QR (wallet address or payment URI). */
  payload: string;
  /** 40x40 currency icon shown in the centered white badge; badge hidden when unset. */
  currencyIcon?: string;
}

/** 148x148 QR rendered via the `qrcode` package with a centered 56x56 white
 *  currency badge on top (node 1102:10747). Styles live in PaymentStatus.css. */
export function QrPanel({ payload, currencyIcon }: QrPanelProps): ReactNode {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    QRCode.toDataURL(payload, { width: 148, margin: 0 })
      .then((url) => {
        if (!stale) setSrc(url);
      })
      .catch(() => undefined);
    return () => {
      stale = true;
    };
  }, [payload]);

  return (
    <div className="scr-status-qrpanel">
      {src ? <img className="scr-status-qr" src={src} alt="Payment QR code" width={148} height={148} /> : null}
      {currencyIcon ? (
        <span className="scr-status-qr-badge">
          <img src={currencyIcon} alt="" width={40} height={40} />
        </span>
      ) : null}
    </div>
  );
}
