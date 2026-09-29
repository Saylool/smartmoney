// Deploys PerplOracleAdapter + SmartMoneyRounds to Monad testnet, registers markets, verifies the
// adapter reads live Perpl prices, hands ownership to OWNER and writes deployments/monad-testnet.json.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { formatEther, parseEther } from "viem";
import { publicClient, walletClient, monadTestnet, ROOT } from "./chain.mjs";
import { MARKETS, PERPL_TESTNET_EXCHANGE } from "./markets.mjs";

const artifact = (name, file = name) =>
  JSON.parse(readFileSync(resolve(ROOT, `contracts/out/${file}.sol/${name}.json`), "utf8"));
const Rounds = artifact("SmartMoneyRounds");
const Adapter = artifact("PerplOracleAdapter");

const { account, client } = walletClient();
const owner = process.env.OWNER ?? account.address;
const keeper = process.env.KEEPER ?? account.address;
const treasury = process.env.TREASURY ?? account.address;
const feeBps = Number(process.env.FEE_BPS ?? 200);
const minBet = parseEther(process.env.MIN_BET_MON ?? "0.01");
const settleWindow = BigInt(process.env.SETTLE_WINDOW ?? 20 * 60);

const balance = await publicClient.getBalance({ address: account.address });
console.log(`deployer ${account.address} balance ${formatEther(balance)} MON on chain ${monadTestnet.id}`);
if (balance === 0n) throw new Error("deployer has no MON; fund it from the faucet first");

async function send(label, p) {
  const hash = await p;
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${label} failed: ${hash}`);
  console.log(`${label}: ${hash}`);
  return receipt;
}

const a = await send(
  "deploy PerplOracleAdapter",
  client.deployContract({ abi: Adapter.abi, bytecode: Adapter.bytecode.object, args: [PERPL_TESTNET_EXCHANGE] }),
);
const oracle = a.contractAddress;
for (const m of MARKETS) {
  const [price, at] = await publicClient.readContract({
    address: oracle, abi: Adapter.abi, functionName: "latestPrice", args: [BigInt(m.feedId)],
  });
  const age = Math.floor(Date.now() / 1000) - Number(at);
  console.log(`  adapter ${m.symbol}: price ${Number(price) / 10 ** m.priceDecimals} (age ${age}s)`);
}

const r = await send(
  "deploy SmartMoneyRounds",
  client.deployContract({
    abi: Rounds.abi,
    bytecode: Rounds.bytecode.object,
    args: [account.address, keeper, treasury, feeBps, minBet, oracle, settleWindow],
  }),
);
const rounds = r.contractAddress;

for (const m of MARKETS) {
  await send(
    `addMarket ${m.symbol} ${m.duration}s`,
    client.writeContract({ address: rounds, abi: Rounds.abi, functionName: "addMarket", args: [m.symbol, BigInt(m.feedId), m.duration] }),
  );
}
if (owner.toLowerCase() !== account.address.toLowerCase()) {
  await send("transferOwnership", client.writeContract({ address: rounds, abi: Rounds.abi, functionName: "transferOwnership", args: [owner] }));
}

mkdirSync(resolve(ROOT, "deployments"), { recursive: true });
const out = resolve(ROOT, "deployments/monad-testnet.json");
writeFileSync(
  out,
  JSON.stringify(
    {
      chainId: monadTestnet.id,
      address: rounds,
      oracle,
      perplExchange: PERPL_TESTNET_EXCHANGE,
      deployBlock: Number(r.blockNumber),
      owner,
      keeper,
      treasury,
      feeBps,
      minBet: minBet.toString(),
      settleWindow: Number(settleWindow),
      markets: MARKETS.map((m, i) => ({ id: i + 1, ...m })),
      deployedAt: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
);
console.log("SmartMoneyRounds", rounds, "\nwrote", out);
