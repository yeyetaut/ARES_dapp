"use client";

import Link from "next/link";
import { useReadContract } from "wagmi";
import { useMemo } from "react";
import { Nav } from "@/components/Nav";
import { ADDRESSES, MARKETPLACE_ABI, DIGITAL_TWIN_ABI, USDC_SCALE, isDeployed } from "@/lib/contracts";
import { motion } from "framer-motion";
import { Tag, User, ArrowsOutSimple, Cube, Cpu } from "@phosphor-icons/react";

// ─── Listing card ─────────────────────────────────────────────────────────────

function ListingCard({ listingId, index }: { listingId: bigint, index: number }) {
  const { data: listing } = useReadContract({
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
    query: { enabled: listing != null && listing.twinId > 0n },
  });

  if (!listing || !listing.active) return null;

  const priceUSDC = listing.price / USDC_SCALE;
  const sellerShort = listing.seller.slice(0, 6) + "…" + listing.seller.slice(-4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link
        href={`/marketplace/${listingId}`}
        className="group relative block rounded-2xl border border-zinc-900 bg-zinc-950 hover:border-accent/50 transition-all duration-300 overflow-hidden"
      >
        {/* Visual Header */}
        <div className="aspect-[4/3] bg-zinc-900 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <Cube size={64} weight="duotone" className="text-zinc-800 group-hover:text-accent/40 transition-colors duration-500" />
          <div className="absolute top-3 right-3">
             <span className="text-[10px] font-mono font-bold bg-black/60 backdrop-blur-md border border-zinc-800 text-zinc-400 px-2 py-1 rounded">
                ID_{listingId.toString().padStart(3, '0')}
             </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <Tag size={14} className="text-accent" />
            </div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Digital Twin #{listing.twinId.toString()}
            </h3>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Current Price</p>
              <p className="text-xl font-mono font-bold text-white">
                {priceUSDC.toString()}<span className="text-xs text-zinc-500 ml-1">USDC</span>
              </p>
            </div>
            <div className="text-right">
               <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Provider</p>
               <div className="flex items-center gap-1.5 justify-end">
                  <User size={12} className="text-zinc-500" />
                  <span className="text-[10px] font-mono text-zinc-400">{sellerShort}</span>
               </div>
            </div>
          </div>
        </div>
        
        {/* Interaction Hint */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-accent transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500" />
      </Link>
    </motion.div>
  );
}

// ─── Browse page ──────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const { data: count, isLoading } = useReadContract({
    address: ADDRESSES.marketplace,
    abi: MARKETPLACE_ABI,
    functionName: "listingCount",
  });

  const contractsDeployed = isDeployed(ADDRESSES.marketplace);

  const listingIds: bigint[] = useMemo(() => {
    return count
      ? Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1))
      : [];
  }, [count]);

  return (
    <main className="flex flex-col min-h-[100dvh] bg-zinc-950">
      <Nav />

      {/* Header */}
      <section className="max-w-[1400px] mx-auto w-full px-6 py-12 md:py-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-zinc-900 pb-12">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-accent text-[10px] font-bold tracking-[0.2em] uppercase mb-4">
              <ArrowsOutSimple size={14} />
              Global Exchange
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-4">
              Marketplace
            </h1>
            <p className="text-zinc-500 text-sm md:text-base leading-relaxed font-medium">
              A verifiable registry of physical assets mapped to the Ethereum mainnet. 
              Filter by reputation, liquidity, or NFC provenance.
            </p>
          </div>
          <Link
            href="/marketplace/list"
            className="inline-flex items-center justify-center rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white hover:bg-blue-400 transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)]"
          >
            List Asset
          </Link>
        </div>
      </section>

      {/* Grid */}
      <section className="flex-1 max-w-[1400px] mx-auto w-full px-6 pb-24">
        {!contractsDeployed ? (
          <div className="flex flex-col items-center justify-center py-32 text-center gap-6">
            <div className="w-16 h-16 rounded-3xl bg-zinc-900 flex items-center justify-center text-zinc-700">
               <Cpu size={32} weight="duotone" />
            </div>
            <div>
              <p className="text-sm font-bold text-white mb-1 uppercase tracking-widest">Protocol Offline</p>
              <p className="text-xs text-zinc-500 max-w-sm">
                Awaiting connection to <code className="text-accent bg-accent/10 px-1 rounded">MARKET_ADDR</code>
              </p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-zinc-900 bg-zinc-900/50 h-[380px] animate-pulse" />
            ))}
          </div>
        ) : listingIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center gap-6">
            <div className="w-16 h-16 rounded-3xl bg-zinc-900 flex items-center justify-center text-zinc-700">
               <Cube size={32} weight="duotone" />
            </div>
            <div>
              <p className="text-sm font-bold text-white mb-1 uppercase tracking-widest">No Active Listings</p>
              <p className="text-xs text-zinc-500 max-w-sm">
                The protocol registry is currently empty.
              </p>
            </div>
            <Link
              href="/marketplace/list"
              className="rounded-xl border border-zinc-800 px-6 py-2.5 text-xs font-bold text-white hover:bg-zinc-900 transition-colors"
            >
              Initialize First Listing
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {listingIds.map((id, i) => (
              <ListingCard key={id.toString()} listingId={id} index={i} />
            ))}
          </div>
        )}
      </section>

      <footer className="max-w-[1400px] mx-auto w-full px-6 py-12 border-t border-zinc-900 text-center">
        <p className="text-[10px] font-bold tracking-[0.2em] text-zinc-600 uppercase">
          ARES PROTOCOL • TERMINAL_v1.0.4
        </p>
      </footer>
    </main>
  );
}
