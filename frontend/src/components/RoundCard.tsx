"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { parseEther, zeroAddress } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import {
  Direction, Side, Status, directionLabel, fmtMon, fmtPrice, gasForBet, gasForClaim, multiple, phaseOf, smartMoney,
  smartMoneyWinning,
  type RoundWithId,
} from "@/lib/contract";
import { marketById } from "@/lib/config";
import { useLivePrice, useNow } from "@/lib/hooks";
import { Countdown } from "./Countdown";
import { TxStatus } from "./TxStatus";
import { ShareButton } from "./ShareButton";
import { useI18n } from "@/lib/i18n";

const QUICK = ["0.05", "0.1", "0.5", "1"];

export function RoundCard({ round, compact = false }: { round: RoundWithId; compact?: boolean }) {
  const now = useNow();
  const { t } = useI18n();
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

  const [gasError, setGasError] = useState<Error | null>(null);
  const bet = async (side: Side) => {
    if (!parsed || tooSmall || !address) return;
    reset();
    setGasError(null);
    try {
      const gas = await gasForBet(round.id, side, parsed, address);
      writeContract({ ...smartMoney, functionName: "bet", args: [round.id, side], value: parsed, gas });
    } catch (e) {
      setGasError(e as Error);
    }
  };
  const claim = async () => {
    if (!address) return;
    reset();
    setGasError(null);
    try {
      const gas = await gasForClaim(round.id, address);
      writeContract({ ...smartMoney, functionName: "claim", args: [round.id], gas });
    } catch (e) {
      setGasError(e as Error);
    }
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
          <span className="market-label">{t.marketLabel(market.symbol, market.duration)}</span>
          <span className={`badge ${phase}`}>{t.phase[phase]}</span>
        </div>
        <Link className="small muted" href={`/round/${round.id}`}>{t.round(round.id.toString())}</Link>
      </div>

      <div className="headline">
        {t.smIs}{" "}
        <span className={isLong ? "long" : "short"}>
          {directionLabel(round.direction)} {market.symbol}
        </span>
        {phase === "betting" && <span className="muted">{t.rightOrWrong}</span>}
      </div>

      <div className="row gap16 wrap small">
        {phase === "betting" && <Countdown to={round.bettingCloses} prefix={t.bettingCloses} />}
        {phase === "starting" && <span className="muted">{t.waitingStart}</span>}
        {phase === "empty" && <span className="muted">{t.nobodyBet}</span>}
        {phase === "live" && <Countdown to={round.endTime} prefix={t.ends} />}
        {phase === "settling" && <span className="muted">{t.waitingEnd}</span>}
        {round.startPrice > 0n && (
          <span>{t.start} <span className="mono">${fmtPrice(round.startPrice, round.marketId)}</span></span>
        )}
        {round.status === Status.Locked && price !== undefined && (
          <span>
            {t.nowPrice} <span className="mono">${fmtPrice(price, round.marketId)}</span>
            {winning !== null && (
              <span className={winning ? "ok" : "error"}> · {winning ? t.smWinning : t.smLosing}</span>
            )}
          </span>
        )}
        {round.endPrice > 0n && (
          <span>{t.end} <span className="mono">${fmtPrice(round.endPrice, round.marketId)}</span></span>
        )}
        {round.status === Status.Resolved && (
          <span className={round.winner === Side.Right ? "ok strong" : "error strong"}>
            {t.smWas(round.winner === Side.Right)}
          </span>
        )}
        {round.status === Status.Voided && <span className="muted">{t.voidedNote}</span>}
      </div>

      <div className="pools">
        <div className="pool right">
          <div className="label">{t.poolRight}</div>
          <div className="value">{fmtMon(round.rightPool)} MON</div>
          <div className="small muted">{t.bettors(round.rightBettors)}{mRight ? t.pays(mRight.toFixed(2)) : ""}</div>
        </div>
        <div className="pool wrong">
          <div className="label">{t.poolWrong}</div>
          <div className="value">{fmtMon(round.wrongPool)} MON</div>
          <div className="small muted">{t.bettors(round.wrongBettors)}{mWrong ? t.pays(mWrong.toFixed(2)) : ""}</div>
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
              aria-label={t.amountLabel}
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
              {t.betRight}
            </button>
            <button className="wrong grow" disabled={!address || busy || !parsed || tooSmall} onClick={() => bet(Side.Wrong)}>
              {t.betWrong}
            </button>
          </div>
          <div className="small muted" style={{ marginTop: 6 }}>
            {!address ? t.connectToBet : tooSmall ? t.minBet(fmtMon(minBet as bigint)) : t.feeNote(round.feeBps / 100)}
          </div>
        </div>
      )}

      {hasPos && pos && (
        <div className="position small">
          {t.yourStake} <span className="ok">{t.stakeRight(fmtMon(pos.right))}</span> ·{" "}
          <span className="error">{t.stakeWrong(fmtMon(pos.wrong))}</span>
          {pos.claimed && <span className="muted"> · {t.claimed}</span>}
          {!pos.claimed && typeof claimable === "bigint" && claimable > 0n && (
            <button className="claim" disabled={busy} onClick={claim}>
              {t.claim(fmtMon(claimable))}
            </button>
          )}
        </div>
      )}

      <TxStatus hash={hash} pending={isPending} confirming={confirming} success={isSuccess} error={error ?? gasError} />

      {!compact && (
        <div className="row between center" style={{ marginTop: 10 }}>
          <Link className="small" href={`/round/${round.id}`}>{t.seeTraders}</Link>
          <ShareButton round={round} />
        </div>
      )}
    </section>
  );
}
