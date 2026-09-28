import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { formatEther, parseEther } from "viem";
import { publicClient, walletClient, monadTestnet, ROOT } from "./chain.mjs";

const artifact = JSON.parse(
  readFileSync(resolve(ROOT, "contracts/out/SmartMoneyRounds.sol/SmartMoneyRounds.json"), "utf8"),
);
const { account, client } = walletClient();

const owner = process.env.OWNER ?? account.address;
const keeper = process.env.KEEPER ?? account.address;
const treasury = process.env.TREASURY ?? account.address;
const feeBps = Number(process.env.FEE_BPS ?? 200);
const minBet = parseEther(process.env.MIN_BET_MON ?? "0.01");

const balance = await publicClient.getBalance({ address: account.address });
console.log(`deployer ${account.address} balance ${formatEther(balance)} MON on chain ${monadTestnet.id}`);
if (balance === 0n) throw new Error("deployer has no MON; fund it from the faucet first");

const hash = await client.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode.object,
  args: [owner, keeper, treasury, feeBps, minBet],
});
console.log("deploy tx", hash);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success" || !receipt.contractAddress) throw new Error("deploy failed");
console.log("SmartMoneyRounds deployed at", receipt.contractAddress);

mkdirSync(resolve(ROOT, "deployments"), { recursive: true });
const out = resolve(ROOT, "deployments/monad-testnet.json");
writeFileSync(
  out,
  JSON.stringify(
    {
      chainId: monadTestnet.id,
      address: receipt.contractAddress,
      txHash: hash,
      block: Number(receipt.blockNumber),
      owner,
      keeper,
      treasury,
      feeBps,
      minBet: minBet.toString(),
      deployedAt: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
);
console.log("wrote", out);
