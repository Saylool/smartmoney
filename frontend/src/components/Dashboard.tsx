"use client";

import { useState } from "react";
import Link from "next/link";
import { MARKETS, marketById } from "@/lib/config";
import { Direction, Side, Status, directionLabel, fmtPrice, phaseOf, type RoundWithId } from "@/lib/contract";
import { useLivePrice, useNow, useRecentRounds } from "@/lib/hooks";
import { RoundCard } from "./RoundCard";
import { SignalPanel } from "./SignalPanel";
import { TrackRecord } from "./TrackRecord";
import { MyClaims } from "./MyClaims";

function LivePrice({ marketId }: { marketId: number }) {
  const { price } = useLivePrice(marketId);
  const m = marketById(marketId);
  return (
    <span className="small muted">
      {m.symbol} oracle price <span className="mono">{price !== undefined ? `$${fmtPrice(price, marketId)}` : "…"}</span>
    </span>
  );
}

function Results({ rounds }: { rounds: RoundWithId[] }) {
  if (rounds.length === 0) return null;
  return (
    <section className="panel">
      <h2>Recent results</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Round</th>
              <th>Smart money</th>
              <th className="num">Start</th>
              <th className="num">End</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r) => (
              <tr key={r.id.toString()}>
                <td><Link href={`/round/${r.id}`}>#{r.id.toString()}</Link></td>
                <td className={r.direction === Direction.Long ? "ok" : "error"}>{directionLabel(r.direction)}</td>
                <td className="num mono">{r.startPrice > 0n ? fmtPrice(r.startPrice, r.marketId) : "—"}</td>
                <td className="num mono">{r.endPrice > 0n ? fmtPrice(r.endPrice, r.marketId) : "—"}</td>
                <td>
                  {r.status === Status.Resolved ? (
                    <span className={r.winner === Side.Right ? "ok" : "error"}>{r.winner === Side.Right ? "Right" : "Wrong"}</span>
                  ) : (
                    <span className="muted">Refunded</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function Dashboard() {
  const [marketId, setMarketId] = useState<number>(MARKETS[0].id);
  const now = useNow();
  const { rounds, isLoading, error } = useRecentRounds(48);

  const mine = rounds.filter((r) => r.marketId === marketId);
  const betting = mine.filter((r) => phaseOf(r, now) === "betting").sort((a, b) => Number(a.startTime - b.startTime));
  const live = mine.filter((r) => ["starting", "live", "settling"].includes(phaseOf(r, now)));
  const done = mine.filter((r) => r.status === Status.Resolved || r.status === Status.Voided).slice(0, 8);
  const featured = betting[0] ?? live[0];

  return (
    <>
      <MyClaims rounds={rounds} />

      <div className="tabs" role="tablist">
        {MARKETS.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={m.id === marketId}
            className={`tab ${m.id === marketId ? "active" : ""}`}
            onClick={() => setMarketId(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="row between center" style={{ margin: "4px 0 12px" }}>
        <LivePrice marketId={marketId} />
        <span className="small muted">Prices: Perpl on-chain oracle (Chainlink Data Streams)</span>
      </div>

      {error && <div className="panel error small">Could not read the contract: {error.message}</div>}
      {isLoading && <div className="panel muted">Loading rounds…</div>}
      {!isLoading && !featured && (
        <div className="panel muted">
          No round is open for this market right now. The keeper opens the next one shortly before it starts.
        </div>
      )}

      {betting.map((r) => <RoundCard key={r.id.toString()} round={r} />)}
      {live.map((r) => <RoundCard key={r.id.toString()} round={r} />)}
      {featured && <SignalPanel round={featured} />}
      <Results rounds={done} />
      <TrackRecord />
    </>
  );
}
