import { expect } from "chai";
import { ethers } from "hardhat";

describe("QA: Agent Onboarding (Verified)", function () {
  let mockUSDC: any;
  let registry: any;
  let factory: any;
  let owner: any;
  let user: any;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();

    // Deploy AgentRegistry
    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    registry = await AgentRegistry.deploy();

    // Deploy AgentFactory
    const AgentFactory = await ethers.getContractFactory("AgentFactory");
    factory = await AgentFactory.deploy(registry.target, mockUSDC.target);

    // Mint some USDC to the user
    await mockUSDC.connect(user).faucet();
  });

  it("Onboarding flow works correctly with approval and NFT transfer", async function () {
    const funding = ethers.parseUnits("100", 6);
    
    // 1. User approves USDC (which the frontend now does)
    await mockUSDC.connect(user).approve(factory.target, funding);

    // 2. Call onboardAgent
    const tx = await factory.connect(user).onboardAgent(
      funding,
      ethers.parseUnits("50", 6),
      ethers.parseUnits("200", 6),
      ethers.parseUnits("100", 6),
      true
    );
    const receipt = await tx.wait();

    // Get the agentId from the event
    const agentCreatedEvent = receipt.logs.find((log: any) => {
      try {
        const parsed = factory.interface.parseLog(log);
        return parsed?.name === "AgentOnboarded";
      } catch (e) {
        return false;
      }
    });

    const parsedEvent = factory.interface.parseLog(agentCreatedEvent);
    const agentId = parsedEvent.args.agentId;
    const tba = parsedEvent.args.tba;

    // 3. Assertions
    const nftOwner = await registry.ownerOf(agentId);
    
    // The NFT is correctly owned by the user
    expect(nftOwner).to.equal(user.address);

    // Verify that the TBA got the funds
    const tbaBalance = await mockUSDC.balanceOf(tba);
    expect(tbaBalance).to.equal(funding);

    // Verify policies
    const agentAccount = await ethers.getContractAt("AgentAccount", tba);
    expect(await agentAccount.maxSingleTrade()).to.equal(ethers.parseUnits("50", 6));
    expect(await agentAccount.dailyBudget()).to.equal(ethers.parseUnits("200", 6));
    
    const policy = await agentAccount.autoBuyPolicy();
    expect(policy.maxPrice).to.equal(ethers.parseUnits("100", 6));
    expect(policy.active).to.equal(true);
  });
});
