// Server-only: full contract history from Envio HyperSync.
//
// Why: the public Monad testnet RPC caps eth_getLogs at ~100 blocks (~40 s), so a browser can't
// see past bets, claims or results. HyperSync returns every event of the contract since deployment
// in a few paged requests, which powers the activity feed, round history and protocol stats.
import { decodeEventLog, encodeEventTopics, type Hex } from "viem";
import { smartMoneyAbi } from "./abi";
import { CONTRACT_ADDRESS } from "./config";

export const HYPERSYNC_URL = process.env.ENVIO_HYPERSYNC_URL || "https://monad-testnet.hypersync.xyz";
export const DEPLOY_BLOCK = Number(process.env.NEXT_PUBLIC_DEPLOY_BLOCK || 66749830);
const TOKEN = process.env.ENVIO_API_TOKEN || "";

export const envioEnabled = () => TOKEN.length > 0;

// Everything except SignalPublished (large payload, fetched per round from its block instead).
const EVENTS = ["RoundCreated", "BetPlaced", "RoundLocked", "RoundResolved", "RoundVoided", "Claimed"] as const;
type EventName = (typeof EVENTS)[number];

const TOPIC0: Record<string, EventName> = Object.fromEntries(
  EVENTS.map((name) => [(encodeEventTopics({ abi: smartMoneyAbi, eventName: name })[0] as string).toLowerCase(), name]),
);

type RawLog = {
  block_number: number;
  log_index: number;
  transaction_hash: Hex;
  data: Hex;
  topic0: Hex;
  topic1?: Hex | null;
  topic2?: Hex | null;
  topic3?: Hex | null;
};
type RawBlock = { number: number; timestamp: string | number };
type Batch = { logs?: RawLog[]; blocks?: RawBlock[] };
type QueryResponse = { data: Batch | Batch[]; next_block: number; archive_height?: number };

