"use client";

import { Direction, Side, Status, type RoundWithId } from "@/lib/contract";
import { SITE_URL, marketById } from "@/lib/config";
import { useI18n, type Dict } from "@/lib/i18n";

export function shareText(round: RoundWithId, t: Dict) {
  const m = marketById(round.marketId);
  const dir = round.direction === Direction.Long ? "LONG" : "SHORT";
  if (round.status === Status.Resolved) return t.shareDone(dir, m.symbol, round.winner === Side.Right);
  return t.shareOpen(dir, m.symbol);
}

export function ShareButton({ round }: { round: RoundWithId }) {
  const { t } = useI18n();
  const share = () => {
    const base = SITE_URL || window.location.origin;
    const url = `${base}/round/${round.id}`;
    const intent = `https://x.com/intent/post?text=${encodeURIComponent(shareText(round, t))}&url=${encodeURIComponent(url)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
  };
  return (
    <button className="secondary small-btn" onClick={share}>
      {t.share}
    </button>
  );
}
