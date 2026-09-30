"use client";

import { EXPLORER } from "@/lib/config";
import { useI18n } from "@/lib/i18n";

type Props = { hash?: `0x${string}`; pending: boolean; confirming: boolean; success: boolean; error: Error | null };

export function TxStatus({ hash, pending, confirming, success, error }: Props) {
  const { t } = useI18n();
  if (pending) return <div className="small muted">{t.txConfirmWallet}</div>;
  if (confirming) return <div className="small muted">{t.txConfirming}</div>;
  if (success && hash)
    return (
      <div className="small ok">
        {t.txConfirmed} <a href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer">{t.txView}</a>
      </div>
    );
  if (error) {
    const msg = (error as { shortMessage?: string }).shortMessage ?? error.message;
    const full = `${msg} ${(error as { details?: string }).details ?? ""}`;
    const justFunded = /insufficient balance/i.test(full);
    return (
      <div className="small error">
        {msg.split("\n")[0]}
        {justFunded && (
          <div className="muted">
            {t.txJustFunded}
          </div>
        )}
      </div>
    );
  }
  return null;
}
