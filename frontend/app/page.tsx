"use client";

import Link from "next/link";
import { Nav } from "@/components/Nav";
import { AgentTerminal } from "@/components/AgentTerminal";
import { 
  Robot, 
  Selection, 
  LockKey, 
  Broadcast, 
  Star, 
  Gavel,
  ArrowRight,
  Cube
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const features = [
  {
    title: "Agent Wallets",
    desc: "Autonomous TBAs holding USDC and executing trades via ERC-6551.",
    icon: Robot,
    color: "text-blue-400",
  },
  {
    title: "Digital Twins",
    desc: "Physical-to-digital bridge via NFC hashes and IPFS metadata.",
    icon: Cube,
    color: "text-emerald-400",
  },
  {
    title: "Trustless Escrow",
    desc: "Programmable settlement locked until DePIN verification.",
    icon: LockKey,
    color: "text-amber-400",
  },
  {
    title: "DePIN Verification",
    desc: "Community nodes scanning physical NFC tags for proof-of-authenticity.",
    icon: Broadcast,
    color: "text-rose-400",
  },
  {
    title: "SBT Reputation",
    desc: "Non-transferable on-chain track records for agents and verifiers.",
    icon: Star,
    color: "text-indigo-400",
  },
  {
    title: "USDC Staking",
    desc: "Collateralized network security with protocol-enforced slashing.",
    icon: Gavel,
    color: "text-cyan-400",
  },
];

export default function Home() {
  return (
    <main className="min-h-[100dvh] flex flex-col bg-zinc-950 overflow-x-hidden">
      <Nav />

      {/* Hero Section */}
      <section className="relative px-6 py-24 md:py-32 flex flex-col items-center justify-center overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-full pointer-events-none opacity-20">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[120px]" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="z-10 text-center max-w-4xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/50 border border-zinc-800 text-[10px] font-bold tracking-[0.2em] text-zinc-400 uppercase mb-8">
            <div className="w-1 h-1 rounded-full bg-accent animate-pulse" />
            HKUST BLOCKCHAIN LAB • SEPOLIA TESTNET
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-white mb-6 leading-[0.9]">
            The Protocol for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500">Autonomous Resell</span>
          </h1>
          
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
            ARES enables AI agents to possess on-chain identities, discover physical assets, 
            and settle trades via DePIN-verified escrow protocols.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <Link
              href="/marketplace"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white text-black text-sm font-bold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 group"
            >
              Enter Marketplace
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-zinc-900 text-white border border-zinc-800 text-sm font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
            >
              Agent Dashboard
            </Link>
          </div>

          <AgentTerminal />
        </motion.div>
      </section>

      {/* Grid Features */}
      <section className="px-6 py-24 max-w-[1400px] mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
              className="group p-8 rounded-3xl border border-zinc-900 bg-zinc-950 hover:border-zinc-800 hover:bg-zinc-900/50 transition-all duration-300"
            >
              <div className={cn("p-3 rounded-xl bg-zinc-900 w-fit mb-6 group-hover:scale-110 transition-transform", f.color)}>
                <f.icon size={24} weight="duotone" />
              </div>
              <h3 className="text-lg font-bold text-white mb-3 tracking-tight">{f.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed font-medium">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Stats/Code section */}
      <section className="px-6 py-24 border-y border-zinc-900 bg-black/40">
        <div className="max-w-4xl mx-auto flex flex-col gap-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: "Active Nodes", val: "128" },
              { label: "Total Volume", val: "$42.4k" },
              { label: "Settlement", val: "< 12s" },
              { label: "Reputation", val: "S-Tier" }
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-[10px] font-bold tracking-widest text-zinc-600 uppercase mb-2">{s.label}</p>
                <p className="text-2xl font-mono font-bold text-white">{s.val}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-6 py-12 text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-1 h-1 rounded-full bg-zinc-800" />
          <div className="w-1 h-1 rounded-full bg-zinc-800" />
          <div className="w-1 h-1 rounded-full bg-zinc-800" />
        </div>
        <p className="text-[10px] font-bold tracking-widest text-zinc-600 uppercase">
          ARES PROTOCOL • HKUST BLOCKCHAIN LAB • MIT LICENSE
        </p>
      </footer>
    </main>
  );
}
