import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const { SEPOLIA_RPC_URL, PRIVATE_KEY } = process.env;

if (SEPOLIA_RPC_URL) {
  console.log(`Using RPC: ${SEPOLIA_RPC_URL.substring(0, 25)}...`);
} else {
  console.warn("WARNING: SEPOLIA_RPC_URL not found in environment.");
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {
      mining: {
        auto: true,
      },
    },
    sepolia: {
      url: SEPOLIA_RPC_URL || "",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
};

export default config;
