// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {SmartMoneyRounds} from "../src/SmartMoneyRounds.sol";
import {PerplOracleAdapter, IPerplExchange} from "../src/oracles/PerplOracleAdapter.sol";

/// @notice Deploys PerplOracleAdapter + SmartMoneyRounds, registers the default markets and hands
///         ownership to OWNER. Env vars (all optional):
///   OWNER, KEEPER, TREASURY  — default to the broadcaster
///   PERPL_EXCHANGE           — default: Perpl exchange on Monad testnet
///   FEE_BPS (200), MIN_BET (0.01 ether), SETTLE_WINDOW (20 minutes)
///
///   forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast --private-key $DEPLOYER_PRIVATE_KEY
///
/// The repo's keeper/src/deploy.mjs does the same through viem (used when forge cannot reach the RPC).
contract Deploy is Script {
    address constant PERPL_TESTNET_EXCHANGE = 0x1964C32f0bE608E7D29302AFF5E61268E72080cc;

    function run() external returns (SmartMoneyRounds sm) {
        address broadcaster = msg.sender;
        address owner = vm.envOr("OWNER", broadcaster);
        address keeper = vm.envOr("KEEPER", broadcaster);
        address treasury = vm.envOr("TREASURY", broadcaster);
        address exchange = vm.envOr("PERPL_EXCHANGE", PERPL_TESTNET_EXCHANGE);
        uint16 feeBps = uint16(vm.envOr("FEE_BPS", uint256(200)));
        uint256 minBet = vm.envOr("MIN_BET", uint256(0.01 ether));
        uint64 window = uint64(vm.envOr("SETTLE_WINDOW", uint256(20 minutes)));

        vm.startBroadcast();
        PerplOracleAdapter oracle = new PerplOracleAdapter(IPerplExchange(exchange));
        sm = new SmartMoneyRounds(broadcaster, keeper, treasury, feeBps, minBet, oracle, window);
        // Perpl testnet perpetual ids: BTC 16, ETH 32, SOL 48
        sm.addMarket("BTC", 16, 1 hours);
        sm.addMarket("BTC", 16, 15 minutes);
        sm.addMarket("ETH", 32, 1 hours);
        sm.addMarket("SOL", 48, 1 hours);
        if (owner != broadcaster) sm.transferOwnership(owner);
        vm.stopBroadcast();

        console2.log("PerplOracleAdapter", address(oracle));
        console2.log("SmartMoneyRounds", address(sm));
    }
}
