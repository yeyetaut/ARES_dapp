import hre from "hardhat";

async function main() {
  const MARKETPLACE_ADDR = "0xe320Bc16f641908916C1BeEB2812a2cE42CdF671";
  const m = await hre.ethers.getContractAt("Marketplace", MARKETPLACE_ADDR);
  const count = await m.listingCount();
  
  for (let i = 1n; i <= count; i++) {
    const l = await m.getListing(i);
    console.log(`Listing ${i}: Seller=${l.seller}, Price=${(Number(l.price)/10**6)} USDC, Active=${l.active}`);
  }
}

main().catch(console.error);
