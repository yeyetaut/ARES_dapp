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
  CircleNotch, Info, ArrowRight, Robot 
} from "@phosphor-icons/react";

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

  const nfcHash = nfcSeed ? keccak256(toBytes(nfcSeed)) : undefined;

  const { data: existingTwinId, refetch: refetchExisting } = useReadContract({
    address: ADDRESSES.digitalTwin,
    abi: DIGITAL_TWIN_ABI,
    functionName: "nfcHashToTokenId",
    args: [nfcHash ?? "0x0000000000000000000000000000000000000000000000000000000000000000"],
    query: { enabled: !!nfcHash },
  });

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
    }
  }, [existingTwinId, step, minting]);

  // ── Step 2: Approve Marketplace to transfer the NFT ────────────────────────

  const { writeContract: approveNFT, data: approveTxHash, error: approveErr } = useWriteContract();
  const { isLoading: approvingNFT, isSuccess: approvedNFT, error: approveTxErr } = useWaitForTransactionReceipt({ hash: approveTxHash });
  useTxToast("Approve NFT", approveErr, approvedNFT, approveTxErr);

  // ── Step 3: List item ──────────────────────────────────────────────────────

  const { writeContract: list, data: listTxHash, error: listErr } = useWriteContract();
  const { isLoading: listing, isSuccess: listed, error: listTxErr } = useWaitForTransactionReceipt({ hash: listTxHash });
  useTxToast("List Item", listErr, listed, listTxErr);

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
    <main className="flex flex-col min-h-screen bg-zinc-950 text-white">
      <Nav />

      <div className="max-w-2xl mx-auto w-full px-6 py-12">
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest mb-8">
          <ArrowLeft size={16} />
          Back to Marketplace
        </Link>

        <div className="mb-12">
          <h1 className="text-4xl font-bold tracking-tighter mb-4">List Physical Collectible</h1>
          <p className="text-zinc-500 text-sm max-w-md">
            Complete the secure listing process to tokenize your physical asset for autonomous agent trading.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center justify-between mb-16 relative">
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-zinc-900 -translate-y-1/2 z-0" />
          {steps.map((s, i) => {
            const Icon = s.icon;
            const isCompleted = steps.findIndex(x => x.key === step) > i || (step === "done");
            const isActive = step === s.key;

            return (
              <div key={s.key} className="relative z-10 flex flex-col items-center gap-3">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all duration-300 ${
                  isActive ? "bg-accent border-accent shadow-[0_0_20px_rgba(59,130,246,0.3)]" :
                  isCompleted ? "bg-green-500/10 border-green-500/50 text-green-500" :
                  "bg-zinc-950 border-zinc-900 text-zinc-700"
                }`}>
                  {isCompleted ? <CheckCircle size={20} weight="fill" /> : <Icon size={20} weight={isActive ? "bold" : "regular"} />}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? "text-white" : "text-zinc-600"}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-8 md:p-12">
          <AnimatePresence mode="wait">
            {/* ── Step 1: Mint ── */}
            {step === "mint" && (
              <motion.div
                key="mint"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Physical NFC Seed</label>
                    <input
                      type="text"
                      value={nfcSeed}
                      onChange={(e) => setNfcSeed(e.target.value)}
                      placeholder="e.g. UNIQUE-TAG-ID-123"
                      className="w-full bg-black border border-zinc-800 rounded-2xl px-5 py-4 text-sm font-mono focus:border-accent outline-none transition-colors"
                    />
                    <div className="flex items-center gap-2 text-[10px] text-zinc-600 font-medium">
                       <Info size={14} />
                       <span>This creates a unique on-chain hash for physical verification.</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Metadata IPFS URI</label>
                    <input
                      type="text"
                      value={metadataURI}
                      onChange={(e) => setMetadataURI(e.target.value)}
                      placeholder="ipfs://Qm..."
                      className="w-full bg-black border border-zinc-800 rounded-2xl px-5 py-4 text-sm font-mono focus:border-accent outline-none transition-colors"
                    />
                  </div>
                </div>

                {existingTwinId != null && existingTwinId > 0n && (
                  <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-4">
                     <Info size={20} className="text-accent mt-0.5" />
                     <div className="space-y-1">
                        <p className="text-xs font-bold text-white">Item Already Registered</p>
                        <p className="text-xs text-zinc-500">This NFC tag is already linked to Digital Twin #{existingTwinId.toString()}. You can proceed directly to listing.</p>
                     </div>
                  </div>
                )}

                <div className="flex flex-col gap-4">
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
                    className="w-full rounded-2xl bg-accent hover:bg-blue-400 disabled:opacity-20 px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] transition-all shadow-[0_0_30px_rgba(59,130,246,0.1)] flex items-center justify-center gap-3"
                  >
                    {minting ? <CircleNotch size={18} className="animate-spin" /> : <Tag size={18} weight="bold" />}
                    {minting ? "Minting Protocol..." : "Initialize Digital Twin"}
                  </button>

                  {(minted || (existingTwinId && existingTwinId > 0n)) && (
                    <button
                      onClick={() => setStep("approve")}
                      className="w-full rounded-2xl border border-zinc-800 hover:bg-zinc-900 px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 group"
                    >
                      Continue to Approval
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  )}
                </div>

                <div className="pt-8 border-t border-zinc-900">
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-4">Manual Entry (Advanced)</p>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      placeholder="Twin ID"
                      className="flex-1 bg-black border border-zinc-800 rounded-xl px-4 py-2 text-xs font-mono outline-none"
                      onChange={(e) => setTwinId(e.target.value ? BigInt(e.target.value) : null)}
                    />
                    <button
                      disabled={!twinId}
                      onClick={() => setStep("approve")}
                      className="px-6 py-2 rounded-xl border border-zinc-800 hover:bg-zinc-900 disabled:opacity-30 text-[10px] font-bold uppercase tracking-widest transition-all"
                    >
                      Use ID
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Step 2: Approve NFT ── */}
            {step === "approve" && (
              <motion.div
                key="approve"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex flex-col items-center text-center gap-4">
                   <div className="w-16 h-16 rounded-3xl bg-zinc-950 border border-zinc-900 flex items-center justify-center text-accent">
                      <ShieldCheck size={32} weight="duotone" />
                   </div>
                   <div className="space-y-1">
                      <h3 className="text-xl font-bold">Authorise Marketplace</h3>
                      <p className="text-sm text-zinc-500">You must grant the marketplace permission to custody Twin #{twinId?.toString()} during the sale.</p>
                   </div>
                </div>

                <div className="flex flex-col gap-4">
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
                    className="w-full rounded-2xl bg-accent hover:bg-blue-400 disabled:opacity-20 px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3"
                  >
                    {approvingNFT ? <CircleNotch size={18} className="animate-spin" /> : <ShieldCheck size={18} weight="bold" />}
                    {approvingNFT ? "Authorizing..." : "Approve Protocol"}
                  </button>

                  {approvedNFT && (
                    <button
                      onClick={() => setStep("list")}
                      className="w-full rounded-2xl border border-zinc-800 hover:bg-zinc-900 px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 group"
                    >
                      Continue to Listing
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Step 3: List ── */}
            {step === "list" && (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Listing Price (USDC)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        placeholder="100.00"
                        className="w-full bg-black border border-zinc-800 rounded-2xl pl-5 pr-16 py-4 text-sm font-mono focus:border-accent outline-none transition-colors"
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-600">USDC</span>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-900 space-y-3">
                     <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                        <span className="text-zinc-600">Asset ID</span>
                        <span className="text-white">ADT #{twinId?.toString()}</span>
                     </div>
                     <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                        <span className="text-zinc-600">Protocol Fee</span>
                        <span className="text-green-500">0.00 USDC (0%)</span>
                     </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
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
                    className="w-full rounded-2xl bg-accent hover:bg-blue-400 disabled:opacity-20 px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3"
                  >
                    {listing ? <CircleNotch size={18} className="animate-spin" /> : <Tag size={18} weight="bold" />}
                    {listing ? "Publishing..." : "Create Live Listing"}
                  </button>

                  {listed && (
                    <button
                      onClick={() => setStep("done")}
                      className="w-full rounded-2xl border border-zinc-800 hover:bg-zinc-900 px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 group text-green-500"
                    >
                      Successfully Listed!
                      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Step 4: Done ── */}
            {step === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center text-center py-8 gap-8"
              >
                <div className="relative">
                   <div className="absolute inset-0 bg-green-500 blur-3xl opacity-20" />
                   <div className="w-24 h-24 rounded-full bg-green-500/10 border-2 border-green-500 flex items-center justify-center text-green-500 relative z-10">
                      <CheckCircle size={48} weight="fill" />
                   </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold tracking-tight text-white">Asset Listed</h2>
                  <p className="text-sm text-zinc-500 max-w-xs mx-auto">Your Digital Twin is now live and available for autonomous AI agent trading.</p>
                </div>
                <Link
                  href="/marketplace"
                  className="rounded-2xl bg-white text-black hover:bg-zinc-200 px-10 py-4 text-xs font-bold uppercase tracking-[0.2em] transition-all"
                >
                  Return to Marketplace
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <footer className="max-w-2xl mx-auto w-full px-6 py-12 text-center">
        <p className="text-[10px] font-bold tracking-[0.2em] text-zinc-600 uppercase">
          ARES PROTOCOL • v1.0.4-LOCKED • HKUST BLOCKCHAIN LAB
        </p>
      </footer>
    </main>
  );
}
