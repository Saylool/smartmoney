// Backtest: how often was Perpl smart money right over the next hour?
//
// For every hour H in the last DAYS days and every asset:
//   signal = net direction of TODAY's top-20 (30d PnL) traders, read on-chain at the block of H
//   outcome = Perpl mainnet 1h candle opening at H: close > open (up) / close < open (down)
//
// Caveat (look-ahead / survivorship bias): the trader list is today's 30-day leaderboard, i.e. the
// traders are selected BECAUSE they were profitable during the test window. Results are an upper
// bound, not a forecast. The contract's on-chain track record (marketStats) is the unbiased number.
//
//   node src/backtest.mjs            # writes frontend/public/backtest.json
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ROOT } from "./chain.mjs";
import { PERPL_API } from "./markets.mjs";
import { mainnet, fetchTopTraders, accountIds, netDirection } from "./signal.mjs";

const DAYS = Number(process.env.DAYS ?? 7);
const ASSETS = [
  { symbol: "BTC", perpId: 1, lotDecimals: 5 },
  { symbol: "ETH", perpId: 20, lotDecimals: 3 },
  { symbol: "SOL", perpId: 31, lotDecimals: 3 },
];
const HOUR = 3600;
const CONCURRENCY = 6;

async function blockAt(ts, anchor) {
  // Monad blocks are ~0.4 s; start from a linear estimate and refine a few times.
  let guess = anchor.number - BigInt(Math.round((anchor.time - ts) / anchor.secPerBlock));
  for (let i = 0; i < 4; i++) {
    const b = await mainnet.getBlock({ blockNumber: guess });
    const diff = Number(b.timestamp) - ts;
    if (Math.abs(diff) <= 1) return b.number;
    guess -= BigInt(Math.round(diff / anchor.secPerBlock));
  }
  return guess;
}

async function candles(perpId, fromTs, toTs) {
  const url = `${PERPL_API}/v1/market-data/${perpId}/candles/${HOUR}/${fromTs * 1000}-${toTs * 1000}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`candles HTTP ${res.status}`);
  const body = await res.json();
  return new Map(body.d.map((c) => [Math.floor(c.t / 1000), c]));
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

const head = await mainnet.getBlock();
const past = await mainnet.getBlock({ blockNumber: head.number - 1_000_000n });
const anchor = {
  number: head.number,
  time: Number(head.timestamp),
  secPerBlock: (Number(head.timestamp) - Number(past.timestamp)) / 1_000_000,
};
const endHour = Math.floor(anchor.time / HOUR) * HOUR - HOUR; // last fully closed candle
const hours = Array.from({ length: DAYS * 24 }, (_, i) => endHour - i * HOUR).reverse();

const traders = await fetchTopTraders();
const ids = await accountIds(traders.map((t) => t.address), head.number);
console.log(`top ${traders.length} traders, ${hours.length} hours, ~${anchor.secPerBlock.toFixed(3)} s/block`);

const blocks = await pool(hours, CONCURRENCY, (h) => blockAt(h, anchor));

const result = { generatedAt: new Date().toISOString(), days: DAYS, board: "month/pnl", topN: traders.length, bias:
  "Trader list is today's 30-day leaderboard, so traders were selected for being profitable in this window; treat as an upper bound.", assets: {} };

for (const a of ASSETS) {
  const cs = await candles(a.perpId, hours[0], endHour + HOUR);
  const rows = await pool(hours, CONCURRENCY, async (h, i) => {
    const c = cs.get(h);
    if (!c) return { h, dir: null, move: null };
    const sig = await netDirection(traders, ids, a.perpId, a.lotDecimals, blocks[i]);
    const move = c.c > c.o ? "up" : c.c < c.o ? "down" : "flat";
    return { h, dir: sig.direction, move, o: c.o, c: c.c };
  });
  let right = 0, wrong = 0, noSignal = 0, flat = 0;
  for (const r of rows) {
    if (!r.move) continue;
    if (!r.dir) noSignal++;
    else if (r.move === "flat") flat++;
    else if ((r.dir === "long") === (r.move === "up")) right++;
    else wrong++;
  }
  const decided = right + wrong;
  result.assets[a.symbol] = {
    hours: rows.length, right, wrong, noSignal, flat,
    accuracy: decided ? Math.round((right / decided) * 1000) / 10 : null,
    series: rows.map((r) => [r.h, r.dir ? (r.dir === "long" ? "L" : "S") : "", r.move ?? ""]),
  };
  console.log(`${a.symbol}: right ${right} wrong ${wrong} (acc ${result.assets[a.symbol].accuracy}%), no signal ${noSignal}, flat ${flat}`);
}

const out = resolve(ROOT, "frontend/public/backtest.json");
writeFileSync(out, JSON.stringify(result) + "\n");
console.log("wrote", out);
