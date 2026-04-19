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

    event AgentCreated(uint256 indexed agentId, address indexed owner, address indexed tba);

    constructor() ERC721("ARES Agent", "AGENT") Ownable(msg.sender) {}

    /// @notice Create a new agent: mints an NFT and deploys its TBA.
    /// @return agentId  The ID of the newly minted agent NFT.
    /// @return tba      The address of the deployed Token-Bound Account.
    function createAgent() external returns (uint256 agentId, address tba) {
        agentId = ++_nextAgentId;
        _safeMint(msg.sender, agentId);

        tba = _deployTBA(agentId);
        agentAccount[agentId] = tba;
        accountToAgent[tba] = agentId;

        emit AgentCreated(agentId, msg.sender, tba);
    }

    /// @notice Compute the deterministic TBA address for a given agentId without deploying.
    function computeTBAAddress(uint256 agentId) external view returns (address) {
        return _computeAddress(agentId);
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _deployTBA(uint256 agentId) internal returns (address tba) {
        bytes memory bytecode = _creationBytecode(agentId);
        bytes32 salt = keccak256(abi.encodePacked(agentId));

        assembly {
            tba := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        require(tba != address(0), "AgentRegistry: TBA deployment failed");
    }

    function _computeAddress(uint256 agentId) internal view returns (address) {
        bytes memory bytecode = _creationBytecode(agentId);
        bytes32 salt = keccak256(abi.encodePacked(agentId));
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(bytecode))
        );
        return address(uint160(uint256(hash)));
    }

    function _creationBytecode(uint256 agentId) internal view returns (bytes memory) {
        return abi.encodePacked(
            type(AgentAccount).creationCode,
            abi.encode(block.chainid, address(this), agentId)
        );
    }
}
