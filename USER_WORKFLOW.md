# ARES User Workflow Guide

This document outlines the logical flow of the ARES (Agentic Resell Ecosystem & Settlement) platform, focusing on the Marketplace, Dashboard, and Verification modules.

## 1. The Core Lifecycle: From Listing to Settlement

The ARES protocol facilitates trustless trade through a 5-step lifecycle:
1. **Listing:** A seller mints a "Digital Twin" (ERC-721) representing a physical item and lists it for sale.
2. **Purchase:** A buyer (often an AI Agent) locks funds in an Escrow contract.
3. **Shipping:** The seller ships the physical item to the buyer or a verification hub.
4. **Verification:** A DePIN node scans the NFC tag on the physical item to verify authenticity.
5. **Settlement:** Upon successful verification, funds are released to the seller, and the Digital Twin NFT is transferred to the buyer.

---

## 2. Dashboard: Agent Management & Command Center
The Dashboard is the primary interface for users to manage their fleet of autonomous agents and track their trade history.

### User Actions:
- **Onboard Agent:**
    - Deploy a new ERC-6551 Token-Bound Account (TBA) for an Agent NFT.
    - Set initial parameters: `Initial Funding (USDC)`, `Max Auto-Price`, `Daily Budget`, and `Max Single Trade`.
- **Fund Agent:**
    - Transfer USDC directly to the Agent's TBA so it can perform autonomous trades.
- **Configure Policies:**
    - Update the Agent's autonomous trading rules (e.g., toggle "Autonomous" vs. "Manual" mode, adjust price ceilings).
- **Monitor Settlement History:**
    - View active and past Escrows.
    - **Open Dispute:** If a trade goes wrong (e.g., item never arrives), the buyer can flag an escrow as "Disputed."
- **USDC Faucet:**
    - Mint testnet USDC to interact with the protocol on Sepolia.

---

## 3. Marketplace: The Global Exchange
The Marketplace is where physical assets are discovered and traded.

### User Actions:
- **Browse Listings:**
    - View all active Digital Twins currently for sale.
    - Inspect specific items to see `twinId`, `price`, `seller`, and metadata (visualized as "Digital Twins").
- **List Asset:**
    - Mint a new Digital Twin by providing an NFC hash and metadata.
    - Set a listing price in USDC.
- **Buy Item:**
    - Purchase an item directly. This triggers the `buyItem` function on the Marketplace contract, which creates a new `Escrow` and locks the buyer's USDC.
    - *Note: Agents with "Auto-Buy" enabled will monitor these listings and purchase items that match their policy.*

---

## 4. Verify: DePIN Node Operations
The Verification module is for specialized "Verifiers" who bridge the physical and digital worlds.

### User Actions:
- **Node Registration:**
    - **Approve USDC:** Grant the Verifier contract permission to spend your USDC.
    - **Stake & Register:** Stake the minimum required USDC (e.g., 100 USDC) to become an active Verifier Node.
- **Submit Verification:**
    - **Input Escrow ID:** The specific trade being verified.
    - **NFC Tag Data:** Scan/input the raw NFC data from the physical item. The UI hashes this to match the on-chain NFC hash.
    - **Confirm:** Submitting this releases the funds from Escrow to the seller and completes the trade.
- **Node Management:**
    - **Deregister:** Withdraw stake and deactivate the node.
- **Attestation Lookup:**
    - Check the verification status of any Escrow ID to see which node performed the verification and the resulting NFC hash.

---

## 5. Logical Summary Table

| Phase | Module | Primary User | Key Contract Call | Result |
| :--- | :--- | :--- | :--- | :--- |
| **Setup** | Dashboard | Owner | `onboardAgent` | New Agent & TBA deployed |
| **Offer** | Marketplace | Seller | `listItem` | NFT listed for price X |
| **Commit** | Marketplace | Buyer/Agent | `buyItem` | USDC locked in Escrow |
| **Verify** | Verify | Verifier Node | `submitVerification` | NFC hash match confirmed |
| **Settle** | Automatic | Protocol | `confirmDelivery` | Funds to Seller, NFT to Buyer |
