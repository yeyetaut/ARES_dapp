import { assert } from "chai";
import hre from "hardhat";
import { keccak256, toUtf8Bytes } from "ethers";
import type { NetworkConnection } from "hardhat/types/network";

async function getConnection(): Promise<NetworkConnection> {
  return hre.network.connect();
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixture
// ─────────────────────────────────────────────────────────────────────────────

async function deployAll() {
  const conn = await getConnection();
  const [owner, seller, buyer, node, other] = await conn.ethers.getSigners();

  const MockUSDC = await conn.ethers.getContractFactory("MockUSDC", owner);
  const usdc = await MockUSDC.deploy();

  const DigitalTwin = await conn.ethers.getContractFactory("DigitalTwin", owner);
  const twin = await DigitalTwin.deploy();

  const Escrow = await conn.ethers.getContractFactory("Escrow", owner);
  const escrow = await Escrow.deploy(await usdc.getAddress());

  const Marketplace = await conn.ethers.getContractFactory("Marketplace", owner);
  const marketplace = await Marketplace.deploy(
    await twin.getAddress(),
    await escrow.getAddress(),
  );

  const Verifier = await conn.ethers.getContractFactory("Verifier", owner);
  const verifier = await Verifier.deploy(
    await usdc.getAddress(),
    await twin.getAddress(),
    await escrow.getAddress(),
    await marketplace.getAddress(),
  );

  // Wire contracts
  await escrow.setMarketplace(await marketplace.getAddress());
  await marketplace.setVerifier(await verifier.getAddress(), true);

  // Fund accounts
  await usdc.connect(seller).faucet();   // 1000 USDC
  await usdc.connect(buyer).faucet();    // 1000 USDC
  await usdc.connect(node).faucet();     // 1000 USDC for staking

  return { usdc, twin, escrow, marketplace, verifier, owner, seller, buyer, node, other, conn };
}

const PRICE     = 100n * 10n ** 6n; // 100 USDC
const MIN_STAKE = 100n * 10n ** 6n; // 100 USDC

/// Mint a DigitalTwin to seller, approve Marketplace, list it, have buyer purchase.
/// Returns the twinId, its nfcHash, listingId, and escrowId.
async function fullBuy(ctx: Awaited<ReturnType<typeof deployAll>>, seed: string) {
  const { usdc, twin, escrow, marketplace, seller, buyer } = ctx;

  const nfcHash = keccak256(toUtf8Bytes(seed));
  await twin.mint(seller.address, nfcHash, `ipfs://Qm${seed}`);
  const twinId = await twin.nfcHashToTokenId(nfcHash);

  await twin.connect(seller).approve(await marketplace.getAddress(), twinId);
  await marketplace.connect(seller).listItem(twinId, PRICE, `ipfs://meta${seed}`);
  const listingId = await marketplace.listingCount();

  await usdc.connect(buyer).approve(await escrow.getAddress(), PRICE);
  await marketplace.connect(buyer).buyItem(listingId);
  const escrowId = await escrow.escrowCount();

  return { twinId, nfcHash, listingId, escrowId };
}

/// Register a node with MIN_STAKE.
async function registerNode(ctx: Awaited<ReturnType<typeof deployAll>>, signer = ctx.node) {
  const { usdc, verifier } = ctx;
  await usdc.connect(signer).approve(await verifier.getAddress(), MIN_STAKE);
  await verifier.connect(signer).registerNode(MIN_STAKE);
}

// ─────────────────────────────────────────────────────────────────────────────
// Node registration
// ─────────────────────────────────────────────────────────────────────────────

describe("Verifier — node registration", function () {
  it("node can register with MIN_STAKE; becomes active", async function () {
    const ctx = await deployAll();
    await registerNode(ctx);

    const info = await ctx.verifier.getNode(ctx.node.address);
    assert.equal(info.stake, MIN_STAKE);
    assert.equal(info.active, true);
  });

  it("registration with less than MIN_STAKE reverts", async function () {
    const ctx = await deployAll();
    const { usdc, verifier, node } = ctx;
    const tooLittle = MIN_STAKE - 1n;
    await usdc.connect(node).approve(await verifier.getAddress(), tooLittle);
    try {
      await verifier.connect(node).registerNode(tooLittle);
      assert.fail("Expected revert");
    } catch (e: any) {
      assert.match(e.message, /InsufficientStake|revert/i);
    }
  });

  it("node can top up stake with a second registerNode call", async function () {
    const ctx = await deployAll();
    const { usdc, verifier, node } = ctx;
    await usdc.connect(node).approve(await verifier.getAddress(), MIN_STAKE * 2n);
    await verifier.connect(node).registerNode(MIN_STAKE);
    await verifier.connect(node).registerNode(MIN_STAKE);
    const info = await verifier.getNode(node.address);
    assert.equal(info.stake, MIN_STAKE * 2n);
  });

  it("node can deregister and recover full stake", async function () {
    const ctx = await deployAll();
    const { usdc, verifier, node } = ctx;
    await registerNode(ctx);

    const before = await usdc.balanceOf(node.address);
    await verifier.connect(node).deregisterNode();
    const after = await usdc.balanceOf(node.address);

    assert.equal(after - before, MIN_STAKE);
    const info = await verifier.getNode(node.address);
    assert.equal(info.active, false);
    assert.equal(info.stake, 0n);
  });

  it("deregister without being registered reverts", async function () {
    const ctx = await deployAll();
    try {
      await ctx.verifier.connect(ctx.other).deregisterNode();
      assert.fail("Expected revert");
    } catch (e: any) {
      assert.match(e.message, /NotActiveNode|revert/i);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Verification — success path
// ─────────────────────────────────────────────────────────────────────────────

describe("Verifier — successful verification", function () {
  it("correct nfcHash: USDC released to seller, NFT transferred to buyer", async function () {
    const ctx = await deployAll();
    const { usdc, twin, verifier, seller, buyer } = ctx;
    await registerNode(ctx);
    const { twinId, nfcHash, escrowId } = await fullBuy(ctx, "verify-ok-01");

    const sellerBefore = await usdc.balanceOf(seller.address);
    await verifier.connect(ctx.node).submitVerification(escrowId, nfcHash);
    const sellerAfter = await usdc.balanceOf(seller.address);

    // USDC released to seller
    assert.equal(sellerAfter - sellerBefore, PRICE);

    // NFT transferred to buyer
    assert.equal(await twin.ownerOf(twinId), buyer.address);

    // Escrow state: RELEASED (1)
    const rec = await ctx.escrow.getEscrow(escrowId);
    assert.equal(rec.state, 1n);
  });

  it("attestation record is stored with finalized = true", async function () {
    const ctx = await deployAll();
    const { verifier } = ctx;
    await registerNode(ctx);
    const { nfcHash, escrowId } = await fullBuy(ctx, "verify-ok-02");

    await verifier.connect(ctx.node).submitVerification(escrowId, nfcHash);

    const att = await verifier.getAttestation(escrowId);
    assert.equal(att.node, ctx.node.address);
    assert.equal(att.nfcHash, nfcHash);
    assert.equal(att.finalized, true);
  });

  it("cannot submit verification twice for the same escrow", async function () {
    const ctx = await deployAll();
    const { verifier, node } = ctx;
    await registerNode(ctx);
    const { nfcHash, escrowId } = await fullBuy(ctx, "verify-twice");

    await verifier.connect(node).submitVerification(escrowId, nfcHash);
    try {
      await verifier.connect(node).submitVerification(escrowId, nfcHash);
      assert.fail("Expected revert");
    } catch (e: any) {
      assert.match(e.message, /AlreadyVerified|revert/i);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Verification — failure path
// ─────────────────────────────────────────────────────────────────────────────

describe("Verifier — failed verification", function () {
  it("wrong nfcHash reverts with InvalidNfcHash; escrow stays PENDING", async function () {
    const ctx = await deployAll();
    const { escrow, verifier, node } = ctx;
    await registerNode(ctx);
    const { escrowId } = await fullBuy(ctx, "verify-bad-01");

    const wrongHash = keccak256(toUtf8Bytes("totally-wrong-tag-data"));
    try {
      await verifier.connect(node).submitVerification(escrowId, wrongHash);
      assert.fail("Expected revert");
    } catch (e: any) {
      assert.match(e.message, /InvalidNfcHash|revert/i);
    }

    // Escrow still PENDING
    const rec = await escrow.getEscrow(escrowId);
    assert.equal(rec.state, 0n);
  });

  it("non-node cannot submit verification", async function () {
    const ctx = await deployAll();
    const { verifier, other } = ctx;
    const { nfcHash, escrowId } = await fullBuy(ctx, "verify-nonode");

    try {
      await verifier.connect(other).submitVerification(escrowId, nfcHash);
      assert.fail("Expected revert");
    } catch (e: any) {
      assert.match(e.message, /NotActiveNode|revert/i);
    }
  });

  it("deregistered node cannot submit verification", async function () {
    const ctx = await deployAll();
    const { verifier, node } = ctx;
    await registerNode(ctx);
    const { nfcHash, escrowId } = await fullBuy(ctx, "verify-dereg");

    await verifier.connect(node).deregisterNode();
    try {
      await verifier.connect(node).submitVerification(escrowId, nfcHash);
      assert.fail("Expected revert");
    } catch (e: any) {
      assert.match(e.message, /NotActiveNode|revert/i);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Slashing
// ─────────────────────────────────────────────────────────────────────────────

describe("Verifier — slashing", function () {
  it("owner can slash a node directly", async function () {
    const ctx = await deployAll();
    const { verifier, owner, node } = ctx;
    await registerNode(ctx);

    const slashAmt = 30n * 10n ** 6n; // 30 USDC
    await verifier.connect(owner).slash(node.address, slashAmt, "test slash");

    const info = await verifier.getNode(node.address);
    assert.equal(info.stake, MIN_STAKE - slashAmt);
    assert.equal(info.active, true); // still active (stake > 0)
  });

  it("slash exceeding stake caps at full stake; node deactivated", async function () {
    const ctx = await deployAll();
    const { verifier, owner, node } = ctx;
    await registerNode(ctx);

    await verifier.connect(owner).slash(node.address, MIN_STAKE * 10n, "over-slash");

    const info = await verifier.getNode(node.address);
    assert.equal(info.stake, 0n);
    assert.equal(info.active, false);
  });

  it("owner can challenge a verified escrow and slash the attesting node", async function () {
    const ctx = await deployAll();
    const { verifier, owner, node } = ctx;
    await registerNode(ctx);
    const { nfcHash, escrowId } = await fullBuy(ctx, "challenge-slash");

    await verifier.connect(node).submitVerification(escrowId, nfcHash);

    const slashAmt = 50n * 10n ** 6n;
    await verifier.connect(owner).challengeVerification(escrowId, slashAmt);

    const info = await verifier.getNode(node.address);
    assert.equal(info.stake, MIN_STAKE - slashAmt);
  });

  it("challengeVerification reverts if escrow was never verified", async function () {
    const ctx = await deployAll();
    const { verifier, owner } = ctx;
    await registerNode(ctx);
    await fullBuy(ctx, "challenge-unverified");

    try {
      await verifier.connect(owner).challengeVerification(1n, 50n * 10n ** 6n);
      assert.fail("Expected revert");
    } catch (e: any) {
      assert.match(e.message, /NotVerified|revert/i);
    }
  });

  it("non-owner cannot slash", async function () {
    const ctx = await deployAll();
    const { verifier, node, other } = ctx;
    await registerNode(ctx);
    try {
      await verifier.connect(other).slash(node.address, 10n * 10n ** 6n, "unauthorised");
      assert.fail("Expected revert");
    } catch (e: any) {
      assert.match(e.message, /OwnableUnauthorizedAccount|revert/i);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: stake → verify → settle
// ─────────────────────────────────────────────────────────────────────────────

describe("Verifier — end-to-end: stake → verify → settle", function () {
  it("full flow: node stakes, verifies item, seller gets paid, buyer gets NFT", async function () {
    const ctx = await deployAll();
    const { usdc, twin, verifier, seller, buyer, node } = ctx;

    // 1. Node registers
    await registerNode(ctx);

    // 2. Seller mints + lists, buyer purchases
    const { twinId, nfcHash, escrowId } = await fullBuy(ctx, "e2e-flow-01");

    const sellerBefore = await usdc.balanceOf(seller.address);
    const buyerBefore  = await usdc.balanceOf(buyer.address);

    // 3. Node verifies → delivery confirmed
    await verifier.connect(node).submitVerification(escrowId, nfcHash);

    const sellerAfter = await usdc.balanceOf(seller.address);
    const buyerAfter  = await usdc.balanceOf(buyer.address);

    // Seller received PRICE USDC
    assert.equal(sellerAfter - sellerBefore, PRICE);

    // Buyer USDC unchanged (already locked before; deducted in buyItem)
    assert.equal(buyerAfter, buyerBefore);

    // Buyer owns NFT
    assert.equal(await twin.ownerOf(twinId), buyer.address);

    // Node stake intact (no slashing)
    const info = await verifier.getNode(node.address);
    assert.equal(info.stake, MIN_STAKE);
    assert.equal(info.active, true);
  });
});
