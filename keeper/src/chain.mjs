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
