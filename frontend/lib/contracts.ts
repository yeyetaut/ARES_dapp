// ─── Contract addresses ───────────────────────────────────────────────────────
// Fill these in after running `npx hardhat run scripts/deploy.js --network sepolia`
// or set them via NEXT_PUBLIC_* environment variables.

export const ADDRESSES = {
  mockUSDC:    (process.env.NEXT_PUBLIC_USDC_ADDRESS        ?? "0x4BD4ABa1EaeE7b7528348e8A4BB775978004D191") as `0x${string}`,
  digitalTwin: (process.env.NEXT_PUBLIC_TWIN_ADDRESS        ?? "0x228FFc728df832522c7399b13e7f3c43F55606e6") as `0x${string}`,
  escrow:      (process.env.NEXT_PUBLIC_ESCROW_ADDRESS      ?? "0x7CC6176615461333e3a78B8C43F4c14a1a2050Bb") as `0x${string}`,
  marketplace: (process.env.NEXT_PUBLIC_MARKET_ADDRESS      ?? "0xe320Bc16f641908916C1BeEB2812a2cE42CdF671") as `0x${string}`,
  registry:    (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS    ?? "0xF0BC472a735A1D9272a787917Ec368c6A81e6712") as `0x${string}`,
  factory:     (process.env.NEXT_PUBLIC_FACTORY_ADDRESS     ?? "0x6136afFB48c96EBc5CCa86958BBec2793e5D4D82") as `0x${string}`,
  verifier:    (process.env.NEXT_PUBLIC_VERIFIER_ADDRESS    ?? "0x724B0A954142f864DCc5D6ab7CA6936E0C5021df") as `0x${string}`,
  reputation:  (process.env.NEXT_PUBLIC_REPUTATION_ADDRESS  ?? "0x989cceb872cB1E1beb2CA4549e12Ca95269Bb05E") as `0x${string}`,
  staking:     (process.env.NEXT_PUBLIC_STAKING_ADDRESS     ?? "0x34d322a61a90046f5153e80EFDDD153Dc235605C") as `0x${string}`,
} as const;

export const USDC_DECIMALS = 6n;
export const USDC_SCALE = 10n ** USDC_DECIMALS;

/** Returns true if an address has been configured (non-empty). */
export function isDeployed(addr: `0x${string}`): boolean {
  return addr.length > 2;
}

// ─── ABIs ─────────────────────────────────────────────────────────────────────

export const MOCK_USDC_ABI = [
  { name: "balanceOf",  type: "function", stateMutability: "view",      inputs: [{ name: "account", type: "address" }],                                             outputs: [{ type: "uint256" }] },
  { name: "decimals",   type: "function", stateMutability: "view",      inputs: [],                                                                                 outputs: [{ type: "uint8" }] },
  { name: "allowance",  type: "function", stateMutability: "view",      inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],         outputs: [{ type: "uint256" }] },
  { name: "approve",    type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],       outputs: [{ type: "bool" }] },
  { name: "faucet",     type: "function", stateMutability: "nonpayable", inputs: [],                                                                                 outputs: [] },
  { name: "transfer",   type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],            outputs: [{ type: "bool" }] },
] as const;

export const DIGITAL_TWIN_ABI = [
  { name: "mint",         type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "nfcHash", type: "bytes32" }, { name: "metadataURI", type: "string" }], outputs: [{ name: "tokenId", type: "uint256" }] },
  { name: "approve",      type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }],                                           outputs: [] },
  { name: "ownerOf",      type: "function", stateMutability: "view",       inputs: [{ name: "tokenId", type: "uint256" }],                                                                             outputs: [{ type: "address" }] },
  { name: "tokenURI",     type: "function", stateMutability: "view",       inputs: [{ name: "tokenId", type: "uint256" }],                                                                             outputs: [{ type: "string" }] },
  { name: "getApproved",  type: "function", stateMutability: "view",       inputs: [{ name: "tokenId", type: "uint256" }],                                                                             outputs: [{ type: "address" }] },
  { name: "minters",      type: "function", stateMutability: "view",       inputs: [{ name: "addr", type: "address" }],                                                                               outputs: [{ type: "bool" }] },
  { name: "nfcHashToTokenId", type: "function", stateMutability: "view",   inputs: [{ name: "hash", type: "bytes32" }],                                                                               outputs: [{ type: "uint256" }] },
  { name: "TwinMinted",   type: "event",    inputs: [{ name: "tokenId", type: "uint256", indexed: true }, { name: "to", type: "address", indexed: true }, { name: "nfcHash", type: "bytes32", indexed: false }, { name: "metadataURI", type: "string", indexed: false }] },
] as const;

