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
  TrendUp, ShieldCheck, Gear, Coins, Robot, Trash, Check, X, CircleNotch,
  Key, Pulse, ListDashes, Broadcast, SealCheck, ArrowRight
} from "@phosphor-icons/react";
import { useTxToast } from "@/hooks/useTxToast";
import { toast } from "react-hot-toast";

// ─── Tactical UI Components ──────────────────────────────────────────────────

function Heartbeat() {
  return (
    <div className="flex items-center gap-1">
       {[...Array(6)].map((_, i) => (
         <motion.div
           key={i}
           animate={{ height: [4, 12, 4] }}
           transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
           className="w-1 bg-accent/40"
         />
       ))}
    </div>
  );
}

function TelemetryBox({ label, value, unit, status }: { label: string; value: string; unit?: string; status?: 'active' | 'warn' | 'dim' }) {
  const statusColor = status === 'active' ? 'text-green-500' : status === 'warn' ? 'text-red-500' : 'text-zinc-600';
  return (
    <div className="border border-zinc-900 bg-black/40 p-4 font-mono">
       <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em] mb-1">// {label}</p>
       <p className={`text-lg font-bold tracking-tight ${statusColor}`}>
         {value} {unit && <span className="text-[10px] opacity-50 ml-1">{unit}</span>}
       </p>
    </div>
  );
}

function SectionHeader({ title, subtitle, icon: Icon }: { title: string; subtitle: string; icon: any }) {
  return (
    <div className="flex items-start gap-4 mb-8">
       <div className="p-3 bg-zinc-900 border border-zinc-800 text-zinc-400">
          <Icon size={24} weight="duotone" />
       </div>
       <div>
          <h2 className="text-xl font-bold tracking-tighter uppercase">{title}</h2>
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{subtitle}</p>
       </div>
    </div>
  );
}

// ─── Agent card ───────────────────────────────────────────────────────────────

