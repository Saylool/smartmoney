// SmartMoney keeper. Each tick is idempotent and does whatever is due:
//   1. create the next round of every market (with a fresh smart-money signal)
//   2. lock rounds that have started, resolve rounds that have ended (price comes from the
//      on-chain oracle; these calls are permissionless, the keeper just does them promptly)
//   3. void rounds whose settle window was missed, sweep dust of fully-claimed rounds
//
//   node src/keeper.mjs          # loop forever (every TICK_SECONDS, default 20)
//   node src/keeper.mjs --once   # single tick (for cron / GitHub Actions)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BaseError, ContractFunctionRevertedError, formatEther } from "viem";
import { publicClient, walletClient, gasFor, ROOT } from "./chain.mjs";
import { MARKETS } from "./markets.mjs";
import { snapshot, signalFor } from "./signal.mjs";

const dep = JSON.parse(readFileSync(resolve(ROOT, "deployments/monad-testnet.json"), "utf8"));
const abi = JSON.parse(readFileSync(resolve(ROOT, "keeper/abi/SmartMoneyRounds.json"), "utf8"));
const sm = { address: dep.address, abi };
const { account, client } = walletClient();

const TICK_SECONDS = Number(process.env.TICK_SECONDS ?? 20);
const SCAN_BACK = 60; // how many recent rounds to inspect each tick
const MIN_BETTING_SECONDS = 120; // don't open a round with less betting time than this
// Comma-separated market ids to run (default: all). E.g. KEEPER_MARKETS=1,3,4 skips BTC 15m to save gas.
const ACTIVE_MARKETS = new Set(
  (process.env.KEEPER_MARKETS ?? MARKETS.map((_, i) => i + 1).join(",")).split(",").map((x) => Number(x.trim())),
);

const Status = { None: 0, Open: 1, Locked: 2, Resolved: 3, Voided: 4 };
const now = () => Math.floor(Date.now() / 1000);
const log = (...a) => console.log(new Date().toISOString(), ...a);

/** How long before startTime a round of duration `d` opens for betting. */
const bettingLead = (d) => Math.min(d, 30 * 60);

function revertName(e) {
  if (e instanceof BaseError) {
    const r = e.walk((x) => x instanceof ContractFunctionRevertedError);
    if (r?.data?.errorName) return r.data.errorName;
    return e.shortMessage;
  }
  return String(e?.message ?? e);
}

async function write(label, functionName, args) {
  try {
    await publicClient.simulateContract({ ...sm, functionName, args, account });
  } catch (e) {
    return { ok: false, reason: revertName(e) };
  }
  const gas = await gasFor({ ...sm, functionName, args, account });
  const hash = await client.writeContract({ ...sm, functionName, args, gas });
  const rc = await publicClient.waitForTransactionReceipt({ hash });
  log(`${label} -> ${rc.status} ${hash}`);
  return { ok: rc.status === "success", hash };
}

async function recentRounds() {
  const count = Number(await publicClient.readContract({ ...sm, functionName: "roundCount" }));
  const ids = [];
  for (let i = count; i >= 1 && ids.length < SCAN_BACK; i--) ids.push(BigInt(i));
  const rounds = await Promise.all(ids.map((id) => publicClient.readContract({ ...sm, functionName: "getRound", args: [id] })));
  return ids.map((id, i) => ({ id, ...rounds[i] }));
}

async function createDueRounds(rounds, t) {
  let snap = null;
  for (let i = 0; i < MARKETS.length; i++) {
    const marketId = i + 1;
    const m = MARKETS[i];
    if (!ACTIVE_MARKETS.has(marketId)) continue;
    const d = m.duration;
    // next aligned slot whose betting window is still long enough
    let start = Math.ceil(t / d) * d;
    if (start - t < MIN_BETTING_SECONDS) start += d;
    if (t < start - bettingLead(d)) continue; // too early to open this slot
    const exists = rounds.some((r) => Number(r.marketId) === marketId && Number(r.startTime) === start);
    if (exists) continue;

    snap ??= await snapshot();
    const sig = await signalFor(snap, m);
    if (!sig.direction) {
      log(`market ${marketId} ${m.symbol}: smart money flat (no net position), skipping slot ${start}`);
      continue;
    }
    const direction = sig.direction === "long" ? 1 : 2;
    const res = await write(
      `createRound m${marketId} ${m.symbol}/${d / 60}m ${sig.direction.toUpperCase()} start ${new Date(start * 1000).toISOString()}`,
      "createRound",
      [BigInt(marketId), direction, BigInt(start), BigInt(start), `0x${Buffer.from(sig.json).toString("hex")}`],
    );
    if (!res.ok) log(`createRound m${marketId} skipped: ${res.reason}`);
  }
}

async function settle(rounds, t, window) {
  for (const r of rounds) {
    const start = Number(r.startTime);
    const end = Number(r.endTime);
    // Nobody bet: there is nothing to settle or refund, so don't spend gas on lock/resolve/void.
    // (Bets are impossible after bettingCloses, so an empty round past its start stays empty.)
    if (r.status === Status.Open && t >= Number(r.bettingCloses) && r.rightPool + r.wrongPool === 0n) continue;
    if (r.status === Status.Open && t >= start && t <= start + window) {
      const res = await write(`lockRound #${r.id}`, "lockRound", [r.id]);
      if (!res.ok && res.reason !== "StalePrice") log(`lock #${r.id}: ${res.reason}`);
    } else if (r.status === Status.Locked && t >= end && t <= end + window) {
      const res = await write(`resolveRound #${r.id}`, "resolveRound", [r.id]);
      if (!res.ok && res.reason !== "StalePrice") log(`resolve #${r.id}: ${res.reason}`);
    } else if (
      (r.status === Status.Open && t > start + window) ||
      (r.status === Status.Locked && t > end + window)
    ) {
      await write(`voidStaleRound #${r.id}`, "voidStaleRound", [r.id]);
    } else if (r.status === Status.Resolved && !r.swept) {
      const winners = r.winner === 1 ? r.rightBettors : r.wrongBettors;
      if (r.claims === winners) await write(`sweepRound #${r.id}`, "sweepRound", [r.id]);
    }
  }
}

export async function tick() {
  const t = now();
  const window = Number(await publicClient.readContract({ ...sm, functionName: "SETTLE_WINDOW" }));
  const rounds = await recentRounds();
  await settle(rounds, t, window);
  await createDueRounds(await recentRounds(), now());
}

async function main() {
  const bal = await publicClient.getBalance({ address: account.address });
  log(`keeper ${account.address} balance ${formatEther(bal)} MON, contract ${dep.address}`);
  const onChainKeeper = await publicClient.readContract({ ...sm, functionName: "keeper" });
  if (onChainKeeper.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(`this wallet is not the contract keeper (${onChainKeeper})`);
  }
  if (process.argv.includes("--once")) {
    await tick();
    return;
  }
  for (;;) {
    try {
      await tick();
    } catch (e) {
      log("tick error:", revertName(e));
    }
    await new Promise((r) => setTimeout(r, TICK_SECONDS * 1000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
