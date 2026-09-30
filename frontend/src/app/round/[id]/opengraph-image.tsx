import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { formatEther } from "viem";
import { Direction, Side, Status, publicClient, smartMoney, type Round } from "@/lib/contract";
import { marketById } from "@/lib/config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 60;
export const runtime = "nodejs";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let r: Round | null = null;
  try {
    r = (await publicClient.readContract({ ...smartMoney, functionName: "getRound", args: [BigInt(id)] })) as unknown as Round;
  } catch {
    r = null;
  }
  const m = r ? marketById(r.marketId) : null;
  const long = r?.direction === Direction.Long;
  const pool = r ? Number(formatEther(r.rightPool + r.wrongPool)).toFixed(2) : "0";
  const result =
    r?.status === Status.Resolved ? (r.winner === Side.Right ? "Smart money was RIGHT" : "Smart money was WRONG")
    : r?.status === Status.Voided ? "Round refunded"
    : "Right or wrong? Place your bet.";

  const art = await readFile(join(process.cwd(), "public/img/og.jpg")).then((b) => `data:image/jpeg;base64,${b.toString("base64")}`).catch(() => null);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0b0d12", color: "#e8ecf4", padding: 64, fontFamily: "sans-serif", position: "relative" }}>
        {art && <img src={art} width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630 }} alt="" />}
        <div style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, display: "flex", background: "linear-gradient(90deg, rgba(11,13,18,0.95) 0%, rgba(11,13,18,0.8) 45%, rgba(11,13,18,0.1) 100%)" }} />
        <div style={{ display: "flex", alignItems: "center", fontSize: 36, color: "#836ef9", fontWeight: 700 }}>
          <div style={{ width: 26, height: 26, background: "#836ef9", transform: "rotate(45deg)", marginRight: 20 }} />
          Tail or Fade · Round #{id}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 40, color: "#8b95a9" }}>Perpl&apos;s top 20 traders are</div>
          <div style={{ display: "flex", fontSize: 120, fontWeight: 800, color: long ? "#34d399" : "#f87171" }}>
            {r ? `${long ? "LONG" : "SHORT"} ${m?.symbol}` : "…"}
          </div>
          <div style={{ display: "flex", fontSize: 48, marginTop: 8 }}>{result}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, color: "#8b95a9" }}>
          <span>{m?.label ?? ""} · pool {pool} MON</span>
          <span>Parimutuel on Monad</span>
        </div>
      </div>
    ),
    size,
  );
}
