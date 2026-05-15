import hre from "hardhat";

/**
 * Agent Executor Service
 * 
 * This script monitors the Marketplace for new listings and 
 * triggers Agent TBAs to execute auto-buys if they match their policies.
 */

async function processListing(
  listingId: bigint,
  price: bigint,
  Marketplace: any,
  Registry: any,
  executor: any,
  MARKETPLACE_ADDR: string,
  ESCROW_ADDR: string,
  USDC_ADDR: string
) {
  console.log(`\nChecking suitability for Listing ID: ${listingId}, Price: ${Number(price) / 10**6} USDC`);
  
  const agentCount = await Registry.agentCount();
  for (let i = 1n; i <= agentCount; i++) {
    const tbaAddr = await Registry.agentAccount(i);
    const AgentAccount = await hre.ethers.getContractAt("AgentAccount", hre.ethers.getAddress(tbaAddr));

    try {
      const policy = await AgentAccount.autoBuyPolicy();
      const maxSingle = await AgentAccount.maxSingleTrade();
      const budget = await AgentAccount.dailyBudget();
      const spent = await AgentAccount.dailySpent();
      const isExecutor = await AgentAccount.authorisedExecutors(hre.ethers.getAddress(executor.address));
      const agentOwner = await AgentAccount.owner();
      const isOwner = agentOwner.toLowerCase() === executor.address.toLowerCase();

      if (!policy.active) continue;
      if (!isExecutor && !isOwner) {
        // console.log(`Agent ${i} (${tbaAddr}) is not authorizing this executor. Skipping.`);
        continue;
      }

      if (price > policy.maxPrice) {
        console.log(`Agent ${i}: Price exceeds maxPrice ${policy.maxPrice}.`);
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

      // Execute Buy
      console.log(`Agent ${i} matches! Executing auto-buy for listing ${listingId}...`);
      const tx = await AgentAccount.connect(executor).executeAutoBuy(
        hre.ethers.getAddress(MARKETPLACE_ADDR),
        hre.ethers.getAddress(ESCROW_ADDR),
        hre.ethers.getAddress(USDC_ADDR),
        listingId
      );
      const receipt = await tx.wait();
      console.log(`[Success] Agent ${i} bought listing ${listingId}. TX: ${receipt?.hash}`);
      
      return true; // Stop after first successful buy
    } catch (err: any) {
      console.error(`Error processing Agent ${i}:`, err.message);
    }
  }
  return false;
}

export async function main() {
  const [executor] = await hre.ethers.getSigners();
  console.log("Starting Agent Executor with address:", executor.address);

  const MARKETPLACE_ADDR = process.env.MARKETPLACE_ADDR || "";
  const REGISTRY_ADDR = process.env.REGISTRY_ADDR || "";
  const ESCROW_ADDR = process.env.ESCROW_ADDR || "";
  const USDC_ADDR = process.env.USDC_ADDR || "";

  if (!MARKETPLACE_ADDR || !REGISTRY_ADDR) {
    console.error("Error: MARKETPLACE_ADDR and REGISTRY_ADDR must be set in .env");
    return;
  }

  const Marketplace = await hre.ethers.getContractAt("Marketplace", hre.ethers.getAddress(MARKETPLACE_ADDR));
  const Registry = await hre.ethers.getContractAt("AgentRegistry", hre.ethers.getAddress(REGISTRY_ADDR));

  console.log("Monitoring Marketplace at:", MARKETPLACE_ADDR);

  // 1. Process existing listings
  const listingCount = await Marketplace.listingCount();
  console.log(`Checking ${listingCount} existing listings...`);
  for (let i = 1n; i <= listingCount; i++) {
    const listing = await Marketplace.getListing(i);
    if (listing.active) {
      await processListing(i, listing.price, Marketplace, Registry, executor, MARKETPLACE_ADDR, ESCROW_ADDR, USDC_ADDR);
    }
  }

  // 2. Listen for new ItemListed events
  Marketplace.on("ItemListed", async (listingId, twinId, seller, price, metadataURI) => {
    await processListing(listingId, price, Marketplace, Registry, executor, MARKETPLACE_ADDR, ESCROW_ADDR, USDC_ADDR);
  });

  console.log("Executor is running and listening for events. Press Ctrl+C to stop.");
  await new Promise(() => {}); 
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
