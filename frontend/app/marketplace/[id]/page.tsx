"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Nav } from "@/components/Nav";
import {
  ADDRESSES, MARKETPLACE_ABI, ESCROW_ABI, MOCK_USDC_ABI, DIGITAL_TWIN_ABI,
  VERIFIER_ABI, ESCROW_STATE, USDC_SCALE, isDeployed,
} from "@/lib/contracts";

// ─── Escrow status badge ──────────────────────────────────────────────────────

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

  const { writeContract: approve, data: approveTxHash } = useWriteContract();
  const { isLoading: approving, isSuccess: approved } = useWaitForTransactionReceipt({ hash: approveTxHash });

  const { writeContract: buy, data: buyTxHash } = useWriteContract();
  const { isLoading: buying, isSuccess: bought } = useWaitForTransactionReceipt({ hash: buyTxHash });

  if (!address) {
    return <p className="text-sm text-gray-500">Connect your wallet to buy.</p>;
  }

  if (bought) {
    return <p className="text-sm text-green-400 font-medium">Purchase complete! USDC locked in escrow.</p>;
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
        className="w-full rounded-lg bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 px-4 py-3 text-sm font-semibold transition-colors"
      >
        {approving ? "Approving USDC…" : "Approve USDC"}
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
      className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-3 text-sm font-semibold transition-colors"
    >
      {buying ? "Confirming…" : "Buy Now"}
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

  const { writeContract: submit, data: submitTxHash } = useWriteContract();
  const { isLoading: submitting, isSuccess: submitted } = useWaitForTransactionReceipt({ hash: submitTxHash });

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
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">DePIN Verification</h3>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${att?.finalized ? "bg-green-900/50 text-green-300" : "bg-yellow-900/50 text-yellow-300"}`}>
          {att?.finalized ? "Verified" : "Awaiting Verification"}
        </span>
      </div>

      {att?.finalized ? (
        <div className="text-xs text-gray-500">
          <p>Node: <span className="font-mono text-gray-400">{att.node.slice(0, 10)}…{att.node.slice(-8)}</span></p>
          <p className="mt-1 break-all">Hash: <span className="font-mono text-gray-400">{att.nfcHash}</span></p>
        </div>
      ) : nodeInfo?.active && !submitted ? (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="NFC tag data"
            value={nfcTag}
            onChange={e => setNfcTag(e.target.value)}
            className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-xs font-mono focus:outline-none focus:border-indigo-500"
          />
          <button
            disabled={submitting || !nfcTag}
            onClick={handleVerify}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 text-xs font-semibold transition-colors"
          >
            {submitting ? "Submitting…" : "Submit Verification"}
          </button>
        </div>
      ) : submitted ? (
        <p className="text-xs text-green-400">Verification submitted. Trade settled.</p>
      ) : (
        <p className="text-xs text-gray-500">
          Only registered verifier nodes can submit. <a href="/verify" className="text-indigo-400 hover:underline">Register →</a>
        </p>
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
  const escrowCheckIds = escrowCount
    ? Array.from({ length: Math.min(Number(escrowCount), 20) }, (_, i) => escrowCount - BigInt(i))
    : [];

  const { data: escrowMappings } = useReadContracts?.({
    contracts: escrowCheckIds.map(eid => ({
      address: ADDRESSES.marketplace,
      abi: MARKETPLACE_ABI,
      functionName: "escrowListing" as const,
      args: [eid] as const,
    })),
    query: { enabled: escrowCheckIds.length > 0 },
  }) ?? { data: undefined };

  const resolvedEscrowId: bigint | undefined = escrowIdOverride
    ? BigInt(escrowIdOverride)
    : escrowMappings
        ?.map((r, i) => ({ result: r.result as bigint | undefined, id: escrowCheckIds[i] }))
        .find(({ result }) => result === listingId)?.id;

  const isSeller = address?.toLowerCase() === listing?.seller.toLowerCase();
  const priceUSDC = listing ? listing.price / USDC_SCALE : 0n;

  const { writeContract: cancel, data: cancelTxHash } = useWriteContract();
  const { isLoading: cancelling, isSuccess: cancelled } = useWaitForTransactionReceipt({ hash: cancelTxHash });

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
