# ARES — Agentic Resell Ecosystem & Settlement
> **STATUS: [ ACTIVE_TELEMETRY_UPLINK ] // REV: 1.0.4-LOCKED**

A machine-to-machine marketplace for physical collectibles, where autonomous AI agents trade via on-chain wallets (ERC-6551 TBAs) and physical authenticity is verified by DePIN hardware nodes.

---

## 01 // OVERVIEW

ARES is a trustless protocol designed for the next generation of autonomous commerce. It bridges the gap between physical high-value assets and decentralized digital ownership through:

- **AI Fleet Management:** Deploy and fund autonomous trading agents with strict risk policies.
- **Physical Provenance:** Digital Twin NFTs (ERC-721) linked to hardware NFC payloads.
- **Trustless Settlement:** Escrow-based trade cycles finalized only upon DePIN attestation.
- **Tactical UI:** A high-density, industrial terminal interface designed for real-time telemetry.

---

## 02 // TECHNICAL_STACK

### SMART_CONTRACTS (ETHEREUM / SEPOLIA)
- `AgentRegistry.sol`: Mints Agent NFTs and auto-deploys ERC-6551 Token-Bound Accounts.
- `DigitalTwin.sol`: ERC-721 representing physical items with cryptographic NFC hashes.
- `Marketplace.sol`: Orchestrates listings, trade handshakes, and capital sync.
- `Escrow.sol`: Securely locks liquidity (USDC) during the verification cycle.
- `Verifier.sol`: Manages DePIN node registration and proof-of-authenticity submission.

### FRONTEND (NEXT.JS / TACTICAL_UI)
- **Design Archetype:** Industrial Brutalism / Tactical Telemetry.
- **Stack:** React 19, Tailwind CSS 4, Wagmi/RainbowKit, Framer Motion.
- **Visuals:** CRT Scanlines, mechanical noise, rigid grid determinism, monospaced matrices.

---

## 03 // ARCHITECTURE

```text
[ USER_WALLET ] >>> [ AGENT_REGISTRY ] >>> [ AGENT_TBA (USDC) ]
                          v
[ MARKETPLACE ] << [ PHYSICAL_ASSET ] >> [ DIGITAL_TWIN_NFT ]
                          v
[ ESCROW_SYNC ] << [ DEPIN_NODE ] >> [ NFC_ATTESTATION ]
```

1. **Initialization:** User onboards an Agent; a TBA is auto-deployed for capital management.
2. **Provenance:** Seller mints a Digital Twin, providing a secret NFC seed (hashed on-chain).
3. **Handshake:** Agent/Buyer triggers `buyItem`, locking USDC in the Escrow contract.
4. **Attestation:** Physical item is scanned; DePIN node submits the proof.
5. **Settlement:** On hash match, Escrow releases funds to Seller and NFT to Buyer.

---

## 04 // SETUP_INSTRUCTIONS

### LOCAL_ENVIRONMENT
```bash
# 1. Install Workspace Dependencies
npm install

# 2. Compile Hardhat Artifacts
npx hardhat compile

# 3. Start Frontend Terminal
cd frontend
npm install
npm run dev
```

### PERSISTENT_AGENT_BACKEND
The Agent Executor monitors the registry 24/7 to perform auto-buys.
```bash
# Run local simulation
npm run sim:executor --network sepolia
```

---

## 05 // DEPLOYMENT_CONFIG

### FRONTEND (VERCEL)
Deployed to production at: [ARES Command Terminal](https://frontend-smoky-chi-43.vercel.app)

### AGENT_EXECUTOR (RAILWAY)
Configured as a persistent background worker using the provided `Dockerfile` and `Procfile`.

---

## 06 // ENV_SYNC

Required system parameters for `.env`:
```ini
SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/..."
PRIVATE_KEY="0x..."
ETHERSCAN_API_KEY="..."
```

---

## // END_OF_LINE
© 2026 HKUST BLOCKCHAIN LAB // ARES PROTOCOL UNIT 
`LAT: 22.3364° N // LONG: 114.2655° E`
