"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { parseEther, zeroAddress } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import {
  Direction, Side, Status, directionLabel, fmtMon, fmtPrice, multiple, phaseOf, smartMoney, smartMoneyWinning,
  type RoundWithId,
} from "@/lib/contract";
import { marketById } from "@/lib/config";
import { useLivePrice, useNow } from "@/lib/hooks";
import { Countdown } from "./Countdown";
import { TxStatus } from "./TxStatus";
import { ShareButton } from "./ShareButton";

const PHASE_LABEL = {
  betting: "Betting open",
  starting: "Starting",
  live: "Live",
  settling: "Settling",
  resolved: "Resolved",
  voided: "Refunded",
} as const;

const QUICK = ["0.05", "0.1", "0.5", "1"];

export function RoundCard({ round, compact = false }: { round: RoundWithId; compact?: boolean }) {
  const now = useNow();
  const { address } = useAccount();
  const market = marketById(round.marketId);
  const phase = phaseOf(round, now);
  const total = round.rightPool + round.wrongPool;
  const rightPct = total === 0n ? 50 : Number((round.rightPool * 10000n) / total) / 100;
  const isLong = round.direction === Direction.Long;

  const { price } = useLivePrice(round.marketId);
  const { data: minBet } = useReadContract({ ...smartMoney, functionName: "minBet", query: { staleTime: 60_000 } });
  const who = address ?? zeroAddress;
  const { data: position, refetch: refetchPos } = useReadContract({
    ...smartMoney, functionName: "getPosition", args: [round.id, who], query: { enabled: !!address },
  });
  const { data: claimable, refetch: refetchClaimable } = useReadContract({
    ...smartMoney, functionName: "claimable", args: [round.id, who], query: { enabled: !!address },
  });

  const [amount, setAmount] = useState("0.1");
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  useEffect(() => {
    if (isSuccess) {
      refetchPos();
      refetchClaimable();
    }
  }, [isSuccess, refetchPos, refetchClaimable]);

  const busy = isPending || confirming;
  let parsed: bigint | null = null;
  try {
    parsed = parseEther(amount || "0");
  } catch {
    parsed = null;
  }
  const tooSmall = parsed !== null && typeof minBet === "bigint" && parsed < minBet;

  const bet = (side: Side) => {
    if (!parsed || tooSmall) return;
    reset();
    writeContract({ ...smartMoney, functionName: "bet", args: [round.id, side], value: parsed });
  };
  const claim = () => {
    reset();
    writeContract({ ...smartMoney, functionName: "claim", args: [round.id] });
  };

  const pos = position as { right: bigint; wrong: bigint; claimed: boolean } | undefined;
  const hasPos = !!pos && (pos.right > 0n || pos.wrong > 0n);
  const winning = round.status === Status.Locked && price !== undefined ? smartMoneyWinning(round, price) : null;
  const mRight = multiple(round, Side.Right);
  const mWrong = multiple(round, Side.Wrong);

  return (
    <section className={`panel round ${phase}`}>
      <div className="row between center">
        <div className="row center gap8">
          <span className="market-label">{market.label}</span>
          <span className={`badge ${phase}`}>{PHASE_LABEL[phase]}</span>
        </div>
        <Link className="small muted" href={`/round/${round.id}`}>Round #{round.id.toString()}</Link>
      </div>

      <div className="headline">
        Smart money is{" "}
        <span className={isLong ? "long" : "short"}>
          {directionLabel(round.direction)} {market.symbol}
        </span>
        {phase === "betting" && <span className="muted"> — right or wrong?</span>}
      </div>

      <div className="row gap16 wrap small">
        {phase === "betting" && <Countdown to={round.bettingCloses} prefix="Betting closes" />}
        {phase === "starting" && <span className="muted">Waiting for the start price from the oracle…</span>}
        {phase === "live" && <Countdown to={round.endTime} prefix="Ends" />}
        {phase === "settling" && <span className="muted">Waiting for the end price from the oracle…</span>}
        {round.startPrice > 0n && (
          <span>Start <span className="mono">${fmtPrice(round.startPrice, round.marketId)}</span></span>
        )}
        {round.status === Status.Locked && price !== undefined && (
          <span>
            Now <span className="mono">${fmtPrice(price, round.marketId)}</span>
            {winning !== null && (
              <span className={winning ? "ok" : "error"}> · smart money {winning ? "winning" : "losing"}</span>
            )}
          </span>
        )}
        {round.endPrice > 0n && (
          <span>End <span className="mono">${fmtPrice(round.endPrice, round.marketId)}</span></span>
        )}
        {round.status === Status.Resolved && (
          <span className={round.winner === Side.Right ? "ok strong" : "error strong"}>
            Smart money was {round.winner === Side.Right ? "RIGHT" : "WRONG"}
          </span>
        )}
        {round.status === Status.Voided && <span className="muted">Voided: every stake is refundable</span>}
      </div>

      <div className="pools">
        <div className="pool right">
          <div className="label">Right</div>
          <div className="value">{fmtMon(round.rightPool)} MON</div>
          <div className="small muted">{round.rightBettors} bettors{mRight ? ` · pays ${mRight.toFixed(2)}x` : ""}</div>
        </div>
        <div className="pool wrong">
          <div className="label">Wrong</div>
          <div className="value">{fmtMon(round.wrongPool)} MON</div>
          <div className="small muted">{round.wrongBettors} bettors{mWrong ? ` · pays ${mWrong.toFixed(2)}x` : ""}</div>
        </div>
      </div>
      <div className="bar">
        <div className="r" style={{ width: `${rightPct}%` }} />
        <div className="w" style={{ width: `${100 - rightPct}%` }} />
      </div>

      {phase === "betting" && !compact && (
        <div className="bet">
          <div className="row gap8 wrap center">
            <input
              aria-label="Amount in MON"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className="amount"
            />
            {QUICK.map((q) => (
              <button key={q} className="chip" onClick={() => setAmount(q)}>{q}</button>
            ))}
          </div>
          <div className="row gap8 wrap" style={{ marginTop: 10 }}>
            <button className="right grow" disabled={!address || busy || !parsed || tooSmall} onClick={() => bet(Side.Right)}>
              Smart money is RIGHT
            </button>
            <button className="wrong grow" disabled={!address || busy || !parsed || tooSmall} onClick={() => bet(Side.Wrong)}>
              Smart money is WRONG
            </button>
          </div>
          <div className="small muted" style={{ marginTop: 6 }}>
            {!address
              ? "Connect a wallet to bet."
              : tooSmall
                ? `Minimum bet is ${fmtMon(minBet as bigint)} MON.`
                : `Winners split the whole pool pro-rata; ${round.feeBps / 100}% fee on the losing side only.`}
          </div>
        </div>
      )}

      {hasPos && pos && (
        <div className="position small">
          Your stake: <span className="ok">{fmtMon(pos.right)} right</span> ·{" "}
          <span className="error">{fmtMon(pos.wrong)} wrong</span>
          {pos.claimed && <span className="muted"> · claimed</span>}
          {!pos.claimed && typeof claimable === "bigint" && claimable > 0n && (
            <button className="claim" disabled={busy} onClick={claim}>
              Claim {fmtMon(claimable)} MON
            </button>
          )}
        </div>
      )}

      <TxStatus hash={hash} pending={isPending} confirming={confirming} success={isSuccess} error={error} />

      {!compact && (
        <div className="row between center" style={{ marginTop: 10 }}>
          <Link className="small" href={`/round/${round.id}`}>See the 20 traders behind this call →</Link>
          <ShareButton round={round} />
        </div>
      )}
    </section>
  );
}
