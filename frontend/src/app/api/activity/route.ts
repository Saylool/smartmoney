import { NextResponse } from "next/server";
import { envioEnabled, fetchAllEvents, summarize } from "@/lib/envio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Contract-wide activity, history and totals, indexed by Envio HyperSync.
// Cached at the edge for 15 s so every visitor shares one HyperSync call.
export async function GET() {
  if (!envioEnabled()) {
    return NextResponse.json({ enabled: false }, { headers: { "cache-control": "s-maxage=60" } });
  }
  try {
    const { events, height } = await fetchAllEvents();
    return NextResponse.json(summarize(events, height), {
      headers: { "cache-control": "public, s-maxage=15, stale-while-revalidate=60" },
    });
  } catch (e) {
    return NextResponse.json({ enabled: true, error: (e as Error).message }, { status: 502 });
  }
}
