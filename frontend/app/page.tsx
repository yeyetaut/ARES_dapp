"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";

const features = [
  {
    title: "ERC-6551 Agent Wallets",
    desc: "Every AI agent owns an on-chain Token-Bound Account that holds USDC and executes trades autonomously.",
    icon: "🤖",
  },
  {
    title: "Digital Twin NFTs",
    desc: "Each physical collectible is an ERC-721 NFT with IPFS metadata and a unique NFC hash.",
    icon: "🏷️",
  },
  {
    title: "Trustless Escrow",
    desc: "USDC is locked in a smart contract and released only after a DePIN node verifies the item.",
    icon: "🔐",
  },
  {
    title: "DePIN Verification",
    desc: "Community-run nodes scan NFC tags and post cryptographic proofs on-chain to unlock settlement.",
    icon: "📡",
  },
  {
    title: "Soulbound Reputation",
    desc: "Non-transferable reputation tokens track agent and verifier track records — earned, never bought.",
    icon: "⭐",
  },
  {
    title: "Staking & Slashing",
    desc: "Verifier nodes stake USDC as collateral. Bad attestations get slashed, keeping the network honest.",
    icon: "⚖️",
  },
];

const flow = [
  "Fund Agent",
  "Agent Discovers Item",
  "Lock USDC Escrow",
  "Ship Physical Item",
  "DePIN Node Verifies NFC",
  "Escrow Settles",
  "Reputation Updated",
];

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <span className="text-xl font-bold tracking-tight text-indigo-400">ARES</span>
        <div className="flex items-center gap-6">
          <Link href="/marketplace" className="text-sm text-gray-400 hover:text-white transition-colors">
            Marketplace
          </Link>
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
            Dashboard
          </Link>
          <ConnectButton />
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 py-24 gap-6">
        <div className="rounded-full bg-indigo-900/40 px-4 py-1 text-xs font-medium text-indigo-300 ring-1 ring-indigo-700">
          Built on Ethereum Sepolia · Powered by ERC-6551
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight max-w-3xl leading-tight">
          The <span className="text-indigo-400">Machine-to-Machine</span> Marketplace for Physical Collectibles
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl">
          ARES lets autonomous AI agents hold on-chain wallets, discover deals, lock escrow, verify authenticity
          via DePIN nodes, and settle payments — all without human intervention.
        </p>
        <div className="flex gap-4 mt-2">
          <Link
            href="/marketplace"
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-6 py-3 text-sm font-semibold transition-colors"
          >
            Browse Marketplace
          </Link>
          <a
            href="https://eips.ethereum.org/EIPS/eip-6551"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-gray-700 hover:border-gray-500 px-6 py-3 text-sm font-semibold text-gray-300 transition-colors"
          >
            Learn ERC-6551
          </a>
        </div>
      </section>

      {/* Trade Flow */}
      <section className="px-6 py-12 border-y border-gray-800 bg-gray-900/50">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-500 mb-8">
          How a trade works
        </p>
        <div className="flex flex-wrap justify-center items-center gap-2 text-sm text-gray-300 font-medium">
          {flow.map((step, i) => (
            <span key={step} className="flex items-center gap-2">
              <span className="rounded bg-gray-800 px-3 py-1">{step}</span>
              {i < flow.length - 1 && <span className="text-gray-600">→</span>}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20">
        <h2 className="text-center text-2xl font-bold mb-12">Protocol Primitives</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-gray-800 bg-gray-900 p-6 flex flex-col gap-3 hover:border-indigo-700 transition-colors"
            >
              <span className="text-2xl">{f.icon}</span>
              <h3 className="font-semibold text-white">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 text-center border-t border-gray-800">
        <h2 className="text-2xl font-bold mb-4">Ready to deploy your agent?</h2>
        <p className="text-gray-400 mb-8 max-w-xl mx-auto">
          Connect your wallet, mint an agent NFT, and fund its on-chain wallet with USDC to start trading.
        </p>
        <ConnectButton />
      </section>

      <footer className="mt-auto px-6 py-6 border-t border-gray-800 text-center text-xs text-gray-600">
        ARES — HKUST Blockchain Lab · Sepolia Testnet · MIT License
      </footer>
    </main>
  );
}
