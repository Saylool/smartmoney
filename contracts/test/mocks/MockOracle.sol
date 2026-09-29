// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPriceOracle} from "../../src/interfaces/IPriceOracle.sol";

contract MockOracle is IPriceOracle {
    mapping(uint256 => uint256) public price;
    mapping(uint256 => uint256) public updatedAt;

    function set(uint256 feedId, uint256 price_, uint256 updatedAt_) external {
        price[feedId] = price_;
        updatedAt[feedId] = updatedAt_;
    }

    function latestPrice(uint256 feedId) external view returns (uint256, uint256) {
        require(price[feedId] != 0, "no price");
        return (price[feedId], updatedAt[feedId]);
    }
}
