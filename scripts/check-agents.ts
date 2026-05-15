import hre from "hardhat";

async function main() {
  const REGISTRY_ADDR = "0xF0BC472a735A1D9272a787917Ec368c6A81e6712";
  const r = await hre.ethers.getContractAt("AgentRegistry", REGISTRY_ADDR);
  const count = await r.agentCount();
  console.log("Agent Count:", count.toString());
  
  const usdc = await hre.ethers.getContractAt("IERC20", "0x4BD4ABa1EaeE7b7528348e8A4BB775978004D191");
  
  for (let i = 1n; i <= count; i++) {
    const tba = await r.agentAccount(i);
    const owner = await r.ownerOf(i);
    const acc = await hre.ethers.getContractAt("AgentAccount", tba);
    const policy = await acc.autoBuyPolicy();
    const maxSingle = await acc.maxSingleTrade();
    const budget = await acc.dailyBudget();
    const spent = await acc.dailySpent();
    const balance = await usdc.balanceOf(tba);
    console.log(`Agent ${i}:`);
    console.log(` - TBA: ${tba}`);
    console.log(` - Owner: ${owner}`);
    console.log(` - Balance: ${(Number(balance) / 10**6).toFixed(2)} USDC`);
    console.log(` - Policy: Active=${policy.active}, MaxPrice=${(Number(policy.maxPrice) / 10**6).toFixed(2)} USDC`);
    console.log(` - Limits: MaxSingle=${(Number(maxSingle) / 10**6).toFixed(2)} USDC, Daily Budget=${(Number(budget) / 10**6).toFixed(2)} USDC (Spent: ${(Number(spent) / 10**6).toFixed(2)})`);
  }
}

main().catch(console.error);
