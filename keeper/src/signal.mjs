// Computes the "smart money" signal: the net direction of the top-N most profitable Perpl traders
// of the last 30 days, read from Perpl MAINNET. Positions are read on-chain from the exchange
// contract (not from an API), pinned to one block so the result is reproducible.
import { createPublicClient, http, getAddress } from "viem";
import { perplExchangeAbi } from "./perplAbi.mjs";
import { PERPL_API, PERPL_MAINNET_EXCHANGE, MONAD_MAINNET_RPC, TOP_N } from "./markets.mjs";

export const mainnet = createPublicClient({ transport: http(MONAD_MAINNET_RPC, { batch: true, retryCount: 3 }) });

const LONG = 0; // Perpl PositionEnum: 0 = long, 1 = short (only meaningful when lot > 0)

/** Top-N traders by 30-day PnL from Perpl's public leaderboard. */
export async function fetchTopTraders(n = TOP_N) {
  const res = await fetch(`${PERPL_API}/v1/trading/leaderboard/month/pnl`);
  if (!res.ok) throw new Error(`Perpl leaderboard HTTP ${res.status}`);
  const body = await res.json();
  return body.d.slice(0, n).map((row) => ({
    rank: row.i,
    address: getAddress(row.a),
    pnl30dUsd: Math.round(Number(row.p) / 1e6), // AUSD, 6 decimals
  }));
}

/** Perpl account ids for the given addresses, at `blockNumber`. */
export async function accountIds(addresses, blockNumber) {
  return Promise.all(
    addresses.map(async (a) => {
      const info = await mainnet.readContract({
        address: PERPL_MAINNET_EXCHANGE, abi: perplExchangeAbi, functionName: "getAccountByAddr", args: [a], blockNumber,
      });
      return info.accountId;
    }),
  );
}

/**
 * Net direction of `traders` on Perpl perpetual `perpId` at `blockNumber`.
 * @returns {{direction: "long"|"short"|null, long: number, short: number, positions: Array}}
 */
export async function netDirection(traders, ids, perpId, lotDecimals, blockNumber) {
  const positions = await Promise.all(
    traders.map(async (t, i) => {
      if (ids[i] === 0n) return { ...t, side: null, size: 0 };
      const [pos] = await mainnet.readContract({
        address: PERPL_MAINNET_EXCHANGE, abi: perplExchangeAbi, functionName: "getPosition", args: [BigInt(perpId), ids[i]], blockNumber,
      });
      if (pos.lotLNS === 0n) return { ...t, side: null, size: 0 };
      return { ...t, side: pos.positionType === LONG ? "long" : "short", size: Number(pos.lotLNS) / 10 ** lotDecimals };
    }),
  );
  let long = 0;
  let short = 0;
  for (const p of positions) {
    if (p.side === "long") long += p.size;
    else if (p.side === "short") short += p.size;
  }
  const direction = long > short ? "long" : short > long ? "short" : null;
  return { direction, long, short, positions };
}

/** Snapshot the leaderboard + chain once, for reuse across markets in one keeper tick. */
export async function snapshot() {
  const block = await mainnet.getBlock();
  const traders = await fetchTopTraders();
  const ids = await accountIds(traders.map((t) => t.address), block.number);
  return { blockNumber: block.number, blockTime: Number(block.timestamp), traders, ids };
}

/** Build the on-chain signal payload for one market. Compact JSON; see README for the schema. */
export async function signalFor(snap, market) {
  const r = await netDirection(snap.traders, snap.ids, market.signalPerpId, market.signalLotDecimals, snap.blockNumber);
  const round6 = (x) => Math.round(x * 1e6) / 1e6;
  const payload = {
    v: 1,
    src: "perpl-mainnet",
    chainId: 143,
    exchange: PERPL_MAINNET_EXCHANGE,
    block: Number(snap.blockNumber),
    time: snap.blockTime,
    asset: market.symbol,
    perpId: market.signalPerpId,
    board: "month/pnl",
    long: round6(r.long),
    short: round6(r.short),
    dir: r.direction,
    // [rank, address, 30d pnl USD, side ("L"/"S"/""), size in asset units]
    t: r.positions.map((p) => [p.rank, p.address, p.pnl30dUsd, p.side === "long" ? "L" : p.side === "short" ? "S" : "", round6(p.size)]),
  };
  return { direction: r.direction, json: JSON.stringify(payload) };
}
