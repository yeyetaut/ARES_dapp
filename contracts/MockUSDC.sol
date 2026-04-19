// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSDC
/// @notice Test ERC-20 token simulating USDC on Sepolia. 6 decimals like real USDC.
contract MockUSDC is ERC20, Ownable {
    constructor() ERC20("USD Coin (Mock)", "USDC") Ownable(msg.sender) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint tokens to any address (testnet only).
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Anyone can faucet up to 1000 USDC at a time for testing.
    function faucet() external {
        _mint(msg.sender, 1_000 * 10 ** 6);
    }
}
