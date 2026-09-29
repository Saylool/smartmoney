"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReadContract, useReadContracts } from "wagmi";
import { fetchSignal, oracle, smartMoney, type Round, type RoundWithId } from "./contract";
import { marketById } from "./config";

/** Unix seconds, re-rendering every second. */
export function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** The most recent `count` rounds, newest first. */
export function useRecentRounds(count = 40) {
  const { data: rc, isLoading, error } = useReadContract({ ...smartMoney, functionName: "roundCount" });
  const n = typeof rc === "bigint" ? rc : 0n;
  const ids: bigint[] = [];
  for (let i = n; i > 0n && ids.length < count; i--) ids.push(i);
  const { data } = useReadContracts({
    contracts: ids.map((id) => ({ ...smartMoney, functionName: "getRound" as const, args: [id] as const })),
    query: { enabled: ids.length > 0 },
  });
  const rounds: RoundWithId[] = [];
  data?.forEach((d, i) => {
    if (d.status === "success") rounds.push({ ...(d.result as unknown as Round), id: ids[i] });
  });
  return { rounds, roundCount: n, isLoading: isLoading || (ids.length > 0 && !data), error };
}

export function useRound(id: bigint) {
  const q = useReadContract({ ...smartMoney, functionName: "getRound", args: [id] });
  return { ...q, round: q.data as unknown as Round | undefined };
}

/** Live oracle price for a market's feed (the same price the contract settles with). */
export function useLivePrice(marketId: number, feedId?: bigint) {
  const { data: market } = useReadContract({
    ...smartMoney,
    functionName: "getMarket",
    args: [BigInt(marketId)],
    query: { enabled: feedId === undefined, staleTime: Infinity },
  });
  const feed = feedId ?? (market as { feedId: bigint } | undefined)?.feedId;
  const q = useReadContract({
    ...oracle,
    functionName: "latestPrice",
    args: [feed ?? 0n],
    query: { enabled: feed !== undefined, refetchInterval: 4000 },
  });
  const tuple = q.data as readonly [bigint, bigint] | undefined;
  return { price: tuple?.[0], updatedAt: tuple ? Number(tuple[1]) : undefined, decimals: marketById(marketId).priceDecimals };
}

export function useSignal(roundId: bigint | undefined, createdBlock: bigint | undefined) {
  return useQuery({
    queryKey: ["signal", roundId?.toString(), createdBlock?.toString()],
    queryFn: () => fetchSignal(roundId!, createdBlock!),
    enabled: roundId !== undefined && createdBlock !== undefined && createdBlock > 0n,
    staleTime: Infinity,
    refetchInterval: false,
  });
}
