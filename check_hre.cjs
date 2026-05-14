const hre = require("hardhat");
async function main() {
  console.log("HRE keys:", Object.keys(hre));
  if (hre.network) console.log("HRE.network keys:", Object.keys(hre.network));
  if (hre.ethers) console.log("HRE.ethers keys:", Object.keys(hre.ethers));
}
main().catch(console.error);
