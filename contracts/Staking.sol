// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Staking
/// @notice General USDC staking contract with a cooldown period before withdrawal.
///
///         Flow:
///           1. Staker approves USDC to this contract then calls stake(amount).
///           2. To withdraw, call initiateUnstake() — starts a 7-day cooldown.
///           3. After 7 days, call completeUnstake() to receive the staked USDC.
///           4. The owner can slash a staker at any time (e.g. governance / dispute).
///
///         If a staker initiates unstaking and is then slashed, the slash reduces
///         their pending withdrawal amount.
contract Staking is Ownable {
    // ── Types ────────────────────────────────────────────────────────────────

    struct StakeRecord {
        uint256 amount;              // current staked balance
        uint256 unstakeInitiatedAt;  // timestamp when initiateUnstake was called (0 = not pending)
    }

    // ── Storage ───────────────────────────────────────────────────────────────

    IERC20 public immutable usdc;

    uint256 public constant MIN_STAKE = 100 * 10 ** 6; // 100 USDC (6-decimal)
    uint256 public constant COOLDOWN  = 7 days;

    mapping(address => StakeRecord) private _stakes;

    // ── Events ────────────────────────────────────────────────────────────────

    event Staked            (address indexed staker, uint256 amount, uint256 total);
    event UnstakeInitiated  (address indexed staker, uint256 amount, uint256 cooldownEnd);
    event Unstaked          (address indexed staker, uint256 amount);
    event Slashed           (address indexed staker, uint256 amount, string reason);

    // ── Errors ────────────────────────────────────────────────────────────────

    error InsufficientStake();
    error AlreadyUnstaking();
    error NotUnstaking();
    error CooldownNotMet();
    error SlashExceedsStake();
    error TransferFailed();
    error ZeroAmount();

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _usdc) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
    }

    // ── Staker actions ────────────────────────────────────────────────────────

    /// @notice Stake USDC. Caller must approve `amount` to this contract first.
    ///         Cannot top-up while an unstake is pending — complete it first.
    /// @param amount USDC to stake. First stake must be ≥ MIN_STAKE.
    function stake(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        StakeRecord storage s = _stakes[msg.sender];
        if (s.unstakeInitiatedAt != 0) revert AlreadyUnstaking();
        if (s.amount + amount < MIN_STAKE) revert InsufficientStake();

        bool ok = usdc.transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();

        s.amount += amount;
        emit Staked(msg.sender, amount, s.amount);
    }

    /// @notice Begin the 7-day cooldown before withdrawing stake.
    function initiateUnstake() external {
        StakeRecord storage s = _stakes[msg.sender];
        if (s.amount == 0) revert InsufficientStake();
        if (s.unstakeInitiatedAt != 0) revert AlreadyUnstaking();

        s.unstakeInitiatedAt = block.timestamp;
        emit UnstakeInitiated(msg.sender, s.amount, block.timestamp + COOLDOWN);
    }

    /// @notice Withdraw staked USDC after the cooldown period has elapsed.
    function completeUnstake() external {
        StakeRecord storage s = _stakes[msg.sender];
        if (s.unstakeInitiatedAt == 0) revert NotUnstaking();
        if (block.timestamp < s.unstakeInitiatedAt + COOLDOWN) revert CooldownNotMet();

        uint256 amount = s.amount;
        s.amount = 0;
        s.unstakeInitiatedAt = 0;

        bool ok = usdc.transfer(msg.sender, amount);
        if (!ok) revert TransferFailed();

        emit Unstaked(msg.sender, amount);
    }

    // ── Owner governance ──────────────────────────────────────────────────────

    /// @notice Slash a staker's balance by `amount`. Owner only.
    ///         Slashed USDC remains in the contract (governance treasury).
    function slash(address staker, uint256 amount, string calldata reason) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        StakeRecord storage s = _stakes[staker];
        if (amount > s.amount) revert SlashExceedsStake();

        s.amount -= amount;
        // If the remaining stake after slash drops to zero, cancel any pending unstake.
        if (s.amount == 0) s.unstakeInitiatedAt = 0;

        emit Slashed(staker, amount, reason);
    }

    // ── View ──────────────────────────────────────────────────────────────────

    /// @notice Returns the StakeRecord for `staker`.
    function getStake(address staker) external view returns (StakeRecord memory) {
        return _stakes[staker];
    }

    /// @notice Returns the timestamp when `staker` can complete unstaking (0 if not unstaking).
    function cooldownEnd(address staker) external view returns (uint256) {
        uint256 t = _stakes[staker].unstakeInitiatedAt;
        return t == 0 ? 0 : t + COOLDOWN;
    }

    /// @notice Total USDC held by this contract (stakes + slashed treasury).
    function totalStaked() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
