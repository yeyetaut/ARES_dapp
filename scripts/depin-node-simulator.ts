import hre from "hardhat";
import { keccak256, toUtf8Bytes } from "ethers";

/**
 * DePIN Node Simulator
 * 
 * This script simulates a physical verification node. 
 * It registers as a verifier, listens for new Escrow agreements, 
 * and automatically submits "verifications" after a simulated delay.
 */

export async function main() {
  const [node] = await hre.ethers.getSigners();
  console.log("Starting DePIN Node Simulator with address:", node.address);

  // Set polling interval to 10 seconds to reduce CPU usage
  const provider = hre.ethers.provider;
  provider.pollingInterval = 10000;

  // 1. Get contract instances (Placeholder addresses - update after deploy)
  const VERIFIER_ADDR = process.env.VERIFIER_ADDR || "";
  const ESCROW_ADDR = process.env.ESCROW_ADDR || "";
  const TWIN_ADDR = process.env.TWIN_ADDR || "";
  const USDC_ADDR = process.env.USDC_ADDR || "";

  if (!VERIFIER_ADDR || !ESCROW_ADDR || !TWIN_ADDR || !USDC_ADDR) {
    console.error("Error: VERIFIER_ADDR, ESCROW_ADDR, TWIN_ADDR, and USDC_ADDR must be set.");
    return;
  }

  const Verifier = await hre.ethers.getContractAt("Verifier", VERIFIER_ADDR);
  const Escrow = await hre.ethers.getContractAt("Escrow", ESCROW_ADDR);
  const DigitalTwin = await hre.ethers.getContractAt("DigitalTwin", TWIN_ADDR);
  const MockUSDC = await hre.ethers.getContractAt("MockUSDC", USDC_ADDR);

  // 2. Node Registration
  const nodeInfo = await Verifier.getNode(node.address);
  if (!nodeInfo.active) {
    console.log("Node not active. Registering with MIN_STAKE...");
    const minStake = 100n * 10n ** 6n;
    
    // Faucet some USDC if needed
    const bal = await MockUSDC.balanceOf(node.address);
    if (bal < minStake) {
        console.log("Minting USDC for stake...");
        await (await MockUSDC.connect(node).faucet()).wait();
    }

    await (await MockUSDC.connect(node).approve(VERIFIER_ADDR, minStake)).wait();
    await (await Verifier.connect(node).registerNode(minStake)).wait();
    console.log("Node registered successfully!");
  } else {
    console.log("Node is already active. Stake:", nodeInfo.stake / 10n**6n, "USDC");
  }

  // 3. Listen for EscrowCreated events
  console.log("Monitoring Escrow at:", ESCROW_ADDR);
  
  Escrow.on("EscrowCreated", async (escrowId, listingId, buyer, seller, amount, event) => {
    console.log(`\n[Event] New Escrow Created! ID: ${escrowId}, Amount: ${amount / 10n**6n} USDC`);
    console.log(`Buyer: ${buyer}, Seller: ${seller}`);

    // Simulate physical item transit and inspection delay
    const delayMs = 10000; // 10 seconds
    console.log(`Simulating physical transit & inspection (${delayMs/1000}s)...`);
    
    setTimeout(async () => {
      try {
        console.log(`Retrieving NFC hash for Escrow ${escrowId}...`);
        
        // Fetch twinId from escrow record
        const rec = await Escrow.getEscrow(escrowId);
        const twinId = rec.twinId;
        
        // Fetch the registered NFC hash for that twin
        const nfcHash = await DigitalTwin.tokenIdToNfcHash(twinId);
        
        console.log(`Submitting verification for Escrow ${escrowId} with hash: ${nfcHash}`);
        const tx = await Verifier.connect(node).submitVerification(escrowId, nfcHash);
        const receipt = await tx.wait();
        
        console.log(`[Success] Verification submitted! Escrow ${escrowId} settled. TX: ${receipt?.hash}`);
      } catch (err) {
        console.error(`Error submitting verification for Escrow ${escrowId}:`, err);
      }
    }, delayMs);
  });

  // Keep script running
  console.log("Simulator is running. Press Ctrl+C to stop.");
  await new Promise(() => {}); 
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
