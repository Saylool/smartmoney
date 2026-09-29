"use client";

import Link from "next/link";
import { useRound } from "@/lib/hooks";
import { RoundCard } from "./RoundCard";
import { SignalPanel } from "./SignalPanel";

export function RoundDetail({ id }: { id: bigint }) {
  const { round, isLoading, error } = useRound(id);
  if (isLoading) return <div className="panel muted">Loading round…</div>;
  if (error || !round || round.status === 0) return <div className="panel error">Round #{id.toString()} was not found.</div>;
  const r = { ...round, id };
  return (
    <>
      <Link className="small" href="/">← All rounds</Link>
      <RoundCard round={r} />
      <SignalPanel round={r} />
    </>
  );
}
