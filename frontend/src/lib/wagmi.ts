import { createConfig as createWagmiConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { createConfig as createPrivyWagmiConfig } from "@privy-io/wagmi";
import { monad, RPC_URL } from "./config";

/** Plain wagmi (browser wallet) config, used when no Privy app id is configured. */
export const injectedConfig = createWagmiConfig({
  chains: [monad],
  connectors: [injected()],
  transports: { [monad.id]: http(RPC_URL, { batch: true }) },
  ssr: true,
});

/** Privy-managed config: connectors come from Privy (email/social embedded wallets + external). */
export const privyConfig = createPrivyWagmiConfig({
  chains: [monad],
  transports: { [monad.id]: http(RPC_URL, { batch: true }) },
  ssr: true,
});
