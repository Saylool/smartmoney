// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SmartMoneyRounds
/// @notice Parimutuel prediction rounds on whether Perpl "smart money" (top-20
///         traders' net BTC direction) turns out to be right over a fixed window.
///
///         Lifecycle of a round (all timestamps are unix seconds):
///
///           create  ──►  Open   (bets accepted while now < bettingCloses)
///           lock    ──►  Locked (keeper snapshots startPrice at startTime)
///           resolve ──►  Resolved (keeper posts endPrice at endTime, winner set)
///                   or   Voided  (tie, one-sided pool, keeper void, or liveness timeout)
///
///         Payouts are pull-based. Winners share (rightPool + wrongPool - fee)
///         pro-rata to their stake, rounded down. The rounding dust and the
///         protocol fee accrue to the treasury.
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

    struct Round {
        uint64 bettingCloses; // bets accepted strictly before this time
        uint64 startTime; // keeper may lock from here; must be >= bettingCloses
        uint64 endTime; // keeper may resolve from here
        Direction direction; // smart money's net BTC direction for this round
        Status status;
        Side winner; // set on resolve
        uint256 startPrice;
        uint256 endPrice;
        uint256 rightPool;
        uint256 wrongPool;
        uint16 feeBps; // fee snapshotted at creation so terms cannot change mid-round
        uint256 fee; // absolute protocol fee taken from the losing pool (set on resolve)
        uint256 claimedTotal; // sum of payouts / refunds already pulled
        uint256 dust; // rounding remainder (plus unclaimed after CLAIM_WINDOW) moved to treasury
        uint32 rightBettors; // distinct addresses with stake on Right
        uint32 wrongBettors; // distinct addresses with stake on Wrong
        uint32 claims; // number of winner claims processed
        bool swept; // dust already moved to treasury
    }

    struct Position {
        uint128 right;
        uint128 wrong;
        bool claimed;
    }

    // ---------------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------------

    error NotOwner();
    error NotKeeper();
    error ZeroAddress();
    error FeeTooHigh(uint16 feeBps, uint16 maxFeeBps);
    error InvalidDirection();
    error InvalidSide();
    error InvalidSchedule();
    error RoundNotFound(uint256 roundId);
    error BettingClosed(uint256 roundId);
    error BetBelowMinimum(uint256 amount, uint256 minBet);
    error StakeOverflow();
    error WrongStatus(uint256 roundId, Status expected, Status actual);
    error TooEarly(uint256 roundId, uint64 notBefore);
    error TooLate(uint256 roundId, uint64 notAfter);
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

    event RoundCreated(
        uint256 indexed roundId, Direction direction, uint64 bettingCloses, uint64 startTime, uint64 endTime
    );
    event BetPlaced(uint256 indexed roundId, address indexed bettor, Side side, uint256 amount);
    event RoundLocked(uint256 indexed roundId, uint256 startPrice);
    event RoundResolved(uint256 indexed roundId, uint256 endPrice, Side winner, uint256 fee);
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
    /// @notice If the keeper fails to lock/resolve within this window, anyone may void the round.
    uint64 public constant LIVENESS_GRACE = 6 hours;
    /// @notice Unclaimed winnings may be swept to treasury after this window post-resolution.
    uint64 public constant CLAIM_WINDOW = 90 days;

    address public owner;
    address public keeper;
    address public treasury;
    uint16 public feeBps;
    uint256 public minBet;

    /// @notice Fees + dust accrued, withdrawable to `treasury`.
    uint256 public treasuryBalance;

    uint256 public roundCount;
    mapping(uint256 roundId => Round) internal _rounds;
    mapping(uint256 roundId => mapping(address account => Position)) internal _positions;

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

    constructor(address owner_, address keeper_, address treasury_, uint16 feeBps_, uint256 minBet_) {
        if (owner_ == address(0) || keeper_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh(feeBps_, MAX_FEE_BPS);
        owner = owner_;
        keeper = keeper_;
        treasury = treasury_;
        feeBps = feeBps_;
        minBet = minBet_;
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

    // ---------------------------------------------------------------------
    // Keeper: round lifecycle
    // ---------------------------------------------------------------------

    /// @notice Open a new round. `direction` is smart money's net BTC direction.
    /// @dev    bettingCloses must be in the future and <= startTime < endTime.
    function createRound(Direction direction, uint64 bettingCloses, uint64 startTime, uint64 endTime)
        external
        onlyKeeper
        returns (uint256 roundId)
    {
        if (direction == Direction.None) revert InvalidDirection();
        if (bettingCloses <= block.timestamp || startTime < bettingCloses || endTime <= startTime) {
            revert InvalidSchedule();
        }

        roundId = ++roundCount;
        Round storage r = _rounds[roundId];
        r.bettingCloses = bettingCloses;
        r.startTime = startTime;
        r.endTime = endTime;
        r.direction = direction;
        r.status = Status.Open;
        r.feeBps = feeBps;

        emit RoundCreated(roundId, direction, bettingCloses, startTime, endTime);
    }

    /// @notice Snapshot the BTC start price. Callable from startTime until startTime + LIVENESS_GRACE.
    function lockRound(uint256 roundId, uint256 startPrice) external onlyKeeper {
        Round storage r = _getRound(roundId);
        if (r.status != Status.Open) revert WrongStatus(roundId, Status.Open, r.status);
        if (block.timestamp < r.startTime) revert TooEarly(roundId, r.startTime);
        if (block.timestamp > r.startTime + LIVENESS_GRACE) revert TooLate(roundId, r.startTime + LIVENESS_GRACE);
        if (startPrice == 0) revert ZeroPrice();

        r.startPrice = startPrice;
        r.status = Status.Locked;
        emit RoundLocked(roundId, startPrice);
    }

    /// @notice Post the BTC end price and settle. Callable from endTime until endTime + LIVENESS_GRACE.
    /// @dev    Void (full refund) when: price unchanged, or one side has no stake.
    function resolveRound(uint256 roundId, uint256 endPrice) external onlyKeeper {
        Round storage r = _getRound(roundId);
        if (r.status != Status.Locked) revert WrongStatus(roundId, Status.Locked, r.status);
        if (block.timestamp < r.endTime) revert TooEarly(roundId, r.endTime);
        if (block.timestamp > r.endTime + LIVENESS_GRACE) revert TooLate(roundId, r.endTime + LIVENESS_GRACE);
        if (endPrice == 0) revert ZeroPrice();

        r.endPrice = endPrice;

        if (endPrice == r.startPrice) {
            _void(r, roundId, "tie");
            return;
        }
        if (r.rightPool == 0 || r.wrongPool == 0) {
            _void(r, roundId, "one-sided");
            return;
        }

        bool wentUp = endPrice > r.startPrice;
        bool smartMoneyRight = (r.direction == Direction.Long) == wentUp;
        Side winner = smartMoneyRight ? Side.Right : Side.Wrong;

        uint256 losingPool = winner == Side.Right ? r.wrongPool : r.rightPool;
        uint256 fee = (losingPool * r.feeBps) / BPS;

        r.winner = winner;
        r.fee = fee;
        r.status = Status.Resolved;
        treasuryBalance += fee;

        emit RoundResolved(roundId, endPrice, winner, fee);
    }

    /// @notice Keeper may void a round before resolution (e.g. oracle failure).
    function voidRound(uint256 roundId) external onlyKeeper {
        Round storage r = _getRound(roundId);
        if (r.status != Status.Open && r.status != Status.Locked) revert NotVoidable(roundId);
        _void(r, roundId, "keeper");
    }

    /// @notice Anyone may void a round the keeper failed to lock or resolve in time,
    ///         so user funds can never be stranded by an offline keeper.
    function voidStaleRound(uint256 roundId) external {
        Round storage r = _getRound(roundId);
        if (r.status == Status.Open) {
            if (block.timestamp <= r.startTime + LIVENESS_GRACE) revert NotVoidable(roundId);
        } else if (r.status == Status.Locked) {
            if (block.timestamp <= r.endTime + LIVENESS_GRACE) revert NotVoidable(roundId);
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

        emit BetPlaced(roundId, msg.sender, side, msg.value);
    }

    /// @notice Pull winnings (Resolved) or refund (Voided) for `roundId`.
    function claim(uint256 roundId) external nonReentrant {
        Round storage r = _getRound(roundId);
        Position storage p = _positions[roundId][msg.sender];
        if (p.claimed) revert AlreadyClaimed(roundId, msg.sender);

        uint256 amount;
        if (r.status == Status.Resolved) {
            if (r.swept) revert RoundSwept(roundId);
            amount = _winnerPayout(r, p);
            if (amount == 0) revert NothingToClaim(roundId, msg.sender);
            r.claims += 1;
        } else if (r.status == Status.Voided) {
            amount = uint256(p.right) + uint256(p.wrong);
            if (amount == 0) revert NothingToClaim(roundId, msg.sender);
        } else {
            revert WrongStatus(roundId, Status.Resolved, r.status);
        }

        p.claimed = true;
        r.claimedTotal += amount;

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
        if (r.status == Status.Resolved) return _winnerPayout(r, p);
        if (r.status == Status.Voided) return uint256(p.right) + uint256(p.wrong);
        return 0;
    }

    /// @notice Total pool of a round.
    function totalPool(uint256 roundId) external view returns (uint256) {
        Round storage r = _rounds[roundId];
        return r.rightPool + r.wrongPool;
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _getRound(uint256 roundId) internal view returns (Round storage r) {
        r = _rounds[roundId];
        if (r.status == Status.None) revert RoundNotFound(roundId);
    }

    function _void(Round storage r, uint256 roundId, string memory reason) internal {
        r.status = Status.Voided; // fee stays 0: refunds are free
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