export const ESCROW_ABI = [
  {
    name: "getEscrow",
    type: "function", stateMutability: "view",
    inputs:  [{ name: "escrowId", type: "uint256" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "listingId", type: "uint256" },
        { name: "buyer",     type: "address" },
        { name: "seller",    type: "address" },
        { name: "twinId",    type: "uint256" },
        { name: "amount",    type: "uint256" },
        { name: "createdAt", type: "uint256" },
        { name: "state",     type: "uint8"   },
      ],
    }],
  },
  { name: "escrowCount", type: "function", stateMutability: "view",       inputs: [],                                             outputs: [{ type: "uint256" }] },
  { name: "dispute",     type: "function", stateMutability: "nonpayable", inputs: [{ name: "escrowId", type: "uint256" }],        outputs: [] },
  { name: "TIMEOUT",     type: "function", stateMutability: "view",       inputs: [],                                             outputs: [{ type: "uint256" }] },
  { name: "EscrowCreated",  type: "event", inputs: [{ name: "escrowId", type: "uint256", indexed: true }, { name: "listingId", type: "uint256", indexed: true }, { name: "buyer", type: "address", indexed: true }, { name: "seller", type: "address", indexed: false }, { name: "amount", type: "uint256", indexed: false }] },
  { name: "EscrowReleased", type: "event", inputs: [{ name: "escrowId", type: "uint256", indexed: true }, { name: "seller", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }] },
  { name: "EscrowRefunded", type: "event", inputs: [{ name: "escrowId", type: "uint256", indexed: true }, { name: "buyer", type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }] },
  { name: "EscrowDisputed", type: "event", inputs: [{ name: "escrowId", type: "uint256", indexed: true }, { name: "buyer", type: "address", indexed: true }] },
] as const;

export const MARKETPLACE_ABI = [
  {
    name: "getListing",
    type: "function", stateMutability: "view",
    inputs:  [{ name: "listingId", type: "uint256" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "twinId", type: "uint256" },
        { name: "seller", type: "address" },
        { name: "price",  type: "uint256" },
        { name: "active", type: "bool"    },
      ],
    }],
  },
  { name: "listingCount",    type: "function", stateMutability: "view",       inputs: [],                                                                                                                                                      outputs: [{ type: "uint256" }] },
  { name: "listItem",        type: "function", stateMutability: "nonpayable", inputs: [{ name: "twinId", type: "uint256" }, { name: "price", type: "uint256" }, { name: "metadataURI", type: "string" }],                                    outputs: [{ name: "listingId", type: "uint256" }] },
  { name: "buyItem",         type: "function", stateMutability: "nonpayable", inputs: [{ name: "listingId", type: "uint256" }],                                                                                                               outputs: [{ name: "escrowId", type: "uint256" }] },
  { name: "cancelListing",   type: "function", stateMutability: "nonpayable", inputs: [{ name: "listingId", type: "uint256" }],                                                                                                               outputs: [] },
  { name: "confirmDelivery", type: "function", stateMutability: "nonpayable", inputs: [{ name: "escrowId", type: "uint256" }],                                                                                                                outputs: [] },
  { name: "resolveDispute",  type: "function", stateMutability: "nonpayable", inputs: [{ name: "escrowId", type: "uint256" }, { name: "refundBuyer", type: "bool" }],                                                                        outputs: [] },
  { name: "escrowListing",   type: "function", stateMutability: "view",       inputs: [{ name: "escrowId", type: "uint256" }],                                                                                                                outputs: [{ type: "uint256" }] },
  { name: "ItemListed",   type: "event", inputs: [{ name: "listingId", type: "uint256", indexed: true }, { name: "twinId", type: "uint256", indexed: true }, { name: "seller", type: "address", indexed: true }, { name: "price", type: "uint256", indexed: false }, { name: "metadataURI", type: "string", indexed: false }] },
  { name: "ItemSold",     type: "event", inputs: [{ name: "listingId", type: "uint256", indexed: true }, { name: "escrowId", type: "uint256", indexed: true }, { name: "buyer", type: "address", indexed: true }] },
  { name: "ListingCancelled", type: "event", inputs: [{ name: "listingId", type: "uint256", indexed: true }] },
  { name: "DeliveryConfirmed", type: "event", inputs: [{ name: "escrowId", type: "uint256", indexed: true }, { name: "buyer", type: "address", indexed: true }] },
] as const;

