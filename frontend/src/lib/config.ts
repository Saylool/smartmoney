import { defineChain, type Address } from "viem";

// Defaults: the live Monad testnet deployment (deployments/monad-testnet.json). Env vars override.
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0x860844ca0ca1f3ec43a8045370d7cef8b329f141") as Address;
export const ORACLE_ADDRESS = (process.env.NEXT_PUBLIC_ORACLE_ADDRESS ||
  "0x762378bcabb0507b56c56fcdd24986b3f6d5c1b3") as Address;
export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "";

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 10143);
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://testnet-rpc.monad.xyz";

export const monad = defineChain({
  id: CHAIN_ID,
  name: CHAIN_ID === 10143 ? "Monad Testnet" : `Chain ${CHAIN_ID}`,
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "MonadVision", url: "https://testnet.monadvision.com" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
  testnet: true,
});

export const EXPLORER = monad.blockExplorers.default.url;
export const FAUCET_URL = "https://faucet.monad.xyz";
export const PERPL_URL = "https://app.perpl.xyz";

/** Mirrors keeper/src/markets.mjs. Market ids on-chain are 1..n in this order. */
export const MARKETS = [
  { id: 1, symbol: "BTC", duration: 3600, priceDecimals: 1, label: "BTC · 1 hour" },
  { id: 2, symbol: "BTC", duration: 900, priceDecimals: 1, label: "BTC · 15 min" },
  { id: 3, symbol: "ETH", duration: 3600, priceDecimals: 2, label: "ETH · 1 hour" },
  { id: 4, symbol: "SOL", duration: 3600, priceDecimals: 2, label: "SOL · 1 hour" },
] as const;

export type MarketMeta = (typeof MARKETS)[number];
export const marketById = (id: number): MarketMeta => MARKETS.find((m) => m.id === id) ?? MARKETS[0];
