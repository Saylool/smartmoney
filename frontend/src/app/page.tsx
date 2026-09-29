import { Header } from "@/components/Header";
import { Dashboard } from "@/components/Dashboard";
import { CONTRACT_ADDRESS, EXPLORER, monad } from "@/lib/config";

export default function Home() {
  return (
    <main>
      <Header />
      <section className="hero">
        <h1>
          Perpl&apos;s top 20 traders just picked a side.
          <br />
          <span className="accent">Are they right?</span>
        </h1>
        <p className="muted">
          Every round, SmartMoney reads the positions of the 20 most profitable Perpl traders of the last 30 days and
          publishes their net direction on-chain. You bet on whether smart money is <span className="ok">right</span> or{" "}
          <span className="error">wrong</span>. The price comes from an on-chain oracle, anyone can settle a round, and
          winners split the pool.
        </p>
      </section>
      <Dashboard />
      <footer className="small muted">
        Contract{" "}
        <a className="mono" href={`${EXPLORER}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">
          {CONTRACT_ADDRESS}
        </a>{" "}
        on {monad.name}. Testnet MON only, no real value.
      </footer>
    </main>
  );
}
