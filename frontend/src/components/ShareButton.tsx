"use client";

import { Direction, Side, Status, type RoundWithId } from "@/lib/contract";
import { SITE_URL, marketById } from "@/lib/config";

export function shareText(round: RoundWithId) {
  const m = marketById(round.marketId);
  const dir = round.direction === Direction.Long ? "LONG" : "SHORT";
  if (round.status === Status.Resolved) {
    const right = round.winner === Side.Right;
    return `Perpl's top 20 traders went ${dir} ${m.symbol} and were ${right ? "RIGHT" : "WRONG"}. Called it on SmartMoney @monad`;
  }
  return `Perpl's top 20 traders are ${dir} ${m.symbol}. Are they right? Bet on it on SmartMoney @monad`;
}

export function ShareButton({ round }: { round: RoundWithId }) {
  const share = () => {
    const base = SITE_URL || window.location.origin;
    const url = `${base}/round/${round.id}`;
    const intent = `https://x.com/intent/post?text=${encodeURIComponent(shareText(round))}&url=${encodeURIComponent(url)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
  };
  return (
    <button className="secondary small-btn" onClick={share}>
      Share on X
    </button>
  );
}
