import { Header } from "@/components/Header";
import { Dashboard } from "@/components/Dashboard";
import { CONTRACT_ADDRESS, EXPLORER, monad } from "@/lib/config";

export default function Home() {
  return (
    <>
      <div className="hero-wrap">
        <div className="hero-bg" aria-hidden />
        <div className="hero-shade" aria-hidden />
        <div className="hero-inner">
          <Header />
          <section className="hero">
            <span className="eyebrow">Live on Monad testnet · settled by an on-chain oracle</span>
            <h1>
              Perpl&apos;s top 20 traders
              <br />
              just picked a side.
              <br />
              <span className="accent">Are they right?</span>
            </h1>
            <p>
              Every round we read the positions of the 20 most profitable Perpl traders and publish their net
              direction on-chain. You bet that smart money is <span className="ok">right</span> or{" "}
              <span className="error">wrong</span>. Winners split the pool.
            </p>
            <div className="hero-cta">
              <a className="btn primary" href="#rounds">Bet on the next round</a>
              <a className="btn ghost" href="/how">How it works</a>
            </div>
            <ul className="hero-points">
              <li><b>20</b> traders, read on-chain</li>
              <li><b>15 min</b> fastest rounds</li>
              <li><b>0</b> prices typed by humans</li>
            </ul>
          </section>
        </div>
      </div>
      <main id="rounds">
        <Dashboard />
        <footer className="small muted">
          Contract{" "}
          <a className="mono" href={`${EXPLORER}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">
            {CONTRACT_ADDRESS}
          </a>{" "}
          on {monad.name}. Testnet MON only, no real value. Artwork generated with Higgsfield.
        </footer>
      </main>
    </>
  );
}
