// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./DigitalTwin.sol";
import "./Escrow.sol";
import "./Marketplace.sol";

/// @title Verifier
/// @notice DePIN verification hub for the ARES marketplace.
///
///         Flow:
///           1. A node calls registerNode(amount) — stakes ≥ MIN_STAKE USDC.
///           2. Node physically inspects the item, reads its NFC tag, and hashes the data
///              (keccak256 of the tag payload — simulated on testnet).
///           3. Node calls submitVerification(escrowId, nfcHash).
///              - The provided hash is checked against the DigitalTwin's on-chain stored hash.
///              - On match → Marketplace.confirmDelivery() is triggered: USDC released to
///                seller, NFT transferred to buyer.
///              - On mismatch → reverts with InvalidNfcHash; escrow stays PENDING.
///           4. If a node is found to have attested fraudulently, the owner can call
///              challengeVerification(escrowId, slashAmt) or slash(node, amount, reason)
///              to penalise the stake.
///           5. Node may call deregisterNode() to withdraw remaining stake when not needed.
///
///         The Verifier contract must be registered in Marketplace via
///         marketplace.setVerifier(verifierAddress, true) before it can settle escrows.
contract Verifier is Ownable {
    // ── Types ────────────────────────────────────────────────────────────────

    struct Node {
        uint256 stake;
        bool    active;
    }

    struct Attestation {
        address node;
        bytes32 nfcHash;
        bool    finalized;
    }

    // ── Storage ───────────────────────────────────────────────────────────────

    IERC20       public immutable usdc;
    DigitalTwin  public immutable digitalTwin;
    Escrow       public immutable escrow;
    Marketplace  public immutable marketplace;

    /// @notice Minimum USDC stake required to become an active verifier node.
    uint256 public constant MIN_STAKE = 100 * 10 ** 6; // 100 USDC (6-decimal)

    mapping(address  => Node)        public nodes;
    mapping(uint256  => Attestation) public attestations; // escrowId → attestation

    // ── Events ────────────────────────────────────────────────────────────────

    event NodeRegistered    (address indexed node,    uint256 stake);
    event NodeDeregistered  (address indexed node,    uint256 returned);
    event VerificationSubmitted(uint256 indexed escrowId, address indexed node, bytes32 nfcHash);
    event VerificationChallenged(uint256 indexed escrowId, address indexed node, uint256 slashed);
    event NodeSlashed       (address indexed node,    uint256 amount, string reason);

    // ── Errors ────────────────────────────────────────────────────────────────

    error InsufficientStake();
    error NotActiveNode();
    error AlreadyVerified();
    error NotVerified();
    error InvalidNfcHash();
    error TransferFailed();

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(
        address _usdc,
        address _digitalTwin,
        address _escrow,
        address _marketplace
    ) Ownable(msg.sender) {
        usdc        = IERC20(_usdc);
        digitalTwin = DigitalTwin(_digitalTwin);
        escrow      = Escrow(_escrow);
        marketplace = Marketplace(_marketplace);
    }

    // ── Node lifecycle ────────────────────────────────────────────────────────

    /// @notice Stake USDC to register (or top up) as a verifier node.
    ///         Caller must approve `amount` USDC to this contract first.
    /// @param amount USDC to stake (must be ≥ MIN_STAKE on first registration).
    function registerNode(uint256 amount) external {
        if (nodes[msg.sender].stake + amount < MIN_STAKE) revert InsufficientStake();
        bool ok = usdc.transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();
        nodes[msg.sender].stake  += amount;
        nodes[msg.sender].active  = true;
        emit NodeRegistered(msg.sender, amount);
    }

    /// @notice Withdraw all remaining stake and deactivate the node.
    function deregisterNode() external {
        Node storage n = nodes[msg.sender];
        if (!n.active) revert NotActiveNode();
        uint256 amount = n.stake;
        n.stake  = 0;
        n.active = false;
        bool ok  = usdc.transfer(msg.sender, amount);
        if (!ok) revert TransferFailed();
        emit NodeDeregistered(msg.sender, amount);
    }

    // ── Verification ──────────────────────────────────────────────────────────

    /// @notice Attest the authenticity of a physical item and settle the trade.
    ///
    ///         The provided nfcHash must equal the hash stored on the DigitalTwin NFT
    ///         (registered at mint time via keccak256 of the physical NFC tag data).
    ///         On success the Marketplace releases USDC to the seller and transfers
    ///         the NFT to the buyer.
    ///
    /// @param escrowId The ARES escrow record to settle.
    /// @param nfcHash  keccak256 of the physical NFC tag payload read by the node.
    function submitVerification(uint256 escrowId, bytes32 nfcHash) external {
        if (!nodes[msg.sender].active) revert NotActiveNode();
        if (attestations[escrowId].finalized) revert AlreadyVerified();

        // Resolve twinId from the escrow record
        Escrow.EscrowRecord memory rec = escrow.getEscrow(escrowId);

        // Compare against the hash registered at mint time
        bytes32 expected = digitalTwin.tokenIdToNfcHash(rec.twinId);
        if (nfcHash != expected) revert InvalidNfcHash();

        attestations[escrowId] = Attestation({
            node:      msg.sender,
            nfcHash:   nfcHash,
            finalized: true
        });

        emit VerificationSubmitted(escrowId, msg.sender, nfcHash);

        // Trigger settlement: Marketplace releases escrow + transfers NFT
        marketplace.confirmDelivery(escrowId);
    }

    // ── Governance / slashing ─────────────────────────────────────────────────

    /// @notice Challenge a finalised verification — slash the attesting node.
    ///         Called by the owner when a node is found to have attested fraudulently.
    ///         Note: escrow settlement has already occurred at verification time;
    ///         the matching dispute/refund must be handled via Marketplace.resolveDispute.
    /// @param escrowId The settled escrow whose node is being penalised.
    /// @param slashAmt USDC amount to slash from the node's stake.
    function challengeVerification(uint256 escrowId, uint256 slashAmt) external onlyOwner {
        Attestation storage att = attestations[escrowId];
        if (!att.finalized) revert NotVerified();
        uint256 slashed = _slash(att.node, slashAmt, "challenged verification");
        emit VerificationChallenged(escrowId, att.node, slashed);
    }

    /// @notice Slash a node directly (owner governance, e.g. off-chain evidence).
    /// @param node   Address of the node to penalise.
    /// @param amount USDC amount to slash.
    /// @param reason Human-readable reason (emitted in event).
    function slash(address node, uint256 amount, string calldata reason) external onlyOwner {
        _slash(node, amount, reason);
    }

    // ── View ──────────────────────────────────────────────────────────────────

    function getNode(address nodeAddr) external view returns (Node memory) {
        return nodes[nodeAddr];
    }

    function getAttestation(uint256 escrowId) external view returns (Attestation memory) {
        return attestations[escrowId];
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _slash(
        address nodeAddr,
        uint256 amount,
        string memory reason
    ) internal returns (uint256 slashed) {
        Node storage n = nodes[nodeAddr];
        slashed   = amount > n.stake ? n.stake : amount;
        n.stake  -= slashed;
        if (n.stake == 0) n.active = false;
        emit NodeSlashed(nodeAddr, slashed, reason);
    }
}
