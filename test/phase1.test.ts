import { assert } from "chai";
import hre from "hardhat";
import { keccak256, toUtf8Bytes } from "ethers";

// ─────────────────────────────────────────────────────────────────────────────
// MockUSDC
// ─────────────────────────────────────────────────────────────────────────────
describe("MockUSDC", function () {
  it("has 6 decimals", async function () {
    const [deployer] = await hre.ethers.getSigners();
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC", deployer);
    const usdc = await MockUSDC.deploy();

    assert.equal(await usdc.decimals(), 6n);
  });

  it("faucet mints 1000 USDC to caller", async function () {
    const [deployer, user] = await hre.ethers.getSigners();
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC", deployer);
    const usdc = await MockUSDC.deploy();

    await usdc.connect(user).faucet();
    const bal = await usdc.balanceOf(user.address);
    assert.equal(bal, 1_000n * 10n ** 6n);
  });

  it("owner can mint arbitrary amounts", async function () {
    const [deployer, recipient] = await hre.ethers.getSigners();
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC", deployer);
    const usdc = await MockUSDC.deploy();

    await usdc.mint(recipient.address, 500n * 10n ** 6n);
    assert.equal(await usdc.balanceOf(recipient.address), 500n * 10n ** 6n);
  });

  it("non-owner cannot mint", async function () {
    const [deployer, attacker] = await hre.ethers.getSigners();
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC", deployer);
    const usdc = await MockUSDC.deploy();

    try {
      await usdc.connect(attacker).mint(attacker.address, 1n);
      assert.fail("Expected revert");
    } catch (e: any) {
      assert.match(e.message, /revert|OwnableUnauthorizedAccount/i);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DigitalTwin
// ─────────────────────────────────────────────────────────────────────────────
describe("DigitalTwin", function () {
  async function deployDigitalTwin() {
    const [deployer, seller] = await hre.ethers.getSigners();
    const DigitalTwin = await hre.ethers.getContractFactory("DigitalTwin", deployer);
    const twin = await DigitalTwin.deploy();
    return { twin, deployer, seller };
  }

  it("owner can mint a Digital Twin", async function () {
    const { twin, deployer, seller } = await deployDigitalTwin();
    const nfcHash = keccak256(toUtf8Bytes("unique-nfc-001"));

    await twin.mint(seller.address, nfcHash, "ipfs://QmTestHash001");
    assert.equal(await twin.ownerOf(1n), seller.address);
    assert.equal(await twin.tokenURI(1n), "ipfs://QmTestHash001");
  });

  it("prevents duplicate NFC hash registration", async function () {
    const { twin, seller } = await deployDigitalTwin();
    const nfcHash = keccak256(toUtf8Bytes("unique-nfc-dup"));

    await twin.mint(seller.address, nfcHash, "ipfs://QmHash1");
    try {
      await twin.mint(seller.address, nfcHash, "ipfs://QmHash2");
      assert.fail("Expected revert");
    } catch (e: any) {
      assert.include(e.message, "TagAlreadyRegistered");
    }
  });

  it("authorised minter can mint", async function () {
    const { twin, seller } = await deployDigitalTwin();
    const [, , minter] = await hre.ethers.getSigners();
    const nfcHash = keccak256(toUtf8Bytes("nfc-minter-test"));

    await twin.setMinter(minter.address, true);
    await twin.connect(minter).mint(seller.address, nfcHash, "ipfs://QmMinterHash");
    assert.equal(await twin.ownerOf(1n), seller.address);
  });

  it("unauthorised address cannot mint", async function () {
    const { twin } = await deployDigitalTwin();
    const [, , , unauthorized] = await hre.ethers.getSigners();
    const nfcHash = keccak256(toUtf8Bytes("nfc-unauth"));

    try {
      await twin.connect(unauthorized).mint(unauthorized.address, nfcHash, "ipfs://Qm");
      assert.fail("Expected revert");
    } catch (e: any) {
      assert.include(e.message, "NotAuthorisedMinter");
    }
  });

  it("nfcHash ↔ tokenId mappings are consistent", async function () {
    const { twin, seller } = await deployDigitalTwin();
    const nfcHash = keccak256(toUtf8Bytes("nfc-mapping"));

    await twin.mint(seller.address, nfcHash, "ipfs://QmMap");
    assert.equal(await twin.nfcHashToTokenId(nfcHash), 1n);
    assert.equal(await twin.tokenIdToNfcHash(1n), nfcHash);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AgentRegistry + AgentAccount (ERC-6551)
// ─────────────────────────────────────────────────────────────────────────────
describe("AgentRegistry", function () {
  async function deployRegistry() {
    const [deployer, user] = await hre.ethers.getSigners();
    const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry", deployer);
    const registry = await AgentRegistry.deploy();
    return { registry, deployer, user };
  }

  it("createAgent mints an agent NFT with ID 1", async function () {
    const { registry, user } = await deployRegistry();
    await registry.connect(user).createAgent();
    assert.equal(await registry.ownerOf(1n), user.address);
  });

  it("deploys a TBA at the deterministic address", async function () {
    const { registry, user } = await deployRegistry();

    const predicted = await registry.computeTBAAddress(1n, 0, 0, 0, false);
    const tx = await registry.connect(user).createAgent();
    await tx.wait();

    const tba = await registry.agentAccount(1n);
    assert.equal(tba, predicted);
  });

  it("TBA is linked back to agentId", async function () {
    const { registry, user } = await deployRegistry();
    await registry.connect(user).createAgent();
    const tba = await registry.agentAccount(1n);
    assert.equal(await registry.accountToAgent(tba), 1n);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AgentAccount — spending policy
// ─────────────────────────────────────────────────────────────────────────────
describe("AgentAccount (spending policy)", function () {
  async function setup() {
    const [deployer, user, other] = await hre.ethers.getSigners();

    // Deploy contracts
    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC", deployer);
    const usdc = await MockUSDC.deploy();

    const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry", deployer);
    const registry = await AgentRegistry.deploy();

    // Create agent and get TBA
    const tx = await registry.connect(user).createAgent();
    await tx.wait();
    const tbaAddress = await registry.agentAccount(1n);

    // Fund TBA with 500 USDC via faucet then transfer
    await usdc.connect(user).faucet();
    await usdc.connect(user).transfer(tbaAddress, 500n * 10n ** 6n);

    // Get AgentAccount contract instance
    const AgentAccount = await hre.ethers.getContractFactory("AgentAccount", deployer);
    const tba = AgentAccount.attach(tbaAddress);

    return { usdc, registry, tba, user, other };
  }

  it("owner can set spending policy", async function () {
    const { tba, user } = await setup();
    await tba.connect(user).setPolicy(100n * 10n ** 6n, 300n * 10n ** 6n);
    assert.equal(await tba.maxSingleTrade(), 100n * 10n ** 6n);
    assert.equal(await tba.dailyBudget(), 300n * 10n ** 6n);
  });

  it("owner can executeUSDCTransfer within policy", async function () {
    const { usdc, tba, user, other } = await setup();
    const usdcAddress = await usdc.getAddress();

    await tba.connect(user).setPolicy(200n * 10n ** 6n, 400n * 10n ** 6n);
    await tba.connect(user).executeUSDCTransfer(usdcAddress, other.address, 100n * 10n ** 6n);

    assert.equal(await usdc.balanceOf(other.address), 100n * 10n ** 6n);
  });

  it("blocks transfer exceeding maxSingleTrade", async function () {
    const { usdc, tba, user, other } = await setup();
    const usdcAddress = await usdc.getAddress();

    await tba.connect(user).setPolicy(50n * 10n ** 6n, 400n * 10n ** 6n);

    try {
      await tba.connect(user).executeUSDCTransfer(usdcAddress, other.address, 100n * 10n ** 6n);
      assert.fail("Expected revert");
    } catch (e: any) {
      assert.match(e.message, /maxSingleTrade|PolicyViolation/i);
    }
  });

  it("authorised executor can transfer", async function () {
    const { usdc, tba, user, other } = await setup();
    const [, , , executor] = await hre.ethers.getSigners();
    const usdcAddress = await usdc.getAddress();

    await tba.connect(user).setExecutor(executor.address, true);
    await tba.connect(executor).executeUSDCTransfer(usdcAddress, other.address, 50n * 10n ** 6n);
    assert.equal(await usdc.balanceOf(other.address), 50n * 10n ** 6n);
  });

  it("non-owner, non-executor cannot transfer", async function () {
    const { usdc, tba, other } = await setup();
    const usdcAddress = await usdc.getAddress();

    try {
      await tba.connect(other).executeUSDCTransfer(usdcAddress, other.address, 50n * 10n ** 6n);
      assert.fail("Expected revert");
    } catch (e: any) {
      assert.match(e.message, /NotAuthorised|revert/i);
    }
  });
});

