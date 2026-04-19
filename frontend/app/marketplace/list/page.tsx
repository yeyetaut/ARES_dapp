"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { keccak256, toBytes } from "viem";
import { Nav } from "@/components/Nav";
import { ADDRESSES, MARKETPLACE_ABI, DIGITAL_TWIN_ABI, MOCK_USDC_ABI, USDC_SCALE, isDeployed } from "@/lib/contracts";

type Step = "mint" | "approve" | "list" | "done";

export default function ListItemPage() {
  const { address } = useAccount();

  // Form state
  const [nfcSeed, setNfcSeed]       = useState("");
  const [metadataURI, setMetadataURI] = useState("");
  const [priceInput, setPriceInput]  = useState("");
  const [twinId, setTwinId]          = useState<bigint | null>(null);
  const [step, setStep]              = useState<Step>("mint");
  const [listingId, setListingId]    = useState<bigint | null>(null);

  const priceRaw = priceInput ? BigInt(Math.floor(parseFloat(priceInput) * Number(USDC_SCALE))) : 0n;

  // ── Step 1: Mint Digital Twin ───────────────────────────────────────────────

  const { writeContract: mint, data: mintTxHash } = useWriteContract();
  const { isLoading: minting, isSuccess: minted } = useWaitForTransactionReceipt({
    hash: mintTxHash,
    onReplaced: () => {},
  });

  const nfcHash = nfcSeed ? keccak256(toBytes(nfcSeed)) : undefined;

  const { data: existingTwinId } = useReadContract({
    address: ADDRESSES.digitalTwin,
    abi: DIGITAL_TWIN_ABI,
    functionName: "nfcHashToTokenId",
    args: [nfcHash ?? "0x0000000000000000000000000000000000000000000000000000000000000000"],
    query: { enabled: !!nfcHash },
  });

  // ── Step 2: Approve Marketplace to transfer the NFT ────────────────────────

  const { writeContract: approveNFT, data: approveTxHash } = useWriteContract();
  const { isLoading: approvingNFT, isSuccess: approvedNFT } = useWaitForTransactionReceipt({ hash: approveTxHash });

  // ── Step 3: List item ──────────────────────────────────────────────────────

  const { writeContract: list, data: listTxHash } = useWriteContract();
  const { isLoading: listing, isSuccess: listed } = useWaitForTransactionReceipt({ hash: listTxHash });

  if (!address) {
    return (
      <main className="flex flex-col min-h-screen">
        <Nav />
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          Connect your wallet to list an item.
        </div>
      </main>
    );
  }

  const contractsDeployed = isDeployed(ADDRESSES.marketplace);

  return (
    <main className="flex flex-col min-h-screen">
      <Nav />

      <div className="px-6 py-4 text-sm text-gray-500">
        <Link href="/marketplace" className="hover:text-white transition-colors">← Marketplace</Link>
      </div>

      <div className="flex-1 px-6 py-6 max-w-lg w-full mx-auto">
        <h1 className="text-2xl font-bold mb-2">List an Item</h1>
        <p className="text-sm text-gray-400 mb-8">
          Mint a Digital Twin for your physical collectible, then list it on the marketplace.
        </p>

        {!contractsDeployed && (
          <div className="rounded-lg border border-yellow-800 bg-yellow-900/20 px-4 py-3 text-sm text-yellow-300 mb-6">
            Contracts not yet deployed — set environment variables to enable on-chain interactions.
          </div>
        )}

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-8 text-xs font-medium">
          {(["mint", "approve", "list", "done"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className={`rounded-full w-6 h-6 flex items-center justify-center text-xs ${
                step === s ? "bg-indigo-600 text-white" :
                (["mint","approve","list","done"].indexOf(step) > i) ? "bg-green-700 text-white" :
                "bg-gray-800 text-gray-500"
              }`}>
                {(["mint","approve","list","done"].indexOf(step) > i) ? "✓" : i + 1}
              </span>
              <span className={step === s ? "text-white" : "text-gray-500"}>
                {s === "mint" ? "Mint" : s === "approve" ? "Approve" : s === "list" ? "List" : "Done"}
              </span>
              {i < 3 && <span className="text-gray-700">—</span>}
            </div>
          ))}
        </div>

        {/* ── Step 1: Mint ── */}
        {step === "mint" && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">NFC Tag Seed</label>
              <input
                type="text"
                value={nfcSeed}
                onChange={(e) => setNfcSeed(e.target.value)}
                placeholder="e.g. CARD-2024-001"
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-600 mt-1">A unique identifier for this physical item's NFC tag. Will be hashed on-chain.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Metadata URI</label>
              <input
                type="text"
                value={metadataURI}
                onChange={(e) => setMetadataURI(e.target.value)}
                placeholder="ipfs://Qm..."
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {existingTwinId != null && existingTwinId > 0n && (
              <div className="rounded-lg border border-yellow-800 bg-yellow-900/20 px-4 py-3 text-sm text-yellow-300">
                NFC hash already registered as Twin #{existingTwinId.toString()}. Use that twinId directly.
              </div>
            )}

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
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-4 py-3 text-sm font-semibold transition-colors"
            >
              {minting ? "Minting…" : "Mint Digital Twin"}
            </button>

            {minted && (
              <button
                onClick={() => {
                  if (existingTwinId != null && existingTwinId > 0n) {
                    setTwinId(existingTwinId);
                  }
                  setStep("approve");
                }}
                className="rounded-lg border border-gray-700 hover:bg-gray-800 px-4 py-3 text-sm font-semibold transition-colors text-center"
              >
                Minted — Next: Approve →
              </button>
            )}

            <div className="border-t border-gray-800 pt-4">
              <p className="text-xs text-gray-500 mb-2">Already have a Digital Twin?</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  placeholder="Twin ID"
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  onChange={(e) => setTwinId(e.target.value ? BigInt(e.target.value) : null)}
                />
                <button
                  disabled={!twinId}
                  onClick={() => setStep("approve")}
                  className="rounded-lg border border-gray-700 hover:bg-gray-800 disabled:opacity-40 px-4 py-2 text-sm font-semibold transition-colors"
                >
                  Use This ID
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Approve NFT ── */}
        {step === "approve" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-400">
              Approve the Marketplace to transfer Digital Twin #{twinId?.toString()} on your behalf.
            </p>

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
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-4 py-3 text-sm font-semibold transition-colors"
            >
              {approvingNFT ? "Approving…" : "Approve Marketplace"}
            </button>

            {approvedNFT && (
              <button
                onClick={() => setStep("list")}
                className="rounded-lg border border-gray-700 hover:bg-gray-800 px-4 py-3 text-sm font-semibold transition-colors"
              >
                Approved — Next: Set Price →
              </button>
            )}
          </div>
        )}

        {/* ── Step 3: List ── */}
        {step === "list" && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Price (USDC)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="100"
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

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
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-4 py-3 text-sm font-semibold transition-colors"
            >
              {listing ? "Listing…" : "Create Listing"}
            </button>

            {listed && (
              <div>
                <p className="text-sm text-green-400 font-medium mb-2">Listed successfully!</p>
                <button onClick={() => setStep("done")} className="text-sm text-indigo-400 hover:underline">
                  View listing →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Done ── */}
        {step === "done" && (
          <div className="flex flex-col gap-4 text-center py-8">
            <div className="text-5xl mb-2">✅</div>
            <h2 className="text-xl font-bold">Item Listed!</h2>
            <p className="text-sm text-gray-400">Your Digital Twin is now live on the ARES marketplace.</p>
            <Link
              href="/marketplace"
              className="mx-auto rounded-lg bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 text-sm font-semibold transition-colors"
            >
              Browse Marketplace
            </Link>
          </div>
        )}
      </div>

      <footer className="px-6 py-6 border-t border-gray-800 text-center text-xs text-gray-600 mt-auto">
        ARES — HKUST Blockchain Lab · Sepolia Testnet · MIT License
      </footer>
    </main>
  );
}
