// Test helper: fund two throwaway wallets from the keeper and bet both sides of a round, so the full
// bet -> lock -> resolve -> claim path runs on-chain. Keys go to keeper/.e2e-wallets.json (gitignored).
//   node src/e2e-bet.mjs <roundId> [amountMon]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createWalletClient, http, parseEther, formatEther } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { publicClient, walletClient, gasFor, monadTestnet, RPC_URL, ROOT } from "./chain.mjs";

const roundId = BigInt(process.argv[2]);
const amount = parseEther(process.argv[3] ?? "0.05");
const dep = JSON.parse(readFileSync(resolve(ROOT, "deployments/monad-testnet.json"), "utf8"));
const abi = JSON.parse(readFileSync(resolve(ROOT, "keeper/abi/SmartMoneyRounds.json"), "utf8"));
const file = resolve(ROOT, "keeper/.e2e-wallets.json");
const store = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
const { client: keeper } = walletClient();

for (const side of [1, 2]) {
  const pk = generatePrivateKey();
  const a = privateKeyToAccount(pk);
  store.push({ address: a.address, privateKey: pk, roundId: roundId.toString(), side });
  writeFileSync(file, JSON.stringify(store, null, 2));
  const h = await keeper.sendTransaction({ to: a.address, value: amount + parseEther("0.1") });
  await publicClient.waitForTransactionReceipt({ hash: h });
  const w = createWalletClient({ account: a, chain: monadTestnet, transport: http(RPC_URL) });
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 3000)); // Monad checks balances on slightly delayed state
    try {
      const req = { address: dep.address, abi, functionName: "bet", args: [roundId, side], value: amount };
      const tx = await w.writeContract({ ...req, gas: await gasFor({ ...req, account: a }) });
      const rc = await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log(`${a.address} bet ${formatEther(amount)} on ${side === 1 ? "RIGHT" : "WRONG"}: ${rc.status}`);
      break;
    } catch (e) {
      if (i === 7) throw e;
    }
  }
}
