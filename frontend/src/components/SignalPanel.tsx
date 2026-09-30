"use client";

import { EXPLORER, PERPL_URL } from "@/lib/config";
import { useSignal } from "@/lib/hooks";
import type { RoundWithId } from "@/lib/contract";
import { useI18n } from "@/lib/i18n";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const usd = (v: number) => `$${v.toLocaleString("en-US")}`;

export function SignalPanel({ round }: { round: RoundWithId }) {
  const { t } = useI18n();
  const { data: sig, isLoading, error } = useSignal(round.id, round.createdBlock);

  return (
    <section className="panel">
      <h2>{t.whoIsSm}</h2>
      {isLoading && <div className="muted small">{t.readingSignal}</div>}
      {error && <div className="error small">{t.signalError((error as Error).message)}</div>}
      {sig && (
        <>
          <p className="small muted">
            {t.signalIntro(sig.t.length, sig.asset)}{" "}
            <span className="mono">{sig.block.toLocaleString("en-US")}</span>. {t.net}{" "}
            <span className="ok">{t.netLong(sig.long, sig.asset)}</span> {t.vs}{" "}
            <span className="error">{t.netShort(sig.short, sig.asset)}</span>.{" "}
            <a href={PERPL_URL} target="_blank" rel="noreferrer">Perpl ↗</a>
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t.thTrader}</th>
                  <th className="num">{t.thPnl}</th>
                  <th>{t.thPosition(sig.asset)}</th>
                </tr>
              </thead>
              <tbody>
                {sig.t.map(([rank, addr, pnl, side, size]) => (
                  <tr key={addr} className={side ? "" : "dim"}>
                    <td>{rank}</td>
                    <td className="mono">{short(addr)}</td>
                    <td className="num">{usd(pnl)}</td>
                    <td>
                      {side === "L" && <span className="ok">LONG {size}</span>}
                      {side === "S" && <span className="error">SHORT {size}</span>}
                      {!side && <span className="muted">{t.flat}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">
            {t.signalFoot1}
            <a href={`${EXPLORER}/block/${round.createdBlock}`} target="_blank" rel="noreferrer">{t.signalBlock(round.createdBlock.toString())}</a>
            {t.signalFoot2} <span className="mono">npm run verify-signal {round.id.toString()}</span>
          </p>
        </>
      )}
    </section>
  );
}
