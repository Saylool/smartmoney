"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "tr";

const en = {
  // header / nav
  navRounds: "Rounds",
  navLeaderboard: "Leaderboard",
  navHow: "How it works",
  connect: "Connect wallet",
  connecting: "Connecting…",
  disconnect: "Disconnect",
  login: "Log in",
  logout: "Log out",
  loading: "Loading…",
  switchTo: (n: string) => `Switch to ${n}`,
  getMon: "get testnet MON",

  // hero
  eyebrow: "Live on Monad testnet · settled by an on-chain oracle",
  heroLines: ["Perpl's top 20 traders", "just picked a side."],
  heroL3: "Are they right?",
  heroP1: "Every round we read the positions of the 20 most profitable Perpl traders and publish their net direction on-chain. You bet that smart money is ",
  right: "right",
  or: " or ",
  wrong: "wrong",
  heroP2: ". Winners split the pool.",
  ctaBet: "Bet on the next round",
  ctaHow: "How it works",
  min15: "15 min",
  pt1: "traders, read on-chain",
  pt2: "fastest rounds",
  pt3: "prices typed by humans",
  footer: (net: string) => `on ${net}. Testnet MON only, no real value. Artwork generated with Higgsfield, history indexed by Envio.`,
  contract: "Contract",

  // markets
  marketLabel: (sym: string, dur: number) => `${sym} · ${dur >= 3600 ? `${dur / 3600} hour` : `${dur / 60} min`}`,
  oraclePrice: (sym: string) => `${sym} oracle price`,
  priceSource: "Prices: Perpl on-chain oracle (Chainlink Data Streams)",
  loadingRounds: "Loading rounds…",
  noRound: "No round is open for this market right now. The keeper opens the next one shortly before it starts.",
  readError: (m: string) => `Could not read the contract: ${m}`,

  // round card
  phase: {
    betting: "Betting open",
    starting: "Starting",
    live: "Live",
    settling: "Settling",
    resolved: "Resolved",
    voided: "Refunded",
    empty: "No bets",
  },
  round: (id: string) => `Round #${id}`,
  smIs: "Smart money is",
  rightOrWrong: " — right or wrong?",
  bettingCloses: "Betting closes",
  ends: "Ends",
  inWord: "in",
  now: "now",
  waitingStart: "Waiting for the start price from the oracle…",
  waitingEnd: "Waiting for the end price from the oracle…",
  nobodyBet: "Nobody bet on this round, so there is nothing to settle.",
  start: "Start",
  nowPrice: "Now",
  end: "End",
  smWinning: "smart money winning",
  smLosing: "smart money losing",
  smWas: (right: boolean) => `Smart money was ${right ? "RIGHT" : "WRONG"}`,
  voidedNote: "Voided: every stake is refundable",
  poolRight: "Right",
  poolWrong: "Wrong",
  bettors: (n: number) => `${n} bettors`,
  pays: (x: string) => ` · pays ${x}x`,
  amountLabel: "Amount in MON",
  betRight: "Smart money is RIGHT",
  betWrong: "Smart money is WRONG",
  connectToBet: "Connect a wallet to bet.",
  minBet: (m: string) => `Minimum bet is ${m} MON.`,
  feeNote: (pct: number) => `Winners split the whole pool pro-rata; ${pct}% fee on the losing side only.`,
  yourStake: "Your stake:",
  stakeRight: (v: string) => `${v} right`,
  stakeWrong: (v: string) => `${v} wrong`,
  claimed: "claimed",
  claim: (v: string) => `Claim ${v} MON`,
  seeTraders: "See the 20 traders behind this call →",
  share: "Share on X",
  allRounds: "← All rounds",
  roundNotFound: (id: string) => `Round #${id} was not found.`,
  loadingRound: "Loading round…",

  // tx
  txConfirmWallet: "Confirm in your wallet…",
  txConfirming: "Confirming on Monad…",
  txConfirmed: "Confirmed.",
  txView: "View transaction",
  txJustFunded: "If you just received MON, Monad needs a few seconds before it can be spent. Wait a moment and try again.",

  // results
  recentResults: "Recent results",
  thRound: "Round",
  thSmartMoney: "Smart money",
  thStart: "Start",
  thEnd: "End",
  thResult: "Result",
  resRight: "Right",
  resWrong: "Wrong",
  resRefunded: "Refunded",

  // signal
  whoIsSm: "Who is smart money this round?",
  readingSignal: "Reading the signal from the chain…",
  signalError: (m: string) => `Could not read the signal: ${m}`,
  signalIntro: (n: number, asset: string) =>
    `The ${n} most profitable traders on Perpl over the last 30 days, and their ${asset} positions read on-chain at Perpl mainnet block`,
  net: "Net:",
  netLong: (v: number, a: string) => `${v} ${a} long`,
  vs: "vs",
  netShort: (v: number, a: string) => `${v} ${a} short`,
  thTrader: "Trader",
  thPnl: "30d PnL",
  thPosition: (a: string) => `${a} position`,
  flat: "flat",
  signalFoot1: "The full signal is emitted on-chain and its hash is stored in the round (",
  signalBlock: (b: string) => `block ${b}`,
  signalFoot2: "). Anyone can re-derive the direction with",

  // track record
  isSmRight: "Is smart money actually right?",
  statLine: (r: number, w: number, v: number) => `${r} right · ${w} wrong · ${v} refunded`,
  liveRecord: "Live, on-chain track record of settled rounds on this contract.",
  backtestLabel: (sym: string, d: number) => `${sym} · backtest ${d}d`,
  backtestLine: (r: number, w: number, h: number) => `${r} right · ${w} wrong of ${h} hours`,
  backtestNote: (n: number) =>
    `Backtest: next-hour direction of Perpl's current top ${n} traders, replayed hourly from on-chain state. It is biased upward, because those traders were picked for being profitable in the same window. Even so, smart money is close to a coin flip over one hour, which is exactly what makes this a fair market.`,

  // claims
  readyToClaim: "Ready to claim",
  refund: "refund",
  winnings: "winnings",

  // leaderboard
  whoBeats: "Who beats smart money?",
  lbNote:
    "Net = everything claimed (winnings and refunds) minus everything staked, straight from the contract. Stakes in rounds that have not settled yet count against you until you claim.",
  noBets: "No bets yet. Be the first.",
  thPlayer: "Player",
  thNet: "Net (MON)",
  thStaked: "Staked",
  thBets: "Bets",
  thWins: "Wins",

  // share
  shareOpen: (dir: string, sym: string) => `Perpl's top 20 traders are ${dir} ${sym}. Are they right? Tail or fade them on @monad`,
  shareDone: (dir: string, sym: string, right: boolean) =>
    `Perpl's top 20 traders went ${dir} ${sym} and were ${right ? "RIGHT" : "WRONG"}. Called it on Tail or Fade @monad`,

  // envio
  poweredBy: "Indexed by Envio HyperSync",
  liveActivity: "Live activity",
  actBet: (who: string, amt: string, right: boolean) => `${who} bet ${amt} MON that smart money is ${right ? "RIGHT" : "WRONG"}`,
  actClaim: (who: string, amt: string) => `${who} claimed ${amt} MON`,
  actResolved: (right: boolean) => `Smart money was ${right ? "RIGHT" : "WRONG"}`,
  actVoided: (reason: string) => `Round refunded (${reason === "one-sided" ? "one side empty" : reason === "tie" ? "price unchanged" : reason})`,
  actCreated: (dir: string) => `New round: smart money is ${dir}`,
  ago: (secs: number) => (secs < 60 ? `${secs}s ago` : secs < 3600 ? `${Math.floor(secs / 60)}m ago` : secs < 86400 ? `${Math.floor(secs / 3600)}h ago` : `${Math.floor(secs / 86400)}d ago`),
  noActivity: "No bets yet. The first one shows up here within seconds.",
  totBets: "Bets placed",
  totVolume: "Volume",
  totPlayers: "Players",
  totRounds: "Rounds settled",
  historyTitle: "Round by round",
  historyLegend: "green = smart money right · red = wrong · grey = refunded",
  envioOff: "Full history needs an Envio API token (ENVIO_API_TOKEN).",
};

