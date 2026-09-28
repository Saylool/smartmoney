"use client";

import { useEffect, useState } from "react";

export function Countdown({ to, prefix }: { to: bigint; prefix: string }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Number(to) - now;
  if (diff <= 0) return <span className="muted small">{prefix} passed</span>;
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return (
    <span className="small">
      {prefix} in <span className="mono">{h > 0 ? `${h}h ` : ""}{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>
    </span>
  );
}
