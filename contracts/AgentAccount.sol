// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @title IERC6551Account
/// @notice Minimal interface for ERC-6551 Token-Bound Accounts.
interface IERC6551Account {
    function token() external view returns (uint256 chainId, address tokenContract, uint256 tokenId);
    function state() external view returns (uint256);
    function isValidSigner(address signer, bytes calldata context) external view returns (bytes4);
}

/// @title AgentAccount
/// @notice ERC-6551 Token-Bound Account (TBA) for autonomous AI agents in ARES.
///         Each agent NFT minted by AgentRegistry gets one of these accounts.
///         The TBA can hold USDC, execute arbitrary calls, and enforce spending policies.
///
///         Implementation follows the ERC-6551 spec:
///         https://eips.ethereum.org/EIPS/eip-6551
contract AgentAccount is IERC6551Account, IERC165, IERC721Receiver {
    // ── ERC-6551 state ──────────────────────────────────────────────────────
    uint256 public state;  // incremented on every execution (replay protection)

    // Immutables set once during CREATE2 deployment by the registry
    uint256 public immutable chainId;
    address public immutable tokenContract;
    uint256 public immutable tokenId;

    // ── Spending policy ─────────────────────────────────────────────────────
    uint256 public maxSingleTrade;   // max USDC per trade (6-decimal)
    uint256 public dailyBudget;      // max USDC per 24h window
    uint256 public dailySpent;
    uint256 public dayStart;

    /// @notice Authorised callers that can execute autonomous buys (off-chain agent service).
    mapping(address => bool) public authorisedExecutors;

    event Executed(address indexed target, uint256 value, bytes data);
    event PolicyUpdated(uint256 maxSingleTrade, uint256 dailyBudget);
    event ExecutorUpdated(address indexed executor, bool authorised);

    error NotOwner();
    error NotAuthorised();
    error PolicyViolation(string reason);

    constructor(uint256 _chainId, address _tokenContract, uint256 _tokenId) {
        chainId = _chainId;
        tokenContract = _tokenContract;
        tokenId = _tokenId;
        dayStart = block.timestamp;
    }

    // ── Ownership ───────────────────────────────────────────────────────────

    /// @notice The owner is whoever holds the agent NFT.
    function owner() public view returns (address) {
        return IERC721(tokenContract).ownerOf(tokenId);
    }

    modifier onlyOwner() {
        if (msg.sender != owner()) revert NotOwner();
        _;
    }

    modifier onlyOwnerOrExecutor() {
        if (msg.sender != owner() && !authorisedExecutors[msg.sender]) revert NotAuthorised();
        _;
    }

    // ── ERC-6551 ────────────────────────────────────────────────────────────

    function token() external view override returns (uint256, address, uint256) {
        return (chainId, tokenContract, tokenId);
    }

    function isValidSigner(address signer, bytes calldata)
        external view override returns (bytes4)
    {
        if (signer == owner()) return IERC6551Account.isValidSigner.selector;
        return bytes4(0);
    }

    // ── Execution ───────────────────────────────────────────────────────────

    /// @notice Execute an arbitrary call. Only the NFT owner can call this.
    function execute(
        address target,
        uint256 value,
        bytes calldata data,
        uint8 /*operation*/
    ) external payable onlyOwner returns (bytes memory result) {
        ++state;
        (bool success, bytes memory ret) = target.call{value: value}(data);
        require(success, "AgentAccount: call failed");
        emit Executed(target, value, data);
        return ret;
    }

    /// @notice Execute a USDC transfer subject to the active spending policy.
    ///         Can be called by owner or an authorised executor (off-chain agent service).
    function executeUSDCTransfer(
        address usdc,
        address to,
        uint256 amount
    ) external onlyOwnerOrExecutor {
        _resetDayIfNeeded();

        if (maxSingleTrade > 0 && amount > maxSingleTrade)
            revert PolicyViolation("exceeds maxSingleTrade");

        if (dailyBudget > 0 && dailySpent + amount > dailyBudget)
            revert PolicyViolation("exceeds dailyBudget");

        dailySpent += amount;
        ++state;

        bool ok = IERC20(usdc).transfer(to, amount);
        require(ok, "AgentAccount: USDC transfer failed");
    }

    // ── Policy management ───────────────────────────────────────────────────

    /// @notice Set spending limits for autonomous trading.
    /// @param _maxSingleTrade Max USDC (6-dec) per single trade. 0 = unlimited.
    /// @param _dailyBudget    Max USDC (6-dec) per 24h. 0 = unlimited.
    function setPolicy(uint256 _maxSingleTrade, uint256 _dailyBudget) external onlyOwner {
        maxSingleTrade = _maxSingleTrade;
        dailyBudget = _dailyBudget;
        emit PolicyUpdated(_maxSingleTrade, _dailyBudget);
    }

    /// @notice Grant or revoke executor rights to an address.
    function setExecutor(address executor, bool authorised) external onlyOwner {
        authorisedExecutors[executor] = authorised;
        emit ExecutorUpdated(executor, authorised);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    function _resetDayIfNeeded() internal {
        if (block.timestamp >= dayStart + 1 days) {
            dailySpent = 0;
            dayStart = block.timestamp;
        }
    }

    // ── ERC-165 ─────────────────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return
            interfaceId == type(IERC165).interfaceId ||
            interfaceId == type(IERC6551Account).interfaceId ||
            interfaceId == type(IERC721Receiver).interfaceId;
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external pure override returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }

    receive() external payable {}
}
