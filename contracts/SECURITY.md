# SmartMoneyRounds — threat model (v2)

Attack scenarios considered for `SmartMoneyRounds.sol` and `PerplOracleAdapter.sol`, and how each is handled.

## Handled in the contract

| # | Scenario | Mitigation |
| --- | --- | --- |
| 1 | **Late-entry edge**: bet after the start price is known | Bets are rejected once `now >= bettingCloses`, and `bettingCloses <= startTime` is enforced at creation. The start price is read only at or after `startTime`. |
| 2 | **Price manipulation by the operator** | The keeper never supplies prices. `lockRound`/`resolveRound` read `ORACLE.latestPrice`, and `ORACLE` is `immutable`, so the owner cannot swap it under a running round. |
| 3 | **Stale price** | The oracle observation must be at or after the round boundary (`StalePrice` otherwise), so a price from before `startTime`/`endTime` can never be used. |
| 4 | **Keeper or oracle offline / stuck funds** | Lock and resolve are permissionless within `SETTLE_WINDOW` (20 min). Afterwards anyone can `voidStaleRound` and users pull full refunds. Voided refunds never expire. |
| 5 | **Keeper cancelling a losing round** | `voidRound` only works while the round is `Open` (before the start price exists). Once locked, only the oracle decides. |
| 6 | **Reentrancy via `claim` / `withdrawTreasury`** | Checks‑effects‑interactions plus a `nonReentrant` guard. Tested with a re-entering receiver. |
| 7 | **Double claim** | `Position.claimed` flag; second call reverts `AlreadyClaimed`. |
| 8 | **Insolvency through rounding** | Payouts round down; the remainder is accounted as `dust` and moved to treasury only once exact (all winners claimed) or after `CLAIM_WINDOW`. Invariant: `balance == treasuryBalance + Σ outstanding obligations`. |
| 9 | **Fee change mid‑round** | `feeBps` is snapshotted per round at creation. Hard cap `MAX_FEE_BPS = 10 %`. |
| 10 | **Winners losing money** | Fee is taken from the losing pool only, so payout ≥ stake. If either side is empty the round is voided fee‑free. |
| 11 | **Tie** | `endPrice == startPrice` voids the round with full refunds. |
| 12 | **Griefing via a non‑payable winner or treasury** | Pull payments; a reverting receiver only blocks its own claim. Fees accrue in `treasuryBalance` and are pulled with `withdrawTreasury`. |
| 13 | **Spam / dust bets** | `minBet` enforced; stakes stored as `uint128` with an explicit overflow check. |
| 14 | **Unclaimed funds locked forever** | After `CLAIM_WINDOW` (90 d) unclaimed winnings of a resolved round are swept to treasury and the round closes to claims (`RoundSwept`), so a late claimer can never be paid from other rounds' funds. |
| 15 | **Wrong-status transitions** | Explicit `Status` state machine; every transition checks the exact expected state. |
| 16 | **Signal tampering after the fact** | `createRound` emits the full signal and stores `keccak256(signal)` plus `createdBlock` in the round. Anyone can fetch the event, check the hash and re-derive the direction from Perpl mainnet state at the recorded block (`keeper/src/verify-signal.mjs`). |
| 17 | **Adapter ABI drift** | The adapter decodes Perpl's `PerpetualInfo` struct and reverts `NoPrice` on a zero price or timestamp. The deploy script reads every market's price through the adapter before registering it. |

## Residual risks (accepted, documented)

* **Trader list.** The keeper chooses which 20 addresses are "smart money" from Perpl's leaderboard API, which is
  off-chain. Positions and the resulting direction are verifiable on-chain; the ranking is not. A malicious keeper
  could publish a hand-picked list, which would be visible in the signal.
* **Settlement timing.** Whoever settles first picks the moment inside the window, i.e. one of about 20 oracle
  updates. The keeper settles seconds after the boundary, which leaves little room, but a bettor running their
  own bot could race it. A tighter window reduces this at the cost of more stale voids.
* **Cross-environment price.** The signal is computed on Perpl mainnet; the price is Perpl's testnet oracle, which
  mirrors the same Chainlink Data Streams feed. Moving to mainnet would read Perpl mainnet prices directly.
* **Owner is trusted** to rotate keeper/treasury, add markets and set fee/minBet within caps. Use a multisig or
  timelock in production.
* **Block timestamps** gate the windows; drift of a few seconds is irrelevant at minute granularity.
