"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { smartMoney, type Round } from "@/lib/contract";
import { RoundCard } from "./RoundCard";

const HISTORY = 6;

export function Rounds() {
  const { data: count, isLoading, error } = useReadContract({ ...smartMoney, functionName: "roundCount" });
  const n = typeof count === "bigint" ? count : 0n;
  const ids: bigint[] = [];
  for (let i = n; i > 0n && ids.length < HISTORY; i--) ids.push(i);

  const { data: rounds } = useReadContracts({
    contracts: ids.map((id) => ({ ...smartMoney, functionName: "getRound", args: [id] })),
    query: { enabled: ids.length > 0 },
  });

  if (isLoading) return <div className="panel muted">Loading rounds…</div>;
  if (error) return <div className="panel error small">Could not read the contract: {error.message}</div>;
  if (n === 0n) return <div className="panel muted">No rounds yet. The keeper opens a new round every hour.</div>;

  return (
    <>
      {ids.map((id, i) => {
        const r = rounds?.[i]?.result as Round | undefined;
        if (!r) return null;
        return <RoundCard key={id.toString()} roundId={id} round={r} />;
      })}
    </>
  );
}
