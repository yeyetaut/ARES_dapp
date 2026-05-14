import { ethers } from "hardhat";

async function main() {
  const USER_ADDRESS = "0x595933FA2bdb94E1743eCBF66faa8FaA5DB53f29";
  const REGISTRY_ADDRESS = "0x65C4595092CAb70e9E7D9d3F0FE691C7f93e986B";
  const USDC_ADDRESS = "0x007De812e4dc678509b9dA4d2A20D3Bed5E1CF0D";

  console.log("\n--- ARES SEPOLIA DIAGNOSTIC ---");
  console.log("Checking Address:", USER_ADDRESS);

  const registry = await ethers.getContractAt("AgentRegistry", REGISTRY_ADDRESS);
  const usdc = await ethers.getContractAt("MockUSDC", USDC_ADDRESS);

  // 1. Check Agent Balance
  try {
    const balance = await registry.balanceOf(USER_ADDRESS);
    console.log("Agent Balance:", balance.toString());

    if (balance > 0) {
        console.log("Agents Owned:");
        // We have to iterate to find the token IDs or check events, but for a simple check:
        const totalAgents = await registry.agentCount();
        for (let i = 1; i <= Number(totalAgents); i++) {
            const owner = await registry.ownerOf(i);
            if (owner.toLowerCase() === USER_ADDRESS.toLowerCase()) {
                const tba = await registry.agentAccount(i);
                console.log(` - Agent #${i} | TBA: ${tba}`);
            }
        }
    } else {
        console.log("No agents found for this address on Sepolia.");
    }
  } catch (e) {
    console.log("Error checking Registry:", e.message);
  }

  // 2. Check USDC Balance
  try {
    const usdcBal = await usdc.balanceOf(USER_ADDRESS);
    const decimals = await usdc.decimals();
    console.log("MockUSDC Balance:", ethers.formatUnits(usdcBal, decimals), "USDC");
  } catch (e) {
    console.log("Error checking USDC:", e.message);
  }

  console.log("-------------------------------\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
