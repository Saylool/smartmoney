import { Connect } from "@/components/Connect";
import { Rounds } from "@/components/Rounds";
import { CONTRACT_ADDRESS, EXPLORER, monad } from "@/lib/config";

export default function Home() {
  return (
    <main>
      <header>
        <div>
          <h1>SmartMoney</h1>
          <div className="muted small">Is Perpl smart money right about BTC this hour? Parimutuel rounds on {monad.name}.</div>
        </div>
        <Connect />
      </header>

      <section className="panel small muted">
        <b style={{ color: "var(--text)" }}>How it works.</b> Every hour the keeper posts the net BTC direction of the 20 most profitable Perpl
        traders over the last 30 days. You bet whether they will be <span className="ok">right</span> or <span className="error">wrong</span> by
        the end of the round. Bets close before the round starts. Winners split the whole pool pro‑rata, minus a small fee taken only from
        the losing side. If nobody is on the other side or the price does not move, everyone is refunded.
      </section>

      {CONTRACT_ADDRESS ? (
        <>
          <h2>Rounds</h2>
          <Rounds />
          <div className="small muted">
            Contract <a className="mono" href={`${EXPLORER}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">{CONTRACT_ADDRESS}</a>
          </div>
        </>
      ) : (
        <section className="panel">
          <h2>Setup required</h2>
          <p className="small muted">
            Contract address is not configured. Deploy <span className="mono">SmartMoneyRounds</span> to {monad.name} and set{" "}
            <span className="mono">NEXT_PUBLIC_CONTRACT_ADDRESS</span> in Vercel project settings, then redeploy.
          </p>
        </section>
      )}
    </main>
  );
}
