"use client";

import { useQuery } from "@tanstack/react-query";
import { useReadContracts } from "wagmi";
import { MARKETS } from "@/lib/config";
import { smartMoney } from "@/lib/contract";
import { useI18n } from "@/lib/i18n";
import { HistoryStrip } from "./ActivityFeed";

type Backtest = {
  days: number;
  topN: number;
  bias: string;
  generatedAt: string;
  assets: Record<string, { right: number; wrong: number; accuracy: number | null; hours: number }>;
};

const pct = (r: number, w: number) => (r + w === 0 ? "—" : `${Math.round((r / (r + w)) * 1000) / 10}%`);

export function TrackRecord() {
  const { t } = useI18n();
  const { data } = useReadContracts({
    contracts: MARKETS.map((m) => ({ ...smartMoney, functionName: "marketStats" as const, args: [BigInt(m.id)] as const })),
  });
  const { data: bt } = useQuery({
    queryKey: ["backtest"],
    queryFn: async () => (await fetch("/backtest.json")).json() as Promise<Backtest>,
    staleTime: Infinity,
    refetchInterval: false,
  });

  return (
    <section className="panel">
      <h2>{t.isSmRight}</h2>
      <div className="stats-grid">
        {MARKETS.map((m, i) => {
          const s = data?.[i]?.result as readonly [number, number, number] | undefined;
          const [right, wrong, voided] = s ?? [0, 0, 0];
          return (
            <div key={m.id} className="stat">
              <div className="label">{t.marketLabel(m.symbol, m.duration)}</div>
              <div className="value">{pct(right, wrong)}</div>
              <div className="small muted">{t.statLine(right, wrong, voided)}</div>
            </div>
          );
        })}
      </div>
      <p className="small muted">{t.liveRecord}</p>
      <HistoryStrip />
      {bt && (
        <>
          <div className="stats-grid" style={{ marginTop: 12 }}>
            {Object.entries(bt.assets).map(([sym, a]) => (
              <div key={sym} className="stat">
                <div className="label">{t.backtestLabel(sym, bt.days)}</div>
                <div className="value">{a.accuracy === null ? "—" : `${a.accuracy}%`}</div>
                <div className="small muted">{t.backtestLine(a.right, a.wrong, a.hours)}</div>
              </div>
            ))}
          </div>
          <p className="small muted">{t.backtestNote(bt.topN)}</p>
        </>
      )}
    </section>
  );
}
