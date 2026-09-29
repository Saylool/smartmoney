// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPriceOracle} from "./interfaces/IPriceOracle.sol";

/// @title SmartMoneyRounds
/// @notice Parimutuel prediction rounds on whether Perpl "smart money" (the net direction of the
///         top‑20 most profitable Perpl traders of the last 30 days) turns out to be right.
///
///         Lifecycle of a round (all timestamps are unix seconds):
///
///           createRound ──► Open     keeper publishes the smart-money signal; bets accepted
///                                    while now < bettingCloses
///           lockRound   ──► Locked   ANYONE, in [startTime, startTime + SETTLE_WINDOW]; start price
///                                    is read from the on-chain oracle, never supplied by a caller
///           resolveRound──► Resolved ANYONE, in [endTime, endTime + SETTLE_WINDOW]; end price read
///                     or    Voided   from the oracle. Tie or one-sided pool voids (full refund).
///           voidStaleRound ► Voided  ANYONE, once a settle window was missed.
///
///         The keeper is trusted only for the signal (direction + the published trader list,
///         which is emitted on-chain so anyone can audit it). It cannot set prices, cannot void a
///         round once it is locked, and never touches user funds.
///
///         Payouts are pull-based. Winners share (rightPool + wrongPool - fee) pro-rata to their
///         stake, rounded down. The protocol fee (taken from the losing pool only) and the rounding
///         dust accrue to the treasury.
contract SmartMoneyRounds {
    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    enum Direction {
        None,
        Long,
        Short
    }

    /// @dev Right = "smart money will be right", Wrong = "smart money will be wrong".
    enum Side {
        None,
        Right,
        Wrong
    }

    enum Status {
        None,
        Open,
        Locked,
        Resolved,
        Voided
    }

    struct Market {
        uint64 feedId; // oracle feed id (Perpl perpetual id on the price chain)
        uint32 duration; // endTime - startTime for every round of this market
        bool active;
        string symbol; // e.g. "BTC"
    }

    struct Round {
        uint32 marketId;
        uint64 bettingCloses; // bets accepted strictly before this time
        uint64 startTime; // anyone may lock from here; >= bettingCloses
        uint64 endTime; // anyone may resolve from here
        Direction direction; // smart money's net direction for this round
        Status status;
        Side winner; // set on resolve
        uint16 feeBps; // fee snapshotted at creation so terms cannot change mid-round
        uint32 rightBettors; // distinct addresses with stake on Right
        uint32 wrongBettors; // distinct addresses with stake on Wrong
        uint32 claims; // number of winner claims processed
        bool swept; // dust already moved to treasury
        uint64 createdBlock; // block of createRound, where SignalPublished can be found
        bytes32 signalHash; // keccak256 of the signal emitted in SignalPublished
        uint256 startPrice;
        uint256 endPrice;
        uint256 rightPool;
        uint256 wrongPool;
        uint256 fee; // absolute protocol fee taken from the losing pool (set on resolve)
        uint256 claimedTotal; // sum of payouts / refunds already pulled
        uint256 dust; // rounding remainder (plus unclaimed after CLAIM_WINDOW) moved to treasury
    }

    struct Position {
        uint128 right;
        uint128 wrong;
        bool claimed;
    }

    /// @notice Smart money's track record per market.
    struct MarketStats {
        uint32 right; // resolved rounds where smart money was right
        uint32 wrong; // resolved rounds where smart money was wrong
        uint32 voided;
    }

    /// @notice Per-bettor totals, for the leaderboard.
    struct UserStats {
        uint128 staked; // total ever staked
        uint128 returned; // total ever pulled (winnings + refunds)
        uint32 bets; // number of bet() calls
        uint32 wins; // number of winning claims
    }

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error NotOwner();
    error NotKeeper();
    error ZeroAddress();
    error FeeTooHigh(uint16 feeBps, uint16 maxFeeBps);
    error InvalidWindow();
    error InvalidMarket(uint256 marketId);
    error MarketInactive(uint256 marketId);
    error InvalidDirection();
    error InvalidSide();
    error InvalidSchedule();
    error EmptySignal();
    error RoundNotFound(uint256 roundId);
    error BettingClosed(uint256 roundId);
    error BetBelowMinimum(uint256 amount, uint256 minBet);
    error StakeOverflow();
    error WrongStatus(uint256 roundId, Status expected, Status actual);
    error TooEarly(uint256 roundId, uint64 notBefore);
    error TooLate(uint256 roundId, uint64 notAfter);
    error StalePrice(uint256 roundId, uint256 updatedAt, uint64 notBefore);
    error ZeroPrice();
    error NothingToClaim(uint256 roundId, address account);
    error AlreadyClaimed(uint256 roundId, address account);
    error NotVoidable(uint256 roundId);
    error NotSweepable(uint256 roundId);
    error RoundSwept(uint256 roundId);
    error TransferFailed(address to, uint256 amount);
    error Reentrancy();
    error NothingToWithdraw();

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------

    event MarketAdded(uint256 indexed marketId, string symbol, uint64 feedId, uint32 duration);
    event MarketActiveSet(uint256 indexed marketId, bool active);
    event RoundCreated(
        uint256 indexed roundId,
        uint256 indexed marketId,
        Direction direction,
        uint64 bettingCloses,
        uint64 startTime,
        uint64 endTime,
        bytes32 signalHash
    );
    /// @notice Full smart-money signal (JSON: source block, trader list, per-trader positions).
    event SignalPublished(uint256 indexed roundId, bytes signal);
    event BetPlaced(uint256 indexed roundId, address indexed bettor, Side side, uint256 amount);
    event RoundLocked(uint256 indexed roundId, uint256 startPrice, uint256 priceTime, address indexed by);
    event RoundResolved(uint256 indexed roundId, uint256 endPrice, uint256 priceTime, Side winner, uint256 fee);
    event RoundVoided(uint256 indexed roundId, address indexed by, string reason);
    event Claimed(uint256 indexed roundId, address indexed account, uint256 amount);
    event DustSwept(uint256 indexed roundId, uint256 amount);
    event TreasuryWithdrawn(address indexed treasury, uint256 amount);
    event KeeperUpdated(address indexed keeper);
    event TreasuryUpdated(address indexed treasury);
    event FeeUpdated(uint16 feeBps);
    event MinBetUpdated(uint256 minBet);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ---------------------------------------------------------------------
    // Constants / config
    // ---------------------------------------------------------------------

    uint16 public constant BPS = 10_000;
    uint16 public constant MAX_FEE_BPS = 1_000; // 10 %
    /// @notice Unclaimed winnings may be swept to treasury after this window post-resolution.
    uint64 public constant CLAIM_WINDOW = 90 days;

    /// @notice Price source. Immutable so the owner can never swap it under a running round.
    IPriceOracle public immutable ORACLE;
    /// @notice How long after startTime / endTime a round can still be locked / resolved.
    ///         Afterwards anyone may void it. Kept short to bound caller price-selection.
    uint64 public immutable SETTLE_WINDOW;

    address public owner;
    address public keeper;
    address public treasury;
    uint16 public feeBps;
    uint256 public minBet;

    /// @notice Fees + dust accrued, withdrawable to `treasury`.
    uint256 public treasuryBalance;

    uint256 public marketCount;
    mapping(uint256 marketId => Market) internal _markets;
    mapping(uint256 marketId => MarketStats) public marketStats;

    uint256 public roundCount;
    mapping(uint256 roundId => Round) internal _rounds;
    mapping(uint256 roundId => mapping(address account => Position)) internal _positions;

    mapping(address account => UserStats) public userStats;
    address[] internal _participants;

    uint256 private _locked = 1;

    // ---------------------------------------------------------------------
    // Modifiers
    // ---------------------------------------------------------------------

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper();
        _;
    }

    modifier nonReentrant() {
        if (_locked != 1) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    // ---------------------------------------------------------------------
    // Constructor / admin
    // ---------------------------------------------------------------------

    constructor(
        address owner_,
        address keeper_,
        address treasury_,
        uint16 feeBps_,
        uint256 minBet_,
        IPriceOracle oracle_,
        uint64 settleWindow_
    ) {
        if (owner_ == address(0) || keeper_ == address(0) || treasury_ == address(0) || address(oracle_) == address(0)) revert ZeroAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh(feeBps_, MAX_FEE_BPS);
        if (settleWindow_ < 1 minutes || settleWindow_ > 1 days) revert InvalidWindow();
        owner = owner_;
        keeper = keeper_;
        treasury = treasury_;
        feeBps = feeBps_;
        minBet = minBet_;
        ORACLE = oracle_;
        SETTLE_WINDOW = settleWindow_;
        emit OwnershipTransferred(address(0), owner_);
        emit KeeperUpdated(keeper_);
        emit TreasuryUpdated(treasury_);
        emit FeeUpdated(feeBps_);
        emit MinBetUpdated(minBet_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setKeeper(address keeper_) external onlyOwner {
        if (keeper_ == address(0)) revert ZeroAddress();
        keeper = keeper_;
        emit KeeperUpdated(keeper_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    /// @dev Only affects rounds created after the change; each round snapshots feeBps at creation.
    function setFeeBps(uint16 feeBps_) external onlyOwner {
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh(feeBps_, MAX_FEE_BPS);
        feeBps = feeBps_;
        emit FeeUpdated(feeBps_);
    }

    function setMinBet(uint256 minBet_) external onlyOwner {
        minBet = minBet_;
        emit MinBetUpdated(minBet_);
    }

    /// @notice Register a market: an oracle feed plus a fixed round duration.
    function addMarket(string calldata symbol, uint64 feedId, uint32 duration)
        external
        onlyOwner
        returns (uint256 marketId)
    {
        if (duration == 0 || bytes(symbol).length == 0) revert InvalidMarket(0);
        marketId = ++marketCount;
        _markets[marketId] = Market({feedId: feedId, duration: duration, active: true, symbol: symbol});
        emit MarketAdded(marketId, symbol, feedId, duration);
    }

    /// @notice Pausing a market only stops new rounds; existing rounds settle normally.
    function setMarketActive(uint256 marketId, bool active) external onlyOwner {
        if (marketId == 0 || marketId > marketCount) revert InvalidMarket(marketId);
        _markets[marketId].active = active;
        emit MarketActiveSet(marketId, active);
    }

    // ---------------------------------------------------------------------
    // Keeper: signal
    // ---------------------------------------------------------------------

    /// @notice Open a new round for `marketId` with smart money's `direction`.
    /// @param signal JSON describing how the direction was computed (source chain block, trader
    ///        addresses, their positions). Emitted in full and hashed into the round for audits.
    /// @dev   bettingCloses must be in the future and <= startTime; endTime = startTime + duration.
    function createRound(
        uint256 marketId,
        Direction direction,
        uint64 bettingCloses,
        uint64 startTime,
        bytes calldata signal
    ) external onlyKeeper returns (uint256 roundId) {
        if (marketId == 0 || marketId > marketCount) revert InvalidMarket(marketId);
        Market storage m = _markets[marketId];
        if (!m.active) revert MarketInactive(marketId);
        if (direction == Direction.None) revert InvalidDirection();
        if (bettingCloses <= block.timestamp || startTime < bettingCloses) revert InvalidSchedule();
        if (signal.length == 0) revert EmptySignal();

        uint64 endTime = startTime + m.duration;
        bytes32 signalHash = keccak256(signal);

        roundId = ++roundCount;
        Round storage r = _rounds[roundId];
        r.marketId = uint32(marketId);
        r.bettingCloses = bettingCloses;
        r.startTime = startTime;
        r.endTime = endTime;
        r.direction = direction;
        r.status = Status.Open;
        r.feeBps = feeBps;
        r.signalHash = signalHash;
        r.createdBlock = uint64(block.number);

        emit RoundCreated(roundId, marketId, direction, bettingCloses, startTime, endTime, signalHash);
        emit SignalPublished(roundId, signal);
    }

    /// @notice Keeper may cancel a round that has not started (e.g. signal source outage).
    ///         Once locked, only the oracle decides; the keeper cannot void it.
    function voidRound(uint256 roundId) external onlyKeeper {
        Round storage r = _getRound(roundId);
        if (r.status != Status.Open) revert NotVoidable(roundId);
        _void(r, roundId, "keeper");
    }

    // ---------------------------------------------------------------------
    // Permissionless settlement
    // ---------------------------------------------------------------------

    /// @notice Snapshot the start price from the oracle. Anyone may call.
    /// @dev    The oracle observation must be taken at or after startTime.
    function lockRound(uint256 roundId) external {
        Round storage r = _getRound(roundId);
        if (r.status != Status.Open) revert WrongStatus(roundId, Status.Open, r.status);
        uint64 deadline = r.startTime + SETTLE_WINDOW;
        if (block.timestamp < r.startTime) revert TooEarly(roundId, r.startTime);
        if (block.timestamp > deadline) revert TooLate(roundId, deadline);

        (uint256 price, uint256 at) = _readPrice(roundId, r.marketId, r.startTime);

        r.startPrice = price;
        r.status = Status.Locked;
        emit RoundLocked(roundId, price, at, msg.sender);
    }

    /// @notice Read the end price from the oracle and settle. Anyone may call.
    /// @dev    Void (full refund) when the price is unchanged or one side has no stake.
    function resolveRound(uint256 roundId) external {
        Round storage r = _getRound(roundId);
        if (r.status != Status.Locked) revert WrongStatus(roundId, Status.Locked, r.status);
        uint64 deadline = r.endTime + SETTLE_WINDOW;
        if (block.timestamp < r.endTime) revert TooEarly(roundId, r.endTime);
        if (block.timestamp > deadline) revert TooLate(roundId, deadline);

        (uint256 price, uint256 at) = _readPrice(roundId, r.marketId, r.endTime);
        r.endPrice = price;

        if (price == r.startPrice) {
            _void(r, roundId, "tie");
            return;
        }
        if (r.rightPool == 0 || r.wrongPool == 0) {
            _void(r, roundId, "one-sided");
            return;
        }

        bool wentUp = price > r.startPrice;
        bool smartMoneyRight = (r.direction == Direction.Long) == wentUp;
        Side winner = smartMoneyRight ? Side.Right : Side.Wrong;

        uint256 losingPool = winner == Side.Right ? r.wrongPool : r.rightPool;
        uint256 fee = (losingPool * r.feeBps) / BPS;

        r.winner = winner;
        r.fee = fee;
        r.status = Status.Resolved;
        treasuryBalance += fee;

        MarketStats storage s = marketStats[r.marketId];
        if (smartMoneyRight) s.right += 1;
        else s.wrong += 1;

        emit RoundResolved(roundId, price, at, winner, fee);
    }

    /// @notice Anyone may void a round whose lock or resolve window was missed,
    ///         so user funds can never be stranded by an offline keeper or oracle.
    function voidStaleRound(uint256 roundId) external {
        Round storage r = _getRound(roundId);
        if (r.status == Status.Open) {
            if (block.timestamp <= r.startTime + SETTLE_WINDOW) revert NotVoidable(roundId);
        } else if (r.status == Status.Locked) {
            if (block.timestamp <= r.endTime + SETTLE_WINDOW) revert NotVoidable(roundId);
        } else {
            revert NotVoidable(roundId);
        }
        _void(r, roundId, "stale");
    }

    // ---------------------------------------------------------------------
    // Users
    // ---------------------------------------------------------------------

    /// @notice Stake msg.value on `side` for `roundId`. Only while now < bettingCloses.
    function bet(uint256 roundId, Side side) external payable {
        Round storage r = _getRound(roundId);
        if (r.status != Status.Open) revert WrongStatus(roundId, Status.Open, r.status);
        if (block.timestamp >= r.bettingCloses) revert BettingClosed(roundId);
        if (side != Side.Right && side != Side.Wrong) revert InvalidSide();
        if (msg.value < minBet) revert BetBelowMinimum(msg.value, minBet);
        if (msg.value > type(uint128).max) revert StakeOverflow();

        Position storage p = _positions[roundId][msg.sender];
        if (side == Side.Right) {
            if (p.right == 0) r.rightBettors += 1;
            p.right += uint128(msg.value);
            r.rightPool += msg.value;
        } else {
            if (p.wrong == 0) r.wrongBettors += 1;
            p.wrong += uint128(msg.value);
            r.wrongPool += msg.value;
        }

        UserStats storage u = userStats[msg.sender];
        if (u.bets == 0) _participants.push(msg.sender);
        u.bets += 1;
        u.staked += uint128(msg.value);

        emit BetPlaced(roundId, msg.sender, side, msg.value);
    }

    /// @notice Pull winnings (Resolved) or refund (Voided) for `roundId`.
    function claim(uint256 roundId) external nonReentrant {
        Round storage r = _getRound(roundId);
        Position storage p = _positions[roundId][msg.sender];
        if (p.claimed) revert AlreadyClaimed(roundId, msg.sender);

        uint256 amount;
        UserStats storage u = userStats[msg.sender];
        if (r.status == Status.Resolved) {
            if (r.swept) revert RoundSwept(roundId);
            amount = _winnerPayout(r, p);
            if (amount == 0) revert NothingToClaim(roundId, msg.sender);
            r.claims += 1;
            u.wins += 1;
        } else if (r.status == Status.Voided) {
            amount = uint256(p.right) + uint256(p.wrong);
            if (amount == 0) revert NothingToClaim(roundId, msg.sender);
        } else {
            revert WrongStatus(roundId, Status.Resolved, r.status);
        }

        p.claimed = true;
        r.claimedTotal += amount;
        u.returned += uint128(amount);

        emit Claimed(roundId, msg.sender, amount);
        _send(msg.sender, amount);
    }

    /// @notice Move the rounding dust of a resolved round to the treasury balance. Callable by anyone.
    /// @dev    Allowed once every winner has claimed (dust is then exact), or after CLAIM_WINDOW
    ///         has elapsed since endTime, in which case unclaimed winnings are forfeited to the
    ///         treasury and further claims on the round are closed.
    function sweepRound(uint256 roundId) external {
        Round storage r = _getRound(roundId);
        if (r.status != Status.Resolved || r.swept) revert NotSweepable(roundId);

        uint32 winners = r.winner == Side.Right ? r.rightBettors : r.wrongBettors;
        bool allClaimed = r.claims == winners;
        bool windowElapsed = block.timestamp > r.endTime + CLAIM_WINDOW;
        if (!allClaimed && !windowElapsed) revert NotSweepable(roundId);

        uint256 remaining = r.rightPool + r.wrongPool - r.fee - r.claimedTotal;
        r.swept = true;
        r.dust = remaining;
        treasuryBalance += remaining;

        emit DustSwept(roundId, remaining);
    }

    /// @notice Send accrued fees + dust to the treasury address. Callable by anyone.
    function withdrawTreasury() external nonReentrant {
        uint256 amount = treasuryBalance;
        if (amount == 0) revert NothingToWithdraw();
        treasuryBalance = 0;
        emit TreasuryWithdrawn(treasury, amount);
        _send(treasury, amount);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getMarket(uint256 marketId) external view returns (Market memory) {
        return _markets[marketId];
    }

    function getRound(uint256 roundId) external view returns (Round memory) {
        return _getRound(roundId);
    }

    function getPosition(uint256 roundId, address account) external view returns (Position memory) {
        return _positions[roundId][account];
    }

    /// @notice Amount `account` could pull right now via claim(); 0 if nothing / already claimed.
    function claimable(uint256 roundId, address account) external view returns (uint256) {
        Round storage r = _rounds[roundId];
        Position storage p = _positions[roundId][account];
        if (p.claimed) return 0;
        if (r.status == Status.Resolved) return r.swept ? 0 : _winnerPayout(r, p);
        if (r.status == Status.Voided) return uint256(p.right) + uint256(p.wrong);
        return 0;
    }

    /// @notice Total pool of a round.
    function totalPool(uint256 roundId) external view returns (uint256) {
        Round storage r = _rounds[roundId];
        return r.rightPool + r.wrongPool;
    }

    function participantCount() external view returns (uint256) {
        return _participants.length;
    }

    /// @notice Paginated list of every address that ever bet (for leaderboards).
    function participants(uint256 offset, uint256 limit) external view returns (address[] memory out) {
        uint256 n = _participants.length;
        if (offset >= n) return out;
        uint256 end = offset + limit > n ? n : offset + limit;
        out = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            out[i - offset] = _participants[i];
        }
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _getRound(uint256 roundId) internal view returns (Round storage r) {
        r = _rounds[roundId];
        if (r.status == Status.None) revert RoundNotFound(roundId);
    }

    /// @dev Reads the oracle and requires the observation to be at or after `notBefore`,
    ///      so a price from before the round boundary can never be used.
    function _readPrice(uint256 roundId, uint32 marketId, uint64 notBefore)
        internal
        view
        returns (uint256 price, uint256 at)
    {
        (price, at) = ORACLE.latestPrice(_markets[marketId].feedId);
        if (price == 0) revert ZeroPrice();
        if (at < notBefore) revert StalePrice(roundId, at, notBefore);
    }

    function _void(Round storage r, uint256 roundId, string memory reason) internal {
        r.status = Status.Voided; // fee stays 0: refunds are free
        marketStats[r.marketId].voided += 1;
        emit RoundVoided(roundId, msg.sender, reason);
    }

    /// @dev payout = stake * (rightPool + wrongPool - fee) / winningPool, rounded down.
    function _winnerPayout(Round storage r, Position storage p) internal view returns (uint256) {
        uint256 stake;
        uint256 winningPool;
        if (r.winner == Side.Right) {
            stake = p.right;
            winningPool = r.rightPool;
        } else {
            stake = p.wrong;
            winningPool = r.wrongPool;
        }
        if (stake == 0) return 0;
        uint256 distributable = r.rightPool + r.wrongPool - r.fee;
        return (stake * distributable) / winningPool;
    }

    function _send(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed(to, amount);
    }
}
