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
  const [owner, seller, buyer, verifier, other] = await conn.ethers.getSigners();

  const MockUSDC = await conn.ethers.getContractFactory("MockUSDC", owner);
  const usdc = await MockUSDC.deploy();

  const DigitalTwin = await conn.ethers.getContractFactory("DigitalTwin", owner);
  const twin = await DigitalTwin.deploy();

  const Escrow = await conn.ethers.getContractFactory("Escrow", owner);
  const escrow = await Escrow.deploy(await usdc.getAddress());

  const Marketplace = await conn.ethers.getContractFactory("Marketplace", owner);
  const marketplace = await Marketplace.deploy(
    await twin.getAddress(),
    await escrow.getAddress()
  );

  // Wire Escrow → Marketplace
  await escrow.setMarketplace(await marketplace.getAddress());

  // Allow Marketplace to mint Digital Twins (optional, owner can mint directly too)
  await twin.setMinter(await marketplace.getAddress(), true);

  // Fund seller and buyer with USDC
  await usdc.connect(seller).faucet();   // 1000 USDC
  await usdc.connect(buyer).faucet();    // 1000 USDC

  return { usdc, twin, escrow, marketplace, owner, seller, buyer, verifier, other, conn };
}

/// Helper: mint a DigitalTwin to the seller and approve Marketplace to hold it.
async function mintAndApproveTwin(
  twin: any,
  marketplace: any,
  seller: any,
  seed: string
) {
  const nfcHash = keccak256(toUtf8Bytes(seed));
  await twin.mint(seller.address, nfcHash, `ipfs://Qm${seed}`);
  const twinId = await twin.nfcHashToTokenId(nfcHash);
  await twin.connect(seller).approve(await marketplace.getAddress(), twinId);
  return twinId;
}

const PRICE = 100n * 10n ** 6n;  // 100 USDC

