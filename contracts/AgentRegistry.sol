// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./AgentAccount.sol";

/// @title AgentRegistry
/// @notice Mints Agent NFTs and deterministically deploys an ERC-6551 Token-Bound Account
///         for each one via CREATE2. The NFT holder owns and controls the TBA.
///
///         Flow: user calls createAgent() → receives Agent NFT → TBA is auto-deployed
///               at a deterministic address → user funds the TBA with USDC.
contract AgentRegistry is ERC721, Ownable {
    uint256 private _nextAgentId;

    /// @notice Maps agentId → its TBA address
    mapping(uint256 => address) public agentAccount;

    /// @notice Maps TBA address → agentId (reverse lookup)
    mapping(address => uint256) public accountToAgent;

    /// @notice Maps user address → array of agentIds they own
    mapping(address => uint256[]) private userAgents;

    event AgentCreated(uint256 indexed agentId, address indexed owner, address indexed tba);
    event AgentBurned(uint256 indexed agentId, address indexed owner);

    error NotAuthorised();

    constructor() ERC721("ARES Agent", "AGENT") Ownable(msg.sender) {}

    /// @notice Returns the total number of agents minted.
    function agentCount() external view returns (uint256) {
        return _nextAgentId;
    }

    /// @notice Returns the array of agent IDs owned by a specific address.
    function getUserAgents(address user) external view returns (uint256[] memory) {
        return userAgents[user];
    }

    /// @notice Create a new agent with default empty policies.
    function createAgent() external returns (uint256 agentId, address tba) {
        return createAgentWithPolicy(0, 0, 0, false);
    }

    /// @notice Create a new agent with initial spending policies.
    /// @return agentId  The ID of the newly minted agent NFT.
    /// @return tba      The address of the deployed Token-Bound Account.
    function createAgentWithPolicy(
        uint256 maxSingleTrade,
        uint256 dailyBudget,
        uint256 autoBuyPrice,
        bool autoBuyActive
    ) public returns (uint256 agentId, address tba) {
        agentId = ++_nextAgentId;
        _safeMint(msg.sender, agentId);

        tba = _deployTBA(agentId, maxSingleTrade, dailyBudget, autoBuyPrice, autoBuyActive);
        agentAccount[agentId] = tba;
        accountToAgent[tba] = agentId;

        emit AgentCreated(agentId, msg.sender, tba);
    }

    /// @notice Burn an agent NFT. Only the owner can call this.
    function burn(uint256 agentId) external {
        if (ownerOf(agentId) != msg.sender) revert NotAuthorised();
        
        address tba = agentAccount[agentId];
        delete agentAccount[agentId];
        delete accountToAgent[tba];
        
        _burn(agentId);
        emit AgentBurned(agentId, msg.sender);
    }

    /// @notice Compute the deterministic TBA address for a given agentId without deploying.
    function computeTBAAddress(
        uint256 agentId,
        uint256 maxSingleTrade,
        uint256 dailyBudget,
        uint256 autoBuyPrice,
        bool autoBuyActive
    ) external view returns (address) {
        return _computeAddress(agentId, maxSingleTrade, dailyBudget, autoBuyPrice, autoBuyActive);
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = super._update(to, tokenId, auth);
        
        // Remove from previous owner's list
        if (from != address(0)) {
            uint256[] storage fromList = userAgents[from];
            for (uint256 i = 0; i < fromList.length; i++) {
                if (fromList[i] == tokenId) {
                    fromList[i] = fromList[fromList.length - 1];
                    fromList.pop();
                    break;
                }
            }
        }
        
        // Add to new owner's list
        if (to != address(0)) {
            userAgents[to].push(tokenId);
        }

        return from;
    }

    function _deployTBA(
        uint256 agentId,
        uint256 maxSingleTrade,
        uint256 dailyBudget,
        uint256 autoBuyPrice,
        bool autoBuyActive
    ) internal returns (address tba) {
        bytes memory bytecode = _creationBytecode(agentId, maxSingleTrade, dailyBudget, autoBuyPrice, autoBuyActive);
        bytes32 salt = keccak256(abi.encodePacked(agentId));

        assembly {
            tba := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        require(tba != address(0), "AgentRegistry: TBA deployment failed");
    }

    function _computeAddress(
        uint256 agentId,
        uint256 maxSingleTrade,
        uint256 dailyBudget,
        uint256 autoBuyPrice,
        bool autoBuyActive
    ) internal view returns (address) {
        bytes memory bytecode = _creationBytecode(agentId, maxSingleTrade, dailyBudget, autoBuyPrice, autoBuyActive);
        bytes32 salt = keccak256(abi.encodePacked(agentId));
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(bytecode))
        );
        return address(uint160(uint256(hash)));
    }

    function _creationBytecode(
        uint256 agentId,
        uint256 maxSingleTrade,
        uint256 dailyBudget,
        uint256 autoBuyPrice,
        bool autoBuyActive
    ) internal view returns (bytes memory) {
        return abi.encodePacked(
            type(AgentAccount).creationCode,
            abi.encode(
                block.chainid,
                address(this),
                agentId,
                maxSingleTrade,
                dailyBudget,
                autoBuyPrice,
                autoBuyActive
            )
        );
    }
}