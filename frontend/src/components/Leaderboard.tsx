"use client";

import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { formatEther, type Address } from "viem";
import { EXPLORER } from "@/lib/config";
import { fmtMon, smartMoney } from "@/lib/contract";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function Leaderboard() {
  const { address } = useAccount();
  const { data: list, isLoading } = useReadContract({ ...smartMoney, functionName: "participants", args: [0n, 500n] });
  const people = (list as readonly Address[] | undefined) ?? [];
  const { data: stats } = useReadContracts({
    contracts: people.map((p) => ({ ...smartMoney, functionName: "userStats" as const, args: [p] as const })),
    query: { enabled: people.length > 0 },
  });

  const rows = people
    .map((p, i) => {
      const s = stats?.[i]?.result as readonly [bigint, bigint, number, number] | undefined;
      if (!s) return null;
      const [staked, returned, bets, wins] = s;
      return { p, staked, returned, bets, wins, net: returned - staked };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => (b.net > a.net ? 1 : b.net < a.net ? -1 : 0));

  return (
    <section className="panel">
      <h2>Who beats smart money?</h2>
      <p className="small muted">
        Net = everything claimed (winnings and refunds) minus everything staked, straight from the contract. Stakes in
        rounds that have not settled yet count against you until you claim.
      </p>
      {isLoading && <div className="muted small">Loading…</div>}
      {!isLoading && rows.length === 0 && <div className="muted small">No bets yet. Be the first.</div>}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th className="num">Net (MON)</th>
                <th className="num">Staked</th>
                <th className="num">Bets</th>
                <th className="num">Wins</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.p} className={address?.toLowerCase() === r.p.toLowerCase() ? "me" : ""}>
                  <td>{i + 1}</td>
                  <td className="mono">
                    <a href={`${EXPLORER}/address/${r.p}`} target="_blank" rel="noreferrer">{short(r.p)}</a>
                  </td>
                  <td className={`num ${r.net >= 0n ? "ok" : "error"}`}>
                    {r.net >= 0n ? "+" : "−"}
                    {Number(formatEther(r.net >= 0n ? r.net : -r.net)).toLocaleString("en-US", { maximumFractionDigits: 4 })}
                  </td>
                  <td className="num">{fmtMon(r.staked)}</td>
                  <td className="num">{r.bets}</td>
                  <td className="num">{r.wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
