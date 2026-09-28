import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain, type Address } from "viem";

// Default: Monad testnet deployment (see deployments/monad-testnet.json). Env var overrides.
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x04fc4b1a8f5e9514d0f8f9d4e27e977fb31fb2d1") as Address | "";
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 10143);
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://testnet-rpc.monad.xyz";

export const monad = defineChain({
  id: CHAIN_ID,
  name: CHAIN_ID === 10143 ? "Monad Testnet" : `Chain ${CHAIN_ID}`,
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: {
    default: { name: "MonadVision", url: "https://testnet.monadvision.com" },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [monad],
  connectors: [injected()],
  transports: { [monad.id]: http(RPC_URL) },
  ssr: true,
});

export const EXPLORER = monad.blockExplorers.default.url;
