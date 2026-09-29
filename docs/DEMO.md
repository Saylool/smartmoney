# Demo video script (about 2 minutes)

Record the screen at 1080p with the live site and one terminal. Keep each shot short; the voice-over below is
written to be read at a relaxed pace.

| Time | On screen | Voice-over |
| --- | --- | --- |
| 0:00–0:12 | Home page hero | "Perpl is Monad's on-chain perps exchange. Its top 20 traders just picked a side on Bitcoin. Are they right? That is the whole game." |
| 0:12–0:30 | Scroll to the signal panel: 20 traders, their PnL and positions | "Every round we take Perpl's 20 most profitable traders of the last 30 days and read their positions straight from Perpl's contract on Monad mainnet. Net long means smart money is LONG. The full list goes on-chain with the round." |
| 0:30–0:50 | Connect wallet (or log in with email via Privy), pick BTC 15 min, bet 0.1 MON on WRONG, show the confirmation | "You bet that smart money is right or wrong. Betting closes when the round starts. Monad confirms in under a second." |
| 0:50–1:10 | Live round card: start price, live price, "smart money winning/losing" | "At the start, anyone can lock the round. The contract reads the price from Perpl's on-chain Chainlink oracle itself. Nobody, not even us, can type in a price." |
| 1:10–1:25 | A resolved round, press Claim, then the leaderboard | "When the round ends, winners split the pool. The fee only comes out of the losing side, so a winner never gets back less than they bet. If the price does not move or one side is empty, everyone is refunded." |
| 1:25–1:45 | Terminal: `npm run verify-signal <id>` with four PASS lines | "Don't trust us: this script refetches the signal from the chain, checks its hash and recomputes the direction from Perpl's mainnet state at the same block." |
| 1:45–2:00 | Track record panel with the backtest | "And is smart money actually right? Over the last week, about half the time, even with the odds stacked in its favour. That is exactly why this is a fair market. SmartMoney: bet with, or against, the best traders on Monad." |

## Before recording

1. Make sure the keeper is running (`cd keeper && npm run keeper`) so a BTC 15-minute round is open.
2. Fund the demo wallet from https://faucet.monad.xyz and wait a few seconds before the first bet.
3. Have a resolved round ready to claim (bet on a 15-minute round about 20 minutes before recording).
4. Open a terminal in `keeper/` with `npm run verify-signal <id>` typed and ready.
