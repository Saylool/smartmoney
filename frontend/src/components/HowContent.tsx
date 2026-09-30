"use client";

import { CONTRACT_ADDRESS, EXPLORER, ORACLE_ADDRESS, PERPL_URL } from "@/lib/config";
import { useI18n } from "@/lib/i18n";

const REPO = "https://github.com/Saylool/smartmoney";

function Contracts() {
  return (
    <ul className="mono small">
      <li>
        SmartMoneyRounds: <a href={`${EXPLORER}/address/${CONTRACT_ADDRESS}`}>{CONTRACT_ADDRESS}</a>
      </li>
      <li>
        PerplOracleAdapter: <a href={`${EXPLORER}/address/${ORACLE_ADDRESS}`}>{ORACLE_ADDRESS}</a>
      </li>
      <li>
        GitHub: <a href={REPO}>{REPO}</a>
      </li>
    </ul>
  );
}

const verifyCmd = `git clone ${REPO}
cd smartmoney/keeper && npm ci
node src/verify-signal.mjs <roundId>`;

function English() {
  return (
    <section className="panel prose">
      <h2>How a round works</h2>
      <ol>
        <li>
          <b>Signal.</b> The keeper takes the 20 most profitable traders on <a href={PERPL_URL}>Perpl</a> over the last
          30 days and reads their open positions directly from Perpl&apos;s exchange contract on Monad mainnet, all at one
          block. If they hold more long than short, smart money is LONG; otherwise SHORT. The full list is written
          on-chain with the round.
        </li>
        <li>
          <b>Betting.</b> You bet that smart money is <span className="ok">right</span> or{" "}
          <span className="error">wrong</span>. Betting closes when the round starts, so nobody can bet after the start
          price is known.
        </li>
        <li>
          <b>Start and end price.</b> At the start and end, anyone can call the contract to snapshot the price. The
          contract reads it from Perpl&apos;s on-chain oracle (Chainlink Data Streams) itself. Nobody, not even the keeper,
          can type in a price.
        </li>
        <li>
          <b>Payout.</b> If the price moved the way smart money was positioned, &quot;right&quot; wins, otherwise &quot;wrong&quot;
          wins. Winners split the whole pool in proportion to their stake. A 2% fee is taken from the losing side only,
          so a winner never gets back less than they put in. If nobody bet on one side, or the price did not move,
          everyone is refunded.
        </li>
        <li>
          <b>Claim.</b> Payouts are pulled: press Claim when a round settles. Unclaimed winnings stay claimable for 90 days.
        </li>
      </ol>

      <h2>What you do not have to trust</h2>
      <ul>
        <li>Prices come from an immutable oracle address; the owner cannot swap it.</li>
        <li>Anyone can lock and settle a round; if nobody does within 20 minutes, anyone can void it and everyone is refunded.</li>
        <li>The keeper cannot cancel a round once it has started and never touches funds.</li>
        <li>Each round&apos;s trader list and positions are published on-chain and can be re-checked against Perpl.</li>
        <li>The fee is fixed per round when it opens and capped at 10% in the contract.</li>
      </ul>

      <h2>Verify a round yourself</h2>
      <pre className="code">{verifyCmd}</pre>
      <p className="small muted">
        The script fetches the signal from the round&apos;s block, checks its hash against the one stored in the contract,
        re-reads every trader&apos;s position on Perpl mainnet at the same block and confirms the direction.
      </p>

      <h2>Contracts</h2>
      <Contracts />
    </section>
  );
}

function Turkish() {
  return (
    <section className="panel prose">
      <h2>Bir round nasıl işler?</h2>
      <ol>
        <li>
          <b>Sinyal.</b> Keeper, <a href={PERPL_URL}>Perpl</a>&apos;da son 30 günün en kârlı 20 trader&apos;ını alır ve açık
          pozisyonlarını Monad mainnet&apos;teki Perpl borsa kontratından, hepsini aynı blokta okur. Long pozisyonlar
          short&apos;lardan fazlaysa smart money LONG, değilse SHORT&apos;tur. Listenin tamamı round ile birlikte zincire
          yazılır.
        </li>
        <li>
          <b>Bahis.</b> Smart money&apos;nin <span className="ok">haklı</span> ya da <span className="error">haksız</span>{" "}
          çıkacağına bahis yaparsın. Bahisler round başlarken kapanır; başlangıç fiyatı belli olduktan sonra kimse bahis
          yapamaz.
        </li>
        <li>
          <b>Başlangıç ve bitiş fiyatı.</b> Başlangıçta ve bitişte herkes kontratı çağırıp fiyatı kaydedebilir. Kontrat
          fiyatı Perpl&apos;ın zincir üstü oracle&apos;ından (Chainlink Data Streams) kendisi okur. Keeper dahil hiç kimse
          fiyatı elle giremez.
        </li>
        <li>
          <b>Ödeme.</b> Fiyat smart money&apos;nin pozisyonu yönünde hareket ettiyse &quot;haklı&quot;, etmediyse &quot;haksız&quot;
          taraf kazanır. Kazananlar tüm havuzu bahisleri oranında paylaşır. %2 ücret yalnızca kaybeden taraftan alınır,
          yani kazanan asla yatırdığından azını almaz. Bir tarafa kimse bahis yapmadıysa ya da fiyat değişmediyse
          herkese iade yapılır.
        </li>
        <li>
          <b>Çekme.</b> Ödemeleri kendin çekersin: round sonuçlanınca &quot;Çek&quot;e bas. Çekilmeyen kazançlar 90 gün boyunca
          çekilebilir kalır.
        </li>
      </ol>

      <h2>Güvenmen gerekmeyen şeyler</h2>
      <ul>
        <li>Fiyatlar değiştirilemez bir oracle adresinden gelir; kontrat sahibi bile onu değiştiremez.</li>
        <li>Round&apos;u herkes kilitleyip sonuçlandırabilir; 20 dakika içinde kimse yapmazsa herkes iptal edip iadesini alabilir.</li>
        <li>Keeper başlamış bir round&apos;u iptal edemez ve fonlara hiç dokunmaz.</li>
        <li>Her round&apos;un trader listesi ve pozisyonları zincire yazılır, Perpl ile karşılaştırılabilir.</li>
        <li>Ücret round açılırken sabitlenir ve kontratta en fazla %10 ile sınırlıdır.</li>
      </ul>

      <h2>Bir round&apos;u kendin doğrula</h2>
      <pre className="code">{verifyCmd}</pre>
      <p className="small muted">
        Script, sinyali round&apos;un bloğundan çeker, özetini kontrattaki özetle karşılaştırır, her trader&apos;ın
        pozisyonunu Perpl mainnet&apos;te aynı blokta yeniden okur ve yönü doğrular.
      </p>

      <h2>Kontratlar</h2>
      <Contracts />
    </section>
  );
}

export function HowContent() {
  const { lang } = useI18n();
  return lang === "tr" ? <Turkish /> : <English />;
}
