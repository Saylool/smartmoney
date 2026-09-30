"use client";

import Link from "next/link";
import { useRound } from "@/lib/hooks";
import { RoundCard } from "./RoundCard";
import { SignalPanel } from "./SignalPanel";
import { useI18n } from "@/lib/i18n";

export function RoundDetail({ id }: { id: bigint }) {
  const { t } = useI18n();
  const { round, isLoading, error } = useRound(id);
  if (isLoading) return <div className="panel muted">{t.loadingRound}</div>;
  if (error || !round || round.status === 0) return <div className="panel error">{t.roundNotFound(id.toString())}</div>;
  const r = { ...round, id };
  return (
    <>
      <Link className="small" href="/">{t.allRounds}</Link>
      <RoundCard round={r} />
      <SignalPanel round={r} />
    </>
  );
}
