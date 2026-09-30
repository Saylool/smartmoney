"use client";

import { useEffect } from "react";
import { zeroAddress } from "viem";
import { useAccount, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { useState } from "react";
import { fmtMon, gasForClaim, smartMoney, type RoundWithId } from "@/lib/contract";
import { marketById } from "@/lib/config";
import { TxStatus } from "./TxStatus";
import { useI18n } from "@/lib/i18n";

export function MyClaims({ rounds }: { rounds: RoundWithId[] }) {
  const { t } = useI18n();
  const { address } = useAccount();
  const settled = rounds.filter((r) => r.status >= 3);
  const { data, refetch } = useReadContracts({
    contracts: settled.map((r) => ({
      ...smartMoney, functionName: "claimable" as const, args: [r.id, address ?? zeroAddress] as const,
    })),
    query: { enabled: !!address && settled.length > 0 },
  });
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const [gasError, setGasError] = useState<Error | null>(null);
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  useEffect(() => {
    if (isSuccess) refetch();
  }, [isSuccess, refetch]);

  if (!address) return null;
  const items = settled
    .map((r, i) => ({ r, amount: data?.[i]?.result as bigint | undefined }))
    .filter((x) => typeof x.amount === "bigint" && x.amount > 0n);
  if (items.length === 0) return null;

  return (
    <section className="panel highlight">
      <h2>{t.readyToClaim}</h2>
      {items.map(({ r, amount }) => (
        <div key={r.id.toString()} className="row between center claim-row">
          <span className="small">
            {t.round(r.id.toString())} · {t.marketLabel(marketById(r.marketId).symbol, marketById(r.marketId).duration)} · {r.status === 4 ? t.refund : t.winnings}
          </span>
          <button
            disabled={isPending || confirming}
            onClick={async () => {
              reset();
              setGasError(null);
              try {
                const gas = await gasForClaim(r.id, address);
                writeContract({ ...smartMoney, functionName: "claim", args: [r.id], gas });
              } catch (e) {
                setGasError(e as Error);
              }
            }}
          >
            {t.claim(fmtMon(amount!))}
          </button>
        </div>
      ))}
      <TxStatus hash={hash} pending={isPending} confirming={confirming} success={isSuccess} error={error ?? gasError} />
    </section>
  );
}
