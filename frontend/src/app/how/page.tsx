import { Header } from "@/components/Header";
import { CONTRACT_ADDRESS, EXPLORER, ORACLE_ADDRESS, PERPL_URL } from "@/lib/config";

export const metadata = { title: "How it works · SmartMoney" };

const REPO = "https://github.com/Saylool/smartmoney";

export default function How() {
  return (
    <main>
      <Header />
      <section className="panel prose">
        <h2>How a round works</h2>
        <ol>
          <li>
            <b>Signal.</b> The keeper takes the 20 most profitable traders on <a href={PERPL_URL}>Perpl</a> over the last
            30 days and reads their open positions directly from Perpl&apos;s exchange contract on Monad mainnet, all at
            one block. If they hold more long than short, smart money is LONG; otherwise SHORT. The full list is written
            on-chain with the round.
          </li>
          <li>
            <b>Betting.</b> You bet that smart money is <span className="ok">right</span> or{" "}
            <span className="error">wrong</span>. Betting closes when the round starts, so nobody can bet after the start
            price is known.
          </li>
          <li>
            <b>Start and end price.</b> At the start and end, anyone can call the contract to snapshot the price. The
            contract reads it from Perpl&apos;s on-chain oracle (Chainlink Data Streams) itself. Nobody, not even the keeper,
            can type in a price.
          </li>
          <li>
            <b>Payout.</b> If the price moved the way smart money was positioned, &quot;right&quot; wins, otherwise &quot;wrong&quot;
            wins. Winners split the whole pool in proportion to their stake. A 2% fee is taken from the losing side only,
            so a winner never gets back less than they put in. If nobody bet on one side, or the price did not move,
            everyone is refunded.
          </li>
          <li>
            <b>Claim.</b> Payouts are pulled: press Claim when a round settles. Unclaimed winnings stay claimable for 90 days.
          </li>
        </ol>

        <h2>What you do not have to trust</h2>
        <ul>
          <li>Prices come from an immutable oracle address; the owner cannot swap it.</li>
          <li>Anyone can lock and settle a round; if nobody does within 20 minutes, anyone can void it and everyone is refunded.</li>
          <li>The keeper cannot cancel a round once it has started and never touches funds.</li>
          <li>Each round&apos;s trader list and positions are published on-chain and can be re-checked against Perpl.</li>
          <li>The fee is fixed per round when it opens and capped at 10% in the contract.</li>
        </ul>

        <h2>Verify a round yourself</h2>
        <pre className="code">{`git clone ${REPO}
cd smartmoney/keeper && npm ci
node src/verify-signal.mjs <roundId>`}</pre>
        <p className="small muted">
          The script fetches the signal from the round&apos;s block, checks its hash against the one stored in the contract,
          re-reads every trader&apos;s position on Perpl mainnet at the same block and confirms the direction.
        </p>

        <h2>Contracts</h2>
        <ul className="mono small">
          <li>
            SmartMoneyRounds: <a href={`${EXPLORER}/address/${CONTRACT_ADDRESS}`}>{CONTRACT_ADDRESS}</a>
          </li>
          <li>
            PerplOracleAdapter: <a href={`${EXPLORER}/address/${ORACLE_ADDRESS}`}>{ORACLE_ADDRESS}</a>
          </li>
        </ul>
      </section>
    </main>
  );
}
