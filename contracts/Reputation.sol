// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Reputation
/// @notice Soulbound (non-transferable) ERC-721 that tracks on-chain reputation
///         for every participant in the ARES marketplace.
///
///         One token is minted per address on first interaction. Scores and trade
///         stats are updated by authorised callers (Marketplace, Verifier).
///
///         Score deltas:
///           +10  — trade completed (buyer or seller)
///           +5   — successful NFC verification (verifier node)
///           -15  — seller in a dispute resolved for the buyer
///           -5   — buyer in a dispute resolved for the seller
///           -20  — verifier node challenged / slashed
contract Reputation is ERC721, Ownable {
    // ── Types ────────────────────────────────────────────────────────────────

    struct Stats {
        int256  score;
        uint256 completedTrades;
        uint256 verifications;
        uint256 disputes;       // number of disputes the address was involved in
    }

    // ── Storage ───────────────────────────────────────────────────────────────

    uint256 private _nextTokenId;

    /// address → soulbound token ID (0 = not yet minted)
    mapping(address => uint256) private _tokenOf;

    /// tokenId → stats
    mapping(uint256 => Stats) private _stats;

    /// Addresses authorised to call update functions (Marketplace, Verifier).
    mapping(address => bool) public authorized;

    // ── Events ────────────────────────────────────────────────────────────────

    event ReputationMinted   (address indexed user,   uint256 indexed tokenId);
    event ScoreUpdated       (address indexed user,   int256 delta, int256 newScore);
    event AuthorizedUpdated  (address indexed caller, bool status);

    // ── Errors ────────────────────────────────────────────────────────────────

    error Soulbound();
    error NotAuthorized();

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyAuthorized() {
        if (!authorized[msg.sender] && msg.sender != owner()) revert NotAuthorized();
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor() ERC721("ARES Reputation", "AREP") Ownable(msg.sender) {}

    // ── Admin ─────────────────────────────────────────────────────────────────

    function setAuthorized(address caller, bool status) external onlyOwner {
        authorized[caller] = status;
        emit AuthorizedUpdated(caller, status);
    }

    // ── Soulbound guard ───────────────────────────────────────────────────────

    /// @dev Revert on any transfer except minting (from == address(0)).
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    // ── Score updates (called by Marketplace / Verifier) ──────────────────────

    /// @notice Record a completed trade for both parties (+10 each).
    function recordTrade(address buyer, address seller) external onlyAuthorized {
        _addScore(buyer,  10, false, false);
        _addScore(seller, 10, false, false);
        _stats[_tokenOf[buyer]].completedTrades++;
        _stats[_tokenOf[seller]].completedTrades++;
    }

    /// @notice Record a resolved dispute.
    ///         If refundBuyer == true: buyer +5, seller -15 (fault on seller side).
    ///         If refundBuyer == false: seller +5, buyer -5 (dispute rejected).
    function recordDispute(address buyer, address seller, bool refundBuyer) external onlyAuthorized {
        if (refundBuyer) {
            _addScore(buyer,   5,  false, true);
            _addScore(seller, -15, false, true);
        } else {
            _addScore(seller,  5,  false, true);
            _addScore(buyer,  -5,  false, true);
        }
        _stats[_tokenOf[buyer]].disputes++;
        _stats[_tokenOf[seller]].disputes++;
    }

    /// @notice Record a successful NFC verification (+5 for the node).
    function recordVerification(address node) external onlyAuthorized {
        _addScore(node, 5, true, false);
        _stats[_tokenOf[node]].verifications++;
    }

    /// @notice Record a slash event against a verifier node (-20).
    function recordChallenge(address node) external onlyAuthorized {
        _addScore(node, -20, true, false);
    }

    // ── View ──────────────────────────────────────────────────────────────────

    /// @notice Returns the Stats struct for `user`. Returns zeroed struct if no token yet.
    function statsOf(address user) external view returns (Stats memory) {
        return _stats[_tokenOf[user]];
    }

    /// @notice Returns the soulbound token ID for `user` (0 if not yet minted).
    function tokenOf(address user) external view returns (uint256) {
        return _tokenOf[user];
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    /// @dev Auto-mints a token for `user` on first interaction, then updates score.
    function _addScore(address user, int256 delta, bool /*isNode*/, bool /*isDispute*/) private {
        uint256 id = _tokenOf[user];
        if (id == 0) {
            id = ++_nextTokenId;
            _tokenOf[user] = id;
            _safeMint(user, id);
            emit ReputationMinted(user, id);
        }
        _stats[id].score += delta;
        emit ScoreUpdated(user, delta, _stats[id].score);
    }
}
