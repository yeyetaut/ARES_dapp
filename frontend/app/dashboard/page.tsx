"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Nav } from "@/components/Nav";
import {
  ADDRESSES, AGENT_REGISTRY_ABI, AGENT_ACCOUNT_ABI, AGENT_FACTORY_ABI, MOCK_USDC_ABI,
  ESCROW_ABI, ESCROW_STATE, USDC_SCALE, isDeployed,
} from "@/lib/contracts";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Cpu, Wallet, ClockCounterClockwise as History, Plus, CaretRight, Info,
  TrendUp, ShieldCheck, Gear, Coins, Robot 
} from "@phosphor-icons/react";

// ─── Agent card ───────────────────────────────────────────────────────────────

function AgentCard({ agentId }: { agentId: bigint }) {
  const [showManage, setShowManage] = useState(false);
  
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

  const { data: autoBuy } = useReadContract({
    address: tba,
    abi: AGENT_ACCOUNT_ABI,
    functionName: "autoBuyPolicy",
    query: { enabled: !!tba },
  });

  const usdcDisplay = usdcBal != null ? (Number(usdcBal) / Number(USDC_SCALE)).toFixed(2) : "—";

  return (
    <div className="group rounded-2xl border border-zinc-900 bg-zinc-950 p-6 flex flex-col gap-5 hover:border-zinc-700 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800">
            <Robot size={24} weight="duotone" className="text-accent" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Agent Instance</p>
            <p className="text-xl font-mono font-bold text-white">#{agentId.toString().padStart(3, '0')}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight">Status</span>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${autoBuy?.active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-zinc-700'}`} />
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
              {autoBuy?.active ? 'Autonomous' : 'Manual'}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-900">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Balance</p>
            <p className="text-lg font-mono font-bold text-white">{usdcDisplay} <span className="text-xs text-zinc-600">USDC</span></p>
          </div>
          <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-900">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Budget</p>
            <p className="text-lg font-mono font-bold text-white">
              {dailyBudget != null ? (Number(dailyBudget) / Number(USDC_SCALE)).toFixed(0) : "—"}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1.5">Bound Account (TBA)</p>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-black border border-zinc-900">
             <div className="p-1 rounded bg-zinc-900">
                <ShieldCheck size={12} className="text-zinc-500" />
             </div>
             <p className="text-[10px] font-mono text-zinc-500 truncate">{tba ?? "—"}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
         <button 
           onClick={() => setShowManage(!showManage)}
           className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 transition-colors"
         >
           <Gear size={16} />
           Configure
         </button>
         <button className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-400 transition-all">
           <Coins size={16} />
           Fund
         </button>
      </div>

      <AnimatePresence>
        {showManage && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-4 mt-2 border-t border-zinc-900 space-y-3">
               <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                  <span className="text-zinc-500">Auto-Buy Threshold</span>
                  <span className="text-white">
                    {autoBuy != null ? (Number(autoBuy.maxPrice) / Number(USDC_SCALE)).toFixed(0) : "—"} USDC
                  </span>
               </div>
               <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                  <span className="text-zinc-500">Single Trade Limit</span>
                  <span className="text-white">
                    {maxSingle != null ? (Number(maxSingle) / Number(USDC_SCALE)).toFixed(0) : "—"} USDC
                  </span>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
    Pending: "text-yellow-500", Released: "text-green-500",
    Refunded: "text-blue-500",  Disputed: "text-red-500",
  };
  const amountUSDC = (Number(rec.amount) / Number(USDC_SCALE)).toFixed(2);

  return (
    <tr className="border-t border-zinc-900 text-[11px] font-mono group hover:bg-zinc-900/30 transition-colors">
      <td className="py-4 pr-4 text-zinc-500">#{escrowId.toString().padStart(3, '0')}</td>
      <td className="py-4 pr-4 text-zinc-500">L_{rec.listingId.toString().padStart(3, '0')}</td>
      <td className="py-4 pr-4 font-bold text-white tracking-tight">{amountUSDC} <span className="text-[10px] text-zinc-600 font-bold uppercase">USDC</span></td>
      <td className="py-4 pr-4">
        <div className="flex items-center gap-1.5">
           <div className={`w-1 h-1 rounded-full ${stateColor[stateName].replace('text', 'bg')}`} />
           <span className={`font-bold uppercase tracking-widest ${stateColor[stateName]}`}>{stateName}</span>
        </div>
      </td>
      <td className="py-4">
        <span className="text-zinc-600 font-bold uppercase tracking-widest">{isBuyer ? "Buyer" : "Seller"}</span>
      </td>
      <td className="py-4 pl-4 text-right">
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
            className="rounded-lg border border-red-900/50 hover:bg-red-900/20 px-3 py-1 text-[10px] font-bold text-red-500 disabled:opacity-50 transition-all uppercase tracking-widest"
          >
            {disputing ? "Processing" : "Open Dispute"}
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Onboarding Modal ─────────────────────────────────────────────────────────

function OnboardingModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { address } = useAccount();
  const [funding, setFunding] = useState("100");
  const [maxTrade, setMaxTrade] = useState("50");
  const [budget, setBudget] = useState("200");
  const [maxPrice, setMaxPrice] = useState("100");

  const fundingValue = BigInt(Number(funding || 0) * Number(USDC_SCALE));

  const { data: usdcBalance } = useReadContract({
    address: ADDRESSES.mockUSDC,
    abi: MOCK_USDC_ABI,
    functionName: "balanceOf",
    args: [address ?? "0x0"],
    query: { enabled: !!address },
  });

  const { data: allowance } = useReadContract({
    address: ADDRESSES.mockUSDC,
    abi: MOCK_USDC_ABI,
    functionName: "allowance",
    args: [address ?? "0x0", ADDRESSES.factory],
    query: { enabled: !!address },
  });

  const { writeContract: approve, data: approveTxHash } = useWriteContract();
  const { isLoading: isApproving, isSuccess: isApproved } = useWaitForTransactionReceipt({ hash: approveTxHash });

  const { writeContract: onboard, data: txHash } = useWriteContract();
  const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const needsApproval = (allowance ?? 0n) < fundingValue && !isApproved;
  const hasInsufficientFunds = (usdcBalance ?? 0n) < fundingValue;

  const handleOnboard = async () => {
    if (hasInsufficientFunds) return;

    if (needsApproval) {
      approve({
        address: ADDRESSES.mockUSDC,
        abi: MOCK_USDC_ABI,
        functionName: "approve",
        args: [ADDRESSES.factory, fundingValue],
      });
      return;
    }

    onboard({
      address: ADDRESSES.factory,
      abi: AGENT_FACTORY_ABI,
      functionName: "onboardAgent",
      args: [
        fundingValue,
        BigInt(Number(maxTrade) * Number(USDC_SCALE)),
        BigInt(Number(budget) * Number(USDC_SCALE)),
        BigInt(Number(maxPrice) * Number(USDC_SCALE)),
        true
      ]
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl"
      >
        <div className="p-8 border-b border-zinc-900">
           <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-accent/10 border border-accent/20">
                 <Robot size={24} className="text-accent" weight="duotone" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Onboard AI Agent</h2>
           </div>
           <p className="text-zinc-500 text-xs">Configure autonomous trading parameters and fund the new instance.</p>
        </div>

        <div className="p-8 space-y-6">
           <div className="space-y-4">
              {hasInsufficientFunds && (
                <div className="p-3 rounded-lg bg-red-900/20 border border-red-900/50 text-[10px] text-red-400 font-bold uppercase tracking-widest text-center">
                  ⚠️ Insufficient USDC Balance
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Initial Funding (USDC)</label>
                    <input 
                      type="number" 
                      value={funding}
                      onChange={(e) => setFunding(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:border-accent outline-none transition-colors" 
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Max Auto-Price</label>
                    <input 
                      type="number" 
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:border-accent outline-none transition-colors" 
                    />
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Daily Budget</label>
                    <input 
                      type="number" 
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:border-accent outline-none transition-colors" 
                    />
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Max Single Trade</label>
                    <input 
                      type="number" 
                      value={maxTrade}
                      onChange={(e) => setMaxTrade(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:border-accent outline-none transition-colors" 
                    />
                 </div>
              </div>
           </div>

           <div className="flex items-center gap-3 pt-4">
              <button 
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-xl border border-zinc-800 text-xs font-bold text-zinc-400 hover:bg-zinc-900 transition-colors uppercase tracking-widest"
              >
                Cancel
              </button>
              <button 
                disabled={isWaiting || isApproving || (hasInsufficientFunds && !isSuccess)}
                onClick={handleOnboard}
                className="flex-[2] px-4 py-3 rounded-xl bg-accent text-xs font-bold text-white hover:bg-blue-400 disabled:opacity-50 transition-all uppercase tracking-widest"
              >
                {isApproving ? "Approving..." : isWaiting ? "Authorizing..." : isSuccess ? "Success!" : hasInsufficientFunds ? "Insufficient Funds" : needsApproval ? "Approve USDC" : "Initialize Agent"}
              </button>
           </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Dashboard page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const account = useAccount();
  
  // Test-only bypass for connection state
  const isConnected = (typeof window !== 'undefined' && (window as any).__MOCK_CONNECTED__) ?? account.isConnected;
  const address = (typeof window !== 'undefined' && (window as any).__MOCK_ADDRESS__) ?? account.address;
  const chainId = (typeof window !== 'undefined' && (window as any).__MOCK_CHAIN_ID__) ?? account.chainId;

  const [isOnboarding, setIsOnboarding] = useState(false);

  const { data: userAgentsData } = useReadContract({
    address: ADDRESSES.registry,
    abi: AGENT_REGISTRY_ABI,
    functionName: "getUserAgents",
    args: [address ?? "0x0"],
    query: { enabled: !!address && isDeployed(ADDRESSES.registry) },
  });

  const { data: usdcBalanceData, refetch: refetchUsdc } = useReadContract({
    address: ADDRESSES.mockUSDC,
    abi: MOCK_USDC_ABI,
    functionName: "balanceOf",
    args: [address ?? "0x0"],
    query: { enabled: !!address && isDeployed(ADDRESSES.mockUSDC) },
  });

  const usdcBalance = (typeof window !== 'undefined' && (window as any).__MOCK_USDC_BALANCE__) ?? usdcBalanceData;

  const { data: escrowCount } = useReadContract({
    address: ADDRESSES.escrow,
    abi: ESCROW_ABI,
    functionName: "escrowCount",
    query: { enabled: isDeployed(ADDRESSES.escrow) },
  });

  const { writeContract: faucet, data: faucetTxHash } = useWriteContract();
  const { isLoading: fauceting, isSuccess: faucetSuccess } = useWaitForTransactionReceipt({ hash: faucetTxHash });

  // Refetch USDC balance after faucet success
  useEffect(() => {
    if (faucetSuccess) {
      refetchUsdc();
    }
  }, [faucetSuccess, refetchUsdc]);

  const agentIds = (userAgentsData as bigint[]) || [];
  const agentCount = BigInt(agentIds.length);
  const usdcDisplay = usdcBalance != null ? (Number(usdcBalance) / Number(USDC_SCALE)).toFixed(2) : "—";
  
  const escrowIds: bigint[] = useMemo(() => {
    return escrowCount
      ? Array.from({ length: Number(escrowCount) }, (_, i) => BigInt(i + 1))
      : [];
  }, [escrowCount]);

  if (!isConnected) {
    return (
      <main className="flex flex-col min-h-screen bg-zinc-950">
        <Nav />
        <div className="flex-1 flex flex-col items-center justify-center gap-8 text-center p-6">
          <div className="w-20 h-20 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
             <Cpu size={40} className="text-zinc-700" weight="duotone" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Access Terminal Locked</h1>
            <p className="text-zinc-500 text-sm max-w-xs mx-auto mb-8">Connect your authorized hardware wallet to access the agent management system.</p>
            <ConnectButton />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-[100dvh] bg-zinc-950">
      <Nav />

      {/* Header */}
      <section className="max-w-[1400px] mx-auto w-full px-6 py-12 md:py-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-zinc-900 pb-12">
          <div>
            <div className="flex items-center gap-2 text-accent text-[10px] font-bold tracking-[0.2em] uppercase mb-4">
              <TrendUp size={14} />
              Session Active
            </div>
            <h1 className="text-4xl font-bold tracking-tighter text-white mb-4">
              Command Dashboard
            </h1>
            <p className="text-zinc-500 font-mono text-xs truncate max-w-sm">
              Terminal Address: {address}
            </p>
          </div>
          <div className="flex gap-4">
            <button
              disabled={fauceting || !isDeployed(ADDRESSES.mockUSDC)}
              onClick={() =>
                faucet({ address: ADDRESSES.mockUSDC, abi: MOCK_USDC_ABI, functionName: "faucet" })
              }
              className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-3 text-xs font-bold text-white hover:bg-zinc-800 transition-all uppercase tracking-widest"
            >
              <Coins size={16} />
              {fauceting ? "Minting..." : "USDC Faucet"}
            </button>
            <button
              onClick={() => setIsOnboarding(true)}
              className="flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-xs font-bold text-white hover:bg-blue-400 transition-all shadow-[0_0_20px_rgba(59,130,246,0.1)] uppercase tracking-widest"
            >
              <Plus size={16} weight="bold" />
              Onboard Agent
            </button>
          </div>
        </div>
      </section>

      <div className="max-w-[1400px] mx-auto w-full px-6 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* Sidebar: Metrics */}
        <div className="lg:col-span-3 space-y-8">
           <div>
              <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-4">System Metrics</h2>
              <div className="space-y-4">
                 <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-900">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Wallet Liquidity</p>
                    <p className="text-2xl font-mono font-bold text-white">{usdcDisplay} <span className="text-[10px] text-zinc-600">USDC</span></p>
                 </div>
                 <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-900">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Fleet Size</p>
                    <p className="text-2xl font-mono font-bold text-white">{agentCount.toString()} <span className="text-[10px] text-zinc-600">Agents</span></p>
                 </div>
              </div>
           </div>

           <div>
              <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-4">Quick Links</h2>
              <div className="space-y-2">
                 <button className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-zinc-900 transition-colors text-[10px] font-bold text-zinc-400 uppercase tracking-widest group">
                    <span className="flex items-center gap-2"><History size={14} /> Settlement Logs</span>
                    <CaretRight size={12} className="group-hover:translate-x-1 transition-transform" />
                 </button>
                 <button className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-zinc-900 transition-colors text-[10px] font-bold text-zinc-400 uppercase tracking-widest group">
                    <span className="flex items-center gap-2"><Info size={14} /> Documentation</span>
                    <CaretRight size={12} className="group-hover:translate-x-1 transition-transform" />
                 </button>
              </div>
           </div>
        </div>

        {/* Main: Agents & History */}
        <div className="lg:col-span-9 space-y-16">
          
          {/* My Agents */}
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-sm font-bold text-white uppercase tracking-[0.2em]">Authorized Agents</h2>
            </div>

            {agentCount === 0n ? (
              <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-950 p-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center mx-auto mb-6 text-zinc-700">
                   <Robot size={32} weight="duotone" />
                </div>
                <p className="text-zinc-500 text-sm font-medium mb-8">No agents deployed to the registry yet.</p>
                <button
                  onClick={() => setIsOnboarding(true)}
                  className="rounded-xl border border-zinc-800 px-8 py-3 text-xs font-bold text-white hover:bg-zinc-900 transition-colors uppercase tracking-widest"
                >
                  Initiate First Agent
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {agentIds.map((id, i) => (
                  <AgentCard key={i} agentId={id} />
                ))}
              </div>
            )}
          </section>

          {/* History */}
          <section>
            <h2 className="text-sm font-bold text-white uppercase tracking-[0.2em] mb-8">Settlement History</h2>
            {escrowIds.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-950 p-16 text-center">
                <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest">No transaction records found</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-900 overflow-hidden bg-zinc-950">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-zinc-900/50 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em]">
                    <tr>
                      <th className="pl-6 py-4 pr-4">Escrow</th>
                      <th className="py-4 pr-4">Listing</th>
                      <th className="py-4 pr-4">Volume</th>
                      <th className="py-4 pr-4">Status</th>
                      <th className="py-4 pr-4">Role</th>
                      <th className="pr-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {escrowIds.slice().reverse().map((id) => (
                      <EscrowRow key={id.toString()} escrowId={id} userAddress={address ?? ""} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>

      <OnboardingModal isOpen={isOnboarding} onClose={() => setIsOnboarding(false)} />

      <footer className="max-w-[1400px] mx-auto w-full px-6 py-12 border-t border-zinc-900 text-center">
        <p className="text-[10px] font-bold tracking-[0.2em] text-zinc-600 uppercase">
          ARES PROTOCOL • HKUST BLOCKCHAIN LAB • v1.0.4-LOCKED
        </p>
      </footer>
    </main>
  );
}
