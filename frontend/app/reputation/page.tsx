"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { Nav } from "@/components/Nav";
import {
  ADDRESSES, REPUTATION_ABI, isDeployed,
} from "@/lib/contracts";

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color = "text-white" }: { label: string; value: string | number | bigint; color?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${color}`}>{String(value)}</span>
    </div>
  );
}

// ─── Profile card ─────────────────────────────────────────────────────────────

function ProfileCard({ address }: { address: `0x${string}` }) {
  const { data: stats } = useReadContract({
    address: ADDRESSES.reputation,
    abi: REPUTATION_ABI,
    functionName: "statsOf",
    args: [address],
  });

  const { data: tokenId } = useReadContract({
    address: ADDRESSES.reputation,
    abi: REPUTATION_ABI,
    functionName: "tokenOf",
    args: [address],
  });

  if (!stats) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 text-center text-gray-400">
        No reputation record found. Complete a trade or verification to earn your first score.
      </div>
    );
  }

  const score = stats.score;
  const scoreColor =
    score > 0n ? "text-green-400" : score < 0n ? "text-red-400" : "text-gray-300";

  return (
    <div className="bg-gray-800 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 font-mono">{address}</p>
          {tokenId !== undefined && tokenId > 0n && (
            <p className="text-xs text-indigo-400 mt-0.5">Token #{String(tokenId)}</p>
          )}
        </div>
        <div className={`text-4xl font-black ${scoreColor}`}>
          {score >= 0n ? "+" : ""}{String(score)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Completed Trades" value={stats.completedTrades} />
        <StatCard label="Verifications"    value={stats.verifications}   color="text-indigo-400" />
        <StatCard label="Disputes"         value={stats.disputes}        color={stats.disputes > 0n ? "text-yellow-400" : "text-white"} />
      </div>

      <div className="text-xs text-gray-500 mt-2">
        Score breakdown: +10 per trade · +5 per verification · -20 per challenge · ±15/5 per dispute
      </div>
    </div>
  );
}

// ─── Lookup form ──────────────────────────────────────────────────────────────

function LookupForm() {
  const [input, setInput] = useState("");
  const [queried, setQueried] = useState<`0x${string}` | null>(null);

  function handleLookup() {
    const trimmed = input.trim();
    if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
      setQueried(trimmed as `0x${string}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm font-mono text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500"
          placeholder="0x... address to look up"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLookup()}
        />
        <button
          onClick={handleLookup}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
        >
          Look Up
        </button>
      </div>

      {queried && <ProfileCard address={queried} />}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReputationPage() {
  const { address, isConnected } = useAccount();
  const notDeployed = !isDeployed(ADDRESSES.reputation);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Nav />
      <main className="max-w-2xl mx-auto px-4 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Reputation</h1>
          <p className="text-gray-400 mt-1 text-sm">
            Soulbound scores earned through trades, verifications, and dispute history.
          </p>
        </div>

        {notDeployed && (
          <div className="bg-yellow-900/40 border border-yellow-700 rounded-lg px-4 py-3 text-sm text-yellow-300">
            Reputation contract not yet deployed. Set <code className="font-mono">NEXT_PUBLIC_REPUTATION_ADDRESS</code>.
          </div>
        )}

        {isConnected && address && !notDeployed && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Your Profile</h2>
            <ProfileCard address={address} />
          </section>
        )}

        {!notDeployed && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Look Up Any Address</h2>
            <LookupForm />
          </section>
        )}

        <section className="bg-gray-800/50 rounded-xl p-5 space-y-2 text-sm text-gray-300">
          <h3 className="font-semibold text-white">How Scores Work</h3>
          <ul className="space-y-1 list-disc list-inside text-gray-400">
            <li><span className="text-green-400 font-semibold">+10</span> — trade completed (buyer &amp; seller)</li>
            <li><span className="text-green-400 font-semibold">+5</span> — successful NFC verification (verifier node)</li>
            <li><span className="text-green-400 font-semibold">+5</span> — dispute resolved in your favour</li>
            <li><span className="text-red-400 font-semibold">-5</span> — dispute resolved against you (buyer)</li>
            <li><span className="text-red-400 font-semibold">-15</span> — dispute resolved against you (seller)</li>
            <li><span className="text-red-400 font-semibold">-20</span> — verifier node challenged / slashed</li>
          </ul>
          <p className="text-gray-500 pt-1 text-xs">
            Tokens are soulbound — they cannot be transferred or sold.
          </p>
        </section>
      </main>
    </div>
  );
}
