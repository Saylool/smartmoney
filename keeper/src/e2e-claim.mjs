// Test helper: claim for every saved e2e wallet that has something claimable.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createWalletClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { publicClient, gasFor, monadTestnet, RPC_URL, ROOT } from "./chain.mjs";

const dep = JSON.parse(readFileSync(resolve(ROOT, "deployments/monad-testnet.json"), "utf8"));
const abi = JSON.parse(readFileSync(resolve(ROOT, "keeper/abi/SmartMoneyRounds.json"), "utf8"));
const store = JSON.parse(readFileSync(resolve(ROOT, "keeper/.e2e-wallets.json"), "utf8"));
for (const s of store) {
  const id = BigInt(s.roundId);
  const c = await publicClient.readContract({ address: dep.address, abi, functionName: "claimable", args: [id, s.address] });
  if (c === 0n) { console.log(`${s.address} round ${id}: nothing to claim`); continue; }
  const account = privateKeyToAccount(s.privateKey);
  const w = createWalletClient({ account, chain: monadTestnet, transport: http(RPC_URL) });
  const req = { address: dep.address, abi, functionName: "claim", args: [id] };
  const tx = await w.writeContract({ ...req, gas: await gasFor({ ...req, account }) });
  const rc = await publicClient.waitForTransactionReceipt({ hash: tx });
  console.log(`${s.address} round ${id}: claimed ${formatEther(c)} MON -> ${rc.status} ${tx}`);
}