function AgentCard({ agentId, onUpdate }: { agentId: bigint, onUpdate?: () => void }) {
  const [showManage, setShowManage] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [fundAmount, setFundAmount] = useState("100");
  
  // Configuration states
  const [maxTradeInput, setMaxTradeInput] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [maxPriceInput, setMaxPriceInput] = useState("");

  const { data: tba } = useReadContract({
    address: ADDRESSES.registry,
    abi: AGENT_REGISTRY_ABI,
    functionName: "agentAccount",
    args: [agentId],
  });

  const { data: usdcBal, refetch: refetchBal } = useReadContract({
    address: ADDRESSES.mockUSDC,
    abi: MOCK_USDC_ABI,
    functionName: "balanceOf",
    args: [tba ?? "0x0"],
    query: { enabled: !!tba },
  });

  const { data: maxSingle, refetch: refetchMaxSingle } = useReadContract({
    address: tba,
    abi: AGENT_ACCOUNT_ABI,
    functionName: "maxSingleTrade",
    query: { enabled: !!tba },
  });

  const { data: dailyBudget, refetch: refetchBudget } = useReadContract({
    address: tba,
    abi: AGENT_ACCOUNT_ABI,
    functionName: "dailyBudget",
    query: { enabled: !!tba },
  });

  const { data: autoBuy, refetch: refetchAutoBuy } = useReadContract({
    address: tba,
    abi: AGENT_ACCOUNT_ABI,
    functionName: "autoBuyPolicy",
    query: { enabled: !!tba },
  });

  // Sync inputs when data loads
  useEffect(() => {
    if (maxSingle !== undefined) setMaxTradeInput((Number(maxSingle) / Number(USDC_SCALE)).toString());
    if (dailyBudget !== undefined) setBudgetInput((Number(dailyBudget) / Number(USDC_SCALE)).toString());
    if (autoBuy !== undefined) setMaxPriceInput((Number(autoBuy.maxPrice) / Number(USDC_SCALE)).toString());
  }, [maxSingle, dailyBudget, autoBuy]);

  // Actions
  const { writeContract: burn, data: burnHash, error: burnErr } = useWriteContract();
  const { isLoading: burning, isSuccess: burned, error: burnTxErr } = useWaitForTransactionReceipt({ hash: burnHash });

  const { writeContract: setPolicy, data: policyHash, error: policyErr } = useWriteContract();
  const { isLoading: settingPolicy, isSuccess: policySet, error: policyTxErr } = useWaitForTransactionReceipt({ hash: policyHash });

  const { writeContract: setAutoBuy, data: autoBuyHash, error: autoBuyErr } = useWriteContract();
  const { isLoading: settingAutoBuy, isSuccess: autoBuySet, error: autoBuyTxErr } = useWaitForTransactionReceipt({ hash: autoBuyHash });

  const { writeContract: fund, data: fundHash, error: fundErr } = useWriteContract();
  const { isLoading: funding, isSuccess: funded, error: fundTxErr } = useWaitForTransactionReceipt({ hash: fundHash });

  useTxToast("Delete Agent", burnErr, burned, burnTxErr);
  useTxToast("Update Policy", policyErr, policySet, policyTxErr);
  useTxToast("Update Auto-Buy", autoBuyErr, autoBuySet, autoBuyTxErr);
  useTxToast("Fund Agent", fundErr, funded, fundTxErr);

  useEffect(() => {
    if (burned && onUpdate) onUpdate();
    if (funded) {
      refetchBal();
      setIsFunding(false);
    }
    if (policySet || autoBuySet) {
      refetchMaxSingle();
      refetchBudget();
      refetchAutoBuy();
      toast.success("Configuration updated on-chain");
    }
  }, [burned, policySet, autoBuySet, onUpdate, refetchMaxSingle, refetchBudget, refetchAutoBuy]);

  const handleSaveConfig = () => {
    if (!tba) return;
    
    const newMaxTrade = BigInt(Math.floor(parseFloat(maxTradeInput || "0") * Number(USDC_SCALE)));
    const newBudget = BigInt(Math.floor(parseFloat(budgetInput || "0") * Number(USDC_SCALE)));
    const newMaxPrice = BigInt(Math.floor(parseFloat(maxPriceInput || "0") * Number(USDC_SCALE)));

    // Multi-call would be better, but for simplicity we do sequential or parallel
    setPolicy({
      address: tba,
      abi: AGENT_ACCOUNT_ABI,
      functionName: "setPolicy",
      args: [newMaxTrade, newBudget],
    });

    setAutoBuy({
      address: tba,
      abi: AGENT_ACCOUNT_ABI,
      functionName: "setAutoBuyPolicy",
      args: [newMaxPrice, autoBuy?.active ?? true],
    });
  };

  const usdcDisplay = usdcBal != null ? (Number(usdcBal) / Number(USDC_SCALE)).toFixed(2) : "—";

  return (
    <div className="group border border-zinc-900 bg-black flex flex-col gap-px hover:border-accent/30 transition-all duration-300 relative overflow-hidden shadow-xl">
      {/* Background visual */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-3xl pointer-events-none" />
      
      <div className="bg-black p-6 flex items-start justify-between relative z-10 border-b border-zinc-900">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-zinc-900 border border-zinc-800 text-accent">
            <Robot size={24} weight="duotone" />
          </div>
          <div>
            <p className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-[0.2em]">Instance Identity</p>
            <p className="text-xl font-mono font-bold text-white tracking-tighter">#{agentId.toString().padStart(3, '0')}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-tight">Status</span>
          <div className="flex items-center gap-1.5 border border-zinc-900 px-2 py-0.5 bg-zinc-950">
            <div className={`w-1 h-1 rounded-full animate-pulse ${autoBuy?.active ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-zinc-700'}`} />
            <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${autoBuy?.active ? 'text-green-500' : 'text-zinc-600'}`}>
              {autoBuy?.active ? 'AUTONOMOUS' : 'MANUAL_OVERRIDE'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-zinc-900 relative z-10">
          <TelemetryBox label="TBA Balance" value={usdcDisplay} unit="USDC" status={Number(usdcBal) > 0 ? 'active' : 'dim'} />
          <TelemetryBox label="Daily Budget" value={dailyBudget != null ? (Number(dailyBudget) / Number(USDC_SCALE)).toFixed(0) : "—"} unit="USDC" status="dim" />
      </div>

      <div className="bg-black p-6 space-y-6 relative z-10">
        <div>
          <p className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-[0.2em] mb-2">// Binding Attestation</p>
          <div className="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-900 font-mono">
             <ShieldCheck size={14} className="text-zinc-500" />
             <p className="text-[10px] text-zinc-500 truncate tracking-tight">{tba ?? "—"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
           <button 
             onClick={() => setIsFunding(true)}
             className="flex-1 h-12 flex items-center justify-center gap-3 bg-zinc-900 border border-zinc-800 text-[10px] font-mono font-bold text-white hover:border-accent transition-all uppercase tracking-widest"
           >
             <Coins size={16} />
             Fund_Asset
           </button>
           <button 
             onClick={() => setShowManage(!showManage)}
             className={`flex-1 h-12 flex items-center justify-center gap-3 border text-[10px] font-mono font-bold transition-all uppercase tracking-widest ${showManage ? 'bg-accent border-accent text-white' : 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800'}`}
           >
             <Gear size={16} />
             {showManage ? 'Sync_Exit' : 'Sync_Config'}
           </button>
           <button 
             onClick={() => setIsDeleting(true)}
             className="w-12 h-12 flex items-center justify-center bg-zinc-900 border border-zinc-800 text-red-500 hover:bg-red-950/30 transition-all"
           >
             <Trash size={18} />
           </button>
        </div>
      </div>

      <AnimatePresence>
        {showManage && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden relative z-10 bg-black border-t border-zinc-900"
          >
            <div className="p-6 space-y-6">
               <div className="grid grid-cols-1 gap-px bg-zinc-900 border border-zinc-900">
                  <div className="bg-black p-4 flex items-center justify-between">
                    <label className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-widest">Auto-Buy Max Price</label>
                    <div className="flex items-center gap-2">
                       <input 
                         type="number"
                         value={maxPriceInput}
                         onChange={(e) => setMaxPriceInput(e.target.value)}
                         className="w-20 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[11px] font-mono text-white text-right outline-none focus:border-accent"
                       />
                       <span className="text-[9px] font-mono text-zinc-600 font-bold uppercase">USDC</span>
                    </div>
                  </div>
                  <div className="bg-black p-4 flex items-center justify-between">
                    <label className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-widest">Single Trade Limit</label>
                    <div className="flex items-center gap-2">
                       <input 
                         type="number"
                         value={maxTradeInput}
                         onChange={(e) => setMaxTradeInput(e.target.value)}
                         className="w-20 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[11px] font-mono text-white text-right outline-none focus:border-accent"
                       />
                       <span className="text-[9px] font-mono text-zinc-600 font-bold uppercase">USDC</span>
                    </div>
                  </div>
               </div>
               <button 
                 disabled={settingPolicy || settingAutoBuy}
                 onClick={handleSaveConfig}
                 className="w-full h-12 bg-accent text-white font-mono font-bold text-[10px] tracking-[0.3em] uppercase hover:bg-blue-400 disabled:opacity-30 transition-all flex items-center justify-center gap-3"
               >
                 {settingPolicy || settingAutoBuy ? <CircleNotch size={16} className="animate-spin" /> : <Check size={16} />}
                 Sync On-Chain Data
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Overlay */}
      <AnimatePresence>
        {isDeleting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
          >
             <div className="w-16 h-16 border border-red-900/50 bg-red-950/10 flex items-center justify-center text-red-500 mb-6">
                <Trash size={32} weight="duotone" />
             </div>
             <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-[0.2em]">Decommission Protocol?</h3>
             <p className="text-[10px] font-mono text-zinc-500 mb-8 leading-relaxed uppercase tracking-wider">Burn the Agent NFT and permanently deactivate this TBA instance. Irreversible operation.</p>
             <div className="flex gap-4 w-full">
                <button 
                  onClick={() => setIsDeleting(false)}
                  className="flex-1 h-12 border border-zinc-800 text-[10px] font-mono font-bold text-zinc-500 hover:bg-zinc-900 uppercase tracking-widest transition-all"
                >
                  Abort
                </button>
                <button 
                  disabled={burning}
                  onClick={() => burn({ address: ADDRESSES.registry, abi: AGENT_REGISTRY_ABI, functionName: "burn", args: [agentId] })}
                  className="flex-1 h-12 bg-red-600 text-white font-mono font-bold text-[10px] uppercase tracking-widest hover:bg-red-500 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
                >
                  {burning ? <CircleNotch size={14} className="animate-spin" /> : <Trash size={14} />}
                  Confirm
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Funding Overlay */}
      <AnimatePresence>
        {isFunding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center"
          >
             <div className="w-16 h-16 border border-accent/50 bg-accent/10 flex items-center justify-center text-accent mb-6">
                <Coins size={32} weight="duotone" />
             </div>
             <h3 className="text-sm font-bold text-white mb-2 uppercase tracking-[0.2em]">Capital Injection</h3>
             <p className="text-[10px] font-mono text-zinc-500 mb-8 leading-relaxed uppercase tracking-wider">Inject USDC into the agent's TBA for autonomous operations.</p>
             
             <div className="w-full mb-8">
                <div className="relative border-b border-zinc-800 pb-2">
                   <input 
                     type="number"
                     value={fundAmount}
                     onChange={(e) => setFundAmount(e.target.value)}
                     className="w-full bg-transparent text-2xl font-mono font-bold text-white text-center outline-none"
                     placeholder="0.00"
                   />
                   <span className="absolute right-0 bottom-3 text-[10px] font-mono font-bold text-zinc-600 uppercase">USDC</span>
                </div>
             </div>

             <div className="flex gap-4 w-full">
                <button 
                  onClick={() => setIsFunding(false)}
                  className="flex-1 h-12 border border-zinc-800 text-[10px] font-mono font-bold text-zinc-500 hover:bg-zinc-900 uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button 
                  disabled={funding || !tba}
                  onClick={() => fund({
                    address: ADDRESSES.mockUSDC,
                    abi: MOCK_USDC_ABI,
                    functionName: "transfer",
                    args: [tba as `0x${string}`, BigInt(Math.floor(parseFloat(fundAmount || "0") * Number(USDC_SCALE)))],
                  })}
                  className="flex-1 h-12 bg-accent text-white font-mono font-bold text-[10px] uppercase tracking-widest hover:bg-blue-400 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
                >
                  {funding ? <CircleNotch size={14} className="animate-spin" /> : <Check size={14} />}
                  Fund_Asset
                </button>
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
    Pending: "text-yellow-500 border-yellow-900/50 bg-yellow-500/5", 
    Released: "text-green-500 border-green-900/50 bg-green-500/5",
    Refunded: "text-blue-500 border-blue-900/50 bg-blue-500/5",  
    Disputed: "text-red-500 border-red-900/50 bg-red-500/5",
  };
  const amountUSDC = (Number(rec.amount) / Number(USDC_SCALE)).toFixed(2);

  return (
    <tr className="border-t border-zinc-900 text-[11px] font-mono group hover:bg-zinc-950/50 transition-colors">
      <td className="py-5 pl-6 pr-4 text-zinc-600">#{escrowId.toString().padStart(3, '0')}</td>
      <td className="py-5 pr-4 text-zinc-400 font-bold uppercase tracking-tight">ADT #{rec.twinId.toString()}</td>
      <td className="py-5 pr-4 font-bold text-white tracking-tight">{amountUSDC} <span className="text-[9px] text-zinc-600 uppercase font-bold">USDC</span></td>
      <td className="py-5 pr-4">
        <div className={`inline-flex items-center gap-1.5 border px-2 py-0.5 ${stateColor[stateName]}`}>
           <span className="font-bold uppercase text-[9px] tracking-widest">{stateName}</span>
        </div>
      </td>
      <td className="py-5">
        <span className="text-zinc-600 font-bold uppercase text-[9px] tracking-widest">{isBuyer ? "BUYER_ROLE" : "SELLER_ROLE"}</span>
      </td>
      <td className="py-5 pl-4 text-right">
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
            className="h-8 border border-red-900 bg-red-950/20 px-4 text-[9px] font-bold text-red-500 disabled:opacity-50 transition-all uppercase tracking-widest hover:bg-red-900 hover:text-white"
          >
            {disputing ? "SYNC..." : "Open Dispute"}
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Onboarding Modal ─────────────────────────────────────────────────────────

function OnboardingModal({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess?: () => void }) {
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

  const { writeContract: approve, data: approveTxHash, error: approveErr } = useWriteContract();
  const { isLoading: isApproving, isSuccess: isApproved, error: approveTxErr } = useWaitForTransactionReceipt({ hash: approveTxHash });

  const { writeContract: onboard, data: txHash, error: onboardErr } = useWriteContract();
  const { isLoading: isWaiting, isSuccess, error: onboardTxErr } = useWaitForTransactionReceipt({ hash: txHash });

  useTxToast("Approve USDC", approveErr, isApproved, approveTxErr);
  useTxToast("Onboard Agent", onboardErr, isSuccess, onboardTxErr);

  // Trigger refetch and auto-close on success
  useEffect(() => {
    if (isSuccess) {
      if (onSuccess) onSuccess();
      const timer = setTimeout(() => onClose(), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, onSuccess, onClose]);

  const finalUsdcBal = (typeof window !== 'undefined' && (window as any).__MOCK_USDC_BALANCE__) ? BigInt((window as any).__MOCK_USDC_BALANCE__) : usdcBalance;
  const finalAllowance = (typeof window !== 'undefined' && (window as any).__MOCK_ALLOWANCE__) ? BigInt((window as any).__MOCK_ALLOWANCE__) : allowance;

  const needsApproval = (finalAllowance ?? 0n) < fundingValue && !isApproved;
  const hasInsufficientFunds = (finalUsdcBal ?? 0n) < fundingValue;

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-black border border-zinc-900 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
      >
        <div className="p-8 border-b border-zinc-900 bg-zinc-950">
           <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-zinc-900 border border-zinc-800 text-accent">
                 <Robot size={24} weight="duotone" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tighter uppercase italic leading-none">Onboard Agent</h2>
           </div>
           <p className="text-zinc-600 text-[10px] font-mono font-bold uppercase tracking-widest mt-1">// System Parameters Configuration</p>
        </div>

        <div className="p-8 space-y-8">
           <div className="space-y-6">
              {hasInsufficientFunds && (
                <div className="p-3 border border-red-900 bg-red-950/20 text-[9px] font-mono font-bold text-red-500 uppercase tracking-widest text-center">
                  ⚠️ INSUFFICIENT_LIQUIDITY_ERROR
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <label className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-widest">Funding (USDC)</label>
                    <input 
                      type="number" 
                      value={funding}
                      onChange={(e) => setFunding(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 px-4 py-3 text-sm text-white font-mono focus:border-accent outline-none" 
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-widest">Max Auto-Price</label>
                    <input 
                      type="number" 
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 px-4 py-3 text-sm text-white font-mono focus:border-accent outline-none" 
                    />
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <label className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-widest">Daily Budget</label>
                    <input 
                      type="number" 
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 px-4 py-3 text-sm text-white font-mono focus:border-accent outline-none" 
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-widest">Max Single Trade</label>
                    <input 
                      type="number" 
                      value={maxTrade}
                      onChange={(e) => setMaxTrade(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 px-4 py-3 text-sm text-white font-mono focus:border-accent outline-none" 
                    />
                 </div>
              </div>
           </div>

           <div className="flex items-center gap-4 pt-4">
              <button 
                onClick={onClose}
                className={`${isSuccess ? 'w-full' : 'flex-1'} h-14 border border-zinc-800 text-[10px] font-mono font-bold text-zinc-500 hover:bg-zinc-900 transition-all uppercase tracking-widest`}
              >
                {isSuccess ? "Deactivate_Interface" : "Abort_Action"}
              </button>
              {!isSuccess && (
                <button 
                  disabled={isWaiting || isApproving || (hasInsufficientFunds && !isSuccess)}
                  onClick={handleOnboard}
                  className="flex-[2] h-14 bg-accent text-[11px] font-mono font-bold text-white hover:bg-blue-400 disabled:opacity-20 transition-all uppercase tracking-[0.2em]"
                >
                  {isApproving ? "Authorizing..." : isWaiting ? "Deploying..." : hasInsufficientFunds ? "FAIL: NO_FUNDS" : needsApproval ? "Auth USDC" : "Initialize Agent"}
                </button>
              )}
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

  const { data: userAgentsData, refetch: refetchAgents } = useReadContract({
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

  const { writeContract: faucet, data: faucetTxHash, error: faucetError } = useWriteContract();
  const { isLoading: fauceting, isSuccess: faucetSuccess, error: faucetTxError } = useWaitForTransactionReceipt({ hash: faucetTxHash });

  useTxToast("USDC Faucet", faucetError, faucetSuccess, faucetTxError);

  // Refetch USDC balance after faucet success
  useEffect(() => {
    if (faucetSuccess) {
      refetchUsdc();
      // On live networks, the first refetch might be too early for the RPC.
      const t1 = setTimeout(() => refetchUsdc(), 2000);
      const t2 = setTimeout(() => refetchUsdc(), 5000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
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
      <main className="flex flex-col min-h-screen bg-black">
        <Nav />
        <div className="flex-1 flex flex-col items-center justify-center font-mono p-12">
           <div className="border border-zinc-900 bg-zinc-950 p-12 flex flex-col items-center gap-8 text-center max-w-sm">
              <Key size={48} className="text-zinc-700" weight="duotone" />
              <div className="space-y-4">
                 <h2 className="text-lg font-bold text-white uppercase tracking-[0.4em]">Terminal Locked</h2>
                 <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed">HARDWARE_KEY_REQUIRED_FOR_COMMAND_INTERFACE_SYNC</p>
              </div>
              <ConnectButton />
           </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen bg-black text-white selection:bg-accent/30 selection:text-accent">
      <Nav />
      
      {/* Scanline Effect Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,118,0.06))] bg-[length:100%_2px,3px_100%]" />

      <div className="flex-1 px-6 py-16 max-w-6xl w-full mx-auto flex flex-col gap-16 relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-zinc-900 pb-12">
          <div>
            <div className="flex items-center gap-4 text-accent text-[10px] font-mono font-bold tracking-[0.4em] uppercase mb-4">
               <Pulse size={14} />
               <span>Command Interface Active</span>
               <Heartbeat />
            </div>
            <h1 className="text-5xl font-bold tracking-tighter uppercase italic leading-[0.8] mb-4">
               Command <br/> Dashboard
            </h1>
            <p className="text-zinc-500 font-mono text-[10px] max-w-sm uppercase tracking-widest leading-relaxed">
               Centralized hub for autonomous agent management and trade settlement synchronization. Monitor fleet status and capital allocation in real-time.
            </p>
          </div>
          <div className="flex flex-col md:items-end gap-6">
             <div className="flex items-center gap-6 font-mono text-[10px] text-zinc-600 uppercase font-bold tracking-widest">
                <div className="flex flex-col items-end">
                   <span>Protocol Status</span>
                   <span className="text-white">v1.0.4 / CRT</span>
                </div>
                <div className="w-px h-10 bg-zinc-900" />
                <div className="flex flex-col items-end">
                   <span>Terminal ADDR</span>
                   <span className="text-white truncate max-w-[120px]">{address?.substring(0, 12)}...</span>
                </div>
             </div>
             <div className="flex gap-4">
                <button
                  disabled={fauceting || !isDeployed(ADDRESSES.mockUSDC)}
                  onClick={() => faucet({ address: ADDRESSES.mockUSDC, abi: MOCK_USDC_ABI, functionName: "faucet" })}
                  className="h-12 px-6 border border-zinc-800 bg-zinc-900 text-[10px] font-mono font-bold text-white hover:bg-zinc-800 uppercase tracking-widest transition-all"
                >
                  {fauceting ? "MINTING..." : "USDC_Faucet"}
                </button>
                <button
                  onClick={() => setIsOnboarding(true)}
                  className="h-12 px-8 bg-accent text-[11px] font-mono font-bold text-white hover:bg-blue-400 uppercase tracking-[0.2em] transition-all shadow-[0_0_30px_rgba(59,130,246,0.2)]"
                >
                  + Onboard_Agent
                </button>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Sidebar: Metrics */}
          <div className="lg:col-span-4 space-y-12">
             <div>
                <SectionHeader title="System Metrics" subtitle="Real-time telemetry and resource usage" icon={Cpu} />
                <div className="grid grid-cols-1 gap-px bg-zinc-900 border border-zinc-900">
                   <TelemetryBox label="Wallet Liquidity" value={usdcDisplay} unit="USDC" status={Number(usdcBalance) > 0 ? 'active' : 'dim'} />
                   <TelemetryBox label="Active Fleet Size" value={agentCount.toString()} unit="AGENTS" status="dim" />
                </div>
             </div>

             <div>
                <SectionHeader title="Quick Actions" subtitle="Rapid access to protocol logs" icon={Broadcast} />
                <div className="grid grid-cols-1 gap-px bg-zinc-900 border border-zinc-900">
                   <button className="flex items-center justify-between p-5 bg-black hover:bg-zinc-950 transition-all group">
                      <span className="flex items-center gap-3 text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest group-hover:text-white">
                         <History size={16} /> Settlement Logs
                      </span>
                      <ArrowRight size={14} className="text-zinc-700 group-hover:translate-x-1 transition-transform" />
                   </button>
                   <button className="flex items-center justify-between p-5 bg-black hover:bg-zinc-950 transition-all group">
                      <span className="flex items-center gap-3 text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest group-hover:text-white">
                         <Info size={16} /> API Documentation
                      </span>
                      <ArrowRight size={14} className="text-zinc-700 group-hover:translate-x-1 transition-transform" />
                   </button>
                </div>
             </div>
          </div>

          {/* Main: Agents & History */}
          <div className="lg:col-span-8 space-y-20">
            
            {/* My Agents */}
            <section>
              <SectionHeader title="Authorized Agents" subtitle="Fleet of autonomous entities currently deployed" icon={Robot} />

              {agentCount === 0n ? (
                <div className="border border-dashed border-zinc-800 bg-zinc-950/50 p-20 text-center flex flex-col items-center gap-8">
                  <div className="w-16 h-16 border border-zinc-800 flex items-center justify-center text-zinc-700 opacity-50">
                     <Broadcast size={32} weight="duotone" />
                  </div>
                  <div className="space-y-3">
                     <p className="text-[10px] font-mono font-bold text-zinc-600 uppercase tracking-[0.3em]">// NO_ACTIVE_AGENTS_DETECTED</p>
                     <button
                        onClick={() => setIsOnboarding(true)}
                        className="text-[10px] font-mono font-bold text-accent hover:text-white underline underline-offset-8 decoration-accent/30 uppercase tracking-widest"
                     >
                        Initiate First Deployment Cycle
                     </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-zinc-900 border border-zinc-900 shadow-2xl">
                  {agentIds.map((id) => (
                    <AgentCard key={id.toString()} agentId={id} onUpdate={refetchAgents} />
                  ))}
                </div>
              )}
            </section>

            {/* History */}
            <section>
              <SectionHeader title="Settlement History" subtitle="Immutable log of finalized trade attestations" icon={ListDashes} />
              {escrowIds.length === 0 ? (
                <div className="border border-dashed border-zinc-800 p-12 text-center text-[10px] font-mono text-zinc-600 uppercase tracking-[0.3em]">
                   // NO_TRANSACTION_RECORDS_INDEXED
                </div>
              ) : (
                <div className="border border-zinc-900 overflow-hidden bg-black shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-zinc-950 text-[9px] font-mono text-zinc-600 font-bold uppercase tracking-[0.2em] border-b border-zinc-900">
                        <tr>
                          <th className="pl-6 py-4 pr-4 uppercase">ID</th>
                          <th className="py-4 pr-4 uppercase">Target</th>
                          <th className="py-4 pr-4 uppercase">Volume</th>
                          <th className="py-4 pr-4 uppercase">Status</th>
                          <th className="py-4 pr-4 uppercase">Role</th>
                          <th className="pr-6 py-4 text-right uppercase">Command</th>
                        </tr>
                      </thead>
                      <tbody>
                        {escrowIds.slice().reverse().map((id) => (
                          <EscrowRow key={id.toString()} escrowId={id} userAddress={address ?? ""} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <OnboardingModal isOpen={isOnboarding} onClose={() => setIsOnboarding(false)} onSuccess={refetchAgents} />

      <footer className="max-w-6xl mx-auto w-full px-6 py-12 border-t border-zinc-900 flex justify-between items-center opacity-30 grayscale hover:opacity-100 transition-all">
        <p className="text-[9px] font-mono font-bold tracking-[0.3em] text-zinc-500 uppercase">
          ARES PROTOCOL • HKUST BLOCKCHAIN LAB • END_OF_LINE
        </p>
        <div className="flex gap-6 font-mono text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
           <span>Lat: 22.3364° N</span>
           <span>Long: 114.2655° E</span>
        </div>
      </footer>
    </main>
  );
}
