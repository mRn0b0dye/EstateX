// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EstateXNFT
 * @dev Enhanced ERC-721 Smart Contract for Real Estate Property Tokens.
 * Features IPFS metadata storage, ERC-2981 creator royalties, and property verification status.
 */
contract EstateXNFT is ERC721URIStorage, ERC2981, Ownable {
    uint256 private _tokenIds;

    // Mapping from Token ID to Verification Status (e.g., deed verified by platform)
    mapping(uint256 => bool) public isPropertyVerified;

    // Mapping from Token ID to Minter (Creator)
    mapping(uint256 => address) public propertyMinter;

    // Events
    event PropertyMinted(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed minter,
        string tokenURI
    );

    event PropertyVerified(uint256 indexed tokenId, bool status);

    // Custom errors
    error InvalidTokenURI();
    error PropertyDoesNotExist();

    constructor() ERC721("EstateX Real Estate", "ESTATEX") Ownable(msg.sender) {
        // Set default creator royalty to 1% (100 basis points)
        _setDefaultRoyalty(msg.sender, 100);
    }

    /**
     * @dev Mint a new Property NFT with IPFS metadata URI.
     * @param tokenURI The IPFS metadata URL containing property details & asset image.
     * @return newItemId The newly minted token ID.
     */
    function mintProperty(string memory tokenURI) public returns (uint256) {
        if (bytes(tokenURI).length == 0) revert InvalidTokenURI();

        _tokenIds++;
        uint256 newItemId = _tokenIds;

        _safeMint(msg.sender, newItemId);
        _setTokenURI(newItemId, tokenURI);
        
        propertyMinter[newItemId] = msg.sender;

        emit PropertyMinted(newItemId, msg.sender, msg.sender, tokenURI);

        return newItemId;
    }

    /**
     * @dev Mark a property NFT as legally verified by the platform admin.
     * @param tokenId Property Token ID.
     * @param status True if verified, False if unverified.
     */
    function setPropertyVerification(uint256 tokenId, bool status) public onlyOwner {
        if (_ownerOf(tokenId) == address(0)) revert PropertyDoesNotExist();
        isPropertyVerified[tokenId] = status;
        emit PropertyVerified(tokenId, status);
    }

    /**
     * @dev Update default royalty for creator sales (Owner only).
     */
    function setDefaultRoyalty(address receiver, uint96 feeNumerator) public onlyOwner {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    /**
     * @dev Get total number of properties minted so far.
     */
    function getTotalProperties() public view returns (uint256) {
        return _tokenIds;
    }

    // Required override for ERC721URIStorage and ERC2981
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
