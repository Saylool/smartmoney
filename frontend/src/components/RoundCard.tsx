"use client";

import { formatEther, parseEther } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { useState } from "react";
import { smartMoney, Side, Status, directionLabel, statusLabel, sideLabel, type Round } from "@/lib/contract";
import { Countdown } from "./Countdown";
import { EXPLORER } from "@/lib/config";

const fmt = (v: bigint) => Number(formatEther(v)).toLocaleString(undefined, { maximumFractionDigits: 4 });
const fmtTime = (t: bigint) => new Date(Number(t) * 1000).toLocaleString();

export function RoundCard({ roundId, round }: { roundId: bigint; round: Round }) {
  const { address, isConnected } = useAccount();
  const now = Math.floor(Date.now() / 1000);
  const bettingOpen = round.status === Status.Open && now < Number(round.bettingCloses);
  const total = round.rightPool + round.wrongPool;
  const rightPct = total === 0n ? 50 : Number((round.rightPool * 10000n) / total) / 100;

  const { data: minBet } = useReadContract({ ...smartMoney, functionName: "minBet" });
  const { data: position, refetch: refetchPos } = useReadContract({
    ...smartMoney, functionName: "getPosition", args: [roundId, address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address },
  });
  const { data: claimable, refetch: refetchClaimable } = useReadContract({
    ...smartMoney, functionName: "claimable", args: [roundId, address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address },
  });

  const [amount, setAmount] = useState("0.1");
  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  if (isSuccess) { refetchPos(); refetchClaimable(); }

  const bet = (side: Side) => {
    let value: bigint;
    try { value = parseEther(amount); } catch { return; }
    writeContract({ ...smartMoney, functionName: "bet", args: [roundId, side], value });
  };
  const claim = () => writeContract({ ...smartMoney, functionName: "claim", args: [roundId] });

  const pos = position as { right: bigint; wrong: bigint; claimed: boolean } | undefined;
  const statusClass = statusLabel(round.status).toLowerCase();

  return (
    <section className="panel">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span className="muted small">Round #{roundId.toString()}</span>{" "}
          <span className={`badge ${statusClass}`}>{statusLabel(round.status)}</span>
        </div>
        <div>
          <span className="muted small">Smart money is </span>
          <span className={`badge ${directionLabel(round.direction).toLowerCase()}`}>{directionLabel(round.direction)} BTC</span>
        </div>
      </div>

      <div className="row" style={{ marginTop: 16 }}>
        <div className="stat"><div className="label">Total pool</div><div className="value">{fmt(total)} MON</div></div>
        <div className="stat"><div className="label">Right pool</div><div className="value ok">{fmt(round.rightPool)}</div></div>
        <div className="stat"><div className="label">Wrong pool</div><div className="value error">{fmt(round.wrongPool)}</div></div>
        <div className="stat"><div className="label">Fee</div><div className="value">{(round.feeBps / 100).toFixed(2)}%</div></div>
      </div>
      <div className="bar"><div className="r" style={{ width: `${rightPct}%` }} /><div className="w" style={{ width: `${100 - rightPct}%` }} /></div>
      <div className="row small muted" style={{ justifyContent: "space-between" }}>
        <span>{rightPct.toFixed(1)}% say right · {round.rightBettors} bettors</span>
        <span>{(100 - rightPct).toFixed(1)}% say wrong · {round.wrongBettors} bettors</span>
      </div>

      <div className="row small muted" style={{ marginTop: 12, gap: 24 }}>
        {round.status === Status.Open && <Countdown to={round.bettingCloses} prefix="Betting closes" />}
        {round.status === Status.Locked && <Countdown to={round.endTime} prefix="Resolves" />}
        <span>Start {fmtTime(round.startTime)}</span>
        <span>End {fmtTime(round.endTime)}</span>
        {round.startPrice > 0n && <span>Start price <span className="mono">{round.startPrice.toString()}</span></span>}
        {round.endPrice > 0n && <span>End price <span className="mono">{round.endPrice.toString()}</span></span>}
        {round.status === Status.Resolved && <span className="ok">Winner: {sideLabel(round.winner)}</span>}
        {round.status === Status.Voided && <span>Voided, stakes refundable</span>}
      </div>

      {bettingOpen && (
        <div style={{ marginTop: 20 }}>
          <div className="row" style={{ alignItems: "center" }}>
            <div style={{ flex: "1 1 160px" }}>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount in MON" inputMode="decimal" />
            </div>
            <button className="right" disabled={!isConnected || isPending || confirming} onClick={() => bet(Side.Right)}>Smart money RIGHT</button>
            <button className="wrong" disabled={!isConnected || isPending || confirming} onClick={() => bet(Side.Wrong)}>Smart money WRONG</button>
          </div>
          <div className="small muted" style={{ marginTop: 6 }}>
            Min bet {minBet !== undefined ? fmt(minBet as bigint) : "…"} MON. Bets close before the round starts; payouts are parimutuel.
          </div>
        </div>
      )}

      {pos && (pos.right > 0n || pos.wrong > 0n) && (
        <div className="small" style={{ marginTop: 16 }}>
          Your position: <span className="ok">{fmt(pos.right)} right</span> · <span className="error">{fmt(pos.wrong)} wrong</span>
          {pos.claimed && <span className="muted"> · claimed</span>}
          {!pos.claimed && typeof claimable === "bigint" && claimable > 0n && (
            <>
              {" "}· <button style={{ padding: "4px 12px" }} disabled={isPending || confirming} onClick={claim}>Claim {fmt(claimable)} MON</button>
            </>
          )}
        </div>
      )}

      {(isPending || confirming) && <div className="small muted" style={{ marginTop: 8 }}>Waiting for wallet / confirmation…</div>}
      {isSuccess && txHash && (
        <div className="small ok" style={{ marginTop: 8 }}>
          Confirmed. <a href={`${EXPLORER}/tx/${txHash}`} target="_blank" rel="noreferrer">View tx</a>
        </div>
      )}
      {error && <div className="small error" style={{ marginTop: 8 }}>{(error as { shortMessage?: string }).shortMessage ?? error.message}</div>}
    </section>
  );
}
