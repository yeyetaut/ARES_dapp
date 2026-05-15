"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { keccak256, toBytes, parseEventLogs } from "viem";
import { Nav } from "@/components/Nav";
import { useTxToast } from "@/hooks/useTxToast";
import { ADDRESSES, MARKETPLACE_ABI, DIGITAL_TWIN_ABI, USDC_SCALE, isDeployed } from "@/lib/contracts";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Tag, ShieldCheck, Coins, CheckCircle, 
  CircleNotch, Info, ArrowRight, Robot, Pulse, SealCheck
} from "@phosphor-icons/react";

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

type Step = "mint" | "approve" | "list" | "done";

export default function ListItemPage() {
  const { address } = useAccount();

  // Form state
  const [nfcSeed, setNfcSeed]       = useState("");
  const [metadataURI, setMetadataURI] = useState("");
  const [priceInput, setPriceInput]  = useState("");
  const [twinId, setTwinId]          = useState<bigint | null>(null);
  const [step, setStep]              = useState<Step>("mint");

  const priceRaw = priceInput ? BigInt(Math.floor(parseFloat(priceInput) * Number(USDC_SCALE))) : 0n;

  // ── Step 1: Mint Digital Twin ───────────────────────────────────────────────

  const { writeContract: mint, data: mintTxHash, error: mintErr } = useWriteContract();
  const { data: mintReceipt, isLoading: minting, isSuccess: minted, error: mintTxErr } = useWaitForTransactionReceipt({
    hash: mintTxHash,
  });
  useTxToast("Mint Twin", mintErr, minted, mintTxErr);

  const nfcHash = nfcSeed ? keccak256(toBytes(nfcSeed.trim())) : undefined;

  const { data: existingTwinId, refetch: refetchExisting } = useReadContract({
    address: ADDRESSES.digitalTwin,
    abi: DIGITAL_TWIN_ABI,
    functionName: "nfcHashToTokenId",
    args: [nfcHash ?? "0x0000000000000000000000000000000000000000000000000000000000000000"],
    query: { enabled: !!nfcHash },
  });

  // Auto-transition from Mint -> Approve
  useEffect(() => {
    if (minted) {
      const timer = setTimeout(() => setStep("approve"), 1500);
      return () => clearTimeout(timer);
    }
  }, [minted]);

  // Extract twinId from receipt logs
  useEffect(() => {
    if (mintReceipt) {
      console.log("[DEBUG] Mint Receipt Logs:", mintReceipt.logs);
      try {
        const logs = parseEventLogs({
          abi: DIGITAL_TWIN_ABI,
          eventName: "TwinMinted",
          logs: mintReceipt.logs,
        });
        if (logs.length > 0) {
          const id = (logs[0] as any).args.tokenId;
          console.log("[DEBUG] Extracted Twin ID:", id);
          setTwinId(id);
        }
      } catch (err) {
        console.error("[DEBUG] Error parsing logs:", err);
      }
    }
  }, [mintReceipt]);

  // If already registered, allow moving forward
  useEffect(() => {
    if (existingTwinId && existingTwinId > 0n && step === "mint" && !minting) {
       console.log("[DEBUG] Existing Twin Found:", existingTwinId);
       setTwinId(existingTwinId);
       // We don't auto-jump here to give user a chance to see the message, 
       // but we could if we wanted to. User might want to double check metadata.
    }
  }, [existingTwinId, step, minting]);

  // ── Step 2: Approve Marketplace to transfer the NFT ────────────────────────

  const { writeContract: approveNFT, data: approveTxHash, error: approveErr } = useWriteContract();
  const { isLoading: approvingNFT, isSuccess: approvedNFT, error: approveTxErr } = useWaitForTransactionReceipt({ hash: approveTxHash });
  useTxToast("Approve NFT", approveErr, approvedNFT, approveTxErr);

  // Auto-transition from Approve -> List
  useEffect(() => {
    if (approvedNFT) {
      const timer = setTimeout(() => setStep("list"), 1500);
      return () => clearTimeout(timer);
    }
  }, [approvedNFT]);

  // ── Step 3: List item ──────────────────────────────────────────────────────

  const { writeContract: list, data: listTxHash, error: listErr } = useWriteContract();
  const { isLoading: listing, isSuccess: listed, error: listTxErr } = useWaitForTransactionReceipt({ hash: listTxHash });
  useTxToast("List Item", listErr, listed, listTxErr);

  // Auto-transition from List -> Done
  useEffect(() => {
    if (listed) {
      const timer = setTimeout(() => setStep("done"), 1500);
      return () => clearTimeout(timer);
    }
  }, [listed]);

  const contractsDeployed = isDeployed(ADDRESSES.marketplace);

  if (!address) {
    return (
      <main className="flex flex-col min-h-screen bg-zinc-950">
        <Nav />
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
          Connect your wallet to list an item.
        </div>
      </main>
    );
  }

  const steps: { key: Step; label: string; icon: any }[] = [
    { key: "mint", label: "Mint Twin", icon: Tag },
    { key: "approve", label: "Approve", icon: ShieldCheck },
    { key: "list", label: "List Item", icon: Coins },
    { key: "done", label: "Finalize", icon: CheckCircle },
  ];

  return (
    <main className="flex flex-col min-h-screen bg-black text-white selection:bg-accent/30 selection:text-accent">
      <Nav />

      {/* Scanline Effect Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,118,0.06))] bg-[length:100%_2px,3px_100%]" />

      <div className="max-w-3xl mx-auto w-full px-6 py-16 flex flex-col gap-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-zinc-900 pb-12">
          <div>
            <div className="flex items-center gap-4 text-accent text-[10px] font-mono font-bold tracking-[0.4em] uppercase mb-4">
               <Pulse size={14} />
               <span>Injection Protocol Active</span>
               <Heartbeat />
            </div>
            <h1 className="text-5xl font-bold tracking-tighter uppercase italic leading-[0.8] mb-4">
               Registry <br/> Enrollment
            </h1>
            <p className="text-zinc-500 font-mono text-[10px] max-w-sm uppercase tracking-widest leading-relaxed">
               Secure sequence for physical-to-digital mapping. Authenticate hardware provenance and authorize marketplace liquidity custody.
            </p>
          </div>
          <Link href="/marketplace" className="h-10 px-6 border border-zinc-800 bg-zinc-900 text-[10px] font-mono font-bold text-zinc-500 hover:text-white transition-all uppercase tracking-widest flex items-center gap-3">
             <ArrowLeft size={14} /> Abort_Sequence
          </Link>
        </div>

        {/* Progress Matrix */}
        <div className="grid grid-cols-4 gap-px bg-zinc-900 border border-zinc-900 shadow-2xl">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const isCompleted = steps.findIndex(x => x.key === step) > i || (step === "done");
            const isActive = step === s.key;

            return (
              <div key={s.key} className={`p-6 flex flex-col items-center gap-3 bg-black transition-all ${isActive ? 'bg-zinc-950' : ''}`}>
                <div className={`w-8 h-8 flex items-center justify-center border transition-all ${
                  isActive ? "bg-accent border-accent shadow-[0_0_15px_rgba(59,130,246,0.3)] text-white" :
                  isCompleted ? "bg-green-900/10 border-green-900/50 text-green-500" :
                  "bg-zinc-950 border-zinc-900 text-zinc-700"
                }`}>
                  {isCompleted ? <CheckCircle size={16} weight="fill" /> : <Icon size={16} weight={isActive ? "bold" : "regular"} />}
                </div>
                <span className={`text-[8px] font-mono font-bold uppercase tracking-[0.2em] ${isActive ? "text-white" : "text-zinc-600"}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="bg-zinc-950 border border-zinc-900 p-8 md:p-12 shadow-2xl relative overflow-hidden group">
          {/* Visual background element */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[100px] pointer-events-none" />
          
          <AnimatePresence mode="wait">
            {/* ── Step 1: Mint ── */}
            {step === "mint" && (
              <motion.div
                key="mint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-12"
              >
                <SectionHeader title="Physical Binding" subtitle="Input terminal for NFC payload synchronization" icon={Tag} />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-zinc-900 border border-zinc-900">
                  <div className="bg-black p-6 space-y-2">
                    <label className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-[0.2em]">NFC Payload Seed</label>
                    <input
                      type="text"
                      value={nfcSeed}
                      onChange={(e) => setNfcSeed(e.target.value)}
                      placeholder="RAW_STRING_DATA"
                      className="w-full bg-transparent text-xl font-bold font-mono text-white outline-none placeholder:text-zinc-800"
                    />
                  </div>

                  <div className="bg-black p-6 space-y-2">
                    <label className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-[0.2em]">Metadata Protocol URI</label>
                    <input
                      type="text"
                      value={metadataURI}
                      onChange={(e) => setMetadataURI(e.target.value)}
                      placeholder="ipfs://Qm..."
                      className="w-full bg-transparent text-xl font-bold font-mono text-white outline-none placeholder:text-zinc-800"
                    />
                  </div>
                </div>

                <div className="p-4 border border-blue-900/30 bg-blue-500/5 flex gap-4">
                   <Info size={20} className="text-blue-500 shrink-0" />
                   <p className="text-[10px] font-mono text-zinc-500 leading-relaxed uppercase tracking-wider">
                      This sequence generates a unique cryptographic hash that will be permanently stored on-chain for DePIN hardware verification.
                   </p>
                </div>

                {existingTwinId != null && existingTwinId > 0n && (
                  <div className="p-6 border border-yellow-900/50 bg-yellow-950/10 flex items-start gap-4">
                     <Info size={24} className="text-yellow-500 mt-0.5" />
                     <div className="space-y-1">
                        <p className="text-xs font-mono font-bold text-white uppercase tracking-widest">DUPLICATE_TAG_DETECTED</p>
                        <p className="text-[10px] font-mono text-zinc-500 uppercase">This hardware payload is already registered as ADT #{existingTwinId.toString()}.</p>
                     </div>
                  </div>
                )}

                <div className="flex flex-col gap-4">
                  {!minted && !(existingTwinId && existingTwinId > 0n) && (
                    <button
                      disabled={!nfcSeed || !metadataURI || minting || !contractsDeployed}
                      onClick={() => {
                        if (!nfcHash || !address) return;
                        mint({
                          address: ADDRESSES.digitalTwin,
                          abi: DIGITAL_TWIN_ABI,
                          functionName: "mint",
                          args: [address, nfcHash, metadataURI],
                        });
                      }}
                      className="w-full h-16 bg-accent hover:bg-blue-400 text-white font-bold text-[12px] tracking-[0.4em] uppercase transition-all active:translate-y-px disabled:opacity-20 flex items-center justify-center gap-4"
                    >
                      {minting ? <CircleNotch size={20} className="animate-spin" /> : <Tag size={20} weight="bold" />}
                      {minting ? "Executing Mint..." : "Initialize Digital Twin"}
                    </button>
                  )}
                </div>

                <div className="pt-8 border-t border-zinc-900">
                  <p className="text-[9px] font-mono font-bold text-zinc-700 uppercase tracking-widest mb-6">// Manual ID Intervention</p>
                  <div className="flex gap-4">
                    <input
                      type="number"
                      placeholder="ID_000"
                      className="w-32 bg-zinc-900 border border-zinc-800 p-4 font-mono text-xs outline-none focus:border-accent text-center"
                      onChange={(e) => setTwinId(e.target.value ? BigInt(e.target.value) : null)}
                    />
                    <button
                      disabled={!twinId}
                      onClick={() => setStep("approve")}
                      className="flex-1 bg-zinc-900 border border-zinc-800 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
                    >
                      Use Manual Assignment
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Approve NFT ── */}
            {step === "approve" && (
              <motion.div
                key="approve"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-12 py-8"
              >
                <div className="flex flex-col items-center text-center gap-6">
                   <div className="w-20 h-20 border border-accent/30 bg-accent/5 flex items-center justify-center text-accent">
                      <ShieldCheck size={40} weight="duotone" />
                   </div>
                   <div className="space-y-3">
                      <h3 className="text-2xl font-bold tracking-tighter uppercase italic">Custody Authorization</h3>
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest max-w-sm mx-auto leading-relaxed">
                         Granting marketplace protocol temporary custody of ADT #{twinId?.toString()} for trade settlement.
                      </p>
                   </div>
                </div>

                {!approvedNFT && (
                  <button
                    disabled={approvingNFT || !contractsDeployed || !twinId}
                    onClick={() => {
                      if (!twinId) return;
                      approveNFT({
                        address: ADDRESSES.digitalTwin,
                        abi: DIGITAL_TWIN_ABI,
                        functionName: "approve",
                        args: [ADDRESSES.marketplace, twinId],
                      });
                    }}
                    className="w-full h-16 bg-accent hover:bg-blue-400 text-white font-bold text-[12px] tracking-[0.4em] uppercase transition-all active:translate-y-px disabled:opacity-20 flex items-center justify-center gap-4"
                  >
                    {approvingNFT ? <CircleNotch size={20} className="animate-spin" /> : <ShieldCheck size={20} weight="bold" />}
                    {approvingNFT ? "Authorizing Protocol..." : "Grant Custody Permissions"}
                  </button>
                )}
              </motion.div>
            )}

            {/* ── Step 3: List ── */}
            {step === "list" && (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-12"
              >
                <SectionHeader title="Capital Configuration" subtitle="Define liquidity requirements for registry entry" icon={Coins} />

                <div className="space-y-8">
                  <div className="bg-black border border-zinc-900 p-8 space-y-4">
                    <label className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-[0.2em]">Listing Valuation (USDC)</label>
                    <div className="relative border-b border-zinc-800 pb-2">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        className="w-full bg-transparent text-4xl font-bold font-mono text-white outline-none placeholder:text-zinc-900"
                        placeholder="0.00"
                      />
                      <span className="absolute right-0 bottom-4 text-xs font-mono font-bold text-zinc-600 uppercase">USDC</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-px bg-zinc-900 border border-zinc-900">
                    <div className="bg-black p-6 flex flex-col gap-1">
                        <span className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-widest">Target Asset</span>
                        <span className="text-sm font-mono font-bold text-white uppercase tracking-tighter">ADT #{twinId?.toString()}</span>
                    </div>
                    <div className="bg-black p-6 flex flex-col gap-1 text-right">
                        <span className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-widest">Protocol Fee</span>
                        <span className="text-sm font-mono font-bold text-green-500 uppercase tracking-tighter">0.00 (0%)</span>
                    </div>
                  </div>
                </div>

                {!listed && (
                  <button
                    disabled={!priceInput || priceRaw === 0n || listing || !contractsDeployed || !twinId}
                    onClick={() => {
                      if (!twinId || !metadataURI) return;
                      list({
                        address: ADDRESSES.marketplace,
                        abi: MARKETPLACE_ABI,
                        functionName: "listItem",
                        args: [twinId, priceRaw, metadataURI],
                      });
                    }}
                    className="w-full h-16 bg-accent hover:bg-blue-400 text-white font-bold text-[12px] tracking-[0.4em] uppercase transition-all active:translate-y-px disabled:opacity-20 flex items-center justify-center gap-4"
                  >
                    {listing ? <CircleNotch size={20} className="animate-spin" /> : <Tag size={20} weight="bold" />}
                    {listing ? "Publishing to Registry..." : "Broadcast Live Listing"}
                  </button>
                )}
              </motion.div>
            )}

            {/* ── Step 4: Done ── */}
            {step === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center text-center py-12 gap-10"
              >
                <div className="w-24 h-24 border border-green-900 bg-green-500/5 flex items-center justify-center text-green-500">
                   <SealCheck size={56} weight="fill" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-3xl font-bold tracking-tighter uppercase italic">Protocol Finalized</h2>
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest max-w-xs mx-auto leading-relaxed">
                     Digital Twin is now live in the global registry and available for autonomous agent trade cycles.
                  </p>
                </div>
                <Link
                  href="/marketplace"
                  className="h-14 px-12 bg-white text-black hover:bg-zinc-200 text-[11px] font-mono font-bold uppercase tracking-[0.3em] transition-all flex items-center justify-center"
                >
                  Return to Exchange
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

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
