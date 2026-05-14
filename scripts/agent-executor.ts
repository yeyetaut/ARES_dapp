import hre from "hardhat";
import { keccak256, toUtf8Bytes } from "ethers";

/**
 * Agent Executor Service
 * 
 * This script monitors the Marketplace for new listings and 
 * triggers Agent TBAs to execute auto-buys if they match their policies.
 */

export async function main() {
  const [executor] = await hre.ethers.getSigners();
  console.log("Starting Agent Executor with address:", executor.address);

  // Set polling interval to 10 seconds to reduce CPU usage
  const provider = hre.ethers.provider;
  provider.pollingInterval = 10000;

  // 1. Get contract instances
  // In a real scenario, these addresses would come from a deployment config
  // For this simulation, we'll assume they are passed or we use a known deployment
  
  // Note: For simulation purposes in this script, we'll use the addresses from a local deployment
  // If we were running this against a live network, we'd load them from .env or a file.
  
  // Let's assume we are running this on a local node where we just deployed everything.
  // For the sake of the exercise, I'll write the script to be "runnable" after a deploy.

  // Placeholder addresses - these should be updated after deployment
  const MARKETPLACE_ADDR = process.env.MARKETPLACE_ADDR || "";
  const REGISTRY_ADDR = process.env.REGISTRY_ADDR || "";
  const ESCROW_ADDR = process.env.ESCROW_ADDR || "";
  const USDC_ADDR = process.env.USDC_ADDR || "";

  if (!MARKETPLACE_ADDR || !REGISTRY_ADDR) {
    console.error("Error: MARKETPLACE_ADDR and REGISTRY_ADDR must be set.");
    return;
  }

  const Marketplace = await hre.ethers.getContractAt("Marketplace", MARKETPLACE_ADDR);
  const Registry = await hre.ethers.getContractAt("AgentRegistry", REGISTRY_ADDR);

  console.log("Monitoring Marketplace at:", MARKETPLACE_ADDR);

  // 2. Listen for ItemListed events
  Marketplace.on("ItemListed", async (listingId, twinId, seller, price, metadataURI, event) => {
    console.log(`\n[Event] New Item Listed! ID: ${listingId}, Price: ${price / 10n**6n} USDC`);
    
    // 3. Find candidate Agents
    const agentCount = await Registry.agentCount();
    console.log(`Checking ${agentCount} agents for auto-buy suitability...`);


    for (let i = 1n; i <= agentCount; i++) {
      const tbaAddr = await Registry.agentAccount(i);
      const AgentAccount = await hre.ethers.getContractAt("AgentAccount", tbaAddr);

      try {
        // Check policy
        const policy = await AgentAccount.autoBuyPolicy();
        const maxSingle = await AgentAccount.maxSingleTrade();
        const budget = await AgentAccount.dailyBudget();
        const spent = await AgentAccount.dailySpent();
        const isExecutor = await AgentAccount.authorisedExecutors(executor.address);

        if (!policy.active) continue;
        if (!isExecutor) {
          console.log(`Agent ${i} (${tbaAddr}) is not authorizing this executor. Skipping.`);
          continue;
        }

        if (price > policy.maxPrice) {
          console.log(`Agent ${i}: Price ${price} exceeds maxPrice ${policy.maxPrice}.`);
          continue;
        }

        if (maxSingle > 0n && price > maxSingle) {
          console.log(`Agent ${i}: Price exceeds maxSingleTrade.`);
          continue;
        }

        if (budget > 0n && spent + price > budget) {
          console.log(`Agent ${i}: Price exceeds daily budget.`);
          continue;
        }

        // 4. Execute Buy
        console.log(`Agent ${i} matches! Executing auto-buy for listing ${listingId}...`);
        const tx = await AgentAccount.connect(executor).executeAutoBuy(
          MARKETPLACE_ADDR,
          ESCROW_ADDR,
          USDC_ADDR,
          listingId
        );
        const receipt = await tx.wait();
        console.log(`[Success] Agent ${i} bought listing ${listingId}. TX: ${receipt?.hash}`);
        
        // Stop after first successful buy for this listing (it's no longer active)
        break; 

      } catch (err) {
        console.error(`Error processing Agent ${i}:`, err);
      }
    }
  });

  // Keep script running
  console.log("Executor is running. Press Ctrl+C to stop.");
  await new Promise(() => {}); 
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
