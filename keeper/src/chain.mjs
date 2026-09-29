import { defineChain, createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// Shared secrets live in contracts/.env (gitignored); keeper/.env can override.
config({ path: resolve(here, "../../contracts/.env") });
config({ path: resolve(here, "../.env"), override: true });

export const RPC_URL = process.env.MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz";

export const monadTestnet = defineChain({
  id: Number(process.env.CHAIN_ID ?? 10143),
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "MonadVision", url: "https://testnet.monadvision.com" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
  testnet: true,
});

export const publicClient = createPublicClient({ chain: monadTestnet, transport: http(RPC_URL) });

export function walletClient() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY missing (contracts/.env)");
  const account = privateKeyToAccount(pk);
  return { account, client: createWalletClient({ account, chain: monadTestnet, transport: http(RPC_URL) }) };
}

export const ROOT = resolve(here, "../..");

/**
 * Explicit gas limit: eth_estimateGas + 20 %. Monad bills the gas LIMIT, and viem otherwise fills the
 * limit via eth_fillTransaction, which Monad testnet answers with a ~1M-gas figure.
 */
export async function gasFor(params) {
  // Pass the account as a plain address: with a local account object viem also routes the estimate
  // through eth_fillTransaction.
  const from = typeof params.account === "string" ? params.account : params.account.address;
  const est = await publicClient.estimateContractGas({ ...params, account: from });
  return (est * 12n) / 10n;
}
