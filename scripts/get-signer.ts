import { ethers } from "hardhat";
async function main() {
  const [s] = await ethers.getSigners();
  console.log("Signer Address:", s.address);
}
main();
