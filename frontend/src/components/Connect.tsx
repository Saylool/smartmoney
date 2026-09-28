"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { monad } from "@/lib/config";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function Connect() {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (!isConnected || !address) {
    const c = connectors[0];
    return (
      <button onClick={() => c && connect({ connector: c })} disabled={!c || isPending}>
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }
  if (chainId !== monad.id) {
    return (
      <button onClick={() => switchChain({ chainId: monad.id })}>Switch to {monad.name}</button>
    );
  }
  return (
    <div className="row" style={{ alignItems: "center", gap: 8 }}>
      <span className="mono small">{short(address)}</span>
      <button className="secondary" onClick={() => disconnect()}>Disconnect</button>
    </div>
  );
}
