// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title DigitalTwin
/// @notice ERC-721 NFT representing a physical collectible item in the ARES marketplace.
///         Each token maps to a physical item with metadata (images, NFC tag hash, etc.) on IPFS.
contract DigitalTwin is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    /// @notice Authorised minters (e.g. Marketplace contract)
    mapping(address => bool) public minters;

    // nfcTagHash → tokenId — prevents duplicate physical items
    mapping(bytes32 => uint256) public nfcHashToTokenId;
    mapping(uint256 => bytes32) public tokenIdToNfcHash;

    event TwinMinted(uint256 indexed tokenId, address indexed to, bytes32 nfcHash, string metadataURI);
    event MinterUpdated(address indexed minter, bool authorised);

    modifier onlyMinter() {
        require(minters[msg.sender] || msg.sender == owner(), "DigitalTwin: not authorised minter");
        _;
    }

    constructor() ERC721("ARES Digital Twin", "ADT") Ownable(msg.sender) {}

    /// @notice Grant or revoke minting permission to an address.
    function setMinter(address minter, bool authorised) external onlyOwner {
        minters[minter] = authorised;
        emit MinterUpdated(minter, authorised);
    }

    /// @notice Mint a Digital Twin NFT for a physical item.
    /// @param to        Recipient address (typically the seller or their agent TBA)
    /// @param nfcHash   keccak256 hash of the physical item's NFC tag data
    /// @param metadataURI  IPFS URI with item metadata (images, description, provenance)
    function mint(
        address to,
        bytes32 nfcHash,
        string calldata metadataURI
    ) external onlyMinter returns (uint256 tokenId) {
        require(nfcHashToTokenId[nfcHash] == 0, "DigitalTwin: NFC tag already registered");
        tokenId = ++_nextTokenId;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);
        nfcHashToTokenId[nfcHash] = tokenId;
        tokenIdToNfcHash[tokenId] = nfcHash;
        emit TwinMinted(tokenId, to, nfcHash, metadataURI);
    }

    // ── Required overrides ──────────────────────────────────────────────────

    function tokenURI(uint256 tokenId)
        public view override(ERC721, ERC721URIStorage) returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721URIStorage) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
