// Market configuration shared by deploy, keeper and verification scripts.
//
// Signal: computed from Perpl MAINNET (chain 143), where the real "smart money" trades.
// Price:  read on-chain by the contract from Perpl TESTNET (chain 10143, same chain as our contract),
//         whose oracle price is Chainlink Data Streams and tracks the real market.

export const PERPL_MAINNET_EXCHANGE = "0x34b6552d57a35a1d042ccae1951bd1c370112a6f";
export const PERPL_TESTNET_EXCHANGE = "0x1964c32f0be608e7d29302aff5e61268e72080cc";
export const PERPL_API = "https://app.perpl.xyz/api";
// rpc1 keeps 7+ days of state, which verify-signal and the backtest need (rpc.monad.xyz keeps ~3 days).
export const MONAD_MAINNET_RPC = process.env.MONAD_MAINNET_RPC_URL ?? "https://rpc1.monad.xyz";

// Order matters: market ids on-chain are 1..n in this order (see deploy.mjs).
export const MARKETS = [
  { symbol: "BTC", duration: 3600, feedId: 16, priceDecimals: 1, signalPerpId: 1, signalLotDecimals: 5 },
  { symbol: "BTC", duration: 900, feedId: 16, priceDecimals: 1, signalPerpId: 1, signalLotDecimals: 5 },
  { symbol: "ETH", duration: 3600, feedId: 32, priceDecimals: 2, signalPerpId: 20, signalLotDecimals: 3 },
  { symbol: "SOL", duration: 3600, feedId: 48, priceDecimals: 2, signalPerpId: 31, signalLotDecimals: 3 },
];

export const TOP_N = 20;
