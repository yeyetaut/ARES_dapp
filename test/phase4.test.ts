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

  const Reputation = await conn.ethers.getContractFactory("Reputation", owner);
  const reputation = await Reputation.deploy();

  const Staking = await conn.ethers.getContractFactory("Staking", owner);
  const staking = await Staking.deploy(await usdc.getAddress());

  // Wire contracts
  await escrow.setMarketplace(await marketplace.getAddress());
  await marketplace.setVerifier(await verifier.getAddress(), true);

  // Connect Reputation to Marketplace and Verifier
  await reputation.setAuthorized(await marketplace.getAddress(), true);
  await reputation.setAuthorized(await verifier.getAddress(), true);
  await marketplace.setReputation(await reputation.getAddress());
  await verifier.setReputation(await reputation.getAddress());

  // Fund accounts
  await usdc.connect(seller).faucet();
  await usdc.connect(buyer).faucet();
  await usdc.connect(node).faucet();
  await usdc.connect(other).faucet();

  return { usdc, twin, escrow, marketplace, verifier, reputation, staking, owner, seller, buyer, node, other, conn };
}

const PRICE     = 100n * 10n ** 6n; // 100 USDC
const MIN_STAKE = 100n * 10n ** 6n; // 100 USDC

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

async function registerNode(ctx: Awaited<ReturnType<typeof deployAll>>, signer = ctx.node) {
  const { usdc, verifier } = ctx;
  await usdc.connect(signer).approve(await verifier.getAddress(), MIN_STAKE);
  await verifier.connect(signer).registerNode(MIN_STAKE);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reputation — basic minting and authorization
// ─────────────────────────────────────────────────────────────────────────────

describe("Reputation — authorization", () => {
  it("reverts when unauthorized caller tries to update score", async () => {
    const ctx = await deployAll();
    const { reputation, other, buyer } = ctx;

    let reverted = false;
    try {
      await reputation.connect(other).recordTrade(buyer.address, ctx.seller.address);
    } catch {
      reverted = true;
    }
    assert.isTrue(reverted, "should revert for unauthorized caller");
  });

  it("owner can call recordTrade directly", async () => {
    const ctx = await deployAll();
    const { reputation, buyer, seller } = ctx;
    await reputation.recordTrade(buyer.address, seller.address);
    const stats = await reputation.statsOf(buyer.address);
    assert.equal(stats.score, 10n);
  });

  it("setAuthorized emits AuthorizedUpdated event", async () => {
    const ctx = await deployAll();
    const { reputation, other } = ctx;
    const tx = await reputation.setAuthorized(other.address, true);
    const receipt = await tx.wait();
    const events = receipt?.logs ?? [];
    assert.isTrue(events.length > 0, "should emit AuthorizedUpdated");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reputation — soulbound
// ─────────────────────────────────────────────────────────────────────────────

describe("Reputation — soulbound", () => {
  it("token cannot be transferred after minting", async () => {
    const ctx = await deployAll();
    const { reputation, buyer, seller } = ctx;

    // Mint by triggering a trade
    await reputation.recordTrade(buyer.address, seller.address);
    const tokenId = await reputation.tokenOf(buyer.address);
    assert.isTrue(tokenId > 0n, "token should be minted");

    let reverted = false;
    try {
      await reputation.connect(buyer).transferFrom(buyer.address, seller.address, tokenId);
    } catch {
      reverted = true;
    }
    assert.isTrue(reverted, "transfer should revert (soulbound)");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reputation — trade completion via Marketplace
// ─────────────────────────────────────────────────────────────────────────────

describe("Reputation — trade completion", () => {
  it("buyer and seller each gain +10 on confirmDelivery", async () => {
    const ctx = await deployAll();
    const { marketplace, reputation, owner, buyer, seller } = ctx;

    const { escrowId } = await fullBuy(ctx, "sneaker-alpha");

    // Owner confirms delivery directly (no Verifier needed for this path)
    await marketplace.connect(owner).confirmDelivery(escrowId);

    const buyerStats  = await reputation.statsOf(buyer.address);
    const sellerStats = await reputation.statsOf(seller.address);

    assert.equal(buyerStats.score,          10n, "buyer score should be +10");
    assert.equal(sellerStats.score,         10n, "seller score should be +10");
    assert.equal(buyerStats.completedTrades, 1n, "buyer completedTrades should be 1");
    assert.equal(sellerStats.completedTrades,1n, "seller completedTrades should be 1");
  });

  it("auto-mints reputation token on first trade interaction", async () => {
    const ctx = await deployAll();
    const { marketplace, reputation, owner, buyer } = ctx;

    assert.equal(await reputation.tokenOf(buyer.address), 0n, "no token before trade");

    const { escrowId } = await fullBuy(ctx, "sneaker-beta");
    await marketplace.connect(owner).confirmDelivery(escrowId);

    assert.isTrue(await reputation.tokenOf(buyer.address) > 0n, "token minted after trade");
  });

  it("accumulated score across multiple trades", async () => {
    const ctx = await deployAll();
    const { marketplace, reputation, owner } = ctx;

    const { escrowId: e1 } = await fullBuy(ctx, "item-1");
    await marketplace.connect(owner).confirmDelivery(e1);

    // Give buyer more USDC for second trade
    await ctx.usdc.connect(ctx.buyer).faucet();

    const { escrowId: e2 } = await fullBuy(ctx, "item-2");
    await marketplace.connect(owner).confirmDelivery(e2);

    const stats = await reputation.statsOf(ctx.buyer.address);
    assert.equal(stats.score, 20n, "buyer should have +20 after 2 trades");
    assert.equal(stats.completedTrades, 2n, "buyer completedTrades should be 2");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reputation — dispute resolution
// ─────────────────────────────────────────────────────────────────────────────

describe("Reputation — disputes", () => {
  it("dispute resolved for buyer: buyer +5, seller -15", async () => {
    const ctx = await deployAll();
    const { marketplace, escrow, reputation, owner, buyer, seller } = ctx;

    const { escrowId } = await fullBuy(ctx, "disputed-item-1");
    await escrow.connect(buyer).dispute(escrowId);
    await marketplace.connect(owner).resolveDispute(escrowId, true); // refund buyer

    const buyerStats  = await reputation.statsOf(buyer.address);
    const sellerStats = await reputation.statsOf(seller.address);

    assert.equal(buyerStats.score,  5n,  "buyer score: +5");
    assert.equal(sellerStats.score, -15n,"seller score: -15");
    assert.equal(buyerStats.disputes,  1n, "buyer dispute count: 1");
    assert.equal(sellerStats.disputes, 1n, "seller dispute count: 1");
  });

  it("dispute resolved for seller: seller +5, buyer -5", async () => {
    const ctx = await deployAll();
    const { marketplace, escrow, reputation, owner, buyer, seller } = ctx;

    const { escrowId } = await fullBuy(ctx, "disputed-item-2");
    await escrow.connect(buyer).dispute(escrowId);
    await marketplace.connect(owner).resolveDispute(escrowId, false); // release to seller

    const buyerStats  = await reputation.statsOf(buyer.address);
    const sellerStats = await reputation.statsOf(seller.address);

    assert.equal(buyerStats.score,  -5n, "buyer score: -5");
    assert.equal(sellerStats.score,  5n, "seller score: +5");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reputation — verification via Verifier
// ─────────────────────────────────────────────────────────────────────────────

describe("Reputation — verifier node", () => {
  it("node gains +5 on successful submitVerification", async () => {
    const ctx = await deployAll();
    const { reputation, node } = ctx;

    await registerNode(ctx);
    const { escrowId, nfcHash } = await fullBuy(ctx, "nfc-item-1");
    await ctx.verifier.connect(node).submitVerification(escrowId, nfcHash);

    const stats = await reputation.statsOf(node.address);
    assert.equal(stats.score,         5n, "node score: +5");
    assert.equal(stats.verifications, 1n, "node verifications: 1");
  });

  it("node loses -20 on challengeVerification", async () => {
    const ctx = await deployAll();
    const { verifier, reputation, owner, node } = ctx;

    await registerNode(ctx);
    const { escrowId, nfcHash } = await fullBuy(ctx, "nfc-item-2");
    await verifier.connect(node).submitVerification(escrowId, nfcHash);

    // Node has +5 after verification
    assert.equal((await reputation.statsOf(node.address)).score, 5n);

    // Owner challenges the node with a 10 USDC slash
    const slashAmt = 10n * 10n ** 6n;
    await verifier.connect(owner).challengeVerification(escrowId, slashAmt);

    // Score should now be 5 - 20 = -15
    const stats = await reputation.statsOf(node.address);
    assert.equal(stats.score, -15n, "node score after challenge: -15");
  });

  it("multiple verifications accumulate score", async () => {
    const ctx = await deployAll();
    const { reputation, node } = ctx;

    await registerNode(ctx);

    await ctx.usdc.connect(ctx.buyer).faucet();
    const { escrowId: e1, nfcHash: h1 } = await fullBuy(ctx, "nfc-multi-1");
    await ctx.verifier.connect(node).submitVerification(e1, h1);

    await ctx.usdc.connect(ctx.buyer).faucet();
    const { escrowId: e2, nfcHash: h2 } = await fullBuy(ctx, "nfc-multi-2");
    await ctx.verifier.connect(node).submitVerification(e2, h2);

    const stats = await reputation.statsOf(node.address);
    assert.equal(stats.score,         10n, "node score: +10 after 2 verifications");
    assert.equal(stats.verifications,  2n, "node verifications: 2");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Staking — basic flow
// ─────────────────────────────────────────────────────────────────────────────

describe("Staking — stake and unstake", () => {
  it("stake(amount) deposits USDC and records balance", async () => {
    const ctx = await deployAll();
    const { usdc, staking, other } = ctx;

    await usdc.connect(other).approve(await staking.getAddress(), MIN_STAKE);
    await staking.connect(other).stake(MIN_STAKE);

    const record = await staking.getStake(other.address);
    assert.equal(record.amount, MIN_STAKE, "stake should be recorded");
  });

  it("reverts when staking below MIN_STAKE on first stake", async () => {
    const ctx = await deployAll();
    const { usdc, staking, other } = ctx;

    const tooLittle = 50n * 10n ** 6n;
    await usdc.connect(other).approve(await staking.getAddress(), tooLittle);

    let reverted = false;
    try {
      await staking.connect(other).stake(tooLittle);
    } catch {
      reverted = true;
    }
    assert.isTrue(reverted, "should revert for insufficient stake");
  });

  it("initiateUnstake sets cooldown timestamp", async () => {
    const ctx = await deployAll();
    const { usdc, staking, other } = ctx;

    await usdc.connect(other).approve(await staking.getAddress(), MIN_STAKE);
    await staking.connect(other).stake(MIN_STAKE);
    await staking.connect(other).initiateUnstake();

    const cooldown = await staking.cooldownEnd(other.address);
    assert.isTrue(cooldown > 0n, "cooldown end should be set");
  });

  it("completeUnstake reverts before cooldown elapses", async () => {
    const ctx = await deployAll();
    const { usdc, staking, other } = ctx;

    await usdc.connect(other).approve(await staking.getAddress(), MIN_STAKE);
    await staking.connect(other).stake(MIN_STAKE);
    await staking.connect(other).initiateUnstake();

    let reverted = false;
    try {
      await staking.connect(other).completeUnstake();
    } catch {
      reverted = true;
    }
    assert.isTrue(reverted, "should revert before cooldown");
  });

  it("completeUnstake succeeds after cooldown via time-warp", async () => {
    const ctx = await deployAll();
    const { usdc, staking, other, conn } = ctx;

    await usdc.connect(other).approve(await staking.getAddress(), MIN_STAKE);
    await staking.connect(other).stake(MIN_STAKE);
    await staking.connect(other).initiateUnstake();

    const SEVEN_DAYS = 7 * 24 * 60 * 60;
    await conn.provider.send("evm_increaseTime", [SEVEN_DAYS + 1]);
    await conn.provider.send("evm_mine", []);

    const balBefore = await usdc.balanceOf(other.address);
    await staking.connect(other).completeUnstake();
    const balAfter = await usdc.balanceOf(other.address);

    assert.equal(balAfter - balBefore, MIN_STAKE, "should receive staked USDC back");

    const record = await staking.getStake(other.address);
    assert.equal(record.amount, 0n, "stake cleared after unstake");
  });

  it("cannot stake again while unstake is pending", async () => {
    const ctx = await deployAll();
    const { usdc, staking, other } = ctx;

    await usdc.connect(other).approve(await staking.getAddress(), MIN_STAKE * 2n);
    await staking.connect(other).stake(MIN_STAKE);
    await staking.connect(other).initiateUnstake();

    let reverted = false;
    try {
      await staking.connect(other).stake(MIN_STAKE);
    } catch {
      reverted = true;
    }
    assert.isTrue(reverted, "cannot stake while unstaking");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Staking — slash
// ─────────────────────────────────────────────────────────────────────────────

describe("Staking — slash", () => {
  it("owner can slash a staker's balance", async () => {
    const ctx = await deployAll();
    const { usdc, staking, owner, other } = ctx;

    await usdc.connect(other).approve(await staking.getAddress(), MIN_STAKE);
    await staking.connect(other).stake(MIN_STAKE);

    const slashAmt = 20n * 10n ** 6n;
    await staking.connect(owner).slash(other.address, slashAmt, "fraud");

    const record = await staking.getStake(other.address);
    assert.equal(record.amount, MIN_STAKE - slashAmt, "stake reduced by slash");
  });

  it("slash exceeding stake reverts", async () => {
    const ctx = await deployAll();
    const { usdc, staking, owner, other } = ctx;

    await usdc.connect(other).approve(await staking.getAddress(), MIN_STAKE);
    await staking.connect(other).stake(MIN_STAKE);

    let reverted = false;
    try {
      await staking.connect(owner).slash(other.address, MIN_STAKE + 1n, "too much");
    } catch {
      reverted = true;
    }
    assert.isTrue(reverted, "should revert when slash > stake");
  });

  it("slashing to zero cancels pending unstake", async () => {
    const ctx = await deployAll();
    const { usdc, staking, owner, other } = ctx;

    await usdc.connect(other).approve(await staking.getAddress(), MIN_STAKE);
    await staking.connect(other).stake(MIN_STAKE);
    await staking.connect(other).initiateUnstake();

    assert.isTrue((await staking.cooldownEnd(other.address)) > 0n, "unstake pending before slash");

    await staking.connect(owner).slash(other.address, MIN_STAKE, "wiped");

    const record = await staking.getStake(other.address);
    assert.equal(record.amount, 0n, "stake wiped");
    assert.equal(record.unstakeInitiatedAt, 0n, "pending unstake cleared");
  });

  it("non-owner cannot slash", async () => {
    const ctx = await deployAll();
    const { usdc, staking, other, buyer } = ctx;

    await usdc.connect(other).approve(await staking.getAddress(), MIN_STAKE);
    await staking.connect(other).stake(MIN_STAKE);

    let reverted = false;
    try {
      await staking.connect(buyer).slash(other.address, 1n, "unauthorised");
    } catch {
      reverted = true;
    }
    assert.isTrue(reverted, "non-owner cannot slash");
  });
});
