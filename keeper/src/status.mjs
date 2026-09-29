import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatEther } from "viem";
import { publicClient, ROOT } from "./chain.mjs";

const dep = JSON.parse(readFileSync(resolve(ROOT, "deployments/monad-testnet.json"), "utf8"));
const abi = JSON.parse(readFileSync(resolve(ROOT, "keeper/abi/SmartMoneyRounds.json"), "utf8"));
const c = { address: dep.address, abi };
const names = ["owner", "keeper", "treasury", "feeBps", "minBet", "roundCount", "treasuryBalance"];
const values = await Promise.all(names.map((fn) => publicClient.readContract({ ...c, functionName: fn })));
const info = Object.fromEntries(names.map((n, i) => [n, values[i]]));
info.minBet = formatEther(info.minBet);
info.treasuryBalance = formatEther(info.treasuryBalance);
info.address = dep.address;
console.log(info);
