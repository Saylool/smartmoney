import { Header } from "@/components/Header";
import { Dashboard } from "@/components/Dashboard";
import { HeroCopy, HomeFooter } from "@/components/Hero";
import { HeroVideo } from "@/components/HeroVideo";

export default function Home() {
  return (
    <>
      <div className="hero-wrap">
        <div className="hero-bg" aria-hidden />
        <HeroVideo />
        <div className="hero-shade" aria-hidden />
        <div className="hero-inner">
          <Header />
          <HeroCopy />
        </div>
      </div>
      <main id="rounds">
        <Dashboard />
        <HomeFooter />
      </main>
    </>
  );
}
