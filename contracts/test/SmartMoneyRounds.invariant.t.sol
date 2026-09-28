// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {SmartMoneyRounds} from "../src/SmartMoneyRounds.sol";

/// @dev Drives the contract through random-but-valid sequences of keeper and user actions.
contract Handler is Test {
    SmartMoneyRounds public sm;
    address public keeper;
    address public owner;

    address[] public actors;
    uint256[] public rounds;

    // ghost totals
    uint256 public ghostDeposited;
    uint256 public ghostPaidOut; // claims to users
    uint256 public ghostTreasuryWithdrawn;
    // coverage counters
    uint256 public ghostBets;
    uint256 public ghostOneSided;
    uint256 public ghostTie;
    uint256 public ghostVoidKeeper;
    uint256 public ghostVoidStale;
    uint256 public ghostResolved;
    uint256 public ghostVoided;
    uint256 public ghostSweptExact; // swept because every winner claimed
    uint256 public ghostSweptWindow; // swept after CLAIM_WINDOW

    constructor(SmartMoneyRounds sm_, address keeper_, address owner_) {
        sm = sm_;
        keeper = keeper_;
        owner = owner_;
        for (uint256 i = 0; i < 6; i++) {
            address a = address(uint160(0xA11CE000 + i));
            actors.push(a);
            vm.deal(a, 1_000_000 ether);
        }
    }

    // ------------------------------------------------------------ helpers

    function _actor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    /// @dev 3/4 of the time one of the three newest rounds (those likely still in flight), else any.
    function _round(uint256 seed) internal view returns (uint256 id, bool ok) {
        uint256 n = rounds.length;
        if (n == 0) return (0, false);
        if (seed % 4 == 0) return (rounds[seed % n], true);
        uint256 back = (seed / 4) % 3;
        if (back >= n) back = n - 1;
        return (rounds[n - 1 - back], true);
    }

    // ------------------------------------------------------------ actions

    function createRound(uint8 dir, uint32 betDur, uint32 gap, uint32 roundDur) external {
        SmartMoneyRounds.Direction d = dir % 2 == 0 ? SmartMoneyRounds.Direction.Long : SmartMoneyRounds.Direction.Short;
        // Keep at most one round accepting bets at a time (mirrors the hourly keeper cadence
        // and stops the handler from starving bets by warping past every betting window).
        if (rounds.length > 0) {
            SmartMoneyRounds.Round memory last = sm.getRound(rounds[rounds.length - 1]);
            if (last.status == SmartMoneyRounds.Status.Open) return;
        }
        uint64 now_ = uint64(block.timestamp);
        uint64 bc = now_ + uint64(bound(betDur, 30 minutes, 2 hours));
        uint64 st = bc + uint64(bound(gap, 0, 1 hours));
        uint64 et = st + uint64(bound(roundDur, 1, 3 hours));
        vm.prank(keeper);
        uint256 id = sm.createRound(d, bc, st, et);
        rounds.push(id);
    }

    function bet(uint256 rSeed, uint256 aSeed, uint8 side, uint96 amt) external {
        if (rounds.length == 0) return;
        // Only the newest round can be open for betting (creation is serialized), so target it;
        // 1 in 8 calls tries a random older round to exercise the BettingClosed path.
        uint256 id = rSeed % 8 == 0 ? rounds[rSeed % rounds.length] : rounds[rounds.length - 1];
        SmartMoneyRounds.Round memory r = sm.getRound(id);
        if (r.status != SmartMoneyRounds.Status.Open || block.timestamp >= r.bettingCloses) return;
        uint256 amount = bound(amt, sm.minBet(), 500 ether);
        SmartMoneyRounds.Side s = side % 2 == 0 ? SmartMoneyRounds.Side.Right : SmartMoneyRounds.Side.Wrong;
        vm.prank(_actor(aSeed));
        sm.bet{value: amount}(id, s);
        ghostDeposited += amount;
        ghostBets++;
    }

    function warp(uint32 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 45 minutes));
    }

    /// @dev Rarely jump past CLAIM_WINDOW so window-sweeps (forfeited winnings) get exercised.
    function warpPastClaimWindow(uint256 seed) external {
        if (seed % 128 != 0) return;
        vm.warp(block.timestamp + sm.CLAIM_WINDOW() + 1);
    }

    function lock(uint256 rSeed, uint96 price) external {
        if (rounds.length == 0) return;
        // only the newest round can still be Open (creation is serialized)
        uint256 id = rSeed % 8 == 0 ? rounds[rSeed % rounds.length] : rounds[rounds.length - 1];
        SmartMoneyRounds.Round memory r = sm.getRound(id);
        if (r.status != SmartMoneyRounds.Status.Open) return;
        // never skip an open betting window; only time itself (warp) may close it
        if (block.timestamp < r.bettingCloses) return;
        if (block.timestamp < r.startTime) vm.warp(r.startTime);
        if (block.timestamp > r.startTime + sm.LIVENESS_GRACE()) return;
        vm.prank(keeper);
        sm.lockRound(id, bound(price, 1, 1e12));
    }

    function resolve(uint256 rSeed, uint96 price) external {
        (uint256 id, bool ok) = _round(rSeed);
        if (!ok) return;
        SmartMoneyRounds.Round memory r = sm.getRound(id);
        if (r.status != SmartMoneyRounds.Status.Locked) return;
        if (block.timestamp < r.endTime) vm.warp(r.endTime);
        if (block.timestamp > r.endTime + sm.LIVENESS_GRACE()) return;
        if (r.rightPool == 0 || r.wrongPool == 0) ghostOneSided++;
        // bias towards ties sometimes to exercise the void path
        uint256 p = price % 7 == 0 ? r.startPrice : bound(price, 1, 1e12);
        if (p == r.startPrice) ghostTie++;
        vm.prank(keeper);
        sm.resolveRound(id, p);
        _countOutcome(id);
    }

    function _countOutcome(uint256 id) internal {
        SmartMoneyRounds.Status s = sm.getRound(id).status;
        if (s == SmartMoneyRounds.Status.Resolved) ghostResolved++;
        else if (s == SmartMoneyRounds.Status.Voided) ghostVoided++;
    }

    function _countSweep(uint256 id) internal {
        SmartMoneyRounds.Round memory r = sm.getRound(id);
        uint32 winners = r.winner == SmartMoneyRounds.Side.Right ? r.rightBettors : r.wrongBettors;
        if (r.claims == winners) ghostSweptExact++;
        else ghostSweptWindow++;
    }

    function keeperVoid(uint256 rSeed) external {
        if (rSeed % 8 != 0) return; // rare: keeper voids are an exceptional path
        (uint256 id, bool ok) = _round(rSeed);
        if (!ok) return;
        SmartMoneyRounds.Status s = sm.getRound(id).status;
        if (s != SmartMoneyRounds.Status.Open && s != SmartMoneyRounds.Status.Locked) return;
        vm.prank(keeper);
        sm.voidRound(id);
        ghostVoided++;
        ghostVoidKeeper++;
    }

    function voidStale(uint256 rSeed) external {
        (uint256 id, bool ok) = _round(rSeed);
        if (!ok) return;
        SmartMoneyRounds.Round memory r = sm.getRound(id);
        bool can = (r.status == SmartMoneyRounds.Status.Open && block.timestamp > r.startTime + sm.LIVENESS_GRACE())
            || (r.status == SmartMoneyRounds.Status.Locked && block.timestamp > r.endTime + sm.LIVENESS_GRACE());
        if (!can) return;
        sm.voidStaleRound(id);
        ghostVoided++;
        ghostVoidStale++;
    }

    function claim(uint256 rSeed, uint256 aSeed) external {
        (uint256 id, bool ok) = _round(rSeed);
        if (!ok) return;
        address who = _actor(aSeed);
        if (sm.claimable(id, who) == 0 || sm.getRound(id).swept) return;
        uint256 before = who.balance;
        vm.prank(who);
        sm.claim(id);
        ghostPaidOut += who.balance - before;
    }

    function sweep(uint256 rSeed) external {
        (uint256 id, bool ok) = _round(rSeed);
        if (!ok) return;
        SmartMoneyRounds.Round memory r = sm.getRound(id);
        if (r.status != SmartMoneyRounds.Status.Resolved || r.swept) return;
        uint32 winners = r.winner == SmartMoneyRounds.Side.Right ? r.rightBettors : r.wrongBettors;
        if (r.claims != winners && block.timestamp <= r.endTime + sm.CLAIM_WINDOW()) return;
        _countSweep(id);
        sm.sweepRound(id);
    }

    function withdrawTreasury() external {
        uint256 amt = sm.treasuryBalance();
        if (amt == 0) return;
        sm.withdrawTreasury();
        ghostTreasuryWithdrawn += amt;
    }

    function setFee(uint16 bps) external {
        uint16 capped = uint16(bound(bps, 0, sm.MAX_FEE_BPS()));
        vm.prank(owner);
        sm.setFeeBps(capped);
    }

    /// @dev Fast path: take a round all the way to fully-claimed-and-swept so the exact-dust
    ///      invariant is exercised often.
    function settleFully(uint256 rSeed, uint96 p0, uint96 p1) external {
        (uint256 id, bool ok) = _round(rSeed);
        if (!ok) return;
        SmartMoneyRounds.Round memory r = sm.getRound(id);
        if (r.status == SmartMoneyRounds.Status.Open) {
            if (block.timestamp < r.bettingCloses) return; // see lock()
            if (block.timestamp > r.startTime + sm.LIVENESS_GRACE()) return;
            if (block.timestamp < r.startTime) vm.warp(r.startTime);
            vm.prank(keeper);
            sm.lockRound(id, bound(p0, 1, 1e12));
            r = sm.getRound(id);
        }
        if (r.status == SmartMoneyRounds.Status.Locked) {
            if (block.timestamp > r.endTime + sm.LIVENESS_GRACE()) return;
            if (block.timestamp < r.endTime) vm.warp(r.endTime);
            vm.prank(keeper);
            sm.resolveRound(id, bound(p1, 1, 1e12));
            _countOutcome(id);
            r = sm.getRound(id);
        }
        for (uint256 i = 0; i < actors.length; i++) {
            address who = actors[i];
            if (sm.claimable(id, who) == 0) continue;
            uint256 before = who.balance;
            vm.prank(who);
            sm.claim(id);
            ghostPaidOut += who.balance - before;
        }
        if (r.status == SmartMoneyRounds.Status.Resolved && !sm.getRound(id).swept) {
            _countSweep(id);
            sm.sweepRound(id);
        }
    }

    function roundsLength() external view returns (uint256) {
        return rounds.length;
    }

    function actorsLength() external view returns (uint256) {
        return actors.length;
    }
}

