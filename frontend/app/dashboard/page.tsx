"use client";

import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Nav } from "@/components/Nav";
import {
  ADDRESSES, AGENT_REGISTRY_ABI, AGENT_ACCOUNT_ABI, MOCK_USDC_ABI,
  ESCROW_ABI, ESCROW_STATE, USDC_SCALE, isDeployed,
} from "@/lib/contracts";

// ─── Agent card ───────────────────────────────────────────────────────────────

function AgentCard({ agentId }: { agentId: bigint }) {
  const { data: tba } = useReadContract({
    address: ADDRESSES.registry,
    abi: AGENT_REGISTRY_ABI,
    functionName: "agentAccount",
    args: [agentId],
  });

  const { data: usdcBal } = useReadContract({
    address: ADDRESSES.mockUSDC,
    abi: MOCK_USDC_ABI,
    functionName: "balanceOf",
    args: [tba ?? "0x0"],
    query: { enabled: !!tba },
  });

  const { data: maxSingle } = useReadContract({
    address: tba,
    abi: AGENT_ACCOUNT_ABI,
    functionName: "maxSingleTrade",
    query: { enabled: !!tba },
  });

  const { data: dailyBudget } = useReadContract({
    address: tba,
    abi: AGENT_ACCOUNT_ABI,
    functionName: "dailyBudget",
    query: { enabled: !!tba },
  });

  const usdcDisplay = usdcBal != null ? (Number(usdcBal) / Number(USDC_SCALE)).toFixed(2) : "—";

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500">Agent</p>
          <p className="text-lg font-bold">#{agentId.toString()}</p>
        </div>
        <span className="rounded bg-indigo-900/60 text-indigo-300 px-2 py-0.5 text-xs font-medium">ERC-6551</span>
      </div>

      <div>
        <p className="text-xs text-gray-500 mb-0.5">TBA Address</p>
        <p className="text-xs font-mono text-gray-400 break-all">{tba ?? "—"}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-800">
        <div>
          <p className="text-xs text-gray-500">USDC Balance</p>
          <p className="text-sm font-semibold text-white">{usdcDisplay}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Max Trade</p>
          <p className="text-sm font-semibold text-white">
            {maxSingle != null ? (Number(maxSingle) / Number(USDC_SCALE)).toFixed(0) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Daily Budget</p>
          <p className="text-sm font-semibold text-white">
            {dailyBudget != null ? (Number(dailyBudget) / Number(USDC_SCALE)).toFixed(0) : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Escrow row ───────────────────────────────────────────────────────────────

function EscrowRow({ escrowId, userAddress }: { escrowId: bigint; userAddress: string }) {
  const { data: rec } = useReadContract({
    address: ADDRESSES.escrow,
    abi: ESCROW_ABI,
    functionName: "getEscrow",
    args: [escrowId],
  });

  const { writeContract: dispute, data: disputeTxHash } = useWriteContract();
  const { isLoading: disputing } = useWaitForTransactionReceipt({ hash: disputeTxHash });

  if (!rec) return null;

  const isBuyer  = rec.buyer.toLowerCase()  === userAddress.toLowerCase();
  const isSeller = rec.seller.toLowerCase() === userAddress.toLowerCase();
  if (!isBuyer && !isSeller) return null;

  const stateName = ESCROW_STATE[rec.state as keyof typeof ESCROW_STATE] ?? "Unknown";
  const stateColor: Record<string, string> = {
    Pending: "text-yellow-400", Released: "text-green-400",
    Refunded: "text-blue-400",  Disputed: "text-red-400",
  };
  const amountUSDC = (Number(rec.amount) / Number(USDC_SCALE)).toFixed(2);

  return (
    <tr className="border-t border-gray-800 text-sm">
      <td className="py-3 pr-4 text-gray-400">#{escrowId.toString()}</td>
      <td className="py-3 pr-4 text-gray-400">#{rec.listingId.toString()}</td>
      <td className="py-3 pr-4 font-semibold text-white">{amountUSDC} USDC</td>
      <td className="py-3 pr-4">
        <span className={`font-medium ${stateColor[stateName]}`}>{stateName}</span>
      </td>
      <td className="py-3">
        <span className="text-xs text-gray-500">{isBuyer ? "Buyer" : "Seller"}</span>
      </td>
      <td className="py-3 pl-4">
        {isBuyer && rec.state === 0 && (
          <button
            disabled={disputing}
            onClick={() =>
              dispute({
                address: ADDRESSES.escrow,
                abi: ESCROW_ABI,
                functionName: "dispute",
                args: [escrowId],
              })
            }
            className="rounded border border-red-800 hover:bg-red-900/30 px-2 py-1 text-xs text-red-400 disabled:opacity-50 transition-colors"
          >
            {disputing ? "…" : "Dispute"}
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { address, isConnected } = useAccount();

  const { data: agentBalance } = useReadContract({
    address: ADDRESSES.registry,
    abi: AGENT_REGISTRY_ABI,
    functionName: "balanceOf",
    args: [address ?? "0x0"],
    query: { enabled: !!address && isDeployed(ADDRESSES.registry) },
  });

  const { data: usdcBalance } = useReadContract({
    address: ADDRESSES.mockUSDC,
    abi: MOCK_USDC_ABI,
    functionName: "balanceOf",
    args: [address ?? "0x0"],
    query: { enabled: !!address && isDeployed(ADDRESSES.mockUSDC) },
  });

  const { data: escrowCount } = useReadContract({
    address: ADDRESSES.escrow,
    abi: ESCROW_ABI,
    functionName: "escrowCount",
    query: { enabled: isDeployed(ADDRESSES.escrow) },
  });

  const { writeContract: createAgent, data: createTxHash } = useWriteContract();
  const { isLoading: creating, isSuccess: created } = useWaitForTransactionReceipt({ hash: createTxHash });

  const { writeContract: faucet, data: faucetTxHash } = useWriteContract();
  const { isLoading: fauceting } = useWaitForTransactionReceipt({ hash: faucetTxHash });

  const agentCount  = agentBalance ?? 0n;
  const usdcDisplay = usdcBalance != null ? (Number(usdcBalance) / Number(USDC_SCALE)).toFixed(2) : "—";
  const escrowIds: bigint[] = escrowCount
    ? Array.from({ length: Number(escrowCount) }, (_, i) => BigInt(i + 1))
    : [];

  if (!isConnected) {
    return (
      <main className="flex flex-col min-h-screen">
        <Nav />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-500">
          <p className="text-sm">Connect your wallet to view your dashboard.</p>
          <ConnectButton />
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen">
      <Nav />

      {/* Header */}
      <section className="px-6 py-10 border-b border-gray-800">
        <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
        <p className="text-xs font-mono text-gray-500">{address}</p>
      </section>

      <div className="flex-1 px-6 py-8 flex flex-col gap-10 max-w-5xl w-full mx-auto">

        {/* Wallet summary */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Wallet</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <p className="text-xs text-gray-500 mb-1">USDC Balance</p>
              <p className="text-2xl font-bold">{usdcDisplay}</p>
              <button
                disabled={fauceting || !isDeployed(ADDRESSES.mockUSDC)}
                onClick={() =>
                  faucet({ address: ADDRESSES.mockUSDC, abi: MOCK_USDC_ABI, functionName: "faucet" })
                }
                className="mt-3 rounded border border-gray-700 hover:bg-gray-800 disabled:opacity-40 px-3 py-1.5 text-xs font-medium transition-colors"
              >
                {fauceting ? "Minting…" : "Get 1000 USDC (Testnet)"}
              </button>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <p className="text-xs text-gray-500 mb-1">Agents Owned</p>
              <p className="text-2xl font-bold">{agentCount.toString()}</p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <p className="text-xs text-gray-500 mb-1">Active Escrows</p>
              <p className="text-2xl font-bold">{escrowCount?.toString() ?? "—"}</p>
            </div>
          </div>
        </section>

        {/* Agents */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">My Agents</h2>
            <button
              disabled={creating || !isDeployed(ADDRESSES.registry)}
              onClick={() =>
                createAgent({ address: ADDRESSES.registry, abi: AGENT_REGISTRY_ABI, functionName: "createAgent" })
              }
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-4 py-2 text-sm font-semibold transition-colors"
            >
              {creating ? "Creating…" : created ? "Created!" : "+ New Agent"}
            </button>
          </div>

          {agentCount === 0n ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-8 text-center text-gray-500 text-sm">
              No agents yet. Create one to start trading autonomously.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: Number(agentCount) }, (_, i) => (
                <AgentCard key={i} agentId={BigInt(i + 1)} />
              ))}
            </div>
          )}
        </section>

        {/* Escrows */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Escrow History</h2>
          {escrowIds.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-8 text-center text-gray-500 text-sm">
              No escrows yet.
            </div>
          ) : (
            <div className="rounded-xl border border-gray-800 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-900 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-0 py-3 pr-4">Escrow</th>
                    <th className="py-3 pr-4">Listing</th>
                    <th className="py-3 pr-4">Amount</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Role</th>
                    <th className="py-3 pl-4">Action</th>
                  </tr>
                </thead>
                <tbody className="px-4">
                  {escrowIds.map((id) => (
                    <EscrowRow key={id.toString()} escrowId={id} userAddress={address ?? ""} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <footer className="px-6 py-6 border-t border-gray-800 text-center text-xs text-gray-600 mt-auto">
        ARES — HKUST Blockchain Lab · Sepolia Testnet · MIT License
      </footer>
    </main>
  );
}
