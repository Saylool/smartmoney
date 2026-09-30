"use client";

import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { FAUCET_URL, PRIVY_APP_ID, monad } from "@/lib/config";
import { fmtMon } from "@/lib/contract";
import { useI18n } from "@/lib/i18n";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

function Account() {
  const { t } = useI18n();
  const { address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { data: bal } = useBalance({ address, query: { enabled: !!address } });
  if (!address) return null;
  if (chainId !== monad.id) {
    return <button onClick={() => switchChain({ chainId: monad.id })}>{t.switchTo(monad.name)}</button>;
  }
  return (
    <div className="account">
      <span className="mono small">{short(address)}</span>
      {bal && (
        <span className="small muted">
          {fmtMon(bal.value, 3)} MON
          {bal.value === 0n && (
            <>
              {" · "}
              <a href={FAUCET_URL} target="_blank" rel="noreferrer">{t.getMon}</a>
            </>
          )}
        </span>
      )}
    </div>
  );
}

function PrivyConnect() {
  const { t } = useI18n();
  const { ready, authenticated, login, logout } = usePrivy();
  if (!ready) return <button disabled>{t.loading}</button>;
  if (!authenticated) return <button onClick={login}>{t.login}</button>;
  return (
    <div className="row center gap8">
      <Account />
      <button className="secondary" onClick={logout}>{t.logout}</button>
    </div>
  );
}

function InjectedConnect() {
  const { t } = useI18n();
  const { isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  if (!isConnected) {
    const c = connectors[0];
    return (
      <button onClick={() => c && connect({ connector: c })} disabled={!c || isPending}>
        {isPending ? t.connecting : t.connect}
      </button>
    );
  }
  return (
    <div className="row center gap8">
      <Account />
      <button className="secondary" onClick={() => disconnect()}>{t.disconnect}</button>
    </div>
  );
}

export function Connect() {
  return PRIVY_APP_ID ? <PrivyConnect /> : <InjectedConnect />;
}
