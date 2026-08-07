// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EstateXMarketplace
 * @dev All-in-One Decentralized Real Estate Protocol.
 * Supports:
 * 1. Fixed Price Buy/Sell & Reselling
 * 2. Timed Auctions & Bidding System
 * 3. Real Estate Rental System (Daily/Monthly Rental Income)
 * 4. ERC-2981 Creator Royalties & Platform Volume Tracking
 */
contract EstateXMarketplace is ReentrancyGuard, Pausable, Ownable {
    uint256 private _listingIds;
    uint256 private _auctionIds;
    uint256 private _rentalIds;
    uint256 private _itemsSold;
    uint256 public totalVolume; // Total volume traded in Wei

    // Platform fee in Basis Points (250 BPS = 2.5%)
    uint256 public feeBasisPoints = 250;

    // --- ENUMS & STRUCTS ---

    enum ListingStatus { Active, Sold, Cancelled }

    // 1. Fixed Price Listing
    struct Listing {
        uint256 listingId;
        address payable seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;
        ListingStatus status;
    }

    // 2. Timed Auction
    struct Auction {
        uint256 auctionId;
        address payable seller;
        address nftContract;
        uint256 tokenId;
        uint256 startPrice;
        uint256 highestBid;
        address payable highestBidder;
        uint256 endTime;
        bool ended;
    }

    // 3. Property Rental
    struct Rental {
        uint256 rentalId;
        address payable landlord;
        address nftContract;
        uint256 tokenId;
        uint256 pricePerDay;
        address tenant;
        uint256 rentedUntil; // Timestamp when rental expires
        bool isListedForRent;
    }

    // Mappings
    mapping(uint256 => Listing) private _listings;
    mapping(uint256 => Auction) private _auctions;
    mapping(uint256 => Rental) private _rentals;

    // Active tracking
    mapping(address => mapping(uint256 => uint256)) private _activeListingId;
    mapping(address => mapping(uint256 => uint256)) private _activeAuctionId;
    mapping(address => mapping(uint256 => uint256)) private _activeRentalId;

    // Pending bid refunds for outbid users
    mapping(uint256 => mapping(address => uint256)) public pendingBidRefunds;

    // --- EVENTS ---

    // Fixed Sale Events
    event PropertyListed(uint256 indexed listingId, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 price);
    event PropertySold(uint256 indexed listingId, address indexed buyer, address seller, address indexed nftContract, uint256 tokenId, uint256 price);
    event ListingCancelled(uint256 indexed listingId, address indexed seller, address indexed nftContract, uint256 tokenId);
    event ListingPriceUpdated(uint256 indexed listingId, uint256 oldPrice, uint256 newPrice);

    // Auction Events
    event AuctionCreated(uint256 indexed auctionId, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 startPrice, uint256 endTime);
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionEnded(uint256 indexed auctionId, address indexed winner, uint256 winningBid);

    // Rental Events
    event PropertyListedForRent(uint256 indexed rentalId, address indexed landlord, address indexed nftContract, uint256 tokenId, uint256 pricePerDay);
    event PropertyRented(uint256 indexed rentalId, address indexed tenant, uint256 numberOfDays, uint256 totalCost, uint256 rentedUntil);
    event RentalListingCancelled(uint256 indexed rentalId, address indexed landlord);

    event FeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);

    // --- CUSTOM ERRORS ---
    error InvalidPrice();
    error NotNFTOwner();
    error MarketplaceNotApproved();
    error ListingNotActive();
    error InsufficientPayment();
    error CannotBuyOwnListing();
    error NotSeller();
    error AlreadyListed();
    error AuctionEndedAlready();
    error AuctionStillActive();
    error BidTooLow();
    error ZeroRentalDays();

    constructor() Ownable(msg.sender) {}

    // =========================================================================
    // SECTION 1: FIXED PRICE MARKETPLACE (LIST, BUY, CANCEL, RESELL)
    // =========================================================================

    function listProperty(address nftContract, uint256 tokenId, uint256 price) public whenNotPaused returns (uint256) {
        if (price == 0) revert InvalidPrice();

        IERC721 nft = IERC721(nftContract);
        if (nft.ownerOf(tokenId) != msg.sender) revert NotNFTOwner();

        if (!nft.isApprovedForAll(msg.sender, address(this)) && nft.getApproved(tokenId) != address(this)) {
            revert MarketplaceNotApproved();
        }

        _listingIds++;
        uint256 newListingId = _listingIds;

        _listings[newListingId] = Listing({
            listingId: newListingId,
            seller: payable(msg.sender),
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            status: ListingStatus.Active
        });

        _activeListingId[nftContract][tokenId] = newListingId;

        emit PropertyListed(newListingId, msg.sender, nftContract, tokenId, price);
        return newListingId;
    }

    function updateListingPrice(uint256 listingId, uint256 newPrice) public whenNotPaused {
        Listing storage listing = _listings[listingId];
        if (listing.seller != msg.sender) revert NotSeller();
        if (listing.status != ListingStatus.Active) revert ListingNotActive();
        if (newPrice == 0) revert InvalidPrice();

        uint256 oldPrice = listing.price;
        listing.price = newPrice;

        emit ListingPriceUpdated(listingId, oldPrice, newPrice);
    }

    function buyProperty(uint256 listingId) public payable nonReentrant whenNotPaused {
        Listing storage listing = _listings[listingId];

        if (listing.status != ListingStatus.Active) revert ListingNotActive();
        if (msg.value < listing.price) revert InsufficientPayment();
        if (msg.sender == listing.seller) revert CannotBuyOwnListing();

        listing.status = ListingStatus.Sold;
        _itemsSold++;
        totalVolume += listing.price;
        _activeListingId[listing.nftContract][listing.tokenId] = 0;

        uint256 price = listing.price;
        _distributeFundsAndNFT(listing.nftContract, listing.tokenId, listing.seller, msg.sender, price);

        // Refund excess ETH
        if (msg.value > price) {
            (bool refundPaid, ) = payable(msg.sender).call{value: msg.value - price}("");
            require(refundPaid, "Refund failed");
        }

        emit PropertySold(listingId, msg.sender, listing.seller, listing.nftContract, listing.tokenId, price);
    }

    function cancelListing(uint256 listingId) public {
        Listing storage listing = _listings[listingId];
        if (listing.seller != msg.sender) revert NotSeller();
        if (listing.status != ListingStatus.Active) revert ListingNotActive();

        listing.status = ListingStatus.Cancelled;
        _activeListingId[listing.nftContract][listing.tokenId] = 0;

        emit ListingCancelled(listingId, msg.sender, listing.nftContract, listing.tokenId);
    }

    function resellProperty(address nftContract, uint256 tokenId, uint256 newPrice) public returns (uint256) {
        return listProperty(nftContract, tokenId, newPrice);
    }

    // =========================================================================
    // SECTION 2: TIMED AUCTION & BIDDING SYSTEM
    // =========================================================================

    function createAuction(
        address nftContract,
        uint256 tokenId,
        uint256 startPrice,
        uint256 durationInHours
    ) public whenNotPaused returns (uint256) {
        if (startPrice == 0) revert InvalidPrice();

        IERC721 nft = IERC721(nftContract);
        if (nft.ownerOf(tokenId) != msg.sender) revert NotNFTOwner();

        if (!nft.isApprovedForAll(msg.sender, address(this)) && nft.getApproved(tokenId) != address(this)) {
            revert MarketplaceNotApproved();
        }

        _auctionIds++;
        uint256 newAuctionId = _auctionIds;
        uint256 endTime = block.timestamp + (durationInHours * 1 hours);

        _auctions[newAuctionId] = Auction({
            auctionId: newAuctionId,
            seller: payable(msg.sender),
            nftContract: nftContract,
            tokenId: tokenId,
            startPrice: startPrice,
            highestBid: 0,
            highestBidder: payable(address(0)),
            endTime: endTime,
            ended: false
        });

        _activeAuctionId[nftContract][tokenId] = newAuctionId;

        emit AuctionCreated(newAuctionId, msg.sender, nftContract, tokenId, startPrice, endTime);
        return newAuctionId;
    }

    function placeBid(uint256 auctionId) public payable nonReentrant whenNotPaused {
        Auction storage auction = _auctions[auctionId];

        if (block.timestamp >= auction.endTime || auction.ended) revert AuctionEndedAlready();
        if (msg.sender == auction.seller) revert CannotBuyOwnListing();

        uint256 minRequiredBid = auction.highestBid == 0 ? auction.startPrice : auction.highestBid + ((auction.highestBid * 5) / 100); // 5% minimum bid increment
        if (msg.value < minRequiredBid) revert BidTooLow();

        // Refund previous highest bidder
        if (auction.highestBidder != address(0)) {
            pendingBidRefunds[auctionId][auction.highestBidder] += auction.highestBid;
        }

        auction.highestBid = msg.value;
        auction.highestBidder = payable(msg.sender);

        emit BidPlaced(auctionId, msg.sender, msg.value);
    }

    function withdrawBidRefund(uint256 auctionId) public nonReentrant {
        uint256 amount = pendingBidRefunds[auctionId][msg.sender];
        require(amount > 0, "No funds to withdraw");

        pendingBidRefunds[auctionId][msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Refund withdrawal failed");
    }

    function endAuction(uint256 auctionId) public nonReentrant {
        Auction storage auction = _auctions[auctionId];

        if (block.timestamp < auction.endTime) revert AuctionStillActive();
        if (auction.ended) revert AuctionEndedAlready();

        auction.ended = true;
        _activeAuctionId[auction.nftContract][auction.tokenId] = 0;

        if (auction.highestBidder != address(0)) {
            totalVolume += auction.highestBid;
            _distributeFundsAndNFT(
                auction.nftContract,
                auction.tokenId,
                auction.seller,
                auction.highestBidder,
                auction.highestBid
            );
        }

        emit AuctionEnded(auctionId, auction.highestBidder, auction.highestBid);
    }

    // =========================================================================
    // SECTION 3: REAL ESTATE RENTAL SYSTEM (DAILY / MONTHLY RENT)
    // =========================================================================

    function listPropertyForRent(
        address nftContract,
        uint256 tokenId,
        uint256 pricePerDay
    ) public whenNotPaused returns (uint256) {
        if (pricePerDay == 0) revert InvalidPrice();

        IERC721 nft = IERC721(nftContract);
        if (nft.ownerOf(tokenId) != msg.sender) revert NotNFTOwner();

        _rentalIds++;
        uint256 newRentalId = _rentalIds;

        _rentals[newRentalId] = Rental({
            rentalId: newRentalId,
            landlord: payable(msg.sender),
            nftContract: nftContract,
            tokenId: tokenId,
            pricePerDay: pricePerDay,
            tenant: address(0),
            rentedUntil: 0,
            isListedForRent: true
        });

        _activeRentalId[nftContract][tokenId] = newRentalId;

        emit PropertyListedForRent(newRentalId, msg.sender, nftContract, tokenId, pricePerDay);
        return newRentalId;
    }

    function rentProperty(uint256 rentalId, uint256 numberOfDays) public payable nonReentrant whenNotPaused {
        if (numberOfDays == 0) revert ZeroRentalDays();

        Rental storage rental = _rentals[rentalId];
        if (!rental.isListedForRent) revert ListingNotActive();

        uint256 totalCost = rental.pricePerDay * numberOfDays;
        if (msg.value < totalCost) revert InsufficientPayment();

        // If currently rented, check if lease expired
        if (block.timestamp < rental.rentedUntil) revert AlreadyListed();

        uint256 leaseStartTime = block.timestamp > rental.rentedUntil ? block.timestamp : rental.rentedUntil;
        uint256 newRentedUntil = leaseStartTime + (numberOfDays * 1 days);

        rental.tenant = msg.sender;
        rental.rentedUntil = newRentedUntil;
        totalVolume += totalCost;

        // Distribute rental income (2.5% platform fee, 97.5% landlord payout)
        uint256 platformFee = (totalCost * feeBasisPoints) / 10000;
        uint256 landlordPayout = totalCost - platformFee;

        (bool landlordPaid, ) = rental.landlord.call{value: landlordPayout}("");
        require(landlordPaid, "Landlord payment failed");

        if (platformFee > 0) {
            (bool feePaid, ) = payable(owner()).call{value: platformFee}("");
            require(feePaid, "Platform fee failed");
        }

        // Refund excess ETH
        if (msg.value > totalCost) {
            (bool refundPaid, ) = payable(msg.sender).call{value: msg.value - totalCost}("");
            require(refundPaid, "Refund failed");
        }

        emit PropertyRented(rentalId, msg.sender, numberOfDays, totalCost, newRentedUntil);
    }

    function cancelRentalListing(uint256 rentalId) public {
        Rental storage rental = _rentals[rentalId];
        if (rental.landlord != msg.sender) revert NotSeller();
        require(block.timestamp >= rental.rentedUntil, "Cannot cancel active lease");

        rental.isListedForRent = false;
        _activeRentalId[rental.nftContract][rental.tokenId] = 0;

        emit RentalListingCancelled(rentalId, msg.sender);
    }

    // =========================================================================
    // INTERNAL HELPER FUNCTIONS
    // =========================================================================

    function _distributeFundsAndNFT(
        address nftContract,
        uint256 tokenId,
        address seller,
        address buyer,
        uint256 price
    ) internal {
        uint256 platformFee = (price * feeBasisPoints) / 10000;

        address royaltyReceiver = address(0);
        uint256 royaltyAmount = 0;

        if (IERC165(nftContract).supportsInterface(type(IERC2981).interfaceId)) {
            (royaltyReceiver, royaltyAmount) = IERC2981(nftContract).royaltyInfo(tokenId, price);
        }

        uint256 totalDeductions = platformFee + royaltyAmount;
        uint256 sellerPayout = price > totalDeductions ? price - totalDeductions : 0;

        // Transfer NFT to buyer
        IERC721(nftContract).safeTransferFrom(seller, buyer, tokenId);

        // Pay seller
        if (sellerPayout > 0) {
            (bool sellerPaid, ) = payable(seller).call{value: sellerPayout}("");
            require(sellerPaid, "Seller payment failed");
        }

        // Pay platform fee
        if (platformFee > 0) {
            (bool feePaid, ) = payable(owner()).call{value: platformFee}("");
            require(feePaid, "Platform fee payment failed");
        }

        // Pay creator royalty
        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            (bool royaltyPaid, ) = payable(royaltyReceiver).call{value: royaltyAmount}("");
            require(royaltyPaid, "Royalty payment failed");
        }
    }

    // =========================================================================
    // SECTION 4: ADMIN & GETTER FUNCTIONS
    // =========================================================================

    function pauseMarketplace() public onlyOwner { _pause(); }
    function unpauseMarketplace() public onlyOwner { _unpause(); }

    function setFeeBasisPoints(uint256 newFeeBps) public onlyOwner {
        require(newFeeBps <= 1000, "Fee cannot exceed 10%");
        emit FeeUpdated(feeBasisPoints, newFeeBps);
        feeBasisPoints = newFeeBps;
    }

    function getListing(uint256 listingId) public view returns (Listing memory) { return _listings[listingId]; }
    function getAuction(uint256 auctionId) public view returns (Auction memory) { return _auctions[auctionId]; }
    function getRental(uint256 rentalId) public view returns (Rental memory) { return _rentals[rentalId]; }

    function getAllListings() public view returns (Listing[] memory) {
        Listing[] memory items = new Listing[](_listingIds);
        for (uint256 i = 1; i <= _listingIds; i++) { items[i - 1] = _listings[i]; }
        return items;
    }

    function getAllAuctions() public view returns (Auction[] memory) {
        Auction[] memory items = new Auction[](_auctionIds);
        for (uint256 i = 1; i <= _auctionIds; i++) { items[i - 1] = _auctions[i]; }
        return items;
    }

    function getAllRentals() public view returns (Rental[] memory) {
        Rental[] memory items = new Rental[](_rentalIds);
        for (uint256 i = 1; i <= _rentalIds; i++) { items[i - 1] = _rentals[i]; }
        return items;
    }
}
