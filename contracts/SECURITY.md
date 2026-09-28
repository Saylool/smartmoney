# SmartMoneyRounds — threat model

Attack scenarios considered while writing `SmartMoneyRounds.sol`, and how each is handled.

## Handled in the contract

| # | Scenario | Mitigation |
| --- | --- | --- |
| 1 | **Late-entry edge**: bet after the direction/price is effectively known | Bets are rejected once `now >= bettingCloses`, and `bettingCloses <= startTime` is enforced at creation. The start price is snapshotted only at `startTime`, after betting is closed. |
| 2 | **Reentrancy via `claim` / `withdrawTreasury`** | Checks‑effects‑interactions (position marked `claimed`, totals updated, event emitted, then transfer) plus a `nonReentrant` guard. Tested with a re-entering receiver. |
| 3 | **Double claim** | `Position.claimed` flag; second call reverts `AlreadyClaimed`. |
| 4 | **Insolvency through rounding** | Every payout rounds *down*; leftover is accounted as `dust` and moved to treasury only once it is exactly known (all winners claimed) or the claim window has passed. Invariant: `balance == treasuryBalance + Σ outstanding obligations`. |
| 5 | **Fee change mid‑round** | `feeBps` is snapshotted per round at creation; owner changes affect only future rounds. Hard cap `MAX_FEE_BPS = 10 %`. |
| 6 | **Winners losing money** | Fee is taken from the *losing* pool only, so payout ≥ stake. If either side is empty the round is voided and everyone is refunded, fee‑free. |
| 7 | **Tie manipulation** | `endPrice == startPrice` voids the round with full refunds instead of favouring a side. |
| 8 | **Keeper goes offline / stuck funds** | Lock and resolve each have a 6 h liveness window. If missed, anyone can call `voidStaleRound` and users pull refunds. Voided refunds are claimable forever (never swept). |
| 9 | **Late/stale price posting** | Lock and resolve are rejected outside their windows (`TooEarly` / `TooLate`), bounding how far off‑schedule a price can be posted. |
| 10 | **Griefing via a non‑payable winner** | Payouts are pull‑based, so one address that cannot receive ETH only blocks its own claim, never the round or other users. |
| 11 | **Treasury as a reverting contract** | Fees are accrued in `treasuryBalance` and pulled with `withdrawTreasury`; resolution never depends on the treasury accepting ETH. |
| 12 | **Spam / dust bets** | `minBet` enforced; distinct-bettor counters use `uint32`, stakes `uint128` with explicit overflow check. |
| 13 | **Storage confusion across rounds** | Positions keyed by `(roundId, account)`; `roundId` is a monotonically increasing counter, never reused. |
| 14 | **Wrong-status transitions** | Explicit `Status` state machine; every transition checks the exact expected state and reverts with `WrongStatus`. |
| 15 | **Unclaimed funds locked forever** | After `CLAIM_WINDOW` (90 d) unclaimed winnings of a resolved round can be swept to treasury; the round is then closed to claims (`RoundSwept`) so a late claimer can never be paid from other rounds' funds. |

## Accepted trust assumptions (out of scope for the contract)

* **Keeper is a trusted oracle.** It supplies the smart‑money direction and both BTC prices. A malicious keeper could
  post a false price and steer the outcome. Mitigations live off‑chain (signed price sources, multiple feeds, public
  keeper logs) and could later move on‑chain (e.g. a Pyth/Chainlink read at `lock`/`resolve`). What the contract does
  guarantee even against a malicious keeper: it can never take user funds directly, never charge more than the capped fee,
  and can never lock funds indefinitely (stale rounds are voidable by anyone).
* **Owner is trusted** to rotate the keeper/treasury and set fee/minBet within caps. Consider a multisig or timelock.
* **Block timestamp** is used for windows; validator drift of a few seconds is irrelevant at hour granularity.
* **Perpl data quality**: the “top‑20 most profitable traders” signal is computed off‑chain by the keeper.
