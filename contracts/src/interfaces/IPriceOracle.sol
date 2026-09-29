// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal price source used by SmartMoneyRounds.
interface IPriceOracle {
    /// @return price    latest price for `feedId`, in the feed's native decimals (must be > 0)
    /// @return updatedAt unix seconds at which `price` was observed by the oracle
    function latestPrice(uint256 feedId) external view returns (uint256 price, uint256 updatedAt);
}
