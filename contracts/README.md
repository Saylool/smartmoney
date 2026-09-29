# SmartMoney — contracts

Parimutuel rounds on whether Perpl "smart money" (net direction of the top‑20 traders by 30-day PnL) turns
out to be right. See [SECURITY.md](SECURITY.md) for the threat model.

## Contracts

| Contract | Role |
| --- | --- |
| `SmartMoneyRounds` | Markets, rounds, bets, permissionless oracle settlement, pull payouts, stats |
| `PerplOracleAdapter` | `IPriceOracle` over the Chainlink Data Streams price Perpl stores on-chain per perpetual |

## Round lifecycle

| Step | Who | When | Effect |
| --- | --- | --- | --- |
| `createRound(marketId, direction, bettingCloses, startTime, signal)` | keeper | any time | Opens a round, snapshots `feeBps`, emits `SignalPublished`, stores `signalHash` and `createdBlock`; `endTime = startTime + market.duration` |
| `bet(roundId, side)` | anyone | `now < bettingCloses` | Stakes native MON on **Right** or **Wrong** |
| `lockRound(roundId)` | **anyone** | `[startTime, startTime + SETTLE_WINDOW]` | Reads the start price from `ORACLE`; observation must be `>= startTime` |
| `resolveRound(roundId)` | **anyone** | `[endTime, endTime + SETTLE_WINDOW]` | Reads the end price; picks the winner. Tie or one‑sided pool → **Voided** |
| `voidRound(roundId)` | keeper | while `Open` only | Cancels a round that has not started |
| `voidStaleRound(roundId)` | anyone | a settle window was missed | Full refunds |
| `claim(roundId)` | bettor | after Resolved / Voided | Pull payout or refund |
| `sweepRound(roundId)` | anyone | all winners claimed, or `endTime + 90d` | Dust (and forfeited winnings) → treasury |
| `withdrawTreasury()` | anyone | any time | Sends accrued fee + dust to `treasury` |

Winner payout: `stake * (rightPool + wrongPool - fee) / winningPool`, rounded down. The fee is `feeBps` of the
**losing** pool only (max 10 %), so a winner never receives less than their stake.

Views for clients: `getRound`, `getMarket`, `getPosition`, `claimable`, `marketStats` (smart money's track record per
market), `userStats`, `participants(offset, limit)`.

## Invariants (tested)

- For every swept round: `claimedTotal + fee + dust == rightPool + wrongPool`.
- The contract is exactly solvent: `balance == treasuryBalance + Σ outstanding obligations`.
- Money in == payouts + treasury withdrawals + balance.
- A winner's claimable amount is never below their stake.
- Track-record and user-stat counters always match settled rounds and actual flows.

## Build and test

```bash
forge test
```

Offline or sandboxed machine (no solc download): put `solc-macos` 0.8.28 at `.solc/solc-0.8.28` and run
`FOUNDRY_PROFILE=local forge test`. `forge-std` is vendored under `lib/`.

Deployment is done by `keeper/src/deploy.mjs` (viem) or `script/Deploy.s.sol` (forge).