export const AGENT_REGISTRY_ABI = [
  { name: "createAgent",       type: "function", stateMutability: "nonpayable", inputs: [],                                         outputs: [{ name: "agentId", type: "uint256" }, { name: "tba", type: "address" }] },
  { name: "ownerOf",           type: "function", stateMutability: "view",       inputs: [{ name: "tokenId", type: "uint256" }],     outputs: [{ type: "address" }] },
  { name: "balanceOf",         type: "function", stateMutability: "view",       inputs: [{ name: "owner", type: "address" }],       outputs: [{ type: "uint256" }] },
  { name: "agentAccount",      type: "function", stateMutability: "view",       inputs: [{ name: "agentId", type: "uint256" }],     outputs: [{ type: "address" }] },
  { name: "computeTBAAddress", type: "function", stateMutability: "view",       inputs: [{ name: "agentId", type: "uint256" }],     outputs: [{ type: "address" }] },
  { name: "agentCount",        type: "function", stateMutability: "view",       inputs: [],                                         outputs: [{ type: "uint256" }] },
  { name: "getUserAgents",     type: "function", stateMutability: "view",       inputs: [{ name: "user", type: "address" }],        outputs: [{ type: "uint256[]" }] },
  { name: "burn",              type: "function", stateMutability: "nonpayable", inputs: [{ name: "agentId", type: "uint256" }],       outputs: [] },
  { name: "AgentCreated",      type: "event",    inputs: [{ name: "agentId", type: "uint256", indexed: true }, { name: "owner", type: "address", indexed: true }, { name: "tba", type: "address", indexed: true }] },
  { name: "AgentBurned",       type: "event",    inputs: [{ name: "agentId", type: "uint256", indexed: true }, { name: "owner", type: "address", indexed: true }] },
] as const;

export const AGENT_FACTORY_ABI = [
  {
    name: "onboardAgent",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "initialFunding", type: "uint256" },
      { name: "maxSingleTrade", type: "uint256" },
      { name: "dailyBudget",    type: "uint256" },
      { name: "autoBuyPrice",   type: "uint256" },
      { name: "autoBuyActive",  type: "bool"    },
    ],
    outputs: [
      { name: "agentId", type: "uint256" },
      { name: "tba",     type: "address" },
    ],
  },
  { name: "AgentOnboarded", type: "event", inputs: [{ name: "agentId", type: "uint256", indexed: true }, { name: "owner", type: "address", indexed: true }, { name: "tba", type: "address", indexed: true }, { name: "initialFunding", type: "uint256", indexed: false }] },
] as const;

export const AGENT_ACCOUNT_ABI = [
  { name: "owner",          type: "function", stateMutability: "view",       inputs: [],                                                                                              outputs: [{ type: "address" }] },
  { name: "maxSingleTrade", type: "function", stateMutability: "view",       inputs: [],                                                                                              outputs: [{ type: "uint256" }] },
  { name: "dailyBudget",    type: "function", stateMutability: "view",       inputs: [],                                                                                              outputs: [{ type: "uint256" }] },
  { name: "dailySpent",     type: "function", stateMutability: "view",       inputs: [],                                                                                              outputs: [{ type: "uint256" }] },
  {
    name: "autoBuyPolicy",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "maxPrice", type: "uint256" },
          { name: "active",   type: "bool"    },
        ],
      },
    ],
  },
  { name: "setPolicy",      type: "function", stateMutability: "nonpayable", inputs: [{ name: "_maxSingleTrade", type: "uint256" }, { name: "_dailyBudget", type: "uint256" }],      outputs: [] },
  { name: "setAutoBuyPolicy", type: "function", stateMutability: "nonpayable", inputs: [{ name: "maxPrice", type: "uint256" }, { name: "active", type: "bool" }],              outputs: [] },
  { name: "setExecutor",    type: "function", stateMutability: "nonpayable", inputs: [{ name: "executor", type: "address" }, { name: "authorised", type: "bool" }],                 outputs: [] },
] as const;

export const VERIFIER_ABI = [
  {
    name: "getNode",
    type: "function", stateMutability: "view",
    inputs:  [{ name: "nodeAddr", type: "address" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "stake",  type: "uint256" },
        { name: "active", type: "bool"    },
      ],
    }],
  },
  {
    name: "getAttestation",
    type: "function", stateMutability: "view",
    inputs:  [{ name: "escrowId", type: "uint256" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "node",      type: "address" },
        { name: "nfcHash",   type: "bytes32" },
        { name: "finalized", type: "bool"    },
      ],
    }],
  },
  { name: "MIN_STAKE",          type: "function", stateMutability: "view",       inputs: [],                                                                                       outputs: [{ type: "uint256" }] },
  { name: "registerNode",       type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }],                                                   outputs: [] },
  { name: "deregisterNode",     type: "function", stateMutability: "nonpayable", inputs: [],                                                                                       outputs: [] },
  { name: "submitVerification", type: "function", stateMutability: "nonpayable", inputs: [{ name: "escrowId", type: "uint256" }, { name: "nfcHash", type: "bytes32" }],           outputs: [] },
  { name: "challengeVerification", type: "function", stateMutability: "nonpayable", inputs: [{ name: "escrowId", type: "uint256" }, { name: "slashAmt", type: "uint256" }],       outputs: [] },
  { name: "slash",              type: "function", stateMutability: "nonpayable", inputs: [{ name: "node", type: "address" }, { name: "amount", type: "uint256" }, { name: "reason", type: "string" }], outputs: [] },
  { name: "NodeRegistered",     type: "event",    inputs: [{ name: "node",    type: "address", indexed: true }, { name: "stake",   type: "uint256", indexed: false }] },
  { name: "NodeDeregistered",   type: "event",    inputs: [{ name: "node",    type: "address", indexed: true }, { name: "returned", type: "uint256", indexed: false }] },
  { name: "VerificationSubmitted", type: "event", inputs: [{ name: "escrowId", type: "uint256", indexed: true }, { name: "node", type: "address", indexed: true }, { name: "nfcHash", type: "bytes32", indexed: false }] },
  { name: "NodeSlashed",        type: "event",    inputs: [{ name: "node",    type: "address", indexed: true }, { name: "amount", type: "uint256", indexed: false }, { name: "reason", type: "string", indexed: false }] },
] as const;

