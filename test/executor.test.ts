import { assert } from "chai";
import hre from "hardhat";
import { keccak256, toUtf8Bytes } from "ethers";

describe("Agent Executor Logic", function () {
  async function deployCore() {
    const [owner, user, executor, seller] = await hre.ethers.getSigners();

    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC", owner);
    const usdc = await MockUSDC.deploy();

    const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry", owner);
    const registry = await AgentRegistry.deploy();

    const DigitalTwin = await hre.ethers.getContractFactory("DigitalTwin", owner);
    const twin = await DigitalTwin.deploy();

    const Escrow = await hre.ethers.getContractFactory("Escrow", owner);
    const escrow = await Escrow.deploy(await usdc.getAddress());

    const Marketplace = await hre.ethers.getContractFactory("Marketplace", owner);
    const marketplace = await Marketplace.deploy(await twin.getAddress(), await escrow.getAddress());

    await escrow.setMarketplace(await marketplace.getAddress());

    return { usdc, registry, twin, escrow, marketplace, owner, user, executor, seller };
  }

  it("Executor: can identify and trigger auto-buy for matching agent", async function () {
    const { usdc, registry, twin, escrow, marketplace, user, executor, seller } = await deployCore();
    
    // 1. Setup Agent with auto-buy policy
    const maxPrice = 300n * 10n ** 6n;
    await registry.connect(user).createAgentWithPolicy(1000n * 10n ** 6n, 2000n * 10n ** 6n, maxPrice, true);
    const tbaAddr = await registry.agentAccount(1);
    const agent = await hre.ethers.getContractAt("AgentAccount", tbaAddr);
    
    // Authorize executor and fund agent
    await agent.connect(user).setExecutor(executor.address, true);
    await usdc.mint(tbaAddr, 1000n * 10n ** 6n);

    // 2. Setup Listing that matches policy
    await twin.mint(seller.address, keccak256(toUtf8Bytes("item-1")), "ipfs://1");
    await twin.connect(seller).approve(await marketplace.getAddress(), 1);
    await marketplace.connect(seller).listItem(1, 250n * 10n ** 6n, "ipfs://meta");

    // 3. Simulated Executor Logic (what scripts/agent-executor.ts does)
    const agentCount = await registry.agentCount();
    let bought = false;

    for (let i = 1n; i <= agentCount; i++) {
        const candidateTba = await registry.agentAccount(i);
        const candidateAgent = await hre.ethers.getContractAt("AgentAccount", candidateTba);
        
        const policy = await candidateAgent.autoBuyPolicy();
        const isExecutor = await candidateAgent.authorisedExecutors(executor.address);
        
        // Simulating the check for listingId 1
        const [, , price, active] = await marketplace.getListing(1);
        
        if (active && policy.active && isExecutor && price <= policy.maxPrice) {
            await candidateAgent.connect(executor).executeAutoBuy(
                await marketplace.getAddress(),
                await escrow.getAddress(),
                await usdc.getAddress(),
                1 // listingId
            );
            bought = true;
            break;
        }
    }

    // 4. Verification
    assert.isTrue(bought, "Executor should have triggered the buy");
    const listing = await marketplace.getListing(1);
    assert.isFalse(listing.active);
    const escId = await marketplace.escrowListing(1);
    const esc = await escrow.getEscrow(escId);
    assert.equal(esc.buyer, tbaAddr);
  });
});
