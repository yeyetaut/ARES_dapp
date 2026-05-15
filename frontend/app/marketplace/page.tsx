"use client";

import Link from "next/link";
import { useReadContract } from "wagmi";
import { useMemo } from "react";
import { Nav } from "@/components/Nav";
import { ADDRESSES, MARKETPLACE_ABI, DIGITAL_TWIN_ABI, USDC_SCALE, isDeployed } from "@/lib/contracts";
import { motion } from "framer-motion";
import { Tag, User, ArrowsOutSimple, Cube, Cpu, Pulse, ListDashes, ArrowRight, CircleNotch } from "@phosphor-icons/react";

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

// ─── Listing card ─────────────────────────────────────────────────────────────

function ListingCard({ listingId, index }: { listingId: bigint, index: number }) {
  const { data: listing } = useReadContract({
    address: ADDRESSES.marketplace,
    abi: MARKETPLACE_ABI,
    functionName: "getListing",
    args: [listingId],
  });

  if (!listing || !listing.active) return null;

  const priceUSDC = (Number(listing.price) / Number(USDC_SCALE)).toFixed(2);
  const sellerShort = listing.seller.slice(0, 6) + "…" + listing.seller.slice(-4);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className="group border border-zinc-900 bg-black flex flex-col gap-px hover:border-accent/30 transition-all duration-300 relative overflow-hidden"
    >
      <Link href={`/marketplace/${listingId}`} className="block">
        {/* Visual Header */}
        <div className="aspect-[4/3] bg-zinc-950 flex items-center justify-center relative overflow-hidden border-b border-zinc-900">
          <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <Cube size={64} weight="duotone" className="text-zinc-900 group-hover:text-accent/20 transition-all duration-500" />
          <div className="absolute top-4 right-4">
             <span className="text-[9px] font-mono font-bold border border-zinc-800 text-zinc-500 px-2 py-1 bg-black/80 uppercase tracking-widest">
                ID_{listingId.toString().padStart(3, '0')}
             </span>
          </div>
          <div className="absolute bottom-4 left-4">
             <div className="flex items-center gap-2 px-2 py-1 bg-zinc-900/50 border border-zinc-800">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[8px] font-mono font-bold text-zinc-400 uppercase tracking-tighter">LIVE_FEED</span>
             </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 gap-px bg-zinc-900">
           <div className="bg-black p-5">
              <p className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-[0.2em] mb-1">// Digital Twin</p>
              <h3 className="text-lg font-bold text-white tracking-tighter uppercase italic">
                ADT #{listing.twinId.toString()}
              </h3>
           </div>
           
           <div className="grid grid-cols-2 gap-px bg-zinc-900">
              <div className="bg-black p-5">
                 <p className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-[0.2em] mb-1">Price</p>
                 <p className="text-lg font-mono font-bold text-white">{priceUSDC} <span className="text-[10px] text-zinc-600">USDC</span></p>
              </div>
              <div className="bg-black p-5">
                 <p className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-[0.2em] mb-1">Seller</p>
                 <p className="text-sm font-mono font-bold text-zinc-400 mt-1">{sellerShort}</p>
              </div>
           </div>
        </div>

        {/* Action Reveal */}
        <div className="h-12 bg-zinc-900 flex items-center justify-between px-5 group-hover:bg-accent transition-all duration-300">
           <span className="text-[10px] font-mono font-bold text-zinc-500 group-hover:text-white uppercase tracking-widest">Execute Sync {">>>"}</span>
           <ArrowRight size={14} className="text-zinc-700 group-hover:text-white group-hover:translate-x-1 transition-all" />
        </div>
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
    <main className="flex flex-col min-h-screen bg-black text-white selection:bg-accent/30 selection:text-accent">
      <Nav />

      {/* Scanline Effect Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,118,0.06))] bg-[length:100%_2px,3px_100%]" />

      {/* Header */}
      <section className="max-w-6xl mx-auto w-full px-6 py-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-zinc-900 pb-12">
          <div>
            <div className="flex items-center gap-4 text-accent text-[10px] font-mono font-bold tracking-[0.4em] uppercase mb-4">
               <Pulse size={14} />
               <span>Global Exchange Active</span>
               <Heartbeat />
            </div>
            <h1 className="text-5xl font-bold tracking-tighter uppercase italic leading-[0.8] mb-4">
               Market <br/> Registry
            </h1>
            <p className="text-zinc-500 font-mono text-[10px] max-w-sm uppercase tracking-widest leading-relaxed">
               Decentralized physical asset exchange. Monitor real-time listings, execute autonomous trade handshakes, and verify hardware provenance.
            </p>
          </div>
          <div className="flex flex-col md:items-end gap-6">
             <div className="flex items-center gap-6 font-mono text-[10px] text-zinc-600 uppercase font-bold tracking-widest">
                <div className="flex flex-col items-end">
                   <span>Registry Version</span>
                   <span className="text-white">v1.0.4 / LKD</span>
                </div>
                <div className="w-px h-10 bg-zinc-900" />
                <div className="flex flex-col items-end">
                   <span>Node Status</span>
                   <span className="text-white">D-01 / SYNC</span>
                </div>
             </div>
             <Link
               href="/marketplace/list"
               className="h-12 px-8 bg-accent text-[11px] font-mono font-bold text-white hover:bg-blue-400 uppercase tracking-[0.2em] transition-all shadow-[0_0_30px_rgba(59,130,246,0.2)] flex items-center justify-center gap-3"
             >
               + List_Asset_Unit
             </Link>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="flex-1 max-w-6xl mx-auto w-full px-6 pb-24">
        {!contractsDeployed ? (
          <div className="border border-zinc-900 bg-zinc-950 p-20 text-center flex flex-col items-center gap-8">
             <div className="w-16 h-16 border border-zinc-800 flex items-center justify-center text-zinc-700">
                <Cpu size={32} weight="duotone" />
             </div>
             <div className="space-y-4">
                <h2 className="text-lg font-bold text-white uppercase tracking-[0.4em]">Exchange Offline</h2>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-relaxed max-w-xs mx-auto">PROTOCOL_NOT_DETECTED_ON_CHAIN. ENSURE_HARDHAT_ENVIRONMENT_SYNC.</p>
             </div>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-zinc-900 border border-zinc-900">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] bg-black animate-pulse" />
            ))}
          </div>
        ) : listingIds.length === 0 ? (
          <div className="border border-dashed border-zinc-800 bg-zinc-950/50 p-24 text-center flex flex-col items-center gap-8">
            <div className="w-20 h-20 border border-zinc-800 flex items-center justify-center text-zinc-800 opacity-50">
               <Cube size={48} weight="duotone" />
            </div>
            <div className="space-y-4">
               <p className="text-[10px] font-mono font-bold text-zinc-600 uppercase tracking-[0.3em]">// NO_ASSETS_IN_REGISTRY</p>
               <Link
                  href="/marketplace/list"
                  className="text-[10px] font-mono font-bold text-accent hover:text-white underline underline-offset-8 decoration-accent/30 uppercase tracking-widest"
               >
                  Initiate First Registry Injection
               </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-zinc-900 border border-zinc-900 shadow-2xl">
            {listingIds.map((id, i) => (
              <ListingCard key={id.toString()} listingId={id} index={i} />
            ))}
          </div>
        )}
      </section>

      <footer className="max-w-6xl mx-auto w-full px-6 py-12 border-t border-zinc-900 flex justify-between items-center opacity-30 grayscale hover:opacity-100 transition-all">
        <p className="text-[9px] font-mono font-bold tracking-[0.3em] text-zinc-500 uppercase">
          ARES PROTOCOL • TERMINAL_v1.0.4 • END_OF_LINE
        </p>
        <div className="flex gap-6 font-mono text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
           <span>Lat: 22.3364° N</span>
           <span>Long: 114.2655° E</span>
        </div>
      </footer>
    </main>
  );
}
