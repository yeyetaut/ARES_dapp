"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Nav } from "@/components/Nav";
import {
  ADDRESSES, MOCK_USDC_ABI, VERIFIER_ABI, USDC_SCALE, isDeployed,
} from "@/lib/contracts";

// ─── Node status card ─────────────────────────────────────────────────────────

function NodeStatus({ address }: { address: `0x${string}` }) {
  const { data: node, refetch } = useReadContract({
    address: ADDRESSES.verifier,
    abi: VERIFIER_ABI,
    functionName: "getNode",
    args: [address],
  });
  const { data: minStake } = useReadContract({
    address: ADDRESSES.verifier,
    abi: VERIFIER_ABI,
    functionName: "MIN_STAKE",
  });
  const { data: allowance } = useReadContract({
    address: ADDRESSES.mockUSDC,
    abi: MOCK_USDC_ABI,
    functionName: "allowance",
    args: [address, ADDRESSES.verifier],
  });

  const { writeContract: approve, data: approveTxHash } = useWriteContract();
  const { isLoading: approving, isSuccess: approved } = useWaitForTransactionReceipt({ hash: approveTxHash });

  const { writeContract: register, data: regTxHash } = useWriteContract();
  const { isLoading: registering } = useWaitForTransactionReceipt({
    hash: regTxHash,
    onReplaced: () => refetch(),
  });

  const { writeContract: deregister, data: deregTxHash } = useWriteContract();
  const { isLoading: deregistering } = useWaitForTransactionReceipt({
    hash: deregTxHash,
    onReplaced: () => refetch(),
  });

  const stakeUSDC = node ? node.stake / USDC_SCALE : 0n;
  const minUSDC   = minStake ? minStake / USDC_SCALE : 100n;
  const needsApproval = !approved && (allowance ?? 0n) < (minStake ?? 0n);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Node Status</h2>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${node?.active ? "bg-green-900/50 text-green-300" : "bg-gray-800 text-gray-400"}`}>
          {node?.active ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-gray-800 px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">Stake</p>
          <p className="font-mono font-bold">{stakeUSDC.toString()} USDC</p>
        </div>
        <div className="rounded-lg bg-gray-800 px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">Min Stake</p>
          <p className="font-mono font-bold">{minUSDC.toString()} USDC</p>
        </div>
      </div>

      {!node?.active && (
        <div className="flex flex-col gap-2">
          {needsApproval ? (
            <button
              disabled={approving}
              onClick={() =>
                approve({
                  address: ADDRESSES.mockUSDC,
                  abi: MOCK_USDC_ABI,
                  functionName: "approve",
                  args: [ADDRESSES.verifier, minStake ?? 100n * 10n ** 6n],
                })
              }
              className="w-full rounded-lg bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 px-4 py-3 text-sm font-semibold transition-colors"
            >
              {approving ? "Approving USDC…" : `Approve ${minUSDC.toString()} USDC`}
            </button>
          ) : (
            <button
              disabled={registering}
              onClick={() =>
                register({
                  address: ADDRESSES.verifier,
                  abi: VERIFIER_ABI,
                  functionName: "registerNode",
                  args: [minStake ?? 100n * 10n ** 6n],
                })
              }
              className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-3 text-sm font-semibold transition-colors"
            >
              {registering ? "Registering…" : "Register as Verifier Node"}
            </button>
          )}
        </div>
      )}

      {node?.active && (
        <button
          disabled={deregistering}
          onClick={() =>
            deregister({
              address: ADDRESSES.verifier,
              abi: VERIFIER_ABI,
              functionName: "deregisterNode",
            })
          }
          className="w-full rounded-lg border border-red-800 hover:bg-red-900/30 disabled:opacity-50 px-4 py-3 text-sm font-semibold text-red-400 transition-colors"
        >
          {deregistering ? "Deregistering…" : "Deregister & Withdraw Stake"}
        </button>
      )}
    </div>
  );
}

// ─── Submit verification form ─────────────────────────────────────────────────

function SubmitVerification({ address }: { address: `0x${string}` }) {
  const [escrowId, setEscrowId] = useState("");
  const [nfcTag, setNfcTag]     = useState("");
  const [error, setError]       = useState("");

  const { data: nodeInfo } = useReadContract({
    address: ADDRESSES.verifier,
    abi: VERIFIER_ABI,
    functionName: "getNode",
    args: [address],
  });

  const { writeContract: submit, data: submitTxHash } = useWriteContract();
  const { isLoading: submitting, isSuccess: submitted } = useWaitForTransactionReceipt({
    hash: submitTxHash,
  });

  function handleSubmit() {
    setError("");
    if (!escrowId || !nfcTag) {
      setError("Both fields are required.");
      return;
    }
    const id = BigInt(escrowId);
    // Simulate NFC hash: keccak256 of the tag string (mirrors the on-chain registration)
    const encoder = new TextEncoder();
    const data = encoder.encode(nfcTag);
    // Use viem's keccak256 via window.crypto — approximate; real app reads raw NFC bytes
    import("viem").then(({ keccak256, toBytes }) => {
      const hash = keccak256(toBytes(nfcTag));
      submit({
        address: ADDRESSES.verifier,
        abi: VERIFIER_ABI,
        functionName: "submitVerification",
        args: [id, hash as `0x${string}`],
      });
    });
  }

  if (!nodeInfo?.active) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="text-lg font-semibold mb-3">Submit Verification</h2>
        <p className="text-sm text-gray-500">Register as an active node first to submit verifications.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Submit Verification</h2>
        <p className="text-xs text-gray-500 mt-1">
          Physically inspect the item, scan its NFC tag, and confirm authenticity on-chain.
        </p>
      </div>

      {submitted ? (
        <div className="rounded-lg bg-green-900/30 border border-green-800 px-4 py-3 text-sm text-green-300">
          Verification confirmed. USDC released to seller and NFT transferred to buyer.
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Escrow ID</label>
            <input
              type="number"
              min="1"
              placeholder="e.g. 1"
              value={escrowId}
              onChange={e => setEscrowId(e.target.value)}
              className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">NFC Tag Data</label>
            <input
              type="text"
              placeholder="Raw tag string (hashed to keccak256)"
              value={nfcTag}
              onChange={e => setNfcTag(e.target.value)}
              className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500"
            />
            <p className="text-xs text-gray-600">
              On testnet this mirrors the seed used at mint time. Production reads raw NFC bytes.
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <button
            disabled={submitting}
            onClick={handleSubmit}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-3 text-sm font-semibold transition-colors"
          >
            {submitting ? "Submitting…" : "Submit Verification"}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Attestation lookup ───────────────────────────────────────────────────────

function AttestationLookup() {
  const [input, setInput] = useState("");
  const [escrowId, setEscrowId] = useState<bigint | null>(null);

  const { data: att } = useReadContract({
    address: ADDRESSES.verifier,
    abi: VERIFIER_ABI,
    functionName: "getAttestation",
    args: [escrowId ?? 0n],
    query: { enabled: escrowId !== null && escrowId > 0n },
  });

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Check Attestation</h2>

      <div className="flex gap-2">
        <input
          type="number"
          min="1"
          placeholder="Escrow ID"
          value={input}
          onChange={e => setInput(e.target.value)}
          className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={() => setEscrowId(input ? BigInt(input) : null)}
          className="rounded-lg bg-gray-700 hover:bg-gray-600 px-4 py-2 text-sm font-semibold transition-colors"
        >
          Lookup
        </button>
      </div>

      {att && escrowId !== null && (
        <div className="rounded-lg bg-gray-800 px-4 py-3 text-sm flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Status:</span>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${att.finalized ? "bg-green-900/50 text-green-300" : "bg-yellow-900/50 text-yellow-300"}`}>
              {att.finalized ? "Verified" : "Unverified"}
            </span>
          </div>
          {att.finalized && (
            <>
              <div>
                <span className="text-gray-500">Node: </span>
                <span className="font-mono text-xs">{att.node}</span>
              </div>
              <div>
                <span className="text-gray-500">NFC Hash: </span>
                <span className="font-mono text-xs break-all">{att.nfcHash}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VerifyPage() {
  const { address } = useAccount();

  if (!isDeployed(ADDRESSES.verifier)) {
    return (
      <main className="flex flex-col min-h-screen">
        <Nav />
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Verifier contract not deployed. Set <code className="mx-1 text-xs bg-gray-800 px-1 rounded">NEXT_PUBLIC_VERIFIER_ADDRESS</code>.
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen">
      <Nav />

      <div className="flex-1 px-6 py-8 max-w-3xl w-full mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold">DePIN Verification</h1>
          <p className="text-sm text-gray-500 mt-1">
            Stake USDC to become a verifier node. Physically inspect items, scan NFC tags,
            and attest authenticity on-chain to settle trades.
          </p>
        </div>

        {!address ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-sm text-gray-500">
            Connect your wallet to manage your verifier node.
          </div>
        ) : (
          <>
            <NodeStatus address={address} />
            <SubmitVerification address={address} />
          </>
        )}

        <AttestationLookup />
      </div>

      <footer className="px-6 py-6 border-t border-gray-800 text-center text-xs text-gray-600 mt-auto">
        ARES — HKUST Blockchain Lab · Sepolia Testnet · MIT License
      </footer>
    </main>
  );
}