export const REPUTATION_ABI = [
  {
    name: "statsOf",
    type: "function", stateMutability: "view",
    inputs:  [{ name: "user", type: "address" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "score",           type: "int256"  },
        { name: "completedTrades", type: "uint256" },
        { name: "verifications",   type: "uint256" },
        { name: "disputes",        type: "uint256" },
      ],
    }],
  },
  { name: "tokenOf",        type: "function", stateMutability: "view",       inputs: [{ name: "user",   type: "address" }],                                             outputs: [{ type: "uint256" }] },
  { name: "authorized",     type: "function", stateMutability: "view",       inputs: [{ name: "caller", type: "address" }],                                             outputs: [{ type: "bool"    }] },
  { name: "setAuthorized",  type: "function", stateMutability: "nonpayable", inputs: [{ name: "caller", type: "address" }, { name: "status", type: "bool" }],           outputs: [] },
  { name: "ReputationMinted", type: "event",  inputs: [{ name: "user",    type: "address", indexed: true }, { name: "tokenId", type: "uint256", indexed: true }] },
  { name: "ScoreUpdated",     type: "event",  inputs: [{ name: "user",    type: "address", indexed: true }, { name: "delta",   type: "int256",  indexed: false }, { name: "newScore", type: "int256", indexed: false }] },
] as const;

export const STAKING_ABI = [
  {
    name: "getStake",
    type: "function", stateMutability: "view",
    inputs:  [{ name: "staker", type: "address" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "amount",              type: "uint256" },
        { name: "unstakeInitiatedAt",  type: "uint256" },
      ],
    }],
  },
  { name: "MIN_STAKE",       type: "function", stateMutability: "view",       inputs: [],                                                                                                       outputs: [{ type: "uint256" }] },
  { name: "COOLDOWN",        type: "function", stateMutability: "view",       inputs: [],                                                                                                       outputs: [{ type: "uint256" }] },
  { name: "cooldownEnd",     type: "function", stateMutability: "view",       inputs: [{ name: "staker", type: "address" }],                                                                    outputs: [{ type: "uint256" }] },
  { name: "totalStaked",     type: "function", stateMutability: "view",       inputs: [],                                                                                                       outputs: [{ type: "uint256" }] },
  { name: "stake",           type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }],                                                                    outputs: [] },
  { name: "initiateUnstake", type: "function", stateMutability: "nonpayable", inputs: [],                                                                                                       outputs: [] },
  { name: "completeUnstake", type: "function", stateMutability: "nonpayable", inputs: [],                                                                                                       outputs: [] },
  { name: "slash",           type: "function", stateMutability: "nonpayable", inputs: [{ name: "staker", type: "address" }, { name: "amount", type: "uint256" }, { name: "reason", type: "string" }], outputs: [] },
  { name: "Staked",           type: "event", inputs: [{ name: "staker", type: "address", indexed: true }, { name: "amount",  type: "uint256", indexed: false }, { name: "total", type: "uint256", indexed: false }] },
  { name: "UnstakeInitiated", type: "event", inputs: [{ name: "staker", type: "address", indexed: true }, { name: "amount",  type: "uint256", indexed: false }, { name: "cooldownEnd", type: "uint256", indexed: false }] },
  { name: "Unstaked",         type: "event", inputs: [{ name: "staker", type: "address", indexed: true }, { name: "amount",  type: "uint256", indexed: false }] },
  { name: "Slashed",          type: "event", inputs: [{ name: "staker", type: "address", indexed: true }, { name: "amount",  type: "uint256", indexed: false }, { name: "reason", type: "string", indexed: false }] },
] as const;

// ─── Escrow state enum ─────────────────────────────────────────────────────────

export const ESCROW_STATE = {
  0: "Pending",
  1: "Released",
  2: "Refunded",
  3: "Disputed",
} as const;
