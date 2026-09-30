"use client";

import Link from "next/link";
import { formatEther } from "viem";
import { EXPLORER, marketById } from "@/lib/config";
import { isSummary, useActivity } from "@/lib/activity";
import { useI18n } from "@/lib/i18n";
import { useNow } from "@/lib/hooks";

const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const mon = (wei?: string) => Number(formatEther(BigInt(wei ?? "0"))).toLocaleString("en-US", { maximumFractionDigits: 4 });

export function EnvioBadge() {
  const { t } = useI18n();
  return (
    <a className="envio-badge" href="https://envio.dev" target="_blank" rel="noreferrer">
      {t.poweredBy}
    </a>
  );
}

export function ProtocolTotals() {
  const { t } = useI18n();
  const { data } = useActivity();
  if (!isSummary(data)) return null;
  const x = data.totals;
  return (
    <div className="stats-grid totals">
      <div className="stat"><div className="label">{t.totBets}</div><div className="value">{x.bets}</div></div>
      <div className="stat"><div className="label">{t.totVolume}</div><div className="value">{mon(x.volumeWei)} MON</div></div>
      <div className="stat"><div className="label">{t.totPlayers}</div><div className="value">{x.players}</div></div>
      <div className="stat"><div className="label">{t.totRounds}</div><div className="value">{x.resolved + x.voided}</div></div>
    </div>
  );
}

export function ActivityFeed() {
  const { t } = useI18n();
  const now = useNow();
  const { data } = useActivity();
  if (!isSummary(data)) return null;

  return (
    <section className="panel">
      <div className="row between center wrap" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>{t.liveActivity}</h2>
        <EnvioBadge />
      </div>
      <ProtocolTotals />
      {data.activity.length === 0 && <p className="small muted">{t.noActivity}</p>}
      <ul className="feed">
        {data.activity.map((a) => {
          const m = marketById(a.marketId);
          const dir = a.direction === 1 ? "LONG" : "SHORT";
          let text = "";
          let tone = "";
          if (a.kind === "bet") {
            text = t.actBet(short(a.account), mon(a.amount), a.side === 1);
            tone = a.side === 1 ? "ok" : "error";
          } else if (a.kind === "claim") {
            text = t.actClaim(short(a.account), mon(a.amount));
            tone = "accent";
          } else if (a.kind === "resolved") {
            text = t.actResolved(a.winner === 1);
            tone = a.winner === 1 ? "ok" : "error";
          } else if (a.kind === "voided") {
            text = t.actVoided(a.reason ?? "");
            tone = "muted";
          } else {
            text = t.actCreated(dir);
          }
          return (
            <li key={`${a.tx}-${a.kind}-${a.account ?? ""}`} className="feed-row">
              <span className={`dot ${tone}`} aria-hidden />
              <span className="grow small">
                <span className={tone}>{text}</span>
                <span className="muted">
                  {" · "}
                  <Link href={`/round/${a.roundId}`}>{t.marketLabel(m.symbol, m.duration)} #{a.roundId}</Link>
                </span>
              </span>
              <a className="small muted nowrap" href={`${EXPLORER}/tx/${a.tx}`} target="_blank" rel="noreferrer">
                {a.time ? t.ago(Math.max(0, now - a.time)) : "tx"}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Per-market strip of past outcomes (newest right). */
export function HistoryStrip() {
  const { t } = useI18n();
  const { data } = useActivity();
  if (!isSummary(data) || data.history.length === 0) return null;
  const markets = [...new Set(data.history.map((h) => h.marketId))].sort();
  return (
    <div className="history">
      <div className="row between center wrap">
        <h3 className="small muted" style={{ margin: 0 }}>{t.historyTitle}</h3>
        <EnvioBadge />
      </div>
      {markets.map((id) => {
        const m = marketById(id);
        const pts = data.history.filter((h) => h.marketId === id).slice(-40);
        return (
          <div key={id} className="history-row">
            <span className="small history-label">{t.marketLabel(m.symbol, m.duration)}</span>
            <span className="pips">
              {pts.map((p) => (
                <Link
                  key={p.roundId}
                  href={`/round/${p.roundId}`}
                  className={`pip ${p.outcome}`}
                  title={`#${p.roundId} · ${p.direction === 1 ? "LONG" : "SHORT"} · ${p.outcome}`}
                />
              ))}
            </span>
          </div>
        );
      })}
      <p className="small muted">{t.historyLegend}</p>
    </div>
  );
}
