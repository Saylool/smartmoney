// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPriceOracle} from "../interfaces/IPriceOracle.sol";

/// @dev Subset of the Perpl exchange interface (contract version 1.7.5). The struct layout must match
///      the exchange's `PerpetualInfo` exactly for ABI decoding to work.
interface IPerplExchange {
    struct PerpetualInfo {
        string name;
        string symbol;
        uint256 priceDecimals;
        uint256 lotDecimals;
        bytes32 linkFeedId;
        uint256 priceTolPer100K;
        uint256 marginTol;
        uint256 marginTolDecimals;
        uint256 refPriceMaxAgeSec;
        uint256 positionBalanceCNS;
        uint256 insuranceBalanceCNS;
        uint256 markPNS;
        uint256 markTimestamp;
        uint256 lastPNS;
        uint256 lastTimestamp;
        uint256 oraclePNS;
        uint256 oracleTimestampSec;
        uint256 longOpenInterestLNS;
        uint256 shortOpenInterestLNS;
        uint256 fundingStartBlock;
        int16 fundingRatePct100k;
        uint256 absFundingClampPctPer100K;
        uint8 status;
        uint256 basePricePNS;
        uint256 maxBidPriceONS;
        uint256 minBidPriceONS;
        uint256 maxAskPriceONS;
        uint256 minAskPriceONS;
        uint256 numOrders;
        bool ignOracle;
    }

    function getPerpetualInfo(uint256 perpId) external view returns (PerpetualInfo memory);
}

/// @title PerplOracleAdapter
/// @notice Exposes the Chainlink Data Streams oracle price that the Perpl exchange stores on-chain
///         for each perpetual (`oraclePNS`, updated roughly every minute) as an IPriceOracle.
contract PerplOracleAdapter is IPriceOracle {
    error NoPrice(uint256 perpId);

    IPerplExchange public immutable exchange;

    constructor(IPerplExchange exchange_) {
        exchange = exchange_;
    }

    function latestPrice(uint256 perpId) external view returns (uint256 price, uint256 updatedAt) {
        IPerplExchange.PerpetualInfo memory info = exchange.getPerpetualInfo(perpId);
        if (info.oraclePNS == 0 || info.oracleTimestampSec == 0) revert NoPrice(perpId);
        return (info.oraclePNS, info.oracleTimestampSec);
    }
}
