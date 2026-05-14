import { ethers } from "hardhat";

async function main() {
  const VERIFIER_ADDRESS = "0xCd88714344c3c08d9d9492b9b4E4f2bebec6aDc4";
  const MARKETPLACE_ADDRESS = "0x151Ee43316DCcb11C5390EadE8CCe3234D36b9a3";

  console.log("\n--- MARKETPLACE VERIFIER CHECK ---");
  const marketplace = await ethers.getContractAt("Marketplace", MARKETPLACE_ADDRESS);
  const isAuthorized = await marketplace.verifiers(VERIFIER_ADDRESS);
  console.log(`Is Verifier Contract (${VERIFIER_ADDRESS}) authorized in Marketplace? ${isAuthorized}`);
  
  const owner = await marketplace.owner();
  console.log(`Marketplace Owner: ${owner}`);
  console.log("----------------------------------\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
