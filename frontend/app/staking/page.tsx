"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Nav } from "@/components/Nav";
import {
  ADDRESSES, MOCK_USDC_ABI, STAKING_ABI, USDC_SCALE, isDeployed,
} from "@/lib/contracts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: bigint | undefined, decimals = 6): string {
  if (n === undefined) return "—";
  return (Number(n) / 10 ** decimals).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtDate(ts: bigint | undefined): string {
  if (!ts || ts === 0n) return "—";
  return new Date(Number(ts) * 1000).toLocaleString();
}

// ─── Stake panel ──────────────────────────────────────────────────────────────

function StakePanel({ address }: { address: `0x${string}` }) {
  const { data: stakeRecord, refetch } = useReadContract({
    address: ADDRESSES.staking,
    abi: STAKING_ABI,
    functionName: "getStake",
    args: [address],
  });

  const { data: minStake } = useReadContract({
    address: ADDRESSES.staking,
    abi: STAKING_ABI,
    functionName: "MIN_STAKE",
  });

  const { data: cooldown } = useReadContract({
    address: ADDRESSES.staking,
    abi: STAKING_ABI,
    functionName: "cooldownEnd",
    args: [address],
  });

  const { data: usdcBal } = useReadContract({
    address: ADDRESSES.mockUSDC,
    abi: MOCK_USDC_ABI,
    functionName: "balanceOf",
    args: [address],
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: ADDRESSES.mockUSDC,
    abi: MOCK_USDC_ABI,
    functionName: "allowance",
    args: [address, ADDRESSES.staking],
  });

  const { writeContract: approve, data: approveTxHash } = useWriteContract();
  const { isLoading: approving } = useWaitForTransactionReceipt({
    hash: approveTxHash,
    onReplaced: () => { refetchAllowance(); },
  });

  const { writeContract: stake, data: stakeTxHash } = useWriteContract();
  const { isLoading: staking } = useWaitForTransactionReceipt({
    hash: stakeTxHash,
    onReplaced: () => { refetch(); refetchAllowance(); },
  });

  const { writeContract: initiateUnstake, data: initTxHash } = useWriteContract();
  const { isLoading: initiating } = useWaitForTransactionReceipt({
    hash: initTxHash,
    onReplaced: () => { refetch(); },
  });

  const { writeContract: completeUnstake, data: completeTxHash } = useWriteContract();
  const { isLoading: completing } = useWaitForTransactionReceipt({
    hash: completeTxHash,
    onReplaced: () => { refetch(); },
  });

  const staked        = stakeRecord?.amount ?? 0n;
  const unstakingAt   = stakeRecord?.unstakeInitiatedAt ?? 0n;
  const isUnstaking   = unstakingAt > 0n;
  const cooldownDone  = cooldown !== undefined && cooldown > 0n && BigInt(Math.floor(Date.now() / 1000)) >= cooldown;
  const needsApprove  = (allowance ?? 0n) < (minStake ?? 0n);

  return (
    <div className="bg-gray-800 rounded-xl p-6 space-y-5">
      {/* Balances */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-700/50 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Wallet USDC</p>
          <p className="text-2xl font-bold text-white mt-1">{fmt(usdcBal)}</p>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Staked USDC</p>
          <p className={`text-2xl font-bold mt-1 ${staked > 0n ? "text-green-400" : "text-gray-400"}`}>
            {fmt(staked)}
          </p>
        </div>
      </div>

      {/* Cooldown status */}
      {isUnstaking && (
        <div className={`rounded-lg px-4 py-3 text-sm ${cooldownDone ? "bg-green-900/40 border border-green-700 text-green-300" : "bg-yellow-900/40 border border-yellow-700 text-yellow-300"}`}>
          {cooldownDone
            ? "Cooldown complete — you can withdraw your stake."
            : `Cooldown ends: ${fmtDate(cooldown)}`}
        </div>
      )}

      {/* Min stake info */}
      {minStake !== undefined && (
        <p className="text-xs text-gray-500">
          Minimum stake: {fmt(minStake)} USDC &nbsp;·&nbsp; 7-day cooldown before withdrawal
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-3">
        {!isUnstaking && (
          <>
            {needsApprove ? (
              <button
                disabled={approving}
                onClick={() => approve({
                  address: ADDRESSES.mockUSDC,
                  abi: MOCK_USDC_ABI,
                  functionName: "approve",
                  args: [ADDRESSES.staking, minStake ?? 0n],
                })}
                className="w-full bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-lg transition-colors"
              >
                {approving ? "Approving…" : `Approve ${fmt(minStake)} USDC`}
              </button>
            ) : (
              <button
                disabled={staking}
                onClick={() => stake({
                  address: ADDRESSES.staking,
                  abi: STAKING_ABI,
                  functionName: "stake",
                  args: [minStake ?? 0n],
                })}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-lg transition-colors"
              >
                {staking ? "Staking…" : `Stake ${fmt(minStake)} USDC`}
              </button>
            )}

            {staked > 0n && (
              <button
                disabled={initiating}
                onClick={() => initiateUnstake({
                  address: ADDRESSES.staking,
                  abi: STAKING_ABI,
                  functionName: "initiateUnstake",
                })}
                className="w-full bg-yellow-700 hover:bg-yellow-600 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-lg transition-colors"
              >
                {initiating ? "Initiating…" : "Begin Unstake (7-day cooldown)"}
              </button>
            )}
          </>
        )}

        {isUnstaking && cooldownDone && (
          <button
            disabled={completing}
            onClick={() => completeUnstake({
              address: ADDRESSES.staking,
              abi: STAKING_ABI,
              functionName: "completeUnstake",
            })}
            className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-lg transition-colors"
          >
            {completing ? "Withdrawing…" : `Withdraw ${fmt(staked)} USDC`}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StakingPage() {
  const { address, isConnected } = useAccount();
  const notDeployed = !isDeployed(ADDRESSES.staking);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Nav />
      <main className="max-w-xl mx-auto px-4 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Staking</h1>
          <p className="text-gray-400 mt-1 text-sm">
            Lock USDC as economic collateral. A 7-day cooldown protects against rapid withdrawals.
          </p>
        </div>

        {notDeployed && (
          <div className="bg-yellow-900/40 border border-yellow-700 rounded-lg px-4 py-3 text-sm text-yellow-300">
            Staking contract not yet deployed. Set <code className="font-mono">NEXT_PUBLIC_STAKING_ADDRESS</code>.
          </div>
        )}

        {!isConnected && !notDeployed && (
          <div className="bg-gray-800 rounded-xl p-6 text-center text-gray-400">
            Connect your wallet to stake.
          </div>
        )}

        {isConnected && address && !notDeployed && (
          <StakePanel address={address} />
        )}

        <section className="bg-gray-800/50 rounded-xl p-5 space-y-2 text-sm text-gray-300">
          <h3 className="font-semibold text-white">Staking Rules</h3>
          <ul className="space-y-1 list-disc list-inside text-gray-400">
            <li>Minimum stake: 100 USDC</li>
            <li>7-day cooldown between <em>initiating</em> and <em>completing</em> a withdrawal</li>
            <li>Cannot top up while an unstake is pending — complete it first</li>
            <li>Owner governance can slash dishonest stakers at any time</li>
            <li>Slashed funds remain in the contract treasury</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
