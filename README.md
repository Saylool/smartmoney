# SmartMoney

Bet on whether Perpl "smart money" is right about BTC. Every hour a keeper writes the net BTC direction of the 20 most
profitable Perpl traders (last 30 days) on-chain; users bet **right** or **wrong**, and when the round ends the BTC price
decides. Payouts are parimutuel. Built for Monad Metropolis, Track 01.

| Folder | What | Stack |
| --- | --- | --- |
| [`contracts/`](contracts/) | `SmartMoneyRounds.sol` + Foundry tests, [threat model](contracts/SECURITY.md) | Solidity 0.8.28, Foundry |
| [`frontend/`](frontend/) | Rounds dashboard, bet & claim UI | Next.js 16, wagmi 3, viem |
| `keeper/` | (next) posts direction, start and end price every hour | TypeScript, viem |

## Deploy the contract (Monad testnet)

```bash
cd contracts
export MONAD_RPC_URL=https://testnet-rpc.monad.xyz
forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast --account <your-keystore>
```

Optional env: `OWNER`, `KEEPER`, `TREASURY` (default: deployer), `FEE_BPS` (200), `MIN_BET` (0.01 ether).

## Run the frontend

```bash
cd frontend
cp .env.example .env.local   # set NEXT_PUBLIC_CONTRACT_ADDRESS after deploying
npm install
npm run dev
```

## Deploy on Vercel

1. Import the GitHub repo in Vercel.
2. **Root Directory:** `frontend` (Framework preset: Next.js is auto-detected).
3. Environment variables: `NEXT_PUBLIC_CONTRACT_ADDRESS`, `NEXT_PUBLIC_CHAIN_ID=10143`, `NEXT_PUBLIC_RPC_URL=https://testnet-rpc.monad.xyz`.
4. Deploy. Without a contract address the site renders a "setup required" page instead of failing.

Regenerate the frontend ABI after changing the contract: `cd frontend && npm run abi`.
