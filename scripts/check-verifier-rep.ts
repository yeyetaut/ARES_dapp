import { ethers } from "hardhat";

async function main() {
  const VERIFIER_ADDRESS = "0xCd88714344c3c08d9d9492b9b4E4f2bebec6aDc4";

  console.log("\n--- VERIFIER REPUTATION CHECK ---");
  const verifier = await ethers.getContractAt("Verifier", VERIFIER_ADDRESS);
  const reputation = await verifier.reputation();
  console.log(`Reputation Contract in Verifier: ${reputation}`);
  
  if (reputation !== ethers.ZeroAddress) {
      const repContract = await ethers.getContractAt("Reputation", reputation);
      const isAuthorized = await repContract.authorized(VERIFIER_ADDRESS);
      console.log(`Is Verifier authorized in Reputation? ${isAuthorized}`);
  }
  console.log("---------------------------------\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
