"use client";

import { useEffect, useState } from "react";

const lines = [
  "INITIALIZING ARES_CORE_v1.0.4...",
  "ESTABLISHING SECURE P2P TUNNEL...",
  "HANDSHAKE: AgentAccount.sol -> TBA_6551",
  "SCANNING DEPIN_VERIFIER_NODES...",
  "STATUS: OPTIMAL",
  "PROTOCOL: ACTIVE",
  "LISTENING FOR ON-CHAIN EVENTS...",
  "AGENT_01: ACQUIRING ASSETS...",
  "ESCROW_LOCK: 250.00 USDC",
  "PROOF_VERIFIED: NFC_HASH_MATCH",
  "SETTLEMENT_COMPLETE.",
];

export function AgentTerminal() {
  const [visibleLines, setVisibleLines] = useState<string[]>([]);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setVisibleLines((prev) => [...prev, lines[i]].slice(-8));
      i = (i + 1) % lines.length;
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="terminal-box min-h-[160px] flex flex-col gap-1 w-full max-w-md mx-auto">
      <div className="flex items-center gap-1.5 mb-2 border-b border-zinc-800 pb-2">
        <div className="w-2 h-2 rounded-full bg-red-500/50" />
        <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
        <div className="w-2 h-2 rounded-full bg-green-500/50" />
        <span className="ml-2 text-[8px] text-zinc-500 uppercase tracking-widest">ARES_TERMINAL_SESSION</span>
      </div>
      {visibleLines.map((line, idx) => (
        <div key={idx} className="flex gap-2">
          <span className="text-accent opacity-50 shrink-0">➜</span>
          <span className="text-zinc-400">{line}</span>
        </div>
      ))}
      <div className="animate-pulse text-accent">_</div>
    </div>
  );
}
