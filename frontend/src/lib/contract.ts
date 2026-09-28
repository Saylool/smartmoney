import { smartMoneyAbi } from "./abi";
import { CONTRACT_ADDRESS } from "./config";
import type { Address } from "viem";

export const smartMoney = {
  address: CONTRACT_ADDRESS as Address,
  abi: smartMoneyAbi,
} as const;

export enum Direction { None, Long, Short }
export enum Side { None, Right, Wrong }
export enum Status { None, Open, Locked, Resolved, Voided }

export type Round = {
  bettingCloses: bigint;
  startTime: bigint;
  endTime: bigint;
  direction: number;
  status: number;
  winner: number;
  startPrice: bigint;
  endPrice: bigint;
  rightPool: bigint;
  wrongPool: bigint;
  feeBps: number;
  fee: bigint;
  claimedTotal: bigint;
  dust: bigint;
  rightBettors: number;
  wrongBettors: number;
  claims: number;
  swept: boolean;
};

export const directionLabel = (d: number) => (d === Direction.Long ? "LONG" : d === Direction.Short ? "SHORT" : "—");
export const statusLabel = (s: number) => ["—", "Open", "Locked", "Resolved", "Voided"][s] ?? "—";
export const sideLabel = (s: number) => (s === Side.Right ? "Smart money RIGHT" : s === Side.Wrong ? "Smart money WRONG" : "—");
