"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Nav } from "@/components/Nav";
import { useTxToast } from "@/hooks/useTxToast";
import { 
  ADDRESSES, MARKETPLACE_ABI, ESCROW_ABI, MOCK_USDC_ABI, DIGITAL_TWIN_ABI,
  VERIFIER_ABI, ESCROW_STATE, USDC_SCALE, isDeployed,
} from "@/lib/contracts";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Tag, User, ArrowsOutSimple, Cube, Cpu, Pulse, 
  ShieldCheck, Coins, CheckCircle, CircleNotch, Info, 
  ArrowRight, Key, Warning, SealCheck, ArrowLeft, Fingerprint
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

// ─── Buy button ───────────────────────────────────────────────────────────────

function EscrowBadge({ state }: { state: number }) {
  const styles: Record<number, string> = {
    0: "bg-yellow-900/50 text-yellow-300",
    1: "bg-green-900/50 text-green-300",
    2: "bg-blue-900/50 text-blue-300",
    3: "bg-red-900/50 text-red-300",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles[state] ?? ""}`}>
      {ESCROW_STATE[state as keyof typeof ESCROW_STATE] ?? "Unknown"}
    </span>
  );
}

// ─── Buy button ───────────────────────────────────────────────────────────────

function BuyButton({ listingId, price }: { listingId: bigint; price: bigint }) {
  const { address } = useAccount();

  const { data: allowance } = useReadContract({
    address: ADDRESSES.mockUSDC,
    abi: MOCK_USDC_ABI,
    functionName: "allowance",
    args: [address ?? "0x0", ADDRESSES.escrow],
    query: { enabled: !!address },
  });

  const needsApproval = (allowance ?? 0n) < price;

  const { writeContract: approve, data: approveTxHash, error: approveErr } = useWriteContract();
  const { isLoading: approving, isSuccess: approved, error: approveTxErr } = useWaitForTransactionReceipt({ hash: approveTxHash });
  useTxToast("Approve USDC", approveErr, approved, approveTxErr);

  const { writeContract: buy, data: buyTxHash, error: buyErr } = useWriteContract();
  const { isLoading: buying, isSuccess: bought, error: buyTxErr } = useWaitForTransactionReceipt({ hash: buyTxHash });
  useTxToast("Purchase", buyErr, bought, buyTxErr);

  if (!address) {
    return (
      <div className="p-6 border border-zinc-900 bg-zinc-950/50 text-center space-y-4">
         <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em]">Hardware Authorization Required</p>
      </div>
    );
  }

  if (bought) {
    return (
      <div className="p-6 border border-green-900 bg-green-500/5 text-center">
         <SealCheck size={32} className="text-green-500 mx-auto mb-3" weight="fill" />
         <p className="text-[10px] font-mono font-bold text-green-500 tracking-[0.2em] uppercase">Liquidity Locked In Escrow</p>
      </div>
    );
  }

  if (needsApproval && !approved) {
    return (
      <button
        disabled={approving}
        onClick={() =>
          approve({
            address: ADDRESSES.mockUSDC,
            abi: MOCK_USDC_ABI,
            functionName: "approve",
            args: [ADDRESSES.escrow, price],
          })
        }
        className="w-full h-16 bg-accent hover:bg-blue-400 text-white font-bold text-[12px] tracking-[0.4em] uppercase transition-all active:translate-y-px disabled:opacity-20 flex items-center justify-center gap-4"
      >
        {approving ? <CircleNotch size={20} className="animate-spin" /> : <Coins size={20} weight="bold" />}
        {approving ? "Authorizing USDC..." : "Approve Liquidity"}
      </button>
    );
  }

  return (
    <button
      disabled={buying}
      onClick={() =>
        buy({
          address: ADDRESSES.marketplace,
          abi: MARKETPLACE_ABI,
          functionName: "buyItem",
          args: [listingId],
        })
      }
      className="w-full h-16 bg-accent hover:bg-blue-400 text-white font-bold text-[12px] tracking-[0.4em] uppercase transition-all active:translate-y-px disabled:opacity-20 flex items-center justify-center gap-4 shadow-[0_0_30px_rgba(59,130,246,0.2)]"
    >
      {buying ? <CircleNotch size={20} className="animate-spin" /> : <ArrowsOutSimple size={20} weight="bold" />}
      {buying ? "Executing Swap..." : "Finalize Purchase"}
    </button>
  );
}

// ─── Verification panel ───────────────────────────────────────────────────────

function VerificationPanel({ escrowId }: { escrowId: bigint }) {
  const { address } = useAccount();
  const [nfcTag, setNfcTag] = useState("");

  const { data: att } = useReadContract({
    address: ADDRESSES.verifier,
    abi: VERIFIER_ABI,
    functionName: "getAttestation",
    args: [escrowId],
    query: { enabled: isDeployed(ADDRESSES.verifier) },
  });

  const { data: nodeInfo } = useReadContract({
    address: ADDRESSES.verifier,
    abi: VERIFIER_ABI,
    functionName: "getNode",
    args: [address ?? "0x0"],
    query: { enabled: !!address && isDeployed(ADDRESSES.verifier) },
  });

  const { writeContract: submit, data: submitTxHash, error: submitErr } = useWriteContract();
  const { isLoading: submitting, isSuccess: submitted, error: submitTxErr } = useWaitForTransactionReceipt({ hash: submitTxHash });
  useTxToast("Verification", submitErr, submitted, submitTxErr);

  function handleVerify() {
    if (!nfcTag) return;
    import("viem").then(({ keccak256, toBytes }) => {
      const hash = keccak256(toBytes(nfcTag));
      submit({
        address: ADDRESSES.verifier,
        abi: VERIFIER_ABI,
        functionName: "submitVerification",
        args: [escrowId, hash as `0x${string}`],
      });
    });
  }

  if (!isDeployed(ADDRESSES.verifier)) return null;

  return (
    <div className="bg-zinc-950 border border-zinc-900 p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden">
      <div className="flex justify-between items-start">
         <div>
            <h3 className="text-xl font-bold tracking-tighter uppercase italic flex items-center gap-3">
               <Fingerprint size={24} className="text-accent" />
               Attestation Module
            </h3>
            <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mt-1">Status: {att?.finalized ? 'AUTHENTICATED' : 'SYNC_REQUIRED'}</p>
         </div>
      </div>

      {att?.finalized ? (
        <div className="space-y-4">
           <div className="p-4 border border-green-900 bg-green-500/5 flex gap-4">
              <SealCheck size={20} className="text-green-500 shrink-0" />
              <div className="space-y-1">
                 <p className="text-[10px] font-mono font-bold text-green-500 uppercase">Hardware Attestation Confirmed</p>
                 <p className="text-[9px] font-mono text-green-700/70 truncate uppercase tracking-tighter">NODE_ID: {att.node}</p>
              </div>
           </div>
        </div>
      ) : nodeInfo?.active && !submitted ? (
        <div className="space-y-6">
          <div className="bg-black border border-zinc-900 p-6 space-y-2">
             <label className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-[0.2em]">NFC Payload Seed</label>
             <input
               type="text"
               value={nfcTag}
               onChange={e => setNfcTag(e.target.value)}
               placeholder="RAW_STRING_DATA"
               className="w-full bg-transparent text-xl font-bold font-mono text-white outline-none placeholder:text-zinc-800"
             />
          </div>
          <button
            disabled={submitting || !nfcTag}
            onClick={handleVerify}
            className="w-full h-14 bg-accent hover:bg-blue-400 text-white font-bold text-[11px] tracking-[0.3em] uppercase transition-all active:scale-[0.98] disabled:opacity-20 flex items-center justify-center gap-3"
          >
            {submitting ? <CircleNotch size={18} className="animate-spin" /> : <ArrowRight size={18} />}
            {submitting ? "Processing..." : "Submit Proof of Authenticity"}
          </button>
        </div>
      ) : submitted ? (
        <div className="p-4 border border-green-900 bg-green-500/5 text-center">
           <p className="text-[10px] font-mono font-bold text-green-500 uppercase">Synchronization Successful</p>
        </div>
      ) : (
        <div className="p-4 border border-zinc-900 bg-zinc-950/50 flex gap-4">
           <Info size={20} className="text-zinc-700" />
           <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest leading-relaxed">
              ONLY_AUTHORIZED_DEPIN_NODES_CAN_EXECUTE_ATTESTATION. <Link href="/verify" className="text-accent hover:underline">REGISTER_NODE {">>>"}</Link>
           </p>
        </div>
      )}
    </div>
  );
}

// ─── Item detail page ─────────────────────────────────────────────────────────

export default function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const listingId = BigInt(id);
  const { address } = useAccount();

  const { data: listing, isLoading: loadingListing } = useReadContract({
    address: ADDRESSES.marketplace,
    abi: MARKETPLACE_ABI,
    functionName: "getListing",
    args: [listingId],
  });

  const { data: tokenURI } = useReadContract({
    address: ADDRESSES.digitalTwin,
    abi: DIGITAL_TWIN_ABI,
    functionName: "tokenURI",
    args: [listing?.twinId ?? 0n],
    query: { enabled: !!listing && listing.twinId > 0n },
  });

  // escrowId lookup: Marketplace stores escrowListing[escrowId] → listingId (not reverse).
  // We read total escrow count then batch-check the last few IDs to find a match.
  const [escrowIdOverride, setEscrowIdOverride] = useState<string>("");

  const { data: escrowCount } = useReadContract({
    address: ADDRESSES.escrow,
    abi: ESCROW_ABI,
    functionName: "escrowCount",
  });

  // Try up to the last 20 escrows to find one that maps to this listingId
  const escrowCheckIds = useMemo(() => {
    return escrowCount
      ? Array.from({ length: Math.min(Number(escrowCount), 20) }, (_, i) => escrowCount - BigInt(i))
      : [];
  }, [escrowCount]);

  const { data: escrowMappings } = useReadContracts({
    contracts: escrowCheckIds.map(eid => ({
      address: ADDRESSES.marketplace,
      abi: MARKETPLACE_ABI,
      functionName: "escrowListing" as const,
      args: [eid] as const,
    })),
    query: { enabled: escrowCheckIds.length > 0 },
  });

  const resolvedEscrowId: bigint | undefined = escrowIdOverride
    ? BigInt(escrowIdOverride)
    : escrowMappings
        ?.map((r, i) => ({ result: r.result as bigint | undefined, id: escrowCheckIds[i] }))
        .find(({ result }) => result === listingId)?.id;

  const isSeller = address?.toLowerCase() === listing?.seller.toLowerCase();
  const priceUSDC = listing ? listing.price / USDC_SCALE : 0n;

  const { writeContract: cancel, data: cancelTxHash, error: cancelErr } = useWriteContract();
  const { isLoading: cancelling, isSuccess: cancelled, error: cancelTxErr } = useWaitForTransactionReceipt({ hash: cancelTxHash });
  useTxToast("Cancel Listing", cancelErr, cancelled, cancelTxErr);

  if (!isDeployed(ADDRESSES.marketplace)) {
    return (
      <main className="flex flex-col min-h-screen">
        <Nav />
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Contracts not deployed.
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen">
      <Nav />

      <div className="px-6 py-4 text-sm text-gray-500">
        <Link href="/marketplace" className="hover:text-white transition-colors">← Marketplace</Link>
      </div>

      {loadingListing ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">Loading…</div>
      ) : !listing ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">Listing not found.</div>
      ) : (
        <div className="flex-1 px-6 py-6 max-w-4xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: image placeholder */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 flex items-center justify-center h-80 md:h-auto text-6xl">
            🏷️
          </div>

          {/* Right: details */}
          <div className="flex flex-col gap-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">Digital Twin #{listing.twinId.toString()}</h1>
                {!listing.active && (
                  <span className="rounded bg-gray-800 text-gray-400 px-2 py-0.5 text-xs">Inactive</span>
                )}
              </div>
              <p className="text-xs text-gray-500">Listing #{id}</p>
            </div>

            {tokenURI && (
              <div className="rounded-lg bg-gray-900 border border-gray-800 px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">Metadata URI</p>
                <p className="text-sm text-indigo-300 break-all">{tokenURI}</p>
              </div>
            )}

            <div className="rounded-lg bg-gray-900 border border-gray-800 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Price</p>
                <p className="text-2xl font-bold">{priceUSDC.toString()} <span className="text-sm text-gray-400">USDC</span></p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">Seller</p>
                <p className="text-sm font-mono text-gray-300">
                  {listing.seller.slice(0, 8)}…{listing.seller.slice(-6)}
                </p>
              </div>
            </div>

            {listing.active && !isSeller && (
              <BuyButton listingId={listingId} price={listing.price} />
            )}

            {listing.active && isSeller && !cancelled && (
              <button
                disabled={cancelling}
                onClick={() =>
                  cancel({
                    address: ADDRESSES.marketplace,
                    abi: MARKETPLACE_ABI,
                    functionName: "cancelListing",
                    args: [listingId],
                  })
                }
                className="w-full rounded-lg border border-red-800 hover:bg-red-900/30 disabled:opacity-50 px-4 py-3 text-sm font-semibold text-red-400 transition-colors"
              >
                {cancelling ? "Cancelling…" : "Cancel Listing"}
              </button>
            )}

            {cancelled && (
              <p className="text-sm text-gray-400">Listing cancelled. NFT returned to your wallet.</p>
            )}

            {!listing.active && !isSeller && (
              <p className="text-sm text-gray-500">This listing is no longer active.</p>
            )}

            {/* Phase 3: verification panel for sold listings */}
            {!listing.active && (
              resolvedEscrowId
                ? <VerificationPanel escrowId={resolvedEscrowId} />
                : (
                  <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 flex flex-col gap-2">
                    <p className="text-xs text-gray-500">Enter escrow ID to check verification status:</p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        placeholder="Escrow ID"
                        value={escrowIdOverride}
                        onChange={e => setEscrowIdOverride(e.target.value)}
                        className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-xs font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )
            )}
          </div>
        </div>
      )}

      <footer className="px-6 py-6 border-t border-gray-800 text-center text-xs text-gray-600 mt-auto">
        ARES — HKUST Blockchain Lab · Sepolia Testnet · MIT License
      </footer>
    </main>
  );
}
