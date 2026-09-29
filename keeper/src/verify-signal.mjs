// Independently verify the smart-money signal of a round:
//   1. read the round from SmartMoneyRounds, fetch SignalPublished from its createdBlock
//   2. check keccak256(signal) == round.signalHash
//   3. re-read every listed trader's position on Perpl MAINNET at the signal's block
//   4. check the recomputed net direction matches the direction stored on-chain
//
//   node src/verify-signal.mjs <roundId>
//
// What this does NOT prove: that the trader list was Perpl's top-20 at that moment (the
// leaderboard is an off-chain API). Compare the list against https://app.perpl.xyz/leaderboard.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { keccak256, toHex, hexToString, parseAbiItem } from "viem";
import { publicClient, ROOT } from "./chain.mjs";
import { MARKETS } from "./markets.mjs";
import { accountIds, netDirection } from "./signal.mjs";

const roundId = BigInt(process.argv[2] ?? 0);
if (!roundId) {
  console.error("usage: node src/verify-signal.mjs <roundId>");
  process.exit(2);
}

const dep = JSON.parse(readFileSync(resolve(ROOT, "deployments/monad-testnet.json"), "utf8"));
const abi = JSON.parse(readFileSync(resolve(ROOT, "keeper/abi/SmartMoneyRounds.json"), "utf8"));
const r = await publicClient.readContract({ address: dep.address, abi, functionName: "getRound", args: [roundId] });

const [log] = await publicClient.getLogs({
  address: dep.address,
  event: parseAbiItem("event SignalPublished(uint256 indexed roundId, bytes signal)"),
  args: { roundId },
  fromBlock: r.createdBlock,
  toBlock: r.createdBlock,
});
if (!log) throw new Error(`SignalPublished for round ${roundId} not found in block ${r.createdBlock}`);

const bytes = log.args.signal;
const hashOk = keccak256(bytes) === r.signalHash;
const sig = JSON.parse(hexToString(bytes));
const market = MARKETS[Number(r.marketId) - 1];
const traders = sig.t.map(([rank, address, pnl30dUsd]) => ({ rank, address, pnl30dUsd }));

const block = BigInt(sig.block);
const ids = await accountIds(traders.map((t) => t.address), block);
const re = await netDirection(traders, ids, sig.perpId, market.signalLotDecimals, block);
const onChainDir = r.direction === 1 ? "long" : "short";

const checks = [
  ["signal hash matches on-chain hash", hashOk],
  ["signal direction matches on-chain direction", sig.dir === onChainDir],
  [`recomputed direction at Perpl mainnet block ${sig.block} = ${re.direction}`, re.direction === onChainDir],
  [`recomputed long ${re.long.toFixed(6)} / short ${re.short.toFixed(6)} match published ${sig.long} / ${sig.short}`,
    Math.abs(re.long - sig.long) < 1e-6 && Math.abs(re.short - sig.short) < 1e-6],
];
console.log(`round #${roundId} ${market.symbol} ${market.duration / 60}m, ${traders.length} traders, signal tx block ${r.createdBlock}`);
for (const [label, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
