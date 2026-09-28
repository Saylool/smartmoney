# SmartMoney — contracts

Parimutuel rounds on whether Perpl "smart money" (top‑20 traders' net BTC direction over the
last 30 days) turns out to be right. Built for Monad Metropolis, Track 01.

## Round lifecycle

| Step | Who | When | Effect |
| --- | --- | --- | --- |
| `createRound(direction, bettingCloses, startTime, endTime)` | keeper | any time | Opens a round; snapshots `feeBps` |
| `bet(roundId, side)` | anyone | `now < bettingCloses` | Stakes native token on **Right** or **Wrong** |
| `lockRound(roundId, startPrice)` | keeper | `[startTime, startTime + 6h]` | Snapshots BTC start price |
| `resolveRound(roundId, endPrice)` | keeper | `[endTime, endTime + 6h]` | Picks winner, books fee. Tie or one‑sided pool → **Voided** (full refund) |
| `claim(roundId)` | bettor | after Resolved / Voided | Pull payout or refund |
| `sweepRound(roundId)` | anyone | all winners claimed, or `endTime + 90d` | Dust (and forfeited unclaimed winnings) → treasury |
| `voidStaleRound(roundId)` | anyone | keeper missed the lock/resolve window | Refund path when the keeper is offline |
| `withdrawTreasury()` | anyone | any time | Sends accrued fee + dust to `treasury` |

Payout for a winner: `stake * (rightPool + wrongPool - fee) / winningPool`, rounded down.
Fee is `feeBps` of the **losing** pool only (max 10 %), so a winner never receives less than their stake.

Invariant enforced by the test suite for every settled round:
`claimedTotal + fee + dust == rightPool + wrongPool`.

## Build & test

```bash
forge test
```

Offline / sandboxed machine (no solc download): put `solc-macos` 0.8.28 at `.solc/solc-0.8.28` and run
`FOUNDRY_PROFILE=local forge test`. `forge-std` is vendored under `lib/`.

Handler coverage counters for the invariant suite are printed with `forge test --match-contract Invariant -vv`.

See [SECURITY.md](SECURITY.md) for the threat model.
