// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SmartMoneyRounds} from "../src/SmartMoneyRounds.sol";
import {IPriceOracle} from "../src/interfaces/IPriceOracle.sol";
import {MockOracle} from "./mocks/MockOracle.sol";

/// @dev Reenters claim() from its receive hook; the inner call must revert.
contract Reenterer {
    SmartMoneyRounds immutable sm;
    uint256 roundId;
    bool public innerReverted;

    constructor(SmartMoneyRounds sm_) {
        sm = sm_;
    }

    function betOn(uint256 id, SmartMoneyRounds.Side side) external payable {
        roundId = id;
        sm.bet{value: msg.value}(id, side);
    }

    function attack() external {
        sm.claim(roundId);
    }

    receive() external payable {
        try sm.claim(roundId) {}
        catch {
            innerReverted = true;
        }
    }
}

contract RejectsEther {
    fallback() external payable {
        revert("no");
    }
}

contract SmartMoneyRoundsTest is Test {
    SmartMoneyRounds sm;
    MockOracle oracle;

    address owner = makeAddr("owner");
    address keeper = makeAddr("keeper");
    address treasury = makeAddr("treasury");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    uint16 constant FEE_BPS = 200; // 2 %
    uint256 constant MIN_BET = 0.01 ether;
    uint64 constant WINDOW = 20 minutes;
    uint64 constant FEED = 16;
    uint256 constant MARKET = 1;
    bytes constant SIGNAL = bytes('{"v":1,"traders":[]}');

    uint64 constant T0 = 1_800_000_000;
    uint64 bettingCloses = T0 + 50 minutes;
    uint64 startTime = T0 + 1 hours;
    uint64 endTime = T0 + 2 hours; // market duration = 1 hour

    SmartMoneyRounds.Direction constant LONG = SmartMoneyRounds.Direction.Long;
    SmartMoneyRounds.Direction constant SHORT = SmartMoneyRounds.Direction.Short;
    SmartMoneyRounds.Side constant RIGHT = SmartMoneyRounds.Side.Right;
    SmartMoneyRounds.Side constant WRONG = SmartMoneyRounds.Side.Wrong;

    function setUp() public {
        vm.warp(T0);
        oracle = new MockOracle();
        sm = new SmartMoneyRounds(owner, keeper, treasury, FEE_BPS, MIN_BET, oracle, WINDOW);
        vm.prank(owner);
        sm.addMarket("BTC", FEED, 1 hours);
        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);
        vm.deal(carol, 1000 ether);
    }

    // ------------------------------------------------------------------ helpers

    function _create(SmartMoneyRounds.Direction d) internal returns (uint256 id) {
        vm.prank(keeper);
        id = sm.createRound(MARKET, d, bettingCloses, startTime, SIGNAL);
    }

    function _bet(address who, uint256 id, SmartMoneyRounds.Side side, uint256 amt) internal {
        vm.prank(who);
        sm.bet{value: amt}(id, side);
    }

    function _lock(uint256 id, uint256 price) internal {
        vm.warp(startTime);
        oracle.set(FEED, price, startTime);
        sm.lockRound(id);
    }

    function _resolve(uint256 id, uint256 price) internal {
        vm.warp(endTime);
        oracle.set(FEED, price, endTime);
        sm.resolveRound(id);
    }

    function _claim(address who, uint256 id) internal returns (uint256 got) {
        uint256 before = who.balance;
        vm.prank(who);
        sm.claim(id);
        got = who.balance - before;
    }

    // ------------------------------------------------------------------ constructor / admin

    function test_constructor_setsConfig() public view {
        assertEq(sm.owner(), owner);
        assertEq(sm.keeper(), keeper);
        assertEq(sm.treasury(), treasury);
        assertEq(sm.feeBps(), FEE_BPS);
        assertEq(sm.minBet(), MIN_BET);
        assertEq(address(sm.ORACLE()), address(oracle));
        assertEq(sm.SETTLE_WINDOW(), WINDOW);
    }

    function test_constructor_reverts() public {
        vm.expectRevert(SmartMoneyRounds.ZeroAddress.selector);
        new SmartMoneyRounds(address(0), keeper, treasury, FEE_BPS, MIN_BET, oracle, WINDOW);
        vm.expectRevert(SmartMoneyRounds.ZeroAddress.selector);
        new SmartMoneyRounds(owner, address(0), treasury, FEE_BPS, MIN_BET, oracle, WINDOW);
        vm.expectRevert(SmartMoneyRounds.ZeroAddress.selector);
        new SmartMoneyRounds(owner, keeper, address(0), FEE_BPS, MIN_BET, oracle, WINDOW);
        vm.expectRevert(SmartMoneyRounds.ZeroAddress.selector);
        new SmartMoneyRounds(owner, keeper, treasury, FEE_BPS, MIN_BET, IPriceOracle(address(0)), WINDOW);
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.FeeTooHigh.selector, 1001, 1000));
        new SmartMoneyRounds(owner, keeper, treasury, 1001, MIN_BET, oracle, WINDOW);
        vm.expectRevert(SmartMoneyRounds.InvalidWindow.selector);
        new SmartMoneyRounds(owner, keeper, treasury, FEE_BPS, MIN_BET, oracle, 30);
        vm.expectRevert(SmartMoneyRounds.InvalidWindow.selector);
        new SmartMoneyRounds(owner, keeper, treasury, FEE_BPS, MIN_BET, oracle, 2 days);
    }

    function test_admin_onlyOwner() public {
        vm.startPrank(alice);
        vm.expectRevert(SmartMoneyRounds.NotOwner.selector);
        sm.setKeeper(alice);
        vm.expectRevert(SmartMoneyRounds.NotOwner.selector);
        sm.setTreasury(alice);
        vm.expectRevert(SmartMoneyRounds.NotOwner.selector);
        sm.setFeeBps(1);
        vm.expectRevert(SmartMoneyRounds.NotOwner.selector);
        sm.setMinBet(1);
        vm.expectRevert(SmartMoneyRounds.NotOwner.selector);
        sm.transferOwnership(alice);
        vm.expectRevert(SmartMoneyRounds.NotOwner.selector);
        sm.addMarket("ETH", 32, 1 hours);
        vm.expectRevert(SmartMoneyRounds.NotOwner.selector);
        sm.setMarketActive(1, false);
        vm.stopPrank();
    }

    function test_admin_setters() public {
        vm.startPrank(owner);
        sm.setKeeper(alice);
        sm.setTreasury(bob);
        sm.setFeeBps(500);
        sm.setMinBet(1 ether);
        sm.transferOwnership(carol);
        vm.stopPrank();
        assertEq(sm.keeper(), alice);
        assertEq(sm.treasury(), bob);
        assertEq(sm.feeBps(), 500);
        assertEq(sm.minBet(), 1 ether);
        assertEq(sm.owner(), carol);

        vm.startPrank(carol);
        vm.expectRevert(SmartMoneyRounds.ZeroAddress.selector);
        sm.setKeeper(address(0));
        vm.expectRevert(SmartMoneyRounds.ZeroAddress.selector);
        sm.setTreasury(address(0));
        vm.expectRevert(SmartMoneyRounds.ZeroAddress.selector);
        sm.transferOwnership(address(0));
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.FeeTooHigh.selector, 1001, 1000));
        sm.setFeeBps(1001);
        vm.stopPrank();
    }

    // ------------------------------------------------------------------ markets

    function test_markets_addAndToggle() public {
        vm.startPrank(owner);
        uint256 eth = sm.addMarket("ETH", 32, 15 minutes);
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.InvalidMarket.selector, 0));
        sm.addMarket("", 1, 1 hours);
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.InvalidMarket.selector, 0));
        sm.addMarket("X", 1, 0);
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.InvalidMarket.selector, 9));
        sm.setMarketActive(9, false);
        sm.setMarketActive(eth, false);
        vm.stopPrank();

        assertEq(eth, 2);
        assertEq(sm.marketCount(), 2);
        SmartMoneyRounds.Market memory m = sm.getMarket(eth);
        assertEq(m.symbol, "ETH");
        assertEq(m.feedId, 32);
        assertEq(m.duration, 15 minutes);
        assertFalse(m.active);

        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.MarketInactive.selector, eth));
        sm.createRound(eth, LONG, bettingCloses, startTime, SIGNAL);
    }

    function test_markets_endTimeFollowsDuration() public {
        vm.prank(owner);
        uint256 fast = sm.addMarket("BTC", FEED, 15 minutes);
        vm.prank(keeper);
        uint256 id = sm.createRound(fast, LONG, bettingCloses, startTime, SIGNAL);
        assertEq(sm.getRound(id).endTime, startTime + 15 minutes);
        assertEq(sm.getRound(id).marketId, fast);
    }

    // ------------------------------------------------------------------ createRound / signal

    function test_createRound_onlyKeeper() public {
        vm.expectRevert(SmartMoneyRounds.NotKeeper.selector);
        sm.createRound(MARKET, LONG, bettingCloses, startTime, SIGNAL);
    }

    function test_createRound_validates() public {
        vm.startPrank(keeper);
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.InvalidMarket.selector, 0));
        sm.createRound(0, LONG, bettingCloses, startTime, SIGNAL);
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.InvalidMarket.selector, 7));
        sm.createRound(7, LONG, bettingCloses, startTime, SIGNAL);
        vm.expectRevert(SmartMoneyRounds.InvalidDirection.selector);
        sm.createRound(MARKET, SmartMoneyRounds.Direction.None, bettingCloses, startTime, SIGNAL);
        vm.expectRevert(SmartMoneyRounds.InvalidSchedule.selector);
        sm.createRound(MARKET, LONG, T0, startTime, SIGNAL); // closes now
        vm.expectRevert(SmartMoneyRounds.InvalidSchedule.selector);
        sm.createRound(MARKET, LONG, bettingCloses, bettingCloses - 1, SIGNAL); // start before close
        vm.expectRevert(SmartMoneyRounds.EmptySignal.selector);
        sm.createRound(MARKET, LONG, bettingCloses, startTime, "");
        vm.stopPrank();
    }

    function test_createRound_emitsSignalAndStoresHash() public {
        vm.expectEmit(true, true, false, true);
        emit SmartMoneyRounds.RoundCreated(1, MARKET, LONG, bettingCloses, startTime, endTime, keccak256(SIGNAL));
        vm.expectEmit(true, false, false, true);
        emit SmartMoneyRounds.SignalPublished(1, SIGNAL);
        uint256 id = _create(LONG);

        SmartMoneyRounds.Round memory r = sm.getRound(id);
        assertEq(id, 1);
        assertEq(uint8(r.status), uint8(SmartMoneyRounds.Status.Open));
        assertEq(uint8(r.direction), uint8(LONG));
        assertEq(r.feeBps, FEE_BPS);
        assertEq(r.signalHash, keccak256(SIGNAL));
        assertEq(r.createdBlock, block.number);
        assertEq(r.endTime, endTime);
    }

    function test_feeSnapshot_ownerChangeDoesNotAffectOpenRound() public {
        uint256 id = _create(LONG);
        vm.prank(owner);
        sm.setFeeBps(1000);
        _bet(alice, id, RIGHT, 1 ether);
        _bet(bob, id, WRONG, 1 ether);
        _lock(id, 100);
        _resolve(id, 110);
        assertEq(sm.getRound(id).fee, 0.02 ether); // 2 %, not 10 %
    }

    // ------------------------------------------------------------------ bet

    function test_bet_happyPath_countsDistinctBettors() public {
        uint256 id = _create(LONG);
        vm.expectEmit(true, true, false, true);
        emit SmartMoneyRounds.BetPlaced(id, alice, RIGHT, 1 ether);
        _bet(alice, id, RIGHT, 1 ether);
        _bet(alice, id, RIGHT, 2 ether);
        _bet(alice, id, WRONG, 0.5 ether);
        _bet(bob, id, WRONG, 3 ether);

        SmartMoneyRounds.Round memory r = sm.getRound(id);
        assertEq(r.rightPool, 3 ether);
        assertEq(r.wrongPool, 3.5 ether);
        assertEq(r.rightBettors, 1);
        assertEq(r.wrongBettors, 2);
        SmartMoneyRounds.Position memory p = sm.getPosition(id, alice);
        assertEq(p.right, 3 ether);
        assertEq(p.wrong, 0.5 ether);
        assertEq(address(sm).balance, 6.5 ether);
    }

    function test_bet_reverts() public {
        uint256 id = _create(LONG);

        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.RoundNotFound.selector, 99));
        _bet(alice, 99, RIGHT, 1 ether);

        vm.expectRevert(SmartMoneyRounds.InvalidSide.selector);
        _bet(alice, id, SmartMoneyRounds.Side.None, 1 ether);

        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.BetBelowMinimum.selector, MIN_BET - 1, MIN_BET));
        _bet(alice, id, RIGHT, MIN_BET - 1);

        vm.warp(bettingCloses); // strict: closed at bettingCloses
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.BettingClosed.selector, id));
        _bet(alice, id, RIGHT, 1 ether);

        vm.warp(startTime - 1); // still closed before start: no late-entry edge
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.BettingClosed.selector, id));
        _bet(alice, id, RIGHT, 1 ether);

        _lock(id, 100);
        vm.expectRevert(
            abi.encodeWithSelector(
                SmartMoneyRounds.WrongStatus.selector, id, SmartMoneyRounds.Status.Open, SmartMoneyRounds.Status.Locked
            )
        );
        _bet(alice, id, RIGHT, 1 ether);
    }

    function test_bet_lastSecondBeforeCloseAccepted() public {
        uint256 id = _create(LONG);
        vm.warp(bettingCloses - 1);
        _bet(alice, id, RIGHT, 1 ether);
        assertEq(sm.getRound(id).rightPool, 1 ether);
    }

    // ------------------------------------------------------------------ lock / resolve (permissionless, oracle-priced)

    function test_lock_anyoneCanCall_priceFromOracle() public {
        uint256 id = _create(LONG);
        vm.warp(startTime + 30);
        oracle.set(FEED, 83_094_1, startTime + 20);
        vm.expectEmit(true, false, true, true);
        emit SmartMoneyRounds.RoundLocked(id, 83_094_1, startTime + 20, carol);
        vm.prank(carol);
        sm.lockRound(id);
        assertEq(sm.getRound(id).startPrice, 83_094_1);
    }

    function test_lock_timing() public {
        uint256 id = _create(LONG);
        oracle.set(FEED, 100, T0);
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.TooEarly.selector, id, startTime));
        sm.lockRound(id);

        vm.warp(startTime + WINDOW + 1);
        oracle.set(FEED, 100, startTime + WINDOW);
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.TooLate.selector, id, startTime + WINDOW));
        sm.lockRound(id);
    }

    function test_lock_rejectsPriceObservedBeforeStart() public {
        uint256 id = _create(LONG);
        vm.warp(startTime + 10);
        oracle.set(FEED, 100, startTime - 1); // oracle has not ticked since the round started
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.StalePrice.selector, id, startTime - 1, startTime));
        sm.lockRound(id);

        oracle.set(FEED, 0, startTime + 5);
        vm.expectRevert(); // mock reverts on zero price
        sm.lockRound(id);
    }

    function test_resolve_timingAndStaleness() public {
        uint256 id = _create(LONG);
        _bet(alice, id, RIGHT, 1 ether);
        _bet(bob, id, WRONG, 1 ether);

        vm.warp(startTime);
        vm.expectRevert(
            abi.encodeWithSelector(
                SmartMoneyRounds.WrongStatus.selector, id, SmartMoneyRounds.Status.Locked, SmartMoneyRounds.Status.Open
            )
        );
        sm.resolveRound(id);

        _lock(id, 100);
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.TooEarly.selector, id, endTime));
        sm.resolveRound(id);

        vm.warp(endTime + 5);
        oracle.set(FEED, 120, endTime - 30); // last observation is before endTime
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.StalePrice.selector, id, endTime - 30, endTime));
        sm.resolveRound(id);

        vm.warp(endTime + WINDOW + 1);
        oracle.set(FEED, 120, endTime + WINDOW);
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.TooLate.selector, id, endTime + WINDOW));
        sm.resolveRound(id);
    }

    function test_resolve_directionMatrix_andStats() public {
        _assertWinner(LONG, 100, 101, RIGHT);
        _assertWinner(LONG, 100, 99, WRONG);
        _assertWinner(SHORT, 100, 99, RIGHT);
        _assertWinner(SHORT, 100, 101, WRONG);
        (uint32 right, uint32 wrong, uint32 voided) = sm.marketStats(MARKET);
        assertEq(right, 2);
        assertEq(wrong, 2);
        assertEq(voided, 0);
    }

    function _assertWinner(SmartMoneyRounds.Direction d, uint256 p0, uint256 p1, SmartMoneyRounds.Side expected)
        internal
    {
        vm.warp(T0);
        uint256 id = _create(d);
        _bet(alice, id, RIGHT, 1 ether);
        _bet(bob, id, WRONG, 1 ether);
        _lock(id, p0);
        _resolve(id, p1);
        assertEq(uint8(sm.getRound(id).winner), uint8(expected));
        assertEq(uint8(sm.getRound(id).status), uint8(SmartMoneyRounds.Status.Resolved));
    }

    function test_resolve_tieVoidsWithoutFee() public {
        uint256 id = _create(LONG);
        _bet(alice, id, RIGHT, 1 ether);
        _bet(bob, id, WRONG, 2 ether);
        _lock(id, 100);
        vm.warp(endTime);
        oracle.set(FEED, 100, endTime);
        vm.expectEmit(true, true, false, true);
        emit SmartMoneyRounds.RoundVoided(id, address(this), "tie");
        sm.resolveRound(id);
        assertEq(uint8(sm.getRound(id).status), uint8(SmartMoneyRounds.Status.Voided));
        assertEq(sm.treasuryBalance(), 0);
        assertEq(_claim(alice, id), 1 ether);
        assertEq(_claim(bob, id), 2 ether);
        (,, uint32 voided) = sm.marketStats(MARKET);
        assertEq(voided, 1);
    }

    function test_resolve_oneSidedVoidsAndRefunds() public {
        uint256 id = _create(LONG);
        _bet(alice, id, RIGHT, 1 ether);
        _bet(carol, id, RIGHT, 4 ether);
        _lock(id, 100);
        _resolve(id, 200);
        assertEq(uint8(sm.getRound(id).status), uint8(SmartMoneyRounds.Status.Voided));
        assertEq(_claim(alice, id), 1 ether);
        assertEq(_claim(carol, id), 4 ether);
        assertEq(address(sm).balance, 0);
    }

    function test_resolve_emptyRoundVoids() public {
        uint256 id = _create(LONG);
        _lock(id, 100);
        _resolve(id, 200);
        assertEq(uint8(sm.getRound(id).status), uint8(SmartMoneyRounds.Status.Voided));
    }

    // ------------------------------------------------------------------ claim / payout math

    function test_payout_parimutuelMath() public {
        uint256 id = _create(LONG);
        _bet(alice, id, RIGHT, 1 ether);
        _bet(carol, id, RIGHT, 3 ether);
        _bet(bob, id, WRONG, 6 ether);
        _lock(id, 100);
        _resolve(id, 150); // Right wins

        // fee = 2 % of losing pool (6) = 0.12 ; distributable = 10 - 0.12 = 9.88
        SmartMoneyRounds.Round memory r = sm.getRound(id);
        assertEq(r.fee, 0.12 ether);
        assertEq(sm.treasuryBalance(), 0.12 ether);
        assertEq(sm.claimable(id, alice), 2.47 ether); // 1/4 * 9.88
        assertEq(sm.claimable(id, carol), 7.41 ether); // 3/4 * 9.88
        assertEq(sm.claimable(id, bob), 0);

        assertEq(_claim(alice, id), 2.47 ether);
        assertEq(_claim(carol, id), 7.41 ether);

        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.NothingToClaim.selector, id, bob));
        vm.prank(bob);
        sm.claim(id);

        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.AlreadyClaimed.selector, id, alice));
        vm.prank(alice);
        sm.claim(id);
    }

    function test_userStats_andParticipants() public {
        uint256 id = _create(LONG);
        _bet(alice, id, RIGHT, 1 ether);
        _bet(alice, id, RIGHT, 1 ether);
        _bet(bob, id, WRONG, 2 ether);
        _lock(id, 100);
        _resolve(id, 150); // alice wins 3.96
        _claim(alice, id);

        (uint128 staked, uint128 returned, uint32 bets, uint32 wins) = sm.userStats(alice);
        assertEq(staked, 2 ether);
        assertEq(returned, 3.96 ether);
        assertEq(bets, 2);
        assertEq(wins, 1);
        (staked, returned, bets, wins) = sm.userStats(bob);
        assertEq(staked, 2 ether);
        assertEq(returned, 0);
        assertEq(bets, 1);
        assertEq(wins, 0);

        assertEq(sm.participantCount(), 2);
        address[] memory ps = sm.participants(0, 10);
        assertEq(ps.length, 2);
        assertEq(ps[0], alice);
        assertEq(ps[1], bob);
        assertEq(sm.participants(1, 10).length, 1);
        assertEq(sm.participants(5, 10).length, 0);
    }

    function test_claim_revertsWhileOpenOrLocked() public {
        uint256 id = _create(LONG);
        _bet(alice, id, RIGHT, 1 ether);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                SmartMoneyRounds.WrongStatus.selector,
                id,
                SmartMoneyRounds.Status.Resolved,
                SmartMoneyRounds.Status.Open
            )
        );
        sm.claim(id);
    }

    function test_claim_bettorOnBothSidesGetsWinningSideOnly() public {
        uint256 id = _create(LONG);
        _bet(alice, id, RIGHT, 1 ether);
        _bet(alice, id, WRONG, 1 ether);
        _bet(bob, id, WRONG, 1 ether);
        _lock(id, 100);
        _resolve(id, 90); // Wrong wins; losing pool = 1
        assertEq(_claim(alice, id), 1.49 ether); // (3 - 0.02) / 2
        assertEq(_claim(bob, id), 1.49 ether);
    }

    function test_claim_reentrancyBlocked() public {
        Reenterer evil = new Reenterer(sm);
        vm.deal(address(evil), 10 ether);
        uint256 id = _create(LONG);
        evil.betOn{value: 1 ether}(id, RIGHT);
        _bet(bob, id, WRONG, 1 ether);
        _lock(id, 100);
        _resolve(id, 110);

        uint256 before = address(evil).balance;
        evil.attack();
        assertEq(address(evil).balance - before, 1.98 ether);
        assertTrue(evil.innerReverted());
        assertEq(address(sm).balance, 0.02 ether); // only fee left
    }

    function test_claim_transferFailureReverts() public {
        RejectsEther rej = new RejectsEther();
        vm.deal(address(rej), 10 ether);
        uint256 id = _create(LONG);
        vm.prank(address(rej));
        sm.bet{value: 1 ether}(id, RIGHT);
        _bet(bob, id, WRONG, 1 ether);
        _lock(id, 100);
        _resolve(id, 110);
        vm.prank(address(rej));
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.TransferFailed.selector, address(rej), 1.98 ether));
        sm.claim(id);
        assertFalse(sm.getPosition(id, address(rej)).claimed);
    }

    // ------------------------------------------------------------------ void

    function test_voidRound_keeperOnlyWhileOpen() public {
        uint256 id = _create(LONG);
        _bet(alice, id, RIGHT, 1 ether);
        vm.expectRevert(SmartMoneyRounds.NotKeeper.selector);
        sm.voidRound(id);
        vm.prank(keeper);
        sm.voidRound(id);
        assertEq(_claim(alice, id), 1 ether);

        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.NotVoidable.selector, id));
        sm.voidRound(id);
    }

    function test_voidRound_keeperCannotVoidLockedRound() public {
        uint256 id = _create(LONG);
        _bet(alice, id, RIGHT, 1 ether);
        _bet(bob, id, WRONG, 1 ether);
        _lock(id, 100);
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.NotVoidable.selector, id));
        sm.voidRound(id);
    }

    function test_voidStaleRound_openNeverLocked() public {
        uint256 id = _create(LONG);
        _bet(alice, id, RIGHT, 1 ether);
        vm.warp(startTime + WINDOW);
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.NotVoidable.selector, id));
        sm.voidStaleRound(id);
        vm.warp(startTime + WINDOW + 1);
        vm.prank(carol);
        sm.voidStaleRound(id);
        assertEq(_claim(alice, id), 1 ether);
    }

    function test_voidStaleRound_lockedNeverResolved() public {
        uint256 id = _create(LONG);
        _bet(alice, id, RIGHT, 1 ether);
        _bet(bob, id, WRONG, 2 ether);
        _lock(id, 100);
        vm.warp(endTime + WINDOW);
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.NotVoidable.selector, id));
        sm.voidStaleRound(id);
        vm.warp(endTime + WINDOW + 1);
        sm.voidStaleRound(id);
        assertEq(_claim(alice, id), 1 ether);
        assertEq(_claim(bob, id), 2 ether);
    }

    function test_voidStaleRound_notOnResolved() public {
        uint256 id = _create(LONG);
        _bet(alice, id, RIGHT, 1 ether);
        _bet(bob, id, WRONG, 1 ether);
        _lock(id, 100);
        _resolve(id, 110);
        vm.warp(endTime + 365 days);
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.NotVoidable.selector, id));
        sm.voidStaleRound(id);
    }

    // ------------------------------------------------------------------ sweep / treasury

    function test_sweep_exactDustAfterAllWinnersClaim() public {
        uint256 id = _create(LONG);
        vm.deal(address(0xBEEF), 1 ether);
        _bet(alice, id, RIGHT, 1 ether + 1);
        _bet(carol, id, RIGHT, 3 ether + 7);
        _bet(address(0xBEEF), id, RIGHT, 0.5 ether + 3);
        _bet(bob, id, WRONG, 5 ether + 11);
        _lock(id, 100);
        _resolve(id, 120);

        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.NotSweepable.selector, id));
        sm.sweepRound(id);

        uint256 paid = _claim(alice, id) + _claim(carol, id) + _claim(address(0xBEEF), id);
        SmartMoneyRounds.Round memory r = sm.getRound(id);
        uint256 pool = r.rightPool + r.wrongPool;
        uint256 expectedDust = pool - r.fee - paid;
        assertGt(expectedDust, 0, "test should exercise non-zero dust");

        vm.expectEmit(true, false, false, true);
        emit SmartMoneyRounds.DustSwept(id, expectedDust);
        sm.sweepRound(id);

        r = sm.getRound(id);
        assertTrue(r.swept);
        assertEq(r.dust, expectedDust);
        assertEq(r.claimedTotal + r.fee + r.dust, pool);
        assertEq(sm.treasuryBalance(), r.fee + r.dust);
        assertEq(address(sm).balance, sm.treasuryBalance());

        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.NotSweepable.selector, id));
        sm.sweepRound(id);
    }

    function test_sweep_afterClaimWindowForfeitsAndClosesClaims() public {
        uint256 id = _create(LONG);
        _bet(alice, id, RIGHT, 1 ether);
        _bet(carol, id, RIGHT, 1 ether);
        _bet(bob, id, WRONG, 2 ether);
        _lock(id, 100);
        _resolve(id, 120);
        _claim(alice, id); // carol never claims

        vm.warp(endTime + sm.CLAIM_WINDOW());
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.NotSweepable.selector, id));
        sm.sweepRound(id);

        vm.warp(endTime + sm.CLAIM_WINDOW() + 1);
        sm.sweepRound(id);
        SmartMoneyRounds.Round memory r = sm.getRound(id);
        assertEq(r.claimedTotal + r.fee + r.dust, r.rightPool + r.wrongPool);
        assertEq(address(sm).balance, sm.treasuryBalance());

        assertEq(sm.claimable(id, carol), 0);
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.RoundSwept.selector, id));
        sm.claim(id);
    }

    function test_sweep_notOnVoided() public {
        uint256 id = _create(LONG);
        _bet(alice, id, RIGHT, 1 ether);
        vm.prank(keeper);
        sm.voidRound(id);
        vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.NotSweepable.selector, id));
        sm.sweepRound(id);
    }

    function test_withdrawTreasury() public {
        vm.expectRevert(SmartMoneyRounds.NothingToWithdraw.selector);
        sm.withdrawTreasury();

        uint256 id = _create(LONG);
        _bet(alice, id, RIGHT, 1 ether);
        _bet(bob, id, WRONG, 1 ether);
        _lock(id, 100);
        _resolve(id, 110);
        uint256 before = treasury.balance;
        vm.prank(carol);
        sm.withdrawTreasury();
        assertEq(treasury.balance - before, 0.02 ether);
        assertEq(sm.treasuryBalance(), 0);
    }

    // ------------------------------------------------------------------ fuzz

    /// @dev For random stakes: every winner's payout >= stake, and payouts + fee + dust == pool.
    function testFuzz_conservation(uint96[5] memory rightStakes, uint96[5] memory wrongStakes, uint16 feeBps_, bool up)
        public
    {
        feeBps_ = uint16(bound(feeBps_, 0, sm.MAX_FEE_BPS()));
        vm.prank(owner);
        sm.setFeeBps(feeBps_);
        uint256 id = _create(LONG);

        address[10] memory users;
        uint256 pool;
        for (uint256 i = 0; i < 5; i++) {
            users[i] = address(uint160(0x1000 + i));
            users[5 + i] = address(uint160(0x2000 + i));
            uint256 a = bound(rightStakes[i], MIN_BET, 100 ether);
            uint256 b = bound(wrongStakes[i], MIN_BET, 100 ether);
            vm.deal(users[i], a);
            vm.deal(users[5 + i], b);
            _bet(users[i], id, RIGHT, a);
            _bet(users[5 + i], id, WRONG, b);
            pool += a + b;
        }
        _lock(id, 100);
        _resolve(id, up ? 101 : 99);
        SmartMoneyRounds.Round memory r = sm.getRound(id);
        assertEq(r.rightPool + r.wrongPool, pool);

        uint256 paid;
        for (uint256 i = 0; i < 10; i++) {
            SmartMoneyRounds.Position memory p = sm.getPosition(id, users[i]);
            uint256 stake = r.winner == RIGHT ? p.right : p.wrong;
            uint256 c = sm.claimable(id, users[i]);
            if (stake == 0) {
                assertEq(c, 0);
                continue;
            }
            assertGe(c, stake, "winner must never lose money");
            assertEq(_claim(users[i], id), c);
            paid += c;
        }
        sm.sweepRound(id);
        r = sm.getRound(id);
        assertEq(paid + r.fee + r.dust, pool, "payouts + fee + dust != pool");
        assertEq(r.claimedTotal, paid);
        assertLt(r.dust, 5, "dust bounded by number of winners");
        assertEq(address(sm).balance, sm.treasuryBalance());
        assertEq(sm.treasuryBalance(), r.fee + r.dust);
    }

    /// @dev Betting is accepted iff now < bettingCloses and round is Open.
    function testFuzz_bettingWindow(uint64 t) public {
        uint256 id = _create(LONG);
        t = uint64(bound(t, T0, startTime - 1));
        vm.warp(t);
        if (t < bettingCloses) {
            _bet(alice, id, RIGHT, 1 ether);
            assertEq(sm.getRound(id).rightPool, 1 ether);
        } else {
            vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.BettingClosed.selector, id));
            _bet(alice, id, RIGHT, 1 ether);
        }
    }

    /// @dev Min bet is enforced for any amount.
    function testFuzz_minBet(uint256 amt) public {
        amt = bound(amt, 0, 10 ether);
        uint256 id = _create(LONG);
        if (amt < MIN_BET) {
            vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.BetBelowMinimum.selector, amt, MIN_BET));
        }
        _bet(alice, id, RIGHT, amt);
    }

    /// @dev A lock succeeds iff within the window and the oracle observation is not older than startTime.
    function testFuzz_lockAcceptsOnlyFreshPrices(uint64 callAt, uint64 observedAt) public {
        uint256 id = _create(LONG);
        callAt = uint64(bound(callAt, startTime, startTime + WINDOW));
        observedAt = uint64(bound(observedAt, startTime - 10 minutes, callAt));
        vm.warp(callAt);
        oracle.set(FEED, 123, observedAt);
        if (observedAt < startTime) {
            vm.expectRevert(abi.encodeWithSelector(SmartMoneyRounds.StalePrice.selector, id, observedAt, startTime));
        }
        sm.lockRound(id);
    }

    /// @dev Voided rounds refund exactly the stakes, on both sides, with no fee.
    function testFuzz_voidRefundsExactly(uint96 a, uint96 b, uint96 c) public {
        uint256 x = bound(a, MIN_BET, 100 ether);
        uint256 y = bound(b, MIN_BET, 100 ether);
        uint256 z = bound(c, MIN_BET, 100 ether);
        uint256 id = _create(SHORT);
        _bet(alice, id, RIGHT, x);
        _bet(alice, id, WRONG, y);
        _bet(bob, id, WRONG, z);
        _lock(id, 100);
        _resolve(id, 100); // tie -> void
        assertEq(_claim(alice, id), x + y);
        assertEq(_claim(bob, id), z);
        assertEq(address(sm).balance, 0);
        assertEq(sm.treasuryBalance(), 0);
    }
}
