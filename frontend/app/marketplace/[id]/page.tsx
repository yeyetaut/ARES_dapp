"use client";

import { use } from "react";
import Link from "next/link";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Nav } from "@/components/Nav";
import {
  ADDRESSES, MARKETPLACE_ABI, ESCROW_ABI, MOCK_USDC_ABI, DIGITAL_TWIN_ABI,
  ESCROW_STATE, USDC_SCALE, isDeployed,
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

  // Find active escrow for this listing (escrow IDs ≥ 1, check escrowListing mapping)
  // For Phase 2 we display escrow details if the listing is sold.

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
          </div>
        </div>
      )}

      <footer className="px-6 py-6 border-t border-gray-800 text-center text-xs text-gray-600 mt-auto">
        ARES — HKUST Blockchain Lab · Sepolia Testnet · MIT License
      </footer>
    </main>
  );
}
