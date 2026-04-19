"use client";

import Link from "next/link";
import { useReadContract, useReadContracts } from "wagmi";
import { Nav } from "@/components/Nav";
import { ADDRESSES, MARKETPLACE_ABI, DIGITAL_TWIN_ABI, USDC_SCALE, isDeployed } from "@/lib/contracts";

// ─── Listing card ─────────────────────────────────────────────────────────────

function ListingCard({ listingId }: { listingId: bigint }) {
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
  const seller = listing.seller.slice(0, 6) + "…" + listing.seller.slice(-4);

  return (
    <Link
      href={`/marketplace/${listingId}`}
      className="group rounded-xl border border-gray-800 bg-gray-900 hover:border-indigo-700 transition-colors overflow-hidden flex flex-col"
    >
      {/* Thumbnail */}
      <div className="h-44 bg-gray-800 flex items-center justify-center text-4xl">
        🏷️
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-white leading-tight">
            Twin #{listing.twinId.toString()}
          </span>
          <span className="text-xs bg-indigo-900/60 text-indigo-300 rounded px-2 py-0.5 shrink-0">
            #{listingId.toString()}
          </span>
        </div>

        {tokenURI && (
          <p className="text-xs text-gray-500 truncate">{tokenURI}</p>
        )}

        <div className="mt-auto pt-3 border-t border-gray-800 flex items-center justify-between">
          <span className="text-base font-bold text-white">
            {priceUSDC.toString()} <span className="text-xs text-gray-400">USDC</span>
          </span>
          <span className="text-xs text-gray-500">{seller}</span>
        </div>
      </div>
    </Link>
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

  const listingIds: bigint[] = count
    ? Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1))
    : [];

  return (
    <main className="flex flex-col min-h-screen">
      <Nav />

      {/* Header */}
      <section className="px-6 py-10 border-b border-gray-800 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Marketplace</h1>
          <p className="text-gray-400 text-sm">
            Browse verified physical collectibles available for agent-to-agent trading.
          </p>
        </div>
        <Link
          href="/marketplace/list"
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-sm font-semibold transition-colors shrink-0"
        >
          + List Item
        </Link>
      </section>

      {/* Grid */}
      <section className="flex-1 px-6 py-8">
        {!contractsDeployed ? (
          <div className="flex flex-col items-center justify-center py-32 text-center gap-4 text-gray-500">
            <div className="text-4xl">🔌</div>
            <p className="text-sm max-w-sm">
              Contracts not yet deployed. Set <code className="text-indigo-400">NEXT_PUBLIC_MARKET_ADDRESS</code> to connect.
            </p>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-800 bg-gray-900 h-64 animate-pulse" />
            ))}
          </div>
        ) : listingIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center gap-4 text-gray-500">
            <div className="text-4xl">📭</div>
            <p className="font-medium text-gray-400">No listings yet</p>
            <p className="text-sm max-w-xs">Be the first to list a verified physical collectible.</p>
            <Link
              href="/marketplace/list"
              className="mt-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-5 py-2 text-sm font-semibold text-white transition-colors"
            >
              List an Item
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {listingIds.map((id) => (
              <ListingCard key={id.toString()} listingId={id} />
            ))}
          </div>
        )}
      </section>

      <footer className="px-6 py-6 border-t border-gray-800 text-center text-xs text-gray-600">
        ARES — HKUST Blockchain Lab · Sepolia Testnet · MIT License
      </footer>
    </main>
  );
}