export type Dict = typeof en;

const tr: Dict = {
  navRounds: "Round'lar",
  navLeaderboard: "Liderlik",
  navHow: "Nasıl çalışır",
  connect: "Cüzdan bağla",
  connecting: "Bağlanıyor…",
  disconnect: "Bağlantıyı kes",
  login: "Giriş yap",
  logout: "Çıkış yap",
  loading: "Yükleniyor…",
  switchTo: (n) => `${n} ağına geç`,
  getMon: "testnet MON al",

  eyebrow: "Monad testnet'te canlı · zincir üstü oracle ile sonuçlanır",
  heroLines: ["Perpl'ın en iyi", "20 trader'ı", "tarafını seçti."],
  heroL3: "Haklılar mı?",
  heroP1: "Her round'da Perpl'ın en kârlı 20 trader'ının pozisyonlarını okuyup net yönlerini zincire yazıyoruz. Sen smart money'nin ",
  right: "haklı",
  or: " ya da ",
  wrong: "haksız",
  heroP2: " çıkacağına bahis yaparsın. Kazananlar havuzu paylaşır.",
  ctaBet: "Sıradaki round'a bahis yap",
  ctaHow: "Nasıl çalışır",
  min15: "15 dk",
  pt1: "trader, zincirden okunur",
  pt2: "en hızlı round",
  pt3: "elle girilen fiyat",
  footer: (net) => `(${net}). Yalnızca testnet MON, gerçek değeri yok. Görseller Higgsfield ile üretildi, geçmiş Envio ile indekslendi.`,
  contract: "Kontrat",

  marketLabel: (sym, dur) => `${sym} · ${dur >= 3600 ? `${dur / 3600} saat` : `${dur / 60} dk`}`,
  oraclePrice: (sym) => `${sym} oracle fiyatı`,
  priceSource: "Fiyatlar: Perpl zincir üstü oracle (Chainlink Data Streams)",
  loadingRounds: "Round'lar yükleniyor…",
  noRound: "Bu piyasada şu an açık round yok. Keeper bir sonrakini başlamadan kısa süre önce açar.",
  readError: (m) => `Kontrat okunamadı: ${m}`,

  phase: {
    betting: "Bahis açık",
    starting: "Başlıyor",
    live: "Canlı",
    settling: "Sonuçlanıyor",
    resolved: "Sonuçlandı",
    voided: "İade edildi",
    empty: "Bahis yok",
  },
  round: (id) => `Round #${id}`,
  smIs: "Smart money",
  rightOrWrong: " — haklı mı, haksız mı?",
  bettingCloses: "Bahis kapanıyor:",
  ends: "Bitiş:",
  inWord: "",
  now: "şimdi",
  waitingStart: "Başlangıç fiyatı oracle'dan bekleniyor…",
  waitingEnd: "Bitiş fiyatı oracle'dan bekleniyor…",
  nobodyBet: "Bu round'a kimse bahis yapmadı, sonuçlanacak bir şey yok.",
  start: "Başlangıç",
  nowPrice: "Şimdi",
  end: "Bitiş",
  smWinning: "smart money kazanıyor",
  smLosing: "smart money kaybediyor",
  smWas: (right) => `Smart money ${right ? "HAKLI" : "HAKSIZ"} çıktı`,
  voidedNote: "İptal edildi: tüm bahisler iade alınabilir",
  poolRight: "Haklı",
  poolWrong: "Haksız",
  bettors: (n) => `${n} bahisçi`,
  pays: (x) => ` · ${x}x öder`,
  amountLabel: "MON miktarı",
  betRight: "Smart money HAKLI",
  betWrong: "Smart money HAKSIZ",
  connectToBet: "Bahis yapmak için cüzdan bağla.",
  minBet: (m) => `En düşük bahis ${m} MON.`,
  feeNote: (pct) => `Kazananlar tüm havuzu payları oranında bölüşür; %${pct} ücret yalnızca kaybeden taraftan alınır.`,
  yourStake: "Bahsin:",
  stakeRight: (v) => `${v} haklı`,
  stakeWrong: (v) => `${v} haksız`,
  claimed: "çekildi",
  claim: (v) => `${v} MON çek`,
  seeTraders: "Bu kararın arkasındaki 20 trader'ı gör →",
  share: "X'te paylaş",
  allRounds: "← Tüm round'lar",
  roundNotFound: (id) => `Round #${id} bulunamadı.`,
  loadingRound: "Round yükleniyor…",

  txConfirmWallet: "Cüzdanında onayla…",
  txConfirming: "Monad'da onaylanıyor…",
  txConfirmed: "Onaylandı.",
  txView: "İşlemi görüntüle",
  txJustFunded: "MON'u yeni aldıysan Monad'ın harcanabilir hale getirmesi birkaç saniye sürer. Biraz bekleyip tekrar dene.",

  recentResults: "Son sonuçlar",
  thRound: "Round",
  thSmartMoney: "Smart money",
  thStart: "Başlangıç",
  thEnd: "Bitiş",
  thResult: "Sonuç",
  resRight: "Haklı",
  resWrong: "Haksız",
  resRefunded: "İade",

  whoIsSm: "Bu round'da smart money kim?",
  readingSignal: "Sinyal zincirden okunuyor…",
  signalError: (m) => `Sinyal okunamadı: ${m}`,
  signalIntro: (n, asset) =>
    `Perpl'da son 30 günün en kârlı ${n} trader'ı ve ${asset} pozisyonları; Perpl mainnet'te şu blokta zincirden okundu:`,
  net: "Net:",
  netLong: (v, a) => `${v} ${a} long`,
  vs: "karşı",
  netShort: (v, a) => `${v} ${a} short`,
  thTrader: "Trader",
  thPnl: "30g PnL",
  thPosition: (a) => `${a} pozisyonu`,
  flat: "pozisyon yok",
  signalFoot1: "Sinyalin tamamı zincire yazılır ve özeti round'da saklanır (",
  signalBlock: (b) => `blok ${b}`,
  signalFoot2: "). Yönü herkes şu komutla yeniden hesaplayabilir:",

  isSmRight: "Smart money gerçekten haklı mı?",
  statLine: (r, w, v) => `${r} haklı · ${w} haksız · ${v} iade`,
  liveRecord: "Bu kontratta sonuçlanan round'ların canlı, zincir üstü karnesi.",
  backtestLabel: (sym, d) => `${sym} · ${d} günlük test`,
  backtestLine: (r, w, h) => `${h} saatte ${r} haklı · ${w} haksız`,
  backtestNote: (n) =>
    `Geriye dönük test: Perpl'ın bugünkü en iyi ${n} trader'ının bir sonraki saatteki yönü, zincir verisiyle saat saat yeniden oynatıldı. Sonuç yukarı yanlıdır, çünkü bu trader'lar aynı dönemde kârlı oldukları için seçildi. Buna rağmen smart money bir saatlik vadede yazı-turaya yakın; bu da piyasayı adil kılan şey.`,

  readyToClaim: "Çekilmeye hazır",
  refund: "iade",
  winnings: "kazanç",

  whoBeats: "Smart money'yi kim yeniyor?",
  lbNote:
    "Net = çekilen her şey (kazanç ve iadeler) eksi yatırılan her şey, doğrudan kontrattan. Henüz sonuçlanmamış round'lardaki bahisler, çekene kadar aleyhine sayılır.",
  noBets: "Henüz bahis yok. İlk sen ol.",
  thPlayer: "Oyuncu",
  thNet: "Net (MON)",
  thStaked: "Yatırılan",
  thBets: "Bahis",
  thWins: "Kazanç",

  shareOpen: (dir, sym) => `Perpl'ın en iyi 20 trader'ı ${sym}'de ${dir}. Haklılar mı? Tail or Fade'de bahis yap @monad`,
  shareDone: (dir, sym, right) =>
    `Perpl'ın en iyi 20 trader'ı ${sym}'de ${dir} gitti ve ${right ? "HAKLI" : "HAKSIZ"} çıktı. Tail or Fade'de bildim @monad`,

  poweredBy: "Envio HyperSync ile indekslendi",
  liveActivity: "Canlı aktivite",
  actBet: (who, amt, right) => `${who}, smart money ${right ? "HAKLI" : "HAKSIZ"} diye ${amt} MON yatırdı`,
  actClaim: (who, amt) => `${who} ${amt} MON çekti`,
  actResolved: (right) => `Smart money ${right ? "HAKLI" : "HAKSIZ"} çıktı`,
  actVoided: (reason) => `Round iade edildi (${reason === "one-sided" ? "bir taraf boş" : reason === "tie" ? "fiyat değişmedi" : reason})`,
  actCreated: (dir) => `Yeni round: smart money ${dir}`,
  ago: (secs) => (secs < 60 ? `${secs} sn önce` : secs < 3600 ? `${Math.floor(secs / 60)} dk önce` : secs < 86400 ? `${Math.floor(secs / 3600)} sa önce` : `${Math.floor(secs / 86400)} gün önce`),
  noActivity: "Henüz bahis yok. İlk bahis birkaç saniye içinde burada görünür.",
  totBets: "Bahis sayısı",
  totVolume: "Hacim",
  totPlayers: "Oyuncu",
  totRounds: "Sonuçlanan round",
  historyTitle: "Round round",
  historyLegend: "yeşil = smart money haklı · kırmızı = haksız · gri = iade",
  envioOff: "Tüm geçmiş için Envio API anahtarı gerekli (ENVIO_API_TOKEN).",
};

const DICTS: Record<Lang, Dict> = { en, tr };
const STORAGE_KEY = "smartmoney.lang";

type Ctx = { lang: Lang; t: Dict; setLang: (l: Lang) => void };
const I18nContext = createContext<Ctx>({ lang: "en", t: en, setLang: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    let initial: Lang | null = null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "tr") initial = saved;
    } catch {
      /* storage unavailable */
    }
    if (!initial && typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("tr")) initial = "tr";
    if (initial) setLangState(initial);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* storage unavailable */
    }
  };

  return <I18nContext.Provider value={{ lang, t: DICTS[lang], setLang }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);

export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="lang" role="group" aria-label="Language">
      {(["en", "tr"] as const).map((l) => (
        <button key={l} className={l === lang ? "on" : ""} aria-pressed={l === lang} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
