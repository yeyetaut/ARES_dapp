"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { hardhat, sepolia } from "wagmi/chains";
import { http, createConfig } from "wagmi";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "03aee93b6b6d3f863fcba0b2fd326ddd";

// Define local chain explicitly to ensure RPC URLs are correctly formatted as arrays
const localHardhat = {
  ...hardhat,
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
    public: { http: ["http://127.0.0.1:8545"] },
  },
};

export const wagmiConfig = getDefaultConfig({
  appName: "ARES Protocol",
  projectId,
  chains: [sepolia, localHardhat],
  pollingInterval: 12000,
  batch: {
    multicall: false,
  },
  transports: {
    [localHardhat.id]: http("http://127.0.0.1:8545", {
      fetchOptions: { cache: "no-store" },
    }),
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  },
  ssr: true,
});
