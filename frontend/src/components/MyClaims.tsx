"use client";

import { useEffect } from "react";
import { zeroAddress } from "viem";
import { useAccount, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { useState } from "react";
import { fmtMon, gasForClaim, smartMoney, type RoundWithId } from "@/lib/contract";
import { marketById } from "@/lib/config";
import { TxStatus } from "./TxStatus";

export function MyClaims({ rounds }: { rounds: RoundWithId[] }) {
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
      <h2>Ready to claim</h2>
      {items.map(({ r, amount }) => (
        <div key={r.id.toString()} className="row between center claim-row">
          <span className="small">
            Round #{r.id.toString()} · {marketById(r.marketId).label} · {r.status === 4 ? "refund" : "winnings"}
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
            Claim {fmtMon(amount!)} MON
          </button>
        </div>
      ))}
      <TxStatus hash={hash} pending={isPending} confirming={confirming} success={isSuccess} error={error ?? gasError} />
    </section>
  );
}