async function query(fromBlock: number): Promise<QueryResponse> {
  const res = await fetch(`${HYPERSYNC_URL}/query`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({
      from_block: fromBlock,
      logs: [{ address: [CONTRACT_ADDRESS], topics: [Object.keys(TOPIC0)] }],
      field_selection: {
        log: ["block_number", "log_index", "transaction_hash", "data", "topic0", "topic1", "topic2", "topic3"],
        block: ["number", "timestamp"],
      },
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HyperSync ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export type ContractEvent = {
  name: EventName;
  block: number;
  time: number; // unix seconds
  tx: Hex;
  logIndex: number;
  args: Record<string, unknown>;
};

/** Every SmartMoneyRounds event since deployment, oldest first. */
export async function fetchAllEvents(maxPages = 50): Promise<{ events: ContractEvent[]; height: number }> {
  const logs: RawLog[] = [];
  const times = new Map<number, number>();
  let from = DEPLOY_BLOCK;
  let height = from;
  for (let page = 0; page < maxPages; page++) {
    const r = await query(from);
    const batches = Array.isArray(r.data) ? r.data : [r.data];
    for (const b of batches) {
      for (const l of b.logs ?? []) logs.push(l);
      for (const blk of b.blocks ?? []) times.set(Number(blk.number), Number(blk.timestamp));
    }
    height = r.archive_height ?? r.next_block;
    if (!r.next_block || r.next_block <= from || (r.archive_height !== undefined && r.next_block >= r.archive_height)) break;
    from = r.next_block;
  }

  const events: ContractEvent[] = [];
  for (const l of logs) {
    const name = TOPIC0[l.topic0.toLowerCase()];
    if (!name) continue;
    const topics = [l.topic0, l.topic1, l.topic2, l.topic3].filter(Boolean) as [Hex, ...Hex[]];
    try {
      const d = decodeEventLog({ abi: smartMoneyAbi, data: l.data, topics });
      events.push({
        name,
        block: Number(l.block_number),
        time: times.get(Number(l.block_number)) ?? 0,
        tx: l.transaction_hash,
        logIndex: Number(l.log_index),
        args: d.args as Record<string, unknown>,
      });
    } catch {
      /* skip undecodable log */
    }
  }
  events.sort((a, b) => a.block - b.block || a.logIndex - b.logIndex);
  return { events, height };
}

// ---------------------------------------------------------------- derived views

export type ActivityItem = {
  kind: "bet" | "claim" | "resolved" | "voided" | "created";
  roundId: string;
  marketId: number;
  time: number;
  tx: Hex;
  account?: string;
  side?: number; // 1 right, 2 wrong
  amount?: string; // wei as string
  direction?: number; // 1 long, 2 short (created / resolved)
  winner?: number; // resolved
  reason?: string; // voided
};

export type HistoryPoint = { roundId: string; marketId: number; time: number; direction: number; outcome: "right" | "wrong" | "void" };

export type Summary = {
  enabled: true;
  height: number;
  totals: { bets: number; volumeWei: string; players: number; rounds: number; resolved: number; voided: number; claimedWei: string };
  activity: ActivityItem[];
  history: HistoryPoint[];
};

export function summarize(events: ContractEvent[], height: number, activityLimit = 40): Summary {
  const marketOf = new Map<string, number>();
  const directionOf = new Map<string, number>();
  const players = new Set<string>();
  let bets = 0;
  let volume = 0n;
  let claimed = 0n;
  let resolved = 0;
  let voided = 0;
  const activity: ActivityItem[] = [];
  const history: HistoryPoint[] = [];

  for (const e of events) {
    const roundId = String(e.args.roundId);
    switch (e.name) {
      case "RoundCreated": {
        marketOf.set(roundId, Number(e.args.marketId));
        directionOf.set(roundId, Number(e.args.direction));
        activity.push({ kind: "created", roundId, marketId: Number(e.args.marketId), time: e.time, tx: e.tx, direction: Number(e.args.direction) });
        break;
      }
      case "BetPlaced": {
        bets++;
        volume += e.args.amount as bigint;
        players.add(String(e.args.bettor).toLowerCase());
        activity.push({
          kind: "bet", roundId, marketId: marketOf.get(roundId) ?? 0, time: e.time, tx: e.tx,
          account: String(e.args.bettor), side: Number(e.args.side), amount: String(e.args.amount),
        });
        break;
      }
      case "Claimed": {
        claimed += e.args.amount as bigint;
        activity.push({
          kind: "claim", roundId, marketId: marketOf.get(roundId) ?? 0, time: e.time, tx: e.tx,
          account: String(e.args.account), amount: String(e.args.amount),
        });
        break;
      }
      case "RoundResolved": {
        resolved++;
        const winner = Number(e.args.winner);
        activity.push({ kind: "resolved", roundId, marketId: marketOf.get(roundId) ?? 0, time: e.time, tx: e.tx, winner, direction: directionOf.get(roundId) });
        history.push({ roundId, marketId: marketOf.get(roundId) ?? 0, time: e.time, direction: directionOf.get(roundId) ?? 0, outcome: winner === 1 ? "right" : "wrong" });
        break;
      }
      case "RoundVoided": {
        voided++;
        const reason = String(e.args.reason);
        // one-sided / tie voids still say something about smart money; stale/keeper voids don't
        history.push({ roundId, marketId: marketOf.get(roundId) ?? 0, time: e.time, direction: directionOf.get(roundId) ?? 0, outcome: "void" });
        activity.push({ kind: "voided", roundId, marketId: marketOf.get(roundId) ?? 0, time: e.time, tx: e.tx, reason });
        break;
      }
      default:
        break;
    }
  }

  // Newest first; keep "created" noise out of the feed unless nothing else happened.
  const interesting = activity.filter((a) => a.kind !== "created");
  const feed = (interesting.length ? interesting : activity).slice(-activityLimit).reverse();

  return {
    enabled: true,
    height,
    totals: {
      bets,
      volumeWei: volume.toString(),
      players: players.size,
      rounds: marketOf.size,
      resolved,
      voided,
      claimedWei: claimed.toString(),
    },
    activity: feed,
    history: history.slice(-200),
  };
}
