import { ethers } from "hardhat";

async function main() {
  const TWIN_ADDRESS = "0x9234685ebD1fB35647B61dA9538981BBA81224c8";
  const twin = await ethers.getContractAt("DigitalTwin", TWIN_ADDRESS);

  console.log("\n--- TWIN MINT LOGS ---");
  const filter = twin.filters.TwinMinted(3);
  const logs = await twin.queryFilter(filter);
  
  for (const log of logs) {
      console.log(`Token ID: ${log.args.tokenId}`);
      console.log(`To: ${log.args.to}`);
      console.log(`NFC Hash: ${log.args.nfcHash}`);
      console.log(`Metadata: ${log.args.metadataURI}`);
  }
  console.log("----------------------\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
