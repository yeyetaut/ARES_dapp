import { assert } from "chai";
import hre from "hardhat";
import { keccak256, toUtf8Bytes } from "ethers";

describe("Phase 5: Agent Autonomy", function () {
  async function deployCore() {
    const [deployer, user, executor, seller] = await hre.ethers.getSigners();

    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC", deployer);
    const usdc = await MockUSDC.deploy();

    const AgentAccount = await hre.ethers.getContractFactory("AgentAccount", deployer);
    const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry", deployer);
    const registry = await AgentRegistry.deploy();

    const DigitalTwin = await hre.ethers.getContractFactory("DigitalTwin", deployer);
    const twin = await DigitalTwin.deploy();

    const Escrow = await hre.ethers.getContractFactory("Escrow", deployer);
    const escrow = await Escrow.deploy(await usdc.getAddress());

    const Marketplace = await hre.ethers.getContractFactory("Marketplace", deployer);
    const marketplace = await Marketplace.deploy(await twin.getAddress(), await escrow.getAddress());

    await escrow.setMarketplace(await marketplace.getAddress());

    const AgentFactory = await hre.ethers.getContractFactory("AgentFactory", deployer);
    const factory = await AgentFactory.deploy(await registry.getAddress(), await usdc.getAddress());

    return { usdc, registry, twin, escrow, marketplace, factory, deployer, user, executor, seller };
  }

  it("AgentFactory: onboardAgent creates, funds, and configures an agent", async function () {
    const { usdc, factory, user } = await deployCore();
    const initialFunding = 500n * 10n ** 6n;
    const maxSingle = 100n * 10n ** 6n;
    const budget = 200n * 10n ** 6n;
    const autoPrice = 150n * 10n ** 6n;

    await usdc.mint(user.address, initialFunding);
    await usdc.connect(user).approve(await factory.getAddress(), initialFunding);

    const tx = await factory.connect(user).onboardAgent(
      initialFunding,
      maxSingle,
      budget,
      autoPrice,
      true
    );
    const receipt = await tx.wait();
    
    // Find AgentOnboarded event
    const event = receipt?.logs.find((l: any) => l.fragment?.name === 'AgentOnboarded');
    const [agentId, owner, tba] = event.args;

    assert.equal(owner, user.address);
    assert.equal(await usdc.balanceOf(tba), initialFunding);

    const AgentAccount = await hre.ethers.getContractAt("AgentAccount", tba);
    assert.equal(await AgentAccount.maxSingleTrade(), maxSingle);
    assert.equal(await AgentAccount.dailyBudget(), budget);
    const policy = await AgentAccount.autoBuyPolicy();
    assert.equal(policy.maxPrice, autoPrice);
    assert.isTrue(policy.active);
  });

  it("AgentAccount: executeAutoBuy enforces policies and buys from marketplace", async function () {
    const { usdc, registry, twin, escrow, marketplace, user, executor, seller } = await deployCore();
    
    // 1. Setup Agent
    const maxSingle = 500n * 10n ** 6n;
    const budget = 1000n * 10n ** 6n;
    const autoPrice = 300n * 10n ** 6n;
    
    await registry.connect(user).createAgentWithPolicy(maxSingle, budget, autoPrice, true);
    const tbaAddr = await registry.agentAccount(1);
    const agent = await hre.ethers.getContractAt("AgentAccount", tbaAddr);

    // Fund Agent
    await usdc.mint(tbaAddr, 1000n * 10n ** 6n);
    
    // Authorise Executor
    await agent.connect(user).setExecutor(executor.address, true);

    // 2. Setup Listing
    await twin.mint(seller.address, keccak256(toUtf8Bytes("nfc-1")), "ipfs://1");
    await twin.connect(seller).approve(await marketplace.getAddress(), 1);
    await marketplace.connect(seller).listItem(1, 250n * 10n ** 6n, "ipfs://meta");

    // 3. Auto-buy
    await agent.connect(executor).executeAutoBuy(
        await marketplace.getAddress(),
        await escrow.getAddress(),
        await usdc.getAddress(),
        1 // listingId
    );

    // 4. Verify
    const listing = await marketplace.getListing(1);
    assert.isFalse(listing.active);
    
    const escrowId = await marketplace.escrowListing(1);
    const esc = await escrow.getEscrow(escrowId);
    assert.equal(esc.amount, 250n * 10n ** 6n);
    assert.equal(esc.buyer, tbaAddr);
  });

  it("AgentAccount: executeAutoBuy reverts if price exceeds maxPrice", async function () {
    const { usdc, registry, twin, marketplace, user, executor, seller, escrow } = await deployCore();
    
    await registry.connect(user).createAgentWithPolicy(1000n * 10n ** 6n, 2000n * 10n ** 6n, 200n * 10n ** 6n, true);
    const tbaAddr = await registry.agentAccount(1);
    const agent = await hre.ethers.getContractAt("AgentAccount", tbaAddr);
    await usdc.mint(tbaAddr, 1000n * 10n ** 6n);
    await agent.connect(user).setExecutor(executor.address, true);

    await twin.mint(seller.address, keccak256(toUtf8Bytes("nfc-2")), "ipfs://2");
    await twin.connect(seller).approve(await marketplace.getAddress(), 1);
    await marketplace.connect(seller).listItem(1, 250n * 10n ** 6n, "ipfs://meta");

    try {
        await agent.connect(executor).executeAutoBuy(
            await marketplace.getAddress(),
            await escrow.getAddress(),
            await usdc.getAddress(),
            1
        );
        assert.fail("Should have reverted");
    } catch (e: any) {
        assert.include(e.message, "price exceeds maxPrice");
    }
  });

  it("AgentAccount: executeAutoBuy reverts if daily budget exceeded", async function () {
    const { usdc, registry, twin, marketplace, user, executor, seller, escrow } = await deployCore();
    
    // Budget 400, first buy 250, second buy 250 -> should fail
    await registry.connect(user).createAgentWithPolicy(1000n * 10n ** 6n, 400n * 10n ** 6n, 500n * 10n ** 6n, true);
    const tbaAddr = await registry.agentAccount(1);
    const agent = await hre.ethers.getContractAt("AgentAccount", tbaAddr);
    await usdc.mint(tbaAddr, 1000n * 10n ** 6n);
    await agent.connect(user).setExecutor(executor.address, true);

    // Listing 1: 250
    await twin.mint(seller.address, keccak256(toUtf8Bytes("nfc-3")), "ipfs://3");
    await twin.connect(seller).approve(await marketplace.getAddress(), 1);
    await marketplace.connect(seller).listItem(1, 250n * 10n ** 6n, "ipfs://meta1");

    // Listing 2: 250
    await twin.mint(seller.address, keccak256(toUtf8Bytes("nfc-4")), "ipfs://4");
    await twin.connect(seller).approve(await marketplace.getAddress(), 2);
    await marketplace.connect(seller).listItem(2, 250n * 10n ** 6n, "ipfs://meta2");

    // First buy ok
    await agent.connect(executor).executeAutoBuy(await marketplace.getAddress(), await escrow.getAddress(), await usdc.getAddress(), 1);

    // Second buy fail
    try {
        await agent.connect(executor).executeAutoBuy(await marketplace.getAddress(), await escrow.getAddress(), await usdc.getAddress(), 2);
        assert.fail("Should have reverted");
    } catch (e: any) {
        assert.include(e.message, "exceeds dailyBudget");
    }
  });
});

