"use client";

import { EXPLORER } from "@/lib/config";

type Props = { hash?: `0x${string}`; pending: boolean; confirming: boolean; success: boolean; error: Error | null };

export function TxStatus({ hash, pending, confirming, success, error }: Props) {
  if (pending) return <div className="small muted">Confirm in your wallet…</div>;
  if (confirming) return <div className="small muted">Confirming on Monad…</div>;
  if (success && hash)
    return (
      <div className="small ok">
        Confirmed. <a href={`${EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer">View transaction</a>
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
            If you just received MON, Monad needs a few seconds before it can be spent. Wait a moment and try again.
          </div>
        )}
      </div>
    );
  }
  return null;
}
