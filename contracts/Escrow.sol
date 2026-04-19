// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Escrow
/// @notice Holds USDC in trust between a buyer and seller for ARES marketplace trades.
///         Only the Marketplace contract may create/release/refund escrows.
///         Buyers may dispute; disputes are resolved by the Marketplace owner.
///
///         State machine:
///           PENDING ──confirmDelivery──► RELEASED  (USDC → seller)
///           PENDING ──dispute()────────► DISPUTED
///           PENDING ──claimTimeout()───► RELEASED  (seller claims after 30 days)
///           PENDING/DISPUTED ──refund──► REFUNDED  (USDC → buyer)
contract Escrow {
    // ── Types ────────────────────────────────────────────────────────────────

    enum EscrowState { PENDING, RELEASED, REFUNDED, DISPUTED }

    struct EscrowRecord {
        uint256 listingId;
        address buyer;
        address seller;
        uint256 twinId;
        uint256 amount;      // USDC (6-decimal)
        uint256 createdAt;
        EscrowState state;
    }

    // ── Storage ───────────────────────────────────────────────────────────────

    IERC20 public immutable usdc;
    address public marketplace;

    uint256 public constant TIMEOUT = 30 days;

    uint256 private _nextEscrowId;
    mapping(uint256 => EscrowRecord) private _escrows;

    // ── Events ────────────────────────────────────────────────────────────────

    event EscrowCreated(
        uint256 indexed escrowId,
        uint256 indexed listingId,
        address indexed buyer,
        address seller,
        uint256 amount
    );
    event EscrowReleased(uint256 indexed escrowId, address indexed seller, uint256 amount);
    event EscrowRefunded(uint256 indexed escrowId, address indexed buyer, uint256 amount);
    event EscrowDisputed(uint256 indexed escrowId, address indexed buyer);

    // ── Errors ────────────────────────────────────────────────────────────────

    error OnlyMarketplace();
    error OnlyBuyer();
    error WrongState(EscrowState current);
    error TimeoutNotReached();
    error TransferFailed();

    // ── Modifiers ─────────────────────────────────────────────────────────────

    modifier onlyMarketplace() {
        if (msg.sender != marketplace) revert OnlyMarketplace();
        _;
    }

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    /// @notice Set the authorised Marketplace address. Can only be set once.
    function setMarketplace(address _marketplace) external {
        require(marketplace == address(0), "Escrow: marketplace already set");
        marketplace = _marketplace;
    }

    // ── Marketplace-only functions ────────────────────────────────────────────

    /// @notice Create an escrow record and pull USDC from the buyer.
    ///         Buyer must have approved `amount` USDC to this contract before calling.
    /// @return escrowId The ID of the new escrow record.
    function createEscrow(
        uint256 listingId,
        address buyer,
        address seller,
        uint256 twinId,
        uint256 amount
    ) external onlyMarketplace returns (uint256 escrowId) {
        require(amount > 0, "Escrow: amount must be > 0");

        bool ok = usdc.transferFrom(buyer, address(this), amount);
        if (!ok) revert TransferFailed();

        escrowId = ++_nextEscrowId;
        _escrows[escrowId] = EscrowRecord({
            listingId: listingId,
            buyer: buyer,
            seller: seller,
            twinId: twinId,
            amount: amount,
            createdAt: block.timestamp,
            state: EscrowState.PENDING
        });

        emit EscrowCreated(escrowId, listingId, buyer, seller, amount);
    }

    /// @notice Release USDC to the seller. Called by Marketplace on successful delivery.
    function release(uint256 escrowId) external onlyMarketplace {
        EscrowRecord storage rec = _escrows[escrowId];
        if (rec.state != EscrowState.PENDING && rec.state != EscrowState.DISPUTED)
            revert WrongState(rec.state);

        rec.state = EscrowState.RELEASED;
        _safeTransfer(rec.seller, rec.amount);
        emit EscrowReleased(escrowId, rec.seller, rec.amount);
    }

    /// @notice Return USDC to the buyer. Called by Marketplace on failed/cancelled trade.
    function refund(uint256 escrowId) external onlyMarketplace {
        EscrowRecord storage rec = _escrows[escrowId];
        if (rec.state != EscrowState.PENDING && rec.state != EscrowState.DISPUTED)
            revert WrongState(rec.state);

        rec.state = EscrowState.REFUNDED;
        _safeTransfer(rec.buyer, rec.amount);
        emit EscrowRefunded(escrowId, rec.buyer, rec.amount);
    }

    // ── Buyer-only functions ──────────────────────────────────────────────────

    /// @notice Buyer raises a dispute. Pauses automatic release until resolved by Marketplace owner.
    function dispute(uint256 escrowId) external {
        EscrowRecord storage rec = _escrows[escrowId];
        if (msg.sender != rec.buyer) revert OnlyBuyer();
        if (rec.state != EscrowState.PENDING) revert WrongState(rec.state);

        rec.state = EscrowState.DISPUTED;
        emit EscrowDisputed(escrowId, rec.buyer);
    }

    // ── Seller-only timeout claim ─────────────────────────────────────────────

    /// @notice If no action is taken within TIMEOUT, seller can claim funds.
    ///         This protects sellers from buyers who disappear after delivery.
    function claimTimeout(uint256 escrowId) external {
        EscrowRecord storage rec = _escrows[escrowId];
        require(msg.sender == rec.seller, "Escrow: not seller");
        if (rec.state != EscrowState.PENDING) revert WrongState(rec.state);
        if (block.timestamp < rec.createdAt + TIMEOUT) revert TimeoutNotReached();

        rec.state = EscrowState.RELEASED;
        _safeTransfer(rec.seller, rec.amount);
        emit EscrowReleased(escrowId, rec.seller, rec.amount);
    }

    // ── View ──────────────────────────────────────────────────────────────────

    function getEscrow(uint256 escrowId) external view returns (EscrowRecord memory) {
        return _escrows[escrowId];
    }

    function escrowCount() external view returns (uint256) {
        return _nextEscrowId;
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    function _safeTransfer(address to, uint256 amount) internal {
        bool ok = usdc.transfer(to, amount);
        if (!ok) revert TransferFailed();
    }
}
