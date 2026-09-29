import Link from "next/link";
import { Connect } from "./Connect";

export function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <span className="logo" aria-hidden>◆</span> SmartMoney
      </Link>
      <nav className="nav">
        <Link href="/">Rounds</Link>
        <Link href="/leaderboard">Leaderboard</Link>
        <Link href="/how">How it works</Link>
      </nav>
      <Connect />
    </header>
  );
}
