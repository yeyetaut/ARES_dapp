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
  CircleNotch, Fingerprint, Info, ArrowRight, ListDashes,
  Pulse, Broadcast, HardDrive, Cpu, Terminal as TerminalIcon,
  Key, SealCheck
} from "@phosphor-icons/react";
import { keccak256, toBytes } from "viem";
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

// ─── Node Status Module ──────────────────────────────────────────────────────

function NodeControlCenter({ address }: { address: `0x${string}` }) {
  const { data: node, refetch } = useReadContract({
    address: ADDRESSES.verifier,
    abi: VERIFIER_ABI,
    functionName: "getNode",
    args: [address],
  });
  const { data: minStake } = useReadContract({ address: ADDRESSES.verifier, abi: VERIFIER_ABI, functionName: "MIN_STAKE" });
  const { data: allowance } = useReadContract({ address: ADDRESSES.mockUSDC, abi: MOCK_USDC_ABI, functionName: "allowance", args: [address, ADDRESSES.verifier] });

  const { writeContract: approve, data: approveTxHash, error: approveErr } = useWriteContract();
  const { isLoading: approving, isSuccess: approved, error: approveTxErr } = useWaitForTransactionReceipt({ hash: approveTxHash });

  const { writeContract: register, data: regTxHash, error: regErr } = useWriteContract();
  const { isLoading: registering, isSuccess: regSuccess, error: regTxErr } = useWaitForTransactionReceipt({ hash: regTxHash });

  useTxToast("Auth USDC", approveErr, approved, approveTxErr);
  useTxToast("Init Node", regErr, regSuccess, regTxErr);

  useEffect(() => { if (regSuccess) refetch(); }, [regSuccess, refetch]);

  const stakeUSDC = node ? Number(node.stake) / Number(USDC_SCALE) : 0;
  const minUSDC   = minStake ? Number(minStake) / Number(USDC_SCALE) : 100;
  const needsApproval = !approved && (allowance ?? 0n) < (minStake ?? 0n);

  return (
    <div className="flex flex-col gap-px bg-zinc-900 border border-zinc-900 overflow-hidden shadow-2xl">
       <div className="bg-black p-6 flex justify-between items-center border-b border-zinc-900">
          <div className="flex items-center gap-3">
             <div className={`w-2 h-2 rounded-full animate-pulse ${node?.active ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-zinc-800'}`} />
             <span className="text-[10px] font-mono font-bold tracking-[0.3em] uppercase text-zinc-400">Node Uplink Status</span>
          </div>
          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 border ${node?.active ? 'border-green-900 text-green-500 bg-green-500/5' : 'border-zinc-800 text-zinc-600'}`}>
            {node?.active ? 'OPERATIONAL' : 'DEACTIVATED'}
          </span>
       </div>
       
       <div className="grid grid-cols-2 bg-zinc-900 gap-px">
          <TelemetryBox label="Active Stake" value={stakeUSDC.toFixed(0)} unit="USDC" status={node?.active ? 'active' : 'dim'} />
          <TelemetryBox label="Protocol Min" value={minUSDC.toString()} unit="USDC" status="dim" />
       </div>

       {!node?.active && (
         <div className="bg-black p-6 space-y-6">
            <div className="p-4 border border-blue-900/30 bg-blue-500/5 flex gap-4">
               <Broadcast size={20} className="text-blue-500 shrink-0" />
               <p className="text-[10px] font-mono text-zinc-500 leading-relaxed uppercase tracking-wider">
                  Registration required for network participation. Min stake: {minUSDC} USDC.
               </p>
            </div>
            {needsApproval ? (
              <button
                disabled={approving}
                onClick={() => approve({ address: ADDRESSES.mockUSDC, abi: MOCK_USDC_ABI, functionName: "approve", args: [ADDRESSES.verifier, minStake ?? 100n * 10n ** 6n] })}
                className="w-full h-14 bg-blue-600 text-white font-bold text-[11px] tracking-[0.3em] uppercase hover:bg-blue-500 transition-all active:scale-[0.98] disabled:opacity-30"
              >
                {approving ? <CircleNotch size={20} className="animate-spin mx-auto" /> : "Authorize Protocol"}
              </button>
            ) : (
              <button
                disabled={registering}
                onClick={() => register({ address: ADDRESSES.verifier, abi: VERIFIER_ABI, functionName: "registerNode", args: [minStake ?? 100n * 10n ** 6n] })}
                className="w-full h-14 bg-green-600 text-white font-bold text-[11px] tracking-[0.3em] uppercase hover:bg-green-500 transition-all active:scale-[0.98] disabled:opacity-30"
              >
                {registering ? <CircleNotch size={20} className="animate-spin mx-auto" /> : "Initialize Uplink"}
              </button>
            )}
         </div>
       )}
    </div>
  );
}

// ─── Attestation Terminal Module ─────────────────────────────────────────────

function AttestationTerminal({ address, initialEscrowId, initialSeed }: { address: `0x${string}`, initialEscrowId?: string, initialSeed?: string }) {
  const [escrowId, setEscrowId] = useState(initialEscrowId || "");
  const [nfcTag, setNfcTag]     = useState(initialSeed || "");

  // Sync with props when Quick Verify is clicked
  useEffect(() => { if (initialEscrowId) setEscrowId(initialEscrowId); }, [initialEscrowId]);
  useEffect(() => { if (initialSeed) setNfcTag(initialSeed); }, [initialSeed]);

  const { writeContract: submit, data: submitTxHash, error: submitErr } = useWriteContract();
  const { isLoading: submitting, isSuccess: submitted, error: submitTxErr } = useWaitForTransactionReceipt({ hash: submitTxHash });

  useTxToast("Attestation", submitErr, submitted, submitTxErr);

  // Auto-reset form after success
  useEffect(() => {
    if (submitted) {
      const timer = setTimeout(() => { setEscrowId(""); setNfcTag(""); }, 4000);
      return () => clearTimeout(timer);
    }
  }, [submitted]);

  const handleSubmit = () => {
    if (!escrowId || !nfcTag) {
      toast.error("MISSING TELEMETRY DATA");
      return;
    }
    submit({
        address: ADDRESSES.verifier,
        abi: VERIFIER_ABI,
        functionName: "submitVerification",
        args: [BigInt(escrowId), keccak256(toBytes(nfcTag.trim())) as `0x${string}`],
    });
  };

  return (
    <div className="bg-zinc-950 border border-zinc-900 p-8 flex flex-col gap-8 shadow-2xl relative overflow-hidden group">
      {/* Visual background element */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 border-l border-b border-zinc-800 pointer-events-none" />

      <div className="flex justify-between items-start relative z-10">
         <div>
            <h3 className="text-2xl font-bold tracking-tighter uppercase italic flex items-center gap-3">
               <Fingerprint size={28} className="text-accent" />
               Attestation Terminal
            </h3>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Status: Ready for input synchronization</p>
         </div>
         <div className="flex flex-col items-end gap-1 font-mono text-[9px] text-zinc-700">
            <span>SYS_ID / 0x4A6B</span>
            <span>REPUTATION / SYNCED</span>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-zinc-900 border border-zinc-900 relative z-10">
         <div className="bg-black p-6 space-y-2">
            <label className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-[0.2em]">Target Escrow ID</label>
            <input
              type="number"
              value={escrowId}
              onChange={e => setEscrowId(e.target.value)}
              placeholder="000"
              className="w-full bg-transparent text-xl font-bold font-mono text-white outline-none placeholder:text-zinc-800"
            />
         </div>
         <div className="bg-black p-6 space-y-2">
            <label className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-[0.2em]">NFC Payload Seed</label>
            <input
              type="text"
              value={nfcTag}
              onChange={e => setNfcTag(e.target.value)}
              placeholder="RAW_STRING_DATA"
              className="w-full bg-transparent text-xl font-bold font-mono text-white outline-none placeholder:text-zinc-800"
            />
         </div>
      </div>

      {submitted ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 border border-green-900 bg-green-500/5 text-center relative z-10">
           <SealCheck size={40} className="text-green-500 mx-auto mb-4" weight="fill" />
           <p className="text-[11px] font-mono font-bold text-green-500 tracking-[0.3em] uppercase">Authentication Finalized</p>
           <p className="text-[9px] font-mono text-green-700 uppercase mt-2">Assets and capital successfully settled in protocol</p>
        </motion.div>
      ) : (
        <button
          disabled={submitting}
          onClick={handleSubmit}
          className="relative z-10 w-full h-16 bg-accent hover:bg-blue-400 text-white font-bold text-[12px] tracking-[0.4em] uppercase transition-all active:translate-y-px disabled:opacity-20 group"
        >
          {submitting ? (
            <div className="flex items-center justify-center gap-3">
               <CircleNotch size={20} className="animate-spin" />
               <span>Executing Attestation...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3">
               <span>Submit Proof of Authenticity</span>
               <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
            </div>
          )}
        </button>
      )}

      {submitTxErr && (
        <div className="p-4 border border-red-900 bg-red-950/20 flex gap-4 relative z-10">
           <Warning size={20} className="text-red-500 shrink-0" />
           <div className="space-y-1">
              <p className="text-[10px] font-mono font-bold text-red-500 uppercase tracking-widest">Protocol Revert Detected</p>
              <p className="text-[9px] font-mono text-red-400/70 break-all">{(submitTxErr as any).message}</p>
           </div>
        </div>
      )}
    </div>
  );
}

// ─── Pending Registry Module ─────────────────────────────────────────────────

function PendingRegistry({ onSelect }: { onUpdate?: () => void, onSelect: (id: string) => void }) {
  const { data: escrowCount } = useReadContract({ address: ADDRESSES.escrow, abi: ESCROW_ABI, functionName: "escrowCount" });
  const escrowIds = useMemo(() => {
    return escrowCount ? Array.from({ length: Number(escrowCount) }, (_, i) => BigInt(i + 1)) : [];
  }, [escrowCount]);

  return (
    <div className="space-y-6">
      <SectionHeader title="Settlement Queue" subtitle="Registry of active escrows awaiting node verification" icon={ListDashes} />
      
      {escrowIds.length === 0 ? (
        <div className="border border-dashed border-zinc-800 p-12 text-center text-[10px] font-mono text-zinc-600 uppercase tracking-[0.3em]">
           // NO ACTIVE PROTOCOL INSTANCES DETECTED
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-px bg-zinc-900 border border-zinc-900">
           {escrowIds.slice().reverse().map(id => (
             <EscrowRecord key={id.toString()} id={id} onSelect={onSelect} />
           ))}
        </div>
      )}
    </div>
  );
}

function EscrowRecord({ id, onSelect }: { id: bigint, onSelect: (id: string) => void }) {
  const { data: rec } = useReadContract({ address: ADDRESSES.escrow, abi: ESCROW_ABI, functionName: "getEscrow", args: [id] });
  const { data: att } = useReadContract({ address: ADDRESSES.verifier, abi: VERIFIER_ABI, functionName: "getAttestation", args: [id] });
  const { data: expectedHash } = useReadContract({ address: ADDRESSES.digitalTwin, abi: DIGITAL_TWIN_ABI, functionName: "tokenIdToNfcHash", args: [rec?.twinId ?? 0n], query: { enabled: !!rec } });

  if (!rec || rec.state !== 0 || att?.finalized) return null;

  return (
    <div className="bg-black p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:bg-zinc-950 transition-colors">
       <div className="flex items-center gap-6">
          <div className="w-12 h-12 flex flex-col items-center justify-center border border-zinc-800 bg-zinc-900/50 group-hover:border-accent transition-colors">
             <span className="text-[8px] font-mono text-zinc-600 font-bold uppercase">ID</span>
             <span className="text-sm font-bold font-mono text-zinc-300">#{id.toString().padStart(2, '0')}</span>
          </div>
          <div className="space-y-1">
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">ADT #{rec.twinId.toString()}</span>
                <span className="text-[8px] font-mono px-1.5 py-0.5 border border-yellow-900 text-yellow-600 uppercase">Awaiting Proof</span>
             </div>
             <p className="text-[9px] font-mono text-zinc-600 truncate max-w-[200px] uppercase">Hash: {expectedHash?.substring(0, 32)}...</p>
          </div>
       </div>

       <div className="flex items-center gap-8">
          <div className="hidden lg:flex flex-col items-end gap-1 font-mono text-[9px]">
             <span className="text-zinc-600 font-bold">Buyer: {rec.buyer.substring(0, 8)}...</span>
             <span className="text-zinc-600 font-bold">Seller: {rec.seller.substring(0, 8)}...</span>
          </div>
          <button 
            onClick={() => onSelect(id.toString())}
            className="h-10 px-6 bg-zinc-900 border border-zinc-800 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:border-accent hover:bg-accent/10 transition-all"
          >
            Load into Terminal
          </button>
       </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function VerifyPage() {
  const { address } = useAccount();
  const [activeEscrowId, setActiveEscrowId] = useState("");

  if (!isDeployed(ADDRESSES.verifier)) {
    return (
      <main className="flex flex-col min-h-screen bg-black">
        <Nav />
        <div className="flex-1 flex flex-col items-center justify-center font-mono p-12">
           <div className="border border-red-900 bg-red-950/20 p-8 flex flex-col items-center gap-6">
              <Warning size={64} className="text-red-500" weight="fill" />
              <div className="text-center">
                 <h2 className="text-lg font-bold text-red-500 uppercase tracking-[0.4em] mb-2">Protocol Critical Failure</h2>
                 <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest">VERIFIER SERVICE IS NOT DETECTED ON TARGET NETWORK</p>
              </div>
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
               <span>Active Telemetry Uplink</span>
               <Heartbeat />
            </div>
            <h1 className="text-5xl font-bold tracking-tighter uppercase italic leading-[0.8] mb-4">
               Physical <br/> Verification
            </h1>
            <p className="text-zinc-500 font-mono text-[10px] max-w-sm uppercase tracking-widest leading-relaxed">
               Secure protocol for Decentralized Physical Infrastructure (DePIN). Stake USDC to provide node attestations and settle autonomous trade cycles.
            </p>
          </div>
          <div className="flex items-center gap-6 font-mono text-[10px] text-zinc-600 uppercase font-bold tracking-widest">
             <div className="flex flex-col items-end">
                <span>Protocol Version</span>
                <span className="text-white">v1.0.4 / CRT</span>
             </div>
             <div className="w-px h-10 bg-zinc-900" />
             <div className="flex flex-col items-end">
                <span>Network Node</span>
                <span className="text-white">Sepolia / D-01</span>
             </div>
          </div>
        </div>

        {!address ? (
          <div className="border border-zinc-900 bg-zinc-950 p-20 text-center flex flex-col items-center gap-8">
             <div className="w-16 h-16 border border-zinc-800 flex items-center justify-center text-zinc-700">
                <Key size={32} weight="duotone" />
             </div>
             <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.3em]">Hardware authorization required to access terminal</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-zinc-900 border border-zinc-900 shadow-2xl">
            <div className="lg:col-span-4 flex flex-col gap-px bg-zinc-900">
               <div className="bg-black p-px">
                  <NodeControlCenter address={address} />
               </div>
               <div className="bg-black p-8 flex-1 flex flex-col gap-8">
                  <SectionHeader title="Query Engine" subtitle="Lookup attestation records in registry" icon={MagnifyingGlass} />
                  <div className="flex gap-2">
                     <input
                        type="number"
                        placeholder="000"
                        className="w-16 bg-zinc-900 border border-zinc-800 p-3 font-mono text-xs outline-none focus:border-accent text-center"
                     />
                     <button className="flex-1 bg-zinc-900 border border-zinc-800 text-[9px] font-bold uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-zinc-800">
                        Query Registry
                     </button>
                  </div>
                  <div className="p-4 border border-zinc-900 bg-zinc-950/50 text-[9px] font-mono text-zinc-700 uppercase tracking-widest">
                     // Ready for registry lookup operations...
                  </div>
               </div>
            </div>
            <div className="lg:col-span-8 bg-black flex flex-col gap-px p-px">
               <div className="p-8 md:p-12">
                  <AttestationTerminal address={address} initialEscrowId={activeEscrowId} />
               </div>
               <div className="p-8 md:p-12 border-t border-zinc-900">
                  <PendingRegistry onSelect={(id) => {
                     setActiveEscrowId(id);
                     // Scroll to terminal for mobile
                     window.scrollTo({ top: 0, behavior: 'smooth' });
                  }} />
               </div>
            </div>
          </div>
        )}
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
