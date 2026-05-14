import { expect } from "chai";
import { ethers } from "hardhat";

describe("QA: Listings Flow", function () {
  let mockUSDC: any;
  let digitalTwin: any;
  let marketplace: any;
  let escrow: any;
  let owner: any;
  let user: any;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    // Deploy dependencies
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();

    const DigitalTwin = await ethers.getContractFactory("DigitalTwin");
    digitalTwin = await DigitalTwin.deploy();

    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy(mockUSDC.target);

    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy(digitalTwin.target, escrow.target);

    // Setup: Marketplace needs to be able to pull NFTs (via user approval)
    // No special setup needed in constructor for Marketplace usually
  });

  it("Public can now mint DigitalTwin", async function () {
    const nfcHash = ethers.keccak256(ethers.toUtf8Bytes("item-public-1"));
    const metadataURI = "ipfs://public-test";

    // User is NOT owner, but can now mint
    const tx = await digitalTwin.connect(user).mint(user.address, nfcHash, metadataURI);
    await tx.wait();

    expect(await digitalTwin.balanceOf(user.address)).to.equal(1n);
  });

  it("Full Listing Flow (Public)", async function () {
    const nfcHash = ethers.keccak256(ethers.toUtf8Bytes("item-public-2"));
    const metadataURI = "ipfs://public-test-2";

    // 1. Mint (Public)
    const mintTx = await digitalTwin.connect(user).mint(user.address, nfcHash, metadataURI);
    const mintReceipt = await mintTx.wait();
    const tokenId = 2n; // Second token in this describe block's lifecycle if using previous test's ID but beforeEach redeploys.
    // Actually tokenId will be 1 because of beforeEach redeploy.
    const actualTokenId = 1n;

    // 2. Approve Marketplace
    await digitalTwin.connect(user).approve(marketplace.target, actualTokenId);

    // 3. List Item
    const price = ethers.parseUnits("100", 6);
    const listTx = await marketplace.connect(user).listItem(actualTokenId, price, metadataURI);
    await listTx.wait();

    // 4. Verify Listing
    const listing = await marketplace.getListing(1);
    expect(listing.active).to.equal(true);
    expect(listing.seller).to.equal(user.address);
    
    // Verify NFT is in Marketplace custody
    expect(await digitalTwin.ownerOf(actualTokenId)).to.equal(marketplace.target);
  });
});
