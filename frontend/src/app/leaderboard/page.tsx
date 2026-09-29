import { Header } from "@/components/Header";
import { Leaderboard } from "@/components/Leaderboard";

export const metadata = { title: "Leaderboard · SmartMoney" };

export default function LeaderboardPage() {
  return (
    <main>
      <Header />
      <Leaderboard />
    </main>
  );
}
