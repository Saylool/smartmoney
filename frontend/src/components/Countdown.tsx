"use client";

import { useNow } from "@/lib/hooks";

export function fmtDuration(secs: number) {
  if (secs <= 0) return "0:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h > 0 ? `${h}:` : ""}${h > 0 ? String(m).padStart(2, "0") : m}:${String(s).padStart(2, "0")}`;
}

export function Countdown({ to, prefix, done }: { to: bigint | number; prefix: string; done?: string }) {
  const now = useNow();
  const diff = Number(to) - now;
  if (diff <= 0) return <span className="muted small">{done ?? `${prefix} now`}</span>;
  return (
    <span className="small">
      {prefix} in <span className="mono strong">{fmtDuration(diff)}</span>
    </span>
  );
}
