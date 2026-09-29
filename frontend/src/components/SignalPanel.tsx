"use client";

import { EXPLORER, PERPL_URL } from "@/lib/config";
import { useSignal } from "@/lib/hooks";
import type { RoundWithId } from "@/lib/contract";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const usd = (v: number) => `$${v.toLocaleString("en-US")}`;

export function SignalPanel({ round }: { round: RoundWithId }) {
  const { data: sig, isLoading, error } = useSignal(round.id, round.createdBlock);

  return (
    <section className="panel">
      <h2>Who is smart money this round?</h2>
      {isLoading && <div className="muted small">Reading the signal from the chain…</div>}
      {error && <div className="error small">Could not read the signal: {(error as Error).message}</div>}
      {sig && (
        <>
          <p className="small muted">
            The {sig.t.length} most profitable traders on <a href={PERPL_URL} target="_blank" rel="noreferrer">Perpl</a>{" "}
            over the last 30 days, and their {sig.asset} positions read on-chain at Perpl mainnet block{" "}
            <span className="mono">{sig.block.toLocaleString("en-US")}</span>. Net:{" "}
            <span className="ok">{sig.long} {sig.asset} long</span> vs <span className="error">{sig.short} {sig.asset} short</span>.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Trader</th>
                  <th className="num">30d PnL</th>
                  <th>{sig.asset} position</th>
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
                      {!side && <span className="muted">flat</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">
            The full signal is emitted on-chain and its hash is stored in the round (
            <a href={`${EXPLORER}/block/${round.createdBlock}`} target="_blank" rel="noreferrer">block {round.createdBlock.toString()}</a>
            ). Anyone can re-derive the direction with <span className="mono">npm run verify-signal {round.id.toString()}</span>.
          </p>
        </>
      )}
    </section>
  );
}
