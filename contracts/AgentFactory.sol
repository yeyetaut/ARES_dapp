// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "./AgentRegistry.sol";
import "./AgentAccount.sol";

/// @title AgentFactory
/// @notice Streamlines Agent creation by combining minting, funding, and policy setting.
contract AgentFactory is IERC721Receiver {
    AgentRegistry public immutable registry;
    IERC20 public immutable usdc;

    event AgentOnboarded(
        uint256 indexed agentId,
        address indexed owner,
        address indexed tba,
        uint256 initialFunding
    );

    constructor(address _registry, address _usdc) {
        registry = AgentRegistry(_registry);
        usdc = IERC20(_usdc);
    }

    /// @notice Create an agent, fund it, and set its policy in one transaction.
    /// @param initialFunding Amount of USDC to transfer from caller to the new TBA.
    /// @param maxSingleTrade Max USDC per single trade for the agent.
    /// @param dailyBudget    Max USDC per 24h for the agent.
    /// @param autoBuyPrice   Max price for autonomous buying.
    /// @param autoBuyActive  Whether to enable autonomous buying immediately.
    /// @return agentId       The ID of the new agent NFT.
    /// @return tba           The address of the new Token-Bound Account.
    function onboardAgent(
        uint256 initialFunding,
        uint256 maxSingleTrade,
        uint256 dailyBudget,
        uint256 autoBuyPrice,
        bool autoBuyActive
    ) external returns (uint256 agentId, address tba) {
        // 1. Create the agent (mints NFT to address(this), deploys TBA with policy)
        (agentId, tba) = registry.createAgentWithPolicy(
            maxSingleTrade,
            dailyBudget,
            autoBuyPrice,
            autoBuyActive
        );

        // 2. Transfer NFT to the user (Registry minted it to the factory)
        registry.safeTransferFrom(address(this), msg.sender, agentId);

        // 3. Fund the TBA (caller must have approved this factory for USDC)
        if (initialFunding > 0) {
            bool ok = usdc.transferFrom(msg.sender, tba, initialFunding);
            require(ok, "AgentFactory: Funding failed");
        }

        emit AgentOnboarded(agentId, msg.sender, tba, initialFunding);
    }

    /// @notice Support for safe ERC-721 transfers.
    function onERC721Received(address, address, uint256, bytes calldata)
        external pure override returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }
}
