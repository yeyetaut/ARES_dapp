"use client";

import { useState, useEffect, useMemo } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Nav } from "@/components/Nav";
import { useTxToast } from "@/hooks/useTxToast";
import {
  ADDRESSES, MOCK_USDC_ABI, VERIFIER_ABI, ESCROW_ABI, DIGITAL_TWIN_ABI, USDC_SCALE, isDeployed,
} from "@/lib/contracts";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ShieldCheck, CheckCircle, Warning, MagnifyingGlass, 
  CircleNotch, Fingerprint, Info, ArrowRight, ListDashes 
} from "@phosphor-icons/react";
import { keccak256, toBytes } from "viem";

// ─── Node status card ─────────────────────────────────────────────────────────

function NodeStatus({ address }: { address: `0x${string}` }) {
  const { data: node, refetch } = useReadContract({
    address: ADDRESSES.verifier,
    abi: VERIFIER_ABI,
    functionName: "getNode",
    args: [address],
  });
  const { data: minStake } = useReadContract({
    address: ADDRESSES.verifier,
    abi: VERIFIER_ABI,
    functionName: "MIN_STAKE",
  });
  const { data: usdcBal } = useReadContract({
    address: ADDRESSES.mockUSDC,
    abi: MOCK_USDC_ABI,
    functionName: "balanceOf",
    args: [address],
  });
  const { data: allowance } = useReadContract({
    address: ADDRESSES.mockUSDC,
    abi: MOCK_USDC_ABI,
    functionName: "allowance",
    args: [address, ADDRESSES.verifier],
  });

  const { writeContract: approve, data: approveTxHash, error: approveErr } = useWriteContract();
  const { isLoading: approving, isSuccess: approved, error: approveTxErr } = useWaitForTransactionReceipt({ hash: approveTxHash });

  const { writeContract: register, data: regTxHash, error: regErr } = useWriteContract();
  const { isLoading: registering, isSuccess: regSuccess, error: regTxErr } = useWaitForTransactionReceipt({
    hash: regTxHash,
  });

  const { writeContract: deregister, data: deregTxHash, error: deregErr } = useWriteContract();
  const { isLoading: deregistering, isSuccess: deregSuccess, error: deregTxErr } = useWaitForTransactionReceipt({
    hash: deregTxHash,
  });

  useTxToast("Approve USDC", approveErr, approved, approveTxErr);
  useTxToast("Register Node", regErr, regSuccess, regTxErr);
  useTxToast("Deregister Node", deregErr, deregSuccess, deregTxErr);

  useEffect(() => {
    if (regSuccess || deregSuccess) refetch();
  }, [regSuccess, deregSuccess, refetch]);

  const stakeUSDC = node ? Number(node.stake) / Number(USDC_SCALE) : 0;
  const minUSDC   = minStake ? Number(minStake) / Number(USDC_SCALE) : 100;
  const needsApproval = !approved && (allowance ?? 0n) < (minStake ?? 0n);

  return (
    <div className="rounded-3xl border border-zinc-900 bg-zinc-900/30 p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-accent/10 border border-accent/20">
             <ShieldCheck size={24} className="text-accent" weight="duotone" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Verifier Protocol</h2>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Node Infrastructure</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight">Status</span>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${node?.active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-zinc-700'}`} />
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
              {node?.active ? 'Operational' : 'Off-line'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-900">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Active Stake</p>
          <p className="text-xl font-mono font-bold text-white">{stakeUSDC.toFixed(2)} <span className="text-xs text-zinc-600 font-bold">USDC</span></p>
        </div>
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-900">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Required Minimum</p>
          <p className="text-xl font-mono font-bold text-white">{minUSDC} <span className="text-xs text-zinc-600 font-bold">USDC</span></p>
        </div>
      </div>

      {!node?.active ? (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-3">
             <Info size={18} className="text-accent mt-0.5" />
             <p className="text-xs text-zinc-500 leading-relaxed">To become a verifier, you must stake at least {minUSDC} USDC as collateral. This stake can be slashed if fraudulent verifications are submitted.</p>
          </div>
          {needsApproval ? (
            <button
              disabled={approving}
              onClick={() =>
                approve({
                  address: ADDRESSES.mockUSDC,
                  abi: MOCK_USDC_ABI,
                  functionName: "approve",
                  args: [ADDRESSES.verifier, minStake ?? 100n * 10n ** 6n],
                })
              }
              className="w-full rounded-2xl bg-accent hover:bg-blue-400 disabled:opacity-20 px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3"
            >
              {approving ? <CircleNotch size={18} className="animate-spin" /> : <ShieldCheck size={18} weight="bold" />}
              {approving ? "Authorizing USDC..." : "Approve Staking Pool"}
            </button>
          ) : (
            <button
              disabled={registering}
              onClick={() =>
                register({
                  address: ADDRESSES.verifier,
                  abi: VERIFIER_ABI,
                  functionName: "registerNode",
                  args: [minStake ?? 100n * 10n ** 6n],
                })
              }
              className="w-full rounded-2xl bg-accent hover:bg-blue-400 disabled:opacity-20 px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3"
            >
              {registering ? <CircleNotch size={18} className="animate-spin" /> : <CheckCircle size={18} weight="bold" />}
              {registering ? "Initializing Node..." : "Join Verifier Network"}
            </button>
          )}
        </div>
      ) : (
        <button
          disabled={deregistering}
          onClick={() =>
            deregister({
              address: ADDRESSES.verifier,
              abi: VERIFIER_ABI,
              functionName: "deregisterNode",
            })
          }
          className="w-full rounded-2xl border border-red-900/50 hover:bg-red-900/10 disabled:opacity-20 px-8 py-4 text-xs font-bold text-red-500 uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3"
        >
          {deregistering ? <CircleNotch size={18} className="animate-spin" /> : <Warning size={18} weight="bold" />}
          {deregistering ? "Withdrawing..." : "Deregister & Exit Network"}
        </button>
      )}
    </div>
  );
}

// ─── Submit verification form ─────────────────────────────────────────────────

function SubmitVerification({ address }: { address: `0x${string}` }) {
  const [escrowId, setEscrowId] = useState("");
  const [nfcTag, setNfcTag]     = useState("");
  const [localErr, setLocalErr] = useState("");

  const { data: nodeInfo } = useReadContract({
    address: ADDRESSES.verifier,
    abi: VERIFIER_ABI,
    functionName: "getNode",
    args: [address],
  });

  const { writeContract: submit, data: submitTxHash, error: submitErr } = useWriteContract();
  const { isLoading: submitting, isSuccess: submitted, error: submitTxErr } = useWaitForTransactionReceipt({
    hash: submitTxHash,
  });

  useTxToast("Submit Verification", submitErr, submitted, submitTxErr);

  // Auto-reset form after success
  useEffect(() => {
    if (submitted) {
      const timer = setTimeout(() => {
        setEscrowId("");
        setNfcTag("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [submitted]);

  function handleSubmit() {
    setLocalErr("");
    if (!escrowId || !nfcTag) {
      setLocalErr("Both Escrow ID and NFC Tag Data are required.");
      return;
    }
    const id = BigInt(escrowId);
    const hash = keccak256(toBytes(nfcTag.trim()));
    
    submit({
        address: ADDRESSES.verifier,
        abi: VERIFIER_ABI,
        functionName: "submitVerification",
        args: [id, hash as `0x${string}`],
    });
  }

  if (!nodeInfo?.active) {
    return (
      <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-950 p-12 text-center flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center text-zinc-700">
           <Fingerprint size={32} weight="duotone" />
        </div>
        <div className="space-y-1">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">Verification Access Locked</h2>
          <p className="text-xs text-zinc-600">Register as an active node first to submit protocol attestations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-zinc-900 bg-zinc-900/30 p-8 md:p-12 flex flex-col gap-10">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Submit Protocol Attestation</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Physically inspect the item, scan its NFC tag, and confirm authenticity on-chain.
          </p>
        </div>
        <div className="p-3 rounded-2xl bg-accent/5 border border-accent/10">
           <Fingerprint size={28} className="text-accent" weight="duotone" />
        </div>
      </div>

      {submitted ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl bg-green-500/10 border border-green-500/20 p-6 flex items-center gap-4 text-green-500"
        >
          <CheckCircle size={32} weight="fill" />
          <div className="space-y-0.5">
            <p className="text-sm font-bold">Verification Confirmed</p>
            <p className="text-[10px] font-medium opacity-80 uppercase tracking-widest">USDC Released • Asset Transferred</p>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Escrow Instance ID</label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 1"
                value={escrowId}
                onChange={e => setEscrowId(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-2xl px-5 py-4 text-sm font-mono text-white focus:border-accent outline-none transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">NFC Tag Data</label>
              <input
                type="text"
                placeholder="Raw tag string seed"
                value={nfcTag}
                onChange={e => setNfcTag(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-2xl px-5 py-4 text-sm font-mono text-white focus:border-accent outline-none transition-colors"
              />
            </div>
          </div>

          {(localErr || submitTxErr) && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
               <Warning size={18} className="text-red-500 mt-0.5" />
               <p className="text-xs text-red-400 leading-relaxed font-bold">{localErr || (submitTxErr as any).message}</p>
            </div>
          )}

          <button
            disabled={submitting}
            onClick={handleSubmit}
            className="w-full rounded-2xl bg-accent hover:bg-blue-400 disabled:opacity-20 px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] transition-all shadow-[0_0_30px_rgba(59,130,246,0.1)] flex items-center justify-center gap-3"
          >
            {submitting ? <CircleNotch size={18} className="animate-spin" /> : <Fingerprint size={18} weight="bold" />}
            {submitting ? "Processing Attestation..." : "Submit Verification"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Pending Escrows ─────────────────────────────────────────────────────────

function PendingEscrows() {
  const { data: escrowCount } = useReadContract({
    address: ADDRESSES.escrow,
    abi: ESCROW_ABI,
    functionName: "escrowCount",
  });

  const escrowIds = useMemo(() => {
    return escrowCount ? Array.from({ length: Number(escrowCount) }, (_, i) => BigInt(i + 1)) : [];
  }, [escrowCount]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ListDashes size={20} className="text-zinc-500" />
        <h2 className="text-sm font-bold text-white uppercase tracking-[0.2em]">Pending Settlement Registry</h2>
      </div>

      {escrowIds.length === 0 ? (
        <div className="p-8 rounded-3xl border border-zinc-900 bg-zinc-950 text-center text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
           No active escrows found in protocol
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {escrowIds.slice().reverse().map(id => (
            <EscrowCard key={id.toString()} id={id} />
          ))}
        </div>
      )}
    </div>
  );
}

function EscrowCard({ id }: { id: bigint }) {
  const { data: rec } = useReadContract({
    address: ADDRESSES.escrow,
    abi: ESCROW_ABI,
    functionName: "getEscrow",
    args: [id],
  });

  const { data: att } = useReadContract({
    address: ADDRESSES.verifier,
    abi: VERIFIER_ABI,
    functionName: "getAttestation",
    args: [id],
  });

  const { data: expectedHash } = useReadContract({
    address: ADDRESSES.digitalTwin,
    abi: DIGITAL_TWIN_ABI,
    functionName: "tokenIdToNfcHash",
    args: [rec?.twinId ?? 0n],
    query: { enabled: !!rec },
  });

  if (!rec || rec.state !== 0 || att?.finalized) return null;

  return (
    <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-900 group hover:border-zinc-700 transition-all">
       <div className="flex justify-between items-start mb-4">
          <div>
             <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Escrow ID</p>
             <p className="text-lg font-mono font-bold text-white">#{id.toString().padStart(3, '0')}</p>
          </div>
          <div className="px-2 py-1 rounded bg-yellow-500/10 border border-yellow-500/20">
             <p className="text-[8px] font-bold text-yellow-500 uppercase tracking-widest">Awaiting Verification</p>
          </div>
       </div>

       <div className="space-y-3 pt-3 border-t border-zinc-800/50">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
             <span className="text-zinc-600">Digital Twin</span>
             <span className="text-zinc-400">ADT #{rec.twinId.toString()}</span>
          </div>
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
             <span className="text-zinc-600">Expected Hash</span>
             <span className="text-zinc-400 font-mono truncate ml-8">{expectedHash?.substring(0, 20)}...</span>
          </div>
       </div>
    </div>
  );
}

// ─── Attestation lookup ───────────────────────────────────────────────────────

function AttestationLookup() {
  const [input, setInput] = useState("");
  const [escrowId, setEscrowId] = useState<bigint | null>(null);

  const { data: att } = useReadContract({
    address: ADDRESSES.verifier,
    abi: VERIFIER_ABI,
    functionName: "getAttestation",
    args: [escrowId ?? 0n],
    query: { enabled: escrowId !== null && escrowId > 0n },
  });

  return (
    <div className="rounded-3xl border border-zinc-900 bg-zinc-900/30 p-8 flex flex-col gap-6">
      <div className="flex items-center gap-2">
         <MagnifyingGlass size={20} className="text-zinc-500" />
         <h2 className="text-sm font-bold text-white uppercase tracking-[0.2em]">Attestation Explorer</h2>
      </div>

      <div className="flex gap-3">
        <input
          type="number"
          min="1"
          placeholder="Enter Escrow ID"
          value={input}
          onChange={e => setInput(e.target.value)}
          className="flex-1 bg-black border border-zinc-800 rounded-2xl px-5 py-3 text-xs font-mono text-white focus:border-accent outline-none transition-colors"
        />
        <button
          onClick={() => setEscrowId(input ? BigInt(input) : null)}
          className="rounded-2xl bg-zinc-800 hover:bg-zinc-700 px-6 py-3 text-[10px] font-bold text-white uppercase tracking-widest transition-colors"
        >
          Query Registry
        </button>
      </div>

      {att && escrowId !== null && (
        <div className="rounded-2xl bg-zinc-950 border border-zinc-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Protocol Status</span>
            <span className={`rounded-full px-3 py-1 text-[8px] font-bold uppercase tracking-widest ${att.finalized ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"}`}>
              {att.finalized ? "Authenticated" : "Unverified"}
            </span>
          </div>
          {att.finalized && (
            <div className="space-y-3 pt-3 border-t border-zinc-900">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block">Attesting Node</span>
                <span className="font-mono text-xs text-white block truncate">{att.node}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block">Proof Hash (NFC)</span>
                <span className="font-mono text-[10px] text-zinc-400 block break-all leading-relaxed">{att.nfcHash}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VerifyPage() {
  const { address } = useAccount();

  if (!isDeployed(ADDRESSES.verifier)) {
    return (
      <main className="flex flex-col min-h-screen bg-zinc-950">
        <Nav />
        <div className="flex-1 flex flex-col items-center justify-center gap-6 text-zinc-600">
          <Warning size={48} weight="duotone" />
          <p className="text-sm font-bold uppercase tracking-widest">Verifier System Offline</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen bg-zinc-950 text-white">
      <Nav />

      <div className="flex-1 px-6 py-12 max-w-4xl w-full mx-auto flex flex-col gap-12">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-accent text-[10px] font-bold tracking-[0.2em] uppercase mb-2">
              <Fingerprint size={14} />
              DePIN Network Active
          </div>
          <h1 className="text-4xl font-bold tracking-tighter">Asset Authentication</h1>
          <p className="text-sm text-zinc-500 max-w-md">
            Stake collateral to join the decentralized physical infrastructure network. 
            Authenticate collectibles to finalize agent settlements.
          </p>
        </div>

        {!address ? (
          <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-950 p-16 text-center">
             <p className="text-zinc-600 text-sm font-medium uppercase tracking-widest mb-8">Connect hardware wallet to access verifier node</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-8">
               <NodeStatus address={address} />
               <AttestationLookup />
            </div>
            <div className="lg:col-span-8 space-y-12">
               <SubmitVerification address={address} />
               <PendingEscrows />
            </div>
          </div>
        )}
      </div>

      <footer className="max-w-4xl mx-auto w-full px-6 py-12 border-t border-zinc-900 text-center">
        <p className="text-[10px] font-bold tracking-[0.2em] text-zinc-600 uppercase">
          ARES PROTOCOL • HKUST BLOCKCHAIN LAB • v1.0.4-LOCKED
        </p>
      </footer>
    </main>
  );
}
