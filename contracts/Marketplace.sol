// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./DigitalTwin.sol";
import "./Escrow.sol";
import "./Reputation.sol";

/// @title Marketplace
/// @notice ARES listing and order-matching contract.
///
///         Flow:
///           1. Seller approves DigitalTwin NFT to this contract.
///           2. Seller calls listItem() — NFT held in custody here.
///           3. Buyer approves USDC to Escrow contract.
///           4. Buyer calls buyItem() — USDC locked in Escrow; listing deactivated.
///           5. Authorised verifier calls confirmDelivery() — USDC released to seller,
///              NFT transferred to buyer.
///           6. On dispute: Marketplace owner calls resolveDispute() to settle.
///
///         The Verifier address for Phase 2 is the contract owner.
///         Phase 3 will replace it with the Verifier.sol contract.
contract Marketplace is Ownable, IERC721Receiver {
    // ── Types ────────────────────────────────────────────────────────────────

    struct Listing {
        uint256 twinId;
        address seller;
        uint256 price;   // USDC (6-decimal)
        bool active;
    }

    // ── Storage ───────────────────────────────────────────────────────────────

    DigitalTwin public immutable digitalTwin;
    Escrow public immutable escrow;

    /// @notice Authorised verifier addresses (Phase 3: Verifier contract).
    mapping(address => bool) public verifiers;

    /// @notice Optional reputation contract — set via setReputation() after deployment.
    Reputation public reputation;

    uint256 private _nextListingId;
    mapping(uint256 => Listing) private _listings;

    // escrowId → listingId (for NFT routing on settlement)
    mapping(uint256 => uint256) public escrowListing;

    // ── Events ────────────────────────────────────────────────────────────────

    event ItemListed(
        uint256 indexed listingId,
        uint256 indexed twinId,
        address indexed seller,
        uint256 price,
        string metadataURI
    );
    event ItemSold(
        uint256 indexed listingId,
        uint256 indexed escrowId,
        address indexed buyer
    );
    event ListingCancelled(uint256 indexed listingId);
    event DeliveryConfirmed(uint256 indexed escrowId, address indexed buyer);
    event DisputeResolved(uint256 indexed escrowId, bool refundedBuyer);
    event VerifierUpdated(address indexed verifier, bool authorised);

    // ── Errors ────────────────────────────────────────────────────────────────

    error NotActive();
    error NotAuthorised();
    error SelfPurchase();

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyVerifier() {
        if (!verifiers[msg.sender] && msg.sender != owner()) revert NotAuthorised();
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _digitalTwin, address _escrow) Ownable(msg.sender) {
        digitalTwin = DigitalTwin(_digitalTwin);
        escrow = Escrow(_escrow);
    }

    // ── Owner admin ───────────────────────────────────────────────────────────

    /// @notice Grant or revoke verifier rights (used by Phase 3 Verifier contract).
    function setVerifier(address verifier, bool authorised) external onlyOwner {
        verifiers[verifier] = authorised;
        emit VerifierUpdated(verifier, authorised);
    }

    /// @notice Set the Reputation contract address (Phase 4). Pass address(0) to disable.
    function setReputation(address _reputation) external onlyOwner {
        reputation = Reputation(_reputation);
    }

    // ── Listing management ────────────────────────────────────────────────────

    /// @notice List a Digital Twin for sale. Transfers NFT custody to this contract.
    /// @param twinId      Token ID of the DigitalTwin to sell.
    /// @param price       Asking price in USDC (6-decimal units).
    /// @param metadataURI IPFS URI with item metadata (emitted in event for indexing).
    /// @return listingId  The ID of the new listing.
    function listItem(
        uint256 twinId,
        uint256 price,
        string calldata metadataURI
    ) external returns (uint256 listingId) {
        require(price > 0, "Marketplace: price must be > 0");

        // Pull NFT into custody — seller must have approved this contract first.
        digitalTwin.safeTransferFrom(msg.sender, address(this), twinId);

        listingId = ++_nextListingId;
        _listings[listingId] = Listing({
            twinId: twinId,
            seller: msg.sender,
            price: price,
            active: true
        });

        emit ItemListed(listingId, twinId, msg.sender, price, metadataURI);
    }

    /// @notice Cancel a listing and return the NFT to the seller.
    function cancelListing(uint256 listingId) external {
        Listing storage l = _listings[listingId];
        if (!l.active) revert NotActive();
        if (msg.sender != l.seller && msg.sender != owner()) revert NotAuthorised();

        l.active = false;
        digitalTwin.safeTransferFrom(address(this), l.seller, l.twinId);
        emit ListingCancelled(listingId);
    }

    // ── Buying ────────────────────────────────────────────────────────────────

    /// @notice Buy a listed item. Creates an escrow and locks USDC.
    ///         Buyer must approve `listing.price` USDC to the Escrow contract first.
    /// @param listingId  The listing to purchase.
    /// @return escrowId  The ID of the created Escrow record.
    function buyItem(uint256 listingId) external returns (uint256 escrowId) {
        Listing storage l = _listings[listingId];
        if (!l.active) revert NotActive();
        if (msg.sender == l.seller) revert SelfPurchase();

        l.active = false;

        escrowId = escrow.createEscrow(
            listingId,
            msg.sender,  // buyer
            l.seller,
            l.twinId,
            l.price
        );

        escrowListing[escrowId] = listingId;

        emit ItemSold(listingId, escrowId, msg.sender);
    }

    // ── Settlement ────────────────────────────────────────────────────────────

    /// @notice Confirm successful delivery: release USDC to seller, transfer NFT to buyer.
    ///         Called by an authorised verifier (or owner in Phase 2).
    function confirmDelivery(uint256 escrowId) external onlyVerifier {
        Escrow.EscrowRecord memory rec = escrow.getEscrow(escrowId);

        // Release USDC to seller
        escrow.release(escrowId);

        // Transfer NFT from this contract's custody to the buyer
        digitalTwin.safeTransferFrom(address(this), rec.buyer, rec.twinId);

        // Phase 4: update reputation scores
        if (address(reputation) != address(0)) {
            reputation.recordTrade(rec.buyer, rec.seller);
        }

        emit DeliveryConfirmed(escrowId, rec.buyer);
    }

    /// @notice Resolve a disputed escrow. Owner only.
    /// @param refundBuyer If true, USDC goes back to buyer and NFT returns to seller.
    ///                    If false, USDC goes to seller and NFT goes to buyer.
    function resolveDispute(uint256 escrowId, bool refundBuyer) external onlyOwner {
        Escrow.EscrowRecord memory rec = escrow.getEscrow(escrowId);

        if (refundBuyer) {
            escrow.refund(escrowId);
            digitalTwin.safeTransferFrom(address(this), rec.seller, rec.twinId);
        } else {
            escrow.release(escrowId);
            digitalTwin.safeTransferFrom(address(this), rec.buyer, rec.twinId);
        }

        // Phase 4: update reputation scores
        if (address(reputation) != address(0)) {
            reputation.recordDispute(rec.buyer, rec.seller, refundBuyer);
        }

        emit DisputeResolved(escrowId, refundBuyer);
    }

    // ── View ──────────────────────────────────────────────────────────────────

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return _listings[listingId];
    }

    function listingCount() external view returns (uint256) {
        return _nextListingId;
    }

    // ── ERC-721 receiver ──────────────────────────────────────────────────────

    function onERC721Received(address, address, uint256, bytes calldata)
        external pure override returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }
}
