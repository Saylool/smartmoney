// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SmartMoneyRounds} from "../src/SmartMoneyRounds.sol";

/// @notice Deploys SmartMoneyRounds. Env vars (all optional except the broadcaster key):
///   OWNER, KEEPER, TREASURY  — default to the broadcaster address
///   FEE_BPS                  — default 200 (2 %)
///   MIN_BET                  — default 0.01 ether
///
///   forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast --account <keystore> 
contract Deploy is Script {
    function run() external returns (SmartMoneyRounds sm) {
        address broadcaster = msg.sender;
        address owner = vm.envOr("OWNER", broadcaster);
        address keeper = vm.envOr("KEEPER", broadcaster);
        address treasury = vm.envOr("TREASURY", broadcaster);
        uint16 feeBps = uint16(vm.envOr("FEE_BPS", uint256(200)));
        uint256 minBet = vm.envOr("MIN_BET", uint256(0.01 ether));

        vm.startBroadcast();
        sm = new SmartMoneyRounds(owner, keeper, treasury, feeBps, minBet);
        vm.stopBroadcast();

        console2.log("SmartMoneyRounds deployed at", address(sm));
        console2.log("owner", owner);
        console2.log("keeper", keeper);
        console2.log("treasury", treasury);
    }
}
