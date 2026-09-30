"use client";

import { useQuery } from "@tanstack/react-query";
import type { Summary } from "./envio";

export type ActivityResponse = Summary | { enabled: false } | { enabled: true; error: string };

/** Contract-wide history from /api/activity (Envio HyperSync). */
export function useActivity() {
  return useQuery({
    queryKey: ["activity"],
    queryFn: async () => (await fetch("/api/activity")).json() as Promise<ActivityResponse>,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

export const isSummary = (d: ActivityResponse | undefined): d is Summary =>
  !!d && d.enabled === true && !("error" in d);
