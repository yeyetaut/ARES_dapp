import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // 1. MockUSDC
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC", deployer);
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddr = await usdc.getAddress();
  console.log("MockUSDC:    ", usdcAddr);

  // 2. DigitalTwin
  const DigitalTwin = await hre.ethers.getContractFactory("DigitalTwin", deployer);
  const twin = await DigitalTwin.deploy();
  await twin.waitForDeployment();
  const twinAddr = await twin.getAddress();
  console.log("DigitalTwin: ", twinAddr);

  // 3. Escrow
  const Escrow = await hre.ethers.getContractFactory("Escrow", deployer);
  const escrow = await Escrow.deploy(usdcAddr);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("Escrow:      ", escrowAddr);

  // 4. Marketplace
  const Marketplace = await hre.ethers.getContractFactory("Marketplace", deployer);
  const marketplace = await Marketplace.deploy(twinAddr, escrowAddr);
  await marketplace.waitForDeployment();
  const marketplaceAddr = await marketplace.getAddress();
  console.log("Marketplace: ", marketplaceAddr);

  // 5. Verifier
  const Verifier = await hre.ethers.getContractFactory("Verifier", deployer);
  const verifier = await Verifier.deploy(usdcAddr, twinAddr, escrowAddr, marketplaceAddr);
  await verifier.waitForDeployment();
  const verifierAddr = await verifier.getAddress();
  console.log("Verifier:    ", verifierAddr);

  // 6. Reputation
  const Reputation = await hre.ethers.getContractFactory("Reputation", deployer);
  const reputation = await Reputation.deploy();
  await reputation.waitForDeployment();
  const reputationAddr = await reputation.getAddress();
  console.log("Reputation:  ", reputationAddr);

  // 7. Staking
  const Staking = await hre.ethers.getContractFactory("Staking", deployer);
  const staking = await Staking.deploy(usdcAddr);
  await staking.waitForDeployment();
  const stakingAddr = await staking.getAddress();
  console.log("Staking:     ", stakingAddr);

  // 8. AgentRegistry
  const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry", deployer);
  const registry = await AgentRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("AgentRegistry:", registryAddr);

  // 9. AgentFactory
  const AgentFactory = await hre.ethers.getContractFactory("AgentFactory", deployer);
  const factory = await AgentFactory.deploy(registryAddr, usdcAddr);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("AgentFactory: ", factoryAddr);

  // Wiring
  console.log("\nWiring contracts...");
  await (await escrow.setMarketplace(marketplaceAddr)).wait();
  await (await marketplace.setVerifier(verifierAddr, true)).wait();
  await (await marketplace.setReputation(reputationAddr)).wait();
  await (await verifier.setReputation(reputationAddr)).wait();
  await (await reputation.setAuthorized(marketplaceAddr, true)).wait();
  await (await reputation.setAuthorized(verifierAddr, true)).wait();

  console.log("\nDeployment and wiring complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
