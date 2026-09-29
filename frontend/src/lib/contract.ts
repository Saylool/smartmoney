import { createPublicClient, formatEther, http, hexToString, parseAbiItem, type Address } from "viem";
import { smartMoneyAbi, oracleAbi } from "./abi";
import { CONTRACT_ADDRESS, ORACLE_ADDRESS, RPC_URL, marketById, monad } from "./config";

export const smartMoney = { address: CONTRACT_ADDRESS, abi: smartMoneyAbi } as const;
export const oracle = { address: ORACLE_ADDRESS, abi: oracleAbi } as const;

/** Shared read-only client (also usable on the server, e.g. for OG images). */
export const publicClient = createPublicClient({ chain: monad, transport: http(RPC_URL, { batch: true }) });

export enum Direction { None, Long, Short }
export enum Side { None, Right, Wrong }
export enum Status { None, Open, Locked, Resolved, Voided }

export type Round = {
  marketId: number;
  bettingCloses: bigint;
  startTime: bigint;
  endTime: bigint;
  direction: number;
  status: number;
  winner: number;
  feeBps: number;
  rightBettors: number;
  wrongBettors: number;
  claims: number;
  swept: boolean;
  createdBlock: bigint;
  signalHash: `0x${string}`;
  startPrice: bigint;
  endPrice: bigint;
  rightPool: bigint;
  wrongPool: bigint;
  fee: bigint;
  claimedTotal: bigint;
  dust: bigint;
};

export type RoundWithId = Round & { id: bigint };

export type Phase = "betting" | "starting" | "live" | "settling" | "resolved" | "voided" | "empty";

/** User-facing phase of a round at time `now` (unix seconds). */
export function phaseOf(r: Round, now: number): Phase {
  if (r.status === Status.Resolved) return "resolved";
  if (r.status === Status.Voided) return "voided";
  if (r.status === Status.Open) {
    if (now < Number(r.bettingCloses)) return "betting";
    // Nobody bet: the keeper skips settlement since there is nothing to pay out or refund.
    return r.rightPool + r.wrongPool === 0n ? "empty" : "starting";
  }
  return now < Number(r.endTime) ? "live" : "settling";
}

export const directionLabel = (d: number) => (d === Direction.Long ? "LONG" : d === Direction.Short ? "SHORT" : "—");

export const fmtMon = (v: bigint, digits = 4) =>
  Number(formatEther(v)).toLocaleString("en-US", { maximumFractionDigits: digits });

export function fmtPrice(v: bigint, marketId: number) {
  const m = marketById(marketId);
  return (Number(v) / 10 ** m.priceDecimals).toLocaleString("en-US", {
    minimumFractionDigits: m.priceDecimals,
    maximumFractionDigits: m.priceDecimals,
  });
}

/** Implied payout multiple for a 1-unit stake on `side` if it wins (after fee on the losing pool). */
export function multiple(r: Round, side: Side): number | null {
  const mine = side === Side.Right ? r.rightPool : r.wrongPool;
  const other = side === Side.Right ? r.wrongPool : r.rightPool;
  if (mine === 0n) return null;
  const fee = (other * BigInt(r.feeBps)) / 10_000n;
  return Number(mine + other - fee) / Number(mine);
}

/** Is smart money currently right, given a live price? null when flat. */
export function smartMoneyWinning(r: Round, price: bigint): boolean | null {
  if (price === r.startPrice) return null;
  const up = price > r.startPrice;
  return (r.direction === Direction.Long) === up;
}

// ---------------------------------------------------------------- signal

/** Decoded SignalPublished payload (see keeper/src/signal.mjs). */
export type Signal = {
  v: number;
  src: string;
  chainId: number;
  exchange: Address;
  block: number;
  time: number;
  asset: string;
  perpId: number;
  board: string;
  long: number;
  short: number;
  dir: "long" | "short" | null;
  /** [rank, address, 30d pnl USD, "L" | "S" | "", size] */
  t: [number, Address, number, "L" | "S" | "", number][];
};

const signalEvent = parseAbiItem("event SignalPublished(uint256 indexed roundId, bytes signal)");

/** Reads the round's signal from its creation block (a one-block log query). */
export async function fetchSignal(roundId: bigint, createdBlock: bigint): Promise<Signal | null> {
  const logs = await publicClient.getLogs({
    address: CONTRACT_ADDRESS,
    event: signalEvent,
    args: { roundId },
    fromBlock: createdBlock,
    toBlock: createdBlock,
  });
  const data = logs[0]?.args.signal;
  if (!data) return null;
  return JSON.parse(hexToString(data)) as Signal;
}