// ─────────────────────────────────────────────────────────────────────────────
// Escrow — unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Escrow", function () {
  it("setMarketplace can only be called once", async function () {
    const { escrow, other } = await deployAll();
    try {
      await escrow.setMarketplace(other.address);
      assert.fail("Expected revert");
    } catch (e: any) {
      assert.match(e.message, /already set/i);
    }
  });

  it("createEscrow rejects direct calls (non-marketplace)", async function () {
    const { escrow, buyer, seller } = await deployAll();
    try {
      await escrow.connect(buyer).createEscrow(1n, buyer.address, seller.address, 1n, PRICE);
      assert.fail("Expected revert");
    } catch (e: any) {
      assert.match(e.message, /OnlyMarketplace|revert/i);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Marketplace — listing management
// ─────────────────────────────────────────────────────────────────────────────

describe("Marketplace — listing", function () {
  it("seller can list an item; NFT held by Marketplace", async function () {
    const { twin, marketplace, seller } = await deployAll();
    const twinId = await mintAndApproveTwin(twin, marketplace, seller, "list-001");

    await marketplace.connect(seller).listItem(twinId, PRICE, "ipfs://QmMeta001");

    assert.equal(await twin.ownerOf(twinId), await marketplace.getAddress());

    const listing = await marketplace.getListing(1n);
    assert.equal(listing.seller, seller.address);
    assert.equal(listing.price, PRICE);
    assert.equal(listing.active, true);
    assert.equal(await marketplace.listingCount(), 1n);
  });

  it("listItem increments listingId correctly", async function () {
    const { twin, marketplace, seller } = await deployAll();
    const t1 = await mintAndApproveTwin(twin, marketplace, seller, "list-id-a");
    const t2 = await mintAndApproveTwin(twin, marketplace, seller, "list-id-b");

    await marketplace.connect(seller).listItem(t1, PRICE, "ipfs://A");
    await marketplace.connect(seller).listItem(t2, PRICE, "ipfs://B");

    assert.equal(await marketplace.listingCount(), 2n);
  });

  it("seller can cancel a listing and recover NFT", async function () {
    const { twin, marketplace, seller } = await deployAll();
    const twinId = await mintAndApproveTwin(twin, marketplace, seller, "cancel-001");

    await marketplace.connect(seller).listItem(twinId, PRICE, "ipfs://C");
    await marketplace.connect(seller).cancelListing(1n);

    assert.equal(await twin.ownerOf(twinId), seller.address);
    assert.equal((await marketplace.getListing(1n)).active, false);
  });

  it("owner can cancel any listing", async function () {
    const { twin, marketplace, seller, owner } = await deployAll();
    const twinId = await mintAndApproveTwin(twin, marketplace, seller, "cancel-owner");

    await marketplace.connect(seller).listItem(twinId, PRICE, "ipfs://D");
    await marketplace.connect(owner).cancelListing(1n);

    assert.equal(await twin.ownerOf(twinId), seller.address);
  });

  it("unauthorised address cannot cancel listing", async function () {
    const { twin, marketplace, seller, other } = await deployAll();
    const twinId = await mintAndApproveTwin(twin, marketplace, seller, "cancel-unauth");

    await marketplace.connect(seller).listItem(twinId, PRICE, "ipfs://E");
    try {
      await marketplace.connect(other).cancelListing(1n);
      assert.fail("Expected revert");
    } catch (e: any) {
      assert.match(e.message, /NotAuthorised|revert/i);
    }
  });

  it("cannot cancel an already-inactive listing", async function () {
    const { twin, marketplace, seller } = await deployAll();
    const twinId = await mintAndApproveTwin(twin, marketplace, seller, "cancel-twice");

    await marketplace.connect(seller).listItem(twinId, PRICE, "ipfs://F");
    await marketplace.connect(seller).cancelListing(1n);
    try {
      await marketplace.connect(seller).cancelListing(1n);
      assert.fail("Expected revert");
    } catch (e: any) {
      assert.match(e.message, /NotActive|revert/i);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Marketplace + Escrow — buy lifecycle
// ─────────────────────────────────────────────────────────────────────────────

describe("Marketplace + Escrow — buy lifecycle", function () {
  async function listed() {
    const ctx = await deployAll();
    const twinId = await mintAndApproveTwin(ctx.twin, ctx.marketplace, ctx.seller, "buy-001");
    await ctx.marketplace.connect(ctx.seller).listItem(twinId, PRICE, "ipfs://Buy001");
    return { ...ctx, twinId, listingId: 1n };
  }

  it("buyer can purchase a listed item; USDC locked in Escrow", async function () {
    const { usdc, escrow, marketplace, buyer, listingId } = await listed();

    const escrowAddr = await escrow.getAddress();
    await usdc.connect(buyer).approve(escrowAddr, PRICE);
    await marketplace.connect(buyer).buyItem(listingId);

    // Listing deactivated
    assert.equal((await marketplace.getListing(listingId)).active, false);

    // USDC held in Escrow
    assert.equal(await usdc.balanceOf(escrowAddr), PRICE);

    // Escrow record correct
    const rec = await escrow.getEscrow(1n);
    assert.equal(rec.buyer, buyer.address);
    assert.equal(rec.amount, PRICE);
    assert.equal(rec.state, 0n); // PENDING
  });

  it("seller cannot buy their own listing", async function () {
    const { marketplace, seller, usdc, escrow, listingId } = await listed();
    const escrowAddr = await escrow.getAddress();
    await usdc.connect(seller).approve(escrowAddr, PRICE);
    try {
      await marketplace.connect(seller).buyItem(listingId);
      assert.fail("Expected revert");
    } catch (e: any) {
      assert.match(e.message, /SelfPurchase|revert/i);
    }
  });

  it("cannot buy an inactive listing", async function () {
    const { marketplace, buyer, usdc, escrow, listingId } = await listed();
    const escrowAddr = await escrow.getAddress();
    await usdc.connect(buyer).approve(escrowAddr, PRICE);
    await marketplace.connect(buyer).buyItem(listingId);
    try {
      await usdc.connect(buyer).approve(escrowAddr, PRICE);
      await marketplace.connect(buyer).buyItem(listingId);
      assert.fail("Expected revert");
    } catch (e: any) {
      assert.match(e.message, /NotActive|revert/i);
    }
  });

  it("confirmDelivery: USDC released to seller, NFT transferred to buyer", async function () {
    const { usdc, twin, escrow, marketplace, seller, buyer, owner, twinId, listingId } = await listed();

    await usdc.connect(buyer).approve(await escrow.getAddress(), PRICE);
    await marketplace.connect(buyer).buyItem(listingId);

    const sellerBalBefore = await usdc.balanceOf(seller.address);
    await marketplace.connect(owner).confirmDelivery(1n); // owner is default verifier

    // USDC released to seller
    const sellerBalAfter = await usdc.balanceOf(seller.address);
    assert.equal(sellerBalAfter - sellerBalBefore, PRICE);

    // NFT now owned by buyer
    assert.equal(await twin.ownerOf(twinId), buyer.address);

    // Escrow state: RELEASED
    assert.equal((await escrow.getEscrow(1n)).state, 1n);
  });

  it("authorised verifier can confirm delivery", async function () {
    const { usdc, twin, escrow, marketplace, seller, buyer, verifier, owner, twinId, listingId } = await listed();

    await marketplace.connect(owner).setVerifier(verifier.address, true);
    await usdc.connect(buyer).approve(await escrow.getAddress(), PRICE);
    await marketplace.connect(buyer).buyItem(listingId);

    await marketplace.connect(verifier).confirmDelivery(1n);
    assert.equal(await twin.ownerOf(twinId), buyer.address);
  });

  it("unauthorised address cannot confirm delivery", async function () {
    const { usdc, escrow, marketplace, buyer, other, listingId } = await listed();
    await usdc.connect(buyer).approve(await escrow.getAddress(), PRICE);
    await marketplace.connect(buyer).buyItem(listingId);
    try {
      await marketplace.connect(other).confirmDelivery(1n);
      assert.fail("Expected revert");
    } catch (e: any) {
      assert.match(e.message, /NotAuthorised|revert/i);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dispute flow
// ─────────────────────────────────────────────────────────────────────────────

describe("Dispute flow", function () {
  async function withEscrow() {
    const ctx = await deployAll();
    const twinId = await mintAndApproveTwin(ctx.twin, ctx.marketplace, ctx.seller, "dispute-001");
    await ctx.marketplace.connect(ctx.seller).listItem(twinId, PRICE, "ipfs://Dispute001");
    await ctx.usdc.connect(ctx.buyer).approve(await ctx.escrow.getAddress(), PRICE);
    await ctx.marketplace.connect(ctx.buyer).buyItem(1n);
    return { ...ctx, twinId, escrowId: 1n };
  }

  it("buyer can raise a dispute; escrow state becomes DISPUTED", async function () {
    const { escrow, buyer, escrowId } = await withEscrow();
    await escrow.connect(buyer).dispute(escrowId);
    assert.equal((await escrow.getEscrow(escrowId)).state, 3n); // DISPUTED
  });

  it("non-buyer cannot raise a dispute", async function () {
    const { escrow, other, escrowId } = await withEscrow();
    try {
      await escrow.connect(other).dispute(escrowId);
      assert.fail("Expected revert");
    } catch (e: any) {
      assert.match(e.message, /OnlyBuyer|revert/i);
    }
  });

  it("owner resolves dispute in favour of buyer: USDC refunded, NFT back to seller", async function () {
    const { usdc, twin, escrow, marketplace, seller, buyer, owner, twinId, escrowId } = await withEscrow();

    await escrow.connect(buyer).dispute(escrowId);

    const buyerBalBefore = await usdc.balanceOf(buyer.address);
    await marketplace.connect(owner).resolveDispute(escrowId, true); // refundBuyer = true
    const buyerBalAfter = await usdc.balanceOf(buyer.address);

    assert.equal(buyerBalAfter - buyerBalBefore, PRICE);
    assert.equal(await twin.ownerOf(twinId), seller.address);
    assert.equal((await escrow.getEscrow(escrowId)).state, 2n); // REFUNDED
  });

  it("owner resolves dispute in favour of seller: USDC released, NFT to buyer", async function () {
    const { usdc, twin, escrow, marketplace, seller, buyer, owner, twinId, escrowId } = await withEscrow();

    await escrow.connect(buyer).dispute(escrowId);

    const sellerBalBefore = await usdc.balanceOf(seller.address);
    await marketplace.connect(owner).resolveDispute(escrowId, false); // refundBuyer = false
    const sellerBalAfter = await usdc.balanceOf(seller.address);

    assert.equal(sellerBalAfter - sellerBalBefore, PRICE);
    assert.equal(await twin.ownerOf(twinId), buyer.address);
    assert.equal((await escrow.getEscrow(escrowId)).state, 1n); // RELEASED
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Escrow timeout
// ─────────────────────────────────────────────────────────────────────────────

describe("Escrow timeout", function () {
  it("seller cannot claimTimeout before 30 days", async function () {
    const ctx = await deployAll();
    const twinId = await mintAndApproveTwin(ctx.twin, ctx.marketplace, ctx.seller, "timeout-early");
    await ctx.marketplace.connect(ctx.seller).listItem(twinId, PRICE, "ipfs://T1");
    await ctx.usdc.connect(ctx.buyer).approve(await ctx.escrow.getAddress(), PRICE);
    await ctx.marketplace.connect(ctx.buyer).buyItem(1n);

    try {
      await ctx.escrow.connect(ctx.seller).claimTimeout(1n);
      assert.fail("Expected revert");
    } catch (e: any) {
      assert.match(e.message, /TimeoutNotReached|revert/i);
    }
  });

  it("seller can claimTimeout after 30 days", async function () {
    const conn = await getConnection();
    const [owner, seller, buyer] = await conn.ethers.getSigners();

    const MockUSDC = await conn.ethers.getContractFactory("MockUSDC", owner);
    const usdc = await MockUSDC.deploy();

    const DigitalTwin = await conn.ethers.getContractFactory("DigitalTwin", owner);
    const twin = await DigitalTwin.deploy();

    const Escrow = await conn.ethers.getContractFactory("Escrow", owner);
    const escrow = await Escrow.deploy(await usdc.getAddress());

    const Marketplace = await conn.ethers.getContractFactory("Marketplace", owner);
    const marketplace = await Marketplace.deploy(await twin.getAddress(), await escrow.getAddress());

    await escrow.setMarketplace(await marketplace.getAddress());

    await usdc.connect(seller).faucet();
    await usdc.connect(buyer).faucet();

    const nfcHash = keccak256(toUtf8Bytes("timeout-30d"));
    await twin.mint(seller.address, nfcHash, "ipfs://T30");
    const twinId = await twin.nfcHashToTokenId(nfcHash);
    await twin.connect(seller).approve(await marketplace.getAddress(), twinId);

    await marketplace.connect(seller).listItem(twinId, PRICE, "ipfs://T30");
    await usdc.connect(buyer).approve(await escrow.getAddress(), PRICE);
    await marketplace.connect(buyer).buyItem(1n);

    // Fast-forward 30 days + 1 second
    await conn.provider.send("evm_increaseTime", [30 * 24 * 60 * 60 + 1]);
    await conn.provider.send("evm_mine", []);

    const sellerBalBefore = await usdc.balanceOf(seller.address);
    await escrow.connect(seller).claimTimeout(1n);
    const sellerBalAfter = await usdc.balanceOf(seller.address);

    assert.equal(sellerBalAfter - sellerBalBefore, PRICE);
    assert.equal((await escrow.getEscrow(1n)).state, 1n); // RELEASED
  });
});
