import { ethers } from "hardhat";

async function main() {
  const USER_ADDRESS = "0x595933FA2bdb94E1743eCBF66faa8FaA5DB53f29";
  const REGISTRY_ADDRESS = "0xBb2F80d1C618e1ce71100752F22275B9Da20f122";

  console.log("\n--- AUTHORIZING EXECUTOR ---");
  const registry = await ethers.getContractAt("AgentRegistry", REGISTRY_ADDRESS);
  const totalAgents = await registry.agentCount();

  for (let i = 1n; i <= totalAgents; i++) {
    try {
      const owner = await registry.ownerOf(i);
      if (owner.toLowerCase() === USER_ADDRESS.toLowerCase()) {
        const tba = await registry.agentAccount(i);
        const agentAccount = await ethers.getContractAt("AgentAccount", tba);
        
        console.log(`Agent #${i} (${tba}): Authorizing ${USER_ADDRESS}...`);
        const tx = await agentAccount.setExecutor(USER_ADDRESS, true);
        await tx.wait();
        console.log(" - Done.");
      }
    } catch (e) {
      console.log(` - Error for Agent #${i}: ${e.message}`);
    }
  }
  console.log("-----------------------------\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
