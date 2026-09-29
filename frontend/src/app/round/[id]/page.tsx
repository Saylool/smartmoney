import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { RoundDetail } from "@/components/RoundDetail";
import { Direction, publicClient, smartMoney, type Round } from "@/lib/contract";
import { marketById } from "@/lib/config";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const r = (await publicClient.readContract({ ...smartMoney, functionName: "getRound", args: [BigInt(id)] })) as unknown as Round;
    const m = marketById(r.marketId);
    const dir = r.direction === Direction.Long ? "LONG" : "SHORT";
    const title = `Smart money is ${dir} ${m.symbol} — right or wrong? · SmartMoney #${id}`;
    return { title, description: "Bet on whether Perpl's top 20 traders are right. Parimutuel rounds on Monad.", openGraph: { title }, twitter: { card: "summary_large_image", title } };
  } catch {
    return { title: `Round #${id} · SmartMoney` };
  }
}

export default async function RoundPage({ params }: Props) {
  const { id } = await params;
  return (
    <main>
      <Header />
      <RoundDetail id={BigInt(id)} />
    </main>
  );
}