contract SmartMoneyRoundsInvariantTest is Test {
    SmartMoneyRounds sm;
    Handler handler;

    address owner = makeAddr("owner");
    address keeper = makeAddr("keeper");
    address treasury = makeAddr("treasury");

    function setUp() public {
        vm.warp(1_800_000_000);
        sm = new SmartMoneyRounds(owner, keeper, treasury, 200, 0.01 ether);
        handler = new Handler(sm, keeper, owner);
        targetContract(address(handler));
    }

    /// @dev Prints coverage counters after each invariant run (visible with -vv).
    function afterInvariant() public view {
        console2.log("rounds", handler.roundsLength());
        console2.log("bets", handler.ghostBets());
        console2.log("deposited", handler.ghostDeposited());
        console2.log("oneSidedAtResolve", handler.ghostOneSided());
        console2.log("tie", handler.ghostTie());
        console2.log("voidKeeper", handler.ghostVoidKeeper());
        console2.log("voidStale", handler.ghostVoidStale());
        console2.log("resolved", handler.ghostResolved());
        console2.log("voided", handler.ghostVoided());
        console2.log("sweptExact", handler.ghostSweptExact());
        console2.log("sweptWindow", handler.ghostSweptWindow());
    }

    /// @notice For every resolved+swept round: payouts + fee + dust == total pool.
    ///         For every resolved (not yet swept) round: payouts + fee <= pool (dust pending).
    ///         For every voided round: refunds <= pool, fee == 0.
    function invariant_perRoundConservation() public view {
        uint256 n = handler.roundsLength();
        for (uint256 i = 0; i < n; i++) {
            uint256 id = handler.rounds(i);
            SmartMoneyRounds.Round memory r = sm.getRound(id);
            uint256 pool = r.rightPool + r.wrongPool;
            if (r.status == SmartMoneyRounds.Status.Resolved) {
                if (r.swept) {
                    assertEq(r.claimedTotal + r.fee + r.dust, pool, "swept: payouts+fee+dust != pool");
                } else {
                    assertLe(r.claimedTotal + r.fee, pool, "resolved: payouts+fee > pool");
                    assertEq(r.dust, 0);
                }
            } else if (r.status == SmartMoneyRounds.Status.Voided) {
                assertEq(r.fee, 0, "void must not charge a fee");
                assertLe(r.claimedTotal, pool, "void: refunds > pool");
            } else {
                assertEq(r.claimedTotal, 0);
                assertEq(r.fee, 0);
            }
        }
    }

    /// @notice Contract is always exactly solvent: balance == treasuryBalance + outstanding obligations.
    function invariant_solvency() public view {
        uint256 n = handler.roundsLength();
        uint256 outstanding;
        for (uint256 i = 0; i < n; i++) {
            SmartMoneyRounds.Round memory r = sm.getRound(handler.rounds(i));
            uint256 pool = r.rightPool + r.wrongPool;
            outstanding += pool - r.claimedTotal - r.fee - r.dust;
        }
        assertEq(address(sm).balance, sm.treasuryBalance() + outstanding, "balance != treasury + obligations");
    }

    /// @notice Money in == money out + money still inside.
    function invariant_globalFlow() public view {
        assertEq(
            handler.ghostDeposited(),
            handler.ghostPaidOut() + handler.ghostTreasuryWithdrawn() + address(sm).balance,
            "deposits != payouts + withdrawn + balance"
        );
    }

    /// @notice A winner can never receive less than their stake (fee only touches the losing pool).
    function invariant_winnersNeverLose() public view {
        uint256 n = handler.roundsLength();
        uint256 m = handler.actorsLength();
        for (uint256 i = 0; i < n; i++) {
            uint256 id = handler.rounds(i);
            SmartMoneyRounds.Round memory r = sm.getRound(id);
            if (r.status != SmartMoneyRounds.Status.Resolved || r.swept) continue;
            for (uint256 j = 0; j < m; j++) {
                address who = handler.actors(j);
                SmartMoneyRounds.Position memory p = sm.getPosition(id, who);
                if (p.claimed) continue;
                uint256 stake = r.winner == SmartMoneyRounds.Side.Right ? p.right : p.wrong;
                assertGe(sm.claimable(id, who), stake, "winner payout < stake");
            }
        }
    }
}
