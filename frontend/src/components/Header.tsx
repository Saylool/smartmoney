"use client";

import Link from "next/link";
import { Connect } from "./Connect";
import { LangToggle, useI18n } from "@/lib/i18n";

export function Header() {
  const { t } = useI18n();
  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <span className="logo" aria-hidden>◆</span> SmartMoney
      </Link>
      <nav className="nav">
        <Link href="/">{t.navRounds}</Link>
        <Link href="/leaderboard">{t.navLeaderboard}</Link>
        <Link href="/how">{t.navHow}</Link>
      </nav>
      <div className="row center gap8">
        <LangToggle />
        <Connect />
      </div>
    </header>
  );
}
