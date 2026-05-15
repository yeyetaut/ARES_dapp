import { ethers } from "hardhat";

async function main() {
  const USER_ADDRESS = "0x595933FA2bdb94E1743eCBF66faa8FaA5DB53f29";
  
  const VERIFIER_ADDRESS = "0x724B0A954142f864DCc5D6ab7CA6936E0C5021df";
  const ESCROW_ADDRESS = "0x7CC6176615461333e3a78B8C43F4c14a1a2050Bb";
  const TWIN_ADDRESS = "0x228FFc728df832522c7399b13e7f3c43F55606e6";

  console.log("\n--- ARES VERIFIER DIAGNOSTIC ---");
  console.log("Checking Address:", USER_ADDRESS);

  const verifier = await ethers.getContractAt("Verifier", VERIFIER_ADDRESS);
  const escrow = await ethers.getContractAt("Escrow", ESCROW_ADDRESS);
  const twin = await ethers.getContractAt("DigitalTwin", TWIN_ADDRESS);

  // 1. Check Node Status
  try {
    const node = await verifier.nodes(USER_ADDRESS);
    console.log(`\nNode Status for ${USER_ADDRESS}:`);
    console.log(` - Active: ${node.active}`);
    console.log(` - Stake: ${ethers.formatUnits(node.stake, 6)} USDC`);
  } catch (e: any) {
    console.log("Error checking Verifier:", e.message);
  }

  // 2. Check Escrows
  try {
    const escrowCount = await escrow.escrowCount();
    console.log(`\nEscrow Count: ${escrowCount}`);
    for (let i = 1; i <= Number(escrowCount); i++) {
        const rec = await escrow.getEscrow(i);
        const att = await verifier.getAttestation(i);
        const expectedHash = await twin.tokenIdToNfcHash(rec.twinId);

        console.log(`\n - Escrow #${i}:`);
        console.log(`   Buyer: ${rec.buyer}`);
        console.log(`   Seller: ${rec.seller}`);
        console.log(`   Twin ID: ${rec.twinId}`);
        console.log(`   State: ${rec.state} (0=Pending, 1=Released, 2=Refunded, 3=Disputed)`);
        console.log(`   Verified: ${att.finalized}`);
        console.log(`   Expected NFC Hash: ${expectedHash}`);
    }
  } catch (e: any) {
    console.log("Error checking Escrows:", e.message);
  }

  console.log("-----------------------------\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
