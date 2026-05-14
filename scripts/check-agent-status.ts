import { ethers } from "hardhat";

async function main() {
  const USER_ADDRESS = "0x595933FA2bdb94E1743eCBF66faa8FaA5DB53f29";
  const REGISTRY_ADDRESS = "0xBb2F80d1C618e1ce71100752F22275B9Da20f122";
  const USDC_ADDRESS = "0x0CE88A3F67cA52794C5E3343DD6f08A940CcE2c4";
  const MARKETPLACE_ADDRESS = "0x151Ee43316DCcb11C5390EadE8CCe3234D36b9a3";

  console.log("\n--- ARES AGENT DIAGNOSTIC ---");
  console.log("Checking Address:", USER_ADDRESS);

  const registry = await ethers.getContractAt("AgentRegistry", REGISTRY_ADDRESS);
  const usdc = await ethers.getContractAt("MockUSDC", USDC_ADDRESS);
  const marketplace = await ethers.getContractAt("Marketplace", MARKETPLACE_ADDRESS);

  // 1. Check Agents
  try {
    const balance = await registry.balanceOf(USER_ADDRESS);
    console.log("Agent NFT Balance:", balance.toString());

    if (balance > 0) {
        console.log("Agents Owned:");
        const totalAgents = await registry.agentCount();
        for (let i = 1; i <= Number(totalAgents); i++) {
            try {
                const owner = await registry.ownerOf(i);
                if (owner.toLowerCase() === USER_ADDRESS.toLowerCase()) {
                    const tba = await registry.agentAccount(i);
                    const agentAccount = await ethers.getContractAt("AgentAccount", tba);
                    
                    const policy = await agentAccount.autoBuyPolicy();
                    const tbaUsdcBal = await usdc.balanceOf(tba);
                    const isExecutor = await agentAccount.authorisedExecutors(USER_ADDRESS); // The user's own address might not be the executor script's address

                    console.log(`\n - Agent #${i} | TBA: ${tba}`);
                    console.log(`   USDC Balance: ${ethers.formatUnits(tbaUsdcBal, 6)} USDC`);
                    console.log(`   Auto-Buy: ${policy.active ? "ACTIVE" : "INACTIVE"}`);
                    console.log(`   Max Price: ${ethers.formatUnits(policy.maxPrice, 6)} USDC`);
                    console.log(`   User is Authorized Executor: ${isExecutor}`);
                }
            } catch (e) {}
        }
    }
  } catch (e) {
    console.log("Error checking Registry:", e.message);
  }

  // 2. Check Marketplace Listings
  try {
    const listingCount = await marketplace.listingCount();
    console.log(`\nMarketplace Listing Count: ${listingCount}`);
    for (let i = 1; i <= Number(listingCount); i++) {
        const listing = await marketplace.getListing(i);
        if (listing.active) {
            console.log(` - Listing #${i} | Price: ${ethers.formatUnits(listing.price, 6)} USDC | Seller: ${listing.seller}`);
        }
    }
  } catch (e) {
    console.log("Error checking Marketplace:", e.message);
  }

  console.log("-----------------------------\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
