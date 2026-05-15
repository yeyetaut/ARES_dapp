# Use Node.js LTS
FROM node:20

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Ensure hardhat is compiled
RUN npx hardhat compile

# Run the agent executor
CMD ["npx", "hardhat", "run", "scripts/agent-executor.ts", "--network", "sepolia"]
