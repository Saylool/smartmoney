"use client";

import { useNow } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";

export function fmtDuration(secs: number) {
  if (secs <= 0) return "0:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h > 0 ? `${h}:` : ""}${h > 0 ? String(m).padStart(2, "0") : m}:${String(s).padStart(2, "0")}`;
}

export function Countdown({ to, prefix, done }: { to: bigint | number; prefix: string; done?: string }) {
  const now = useNow();
  const { t } = useI18n();
  const diff = Number(to) - now;
  if (diff <= 0) return <span className="muted small">{done ?? `${prefix} ${t.now}`}</span>;
  return (
    <span className="small">
      {prefix}{t.inWord ? ` ${t.inWord}` : ""} <span className="mono strong">{fmtDuration(diff)}</span>
    </span>
  );
}
