// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/EstateXNFT.sol";
import "../contracts/EstateXMarketplace.sol";

/**
 * @title EstateXTest
 * @dev Comprehensive Foundry Test Suite for EstateX Real Estate Protocol.
 * Tests ERC-721 property tokenization, fixed price sales, royalties,
 * timed auctions with escrow refunds, daily rentals, and protocol fees.
 */
contract EstateXTest is Test {
    EstateXNFT public nftContract;
    EstateXMarketplace public marketplaceContract;

    address public owner = makeAddr("owner");
    address public seller = makeAddr("seller");
    address public buyer = makeAddr("buyer");
    address public bidder1 = makeAddr("bidder1");
    address public bidder2 = makeAddr("bidder2");
    address public tenant = makeAddr("tenant");

    string public constant SAMPLE_URI = "ipfs://QmSamplePropertyMetadataCID123";
    uint256 public constant LISTING_PRICE = 0.1 ether;
    uint256 public constant START_PRICE = 0.05 ether;
    uint256 public constant PRICE_PER_DAY = 0.01 ether;

    event PropertyMinted(uint256 indexed tokenId, address indexed owner, address indexed minter, string tokenURI);
    event PropertyVerified(uint256 indexed tokenId, bool status);
    event PropertyListed(uint256 indexed listingId, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 price);
    event PropertySold(uint256 indexed listingId, address indexed buyer, address seller, address indexed nftContract, uint256 tokenId, uint256 price);
    event ListingCancelled(uint256 indexed listingId, address indexed seller, address indexed nftContract, uint256 tokenId);
    event AuctionCreated(uint256 indexed auctionId, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 startPrice, uint256 endTime);
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount);
    event AuctionEnded(uint256 indexed auctionId, address indexed winner, uint256 winningBid);
    event PropertyListedForRent(uint256 indexed rentalId, address indexed landlord, address indexed nftContract, uint256 tokenId, uint256 pricePerDay);
    event PropertyRented(uint256 indexed rentalId, address indexed tenant, uint256 numberOfDays, uint256 totalCost, uint256 rentedUntil);

    function setUp() public {
        vm.startPrank(owner);
        nftContract = new EstateXNFT();
        marketplaceContract = new EstateXMarketplace();
        vm.stopPrank();

        // Fund test accounts with ETH
        vm.deal(seller, 10 ether);
        vm.deal(buyer, 10 ether);
        vm.deal(bidder1, 10 ether);
        vm.deal(bidder2, 10 ether);
        vm.deal(tenant, 10 ether);
    }

    // =========================================================================
    // 1. NFT MINTING & VERIFICATION TESTS
    // =========================================================================

    function test_MintProperty() public {
        vm.startPrank(seller);
        uint256 tokenId = nftContract.mintProperty(SAMPLE_URI);
        vm.stopPrank();

        assertEq(tokenId, 1);
        assertEq(nftContract.ownerOf(1), seller);
        assertEq(nftContract.propertyMinter(1), seller);
        assertEq(nftContract.tokenURI(1), SAMPLE_URI);
        assertEq(nftContract.getTotalProperties(), 1);
    }

    function test_RevertIf_MintWithEmptyURI() public {
        vm.startPrank(seller);
        vm.expectRevert(EstateXNFT.InvalidTokenURI.selector);
        nftContract.mintProperty("");
        vm.stopPrank();
    }

    function test_SetPropertyVerification_ByOwner() public {
        vm.prank(seller);
        uint256 tokenId = nftContract.mintProperty(SAMPLE_URI);

        assertFalse(nftContract.isPropertyVerified(tokenId));

        vm.prank(owner);
        nftContract.setPropertyVerification(tokenId, true);
        assertTrue(nftContract.isPropertyVerified(tokenId));
    }

    function test_RevertIf_SetPropertyVerification_NotOwner() public {
        vm.prank(seller);
        uint256 tokenId = nftContract.mintProperty(SAMPLE_URI);

        vm.prank(seller);
        vm.expectRevert();
        nftContract.setPropertyVerification(tokenId, true);
    }

    function test_ERC2981DefaultRoyalty() public {
        vm.prank(seller);
        uint256 tokenId = nftContract.mintProperty(SAMPLE_URI);

        (address receiver, uint256 royaltyAmount) = nftContract.royaltyInfo(tokenId, 1 ether);
        assertEq(receiver, owner);
        assertEq(royaltyAmount, 0.01 ether); // 1% of 1 ETH = 0.01 ETH
    }

    // =========================================================================
    // 2. FIXED PRICE SALE & BUYOUT TESTS
    // =========================================================================

    function test_ListProperty() public {
        vm.startPrank(seller);
        uint256 tokenId = nftContract.mintProperty(SAMPLE_URI);
        nftContract.approve(address(marketplaceContract), tokenId);

        marketplaceContract.listProperty(address(nftContract), tokenId, LISTING_PRICE);
        vm.stopPrank();

        EstateXMarketplace.Listing memory listing = marketplaceContract.getListing(1);
        assertEq(listing.listingId, 1);
        assertEq(listing.seller, seller);
        assertEq(listing.nftContract, address(nftContract));
        assertEq(listing.tokenId, tokenId);
        assertEq(listing.price, LISTING_PRICE);
        assertTrue(listing.status == EstateXMarketplace.ListingStatus.Active);
    }

    function test_BuyProperty_WithFeeAndRoyaltyDistribution() public {
        vm.startPrank(seller);
        uint256 tokenId = nftContract.mintProperty(SAMPLE_URI);
        nftContract.approve(address(marketplaceContract), tokenId);
        marketplaceContract.listProperty(address(nftContract), tokenId, LISTING_PRICE);
        vm.stopPrank();

        uint256 sellerBalBefore = seller.balance;
        uint256 ownerBalBefore = owner.balance;

        // Buyer executes buyout
        vm.prank(buyer);
        marketplaceContract.buyProperty{value: LISTING_PRICE}(1);

        // Check ownership transferred
        assertEq(nftContract.ownerOf(tokenId), buyer);

        // Check listing status updated to Sold
        EstateXMarketplace.Listing memory listing = marketplaceContract.getListing(1);
        assertTrue(listing.status == EstateXMarketplace.ListingStatus.Sold);

        // Platform fee (2.5%) = 0.0025 ETH, Royalty (1%) = 0.001 ETH
        uint256 platformFee = (LISTING_PRICE * 250) / 10000;
        uint256 royaltyFee = (LISTING_PRICE * 100) / 10000;
        uint256 expectedSellerPayout = LISTING_PRICE - platformFee - royaltyFee;

        assertEq(seller.balance - sellerBalBefore, expectedSellerPayout);
        assertEq(owner.balance - ownerBalBefore, platformFee + royaltyFee);
        assertEq(marketplaceContract.totalVolume(), LISTING_PRICE);
    }

    function test_CancelListing() public {
        vm.startPrank(seller);
        uint256 tokenId = nftContract.mintProperty(SAMPLE_URI);
        nftContract.approve(address(marketplaceContract), tokenId);
        marketplaceContract.listProperty(address(nftContract), tokenId, LISTING_PRICE);

        marketplaceContract.cancelListing(1);
        vm.stopPrank();

        EstateXMarketplace.Listing memory listing = marketplaceContract.getListing(1);
        assertTrue(listing.status == EstateXMarketplace.ListingStatus.Cancelled);
    }

    function test_UpdateListingPrice() public {
        vm.startPrank(seller);
        uint256 tokenId = nftContract.mintProperty(SAMPLE_URI);
        nftContract.approve(address(marketplaceContract), tokenId);
        marketplaceContract.listProperty(address(nftContract), tokenId, LISTING_PRICE);

        uint256 newPrice = 0.25 ether;
        marketplaceContract.updateListingPrice(1, newPrice);
        vm.stopPrank();

        EstateXMarketplace.Listing memory listing = marketplaceContract.getListing(1);
        assertEq(listing.price, newPrice);
    }

    function test_RevertIf_BuyWithInsufficientFunds() public {
        vm.startPrank(seller);
        uint256 tokenId = nftContract.mintProperty(SAMPLE_URI);
        nftContract.approve(address(marketplaceContract), tokenId);
        marketplaceContract.listProperty(address(nftContract), tokenId, LISTING_PRICE);
        vm.stopPrank();

        vm.prank(buyer);
        vm.expectRevert();
        marketplaceContract.buyProperty{value: 0.05 ether}(1);
    }

    // =========================================================================
    // 3. TIMED AUCTION & BIDDING TESTS
    // =========================================================================

    function test_CreateAuction() public {
        vm.startPrank(seller);
        uint256 tokenId = nftContract.mintProperty(SAMPLE_URI);
        nftContract.approve(address(marketplaceContract), tokenId);

        marketplaceContract.createAuction(address(nftContract), tokenId, START_PRICE, 24);
        vm.stopPrank();

        EstateXMarketplace.Auction memory auction = marketplaceContract.getAuction(1);
        assertEq(auction.auctionId, 1);
        assertEq(auction.seller, seller);
        assertEq(auction.startPrice, START_PRICE);
        assertEq(auction.endTime, block.timestamp + 24 hours);
        assertFalse(auction.ended);
    }

    function test_PlaceBidAndOutbidRefund() public {
        vm.startPrank(seller);
        uint256 tokenId = nftContract.mintProperty(SAMPLE_URI);
        nftContract.approve(address(marketplaceContract), tokenId);
        marketplaceContract.createAuction(address(nftContract), tokenId, START_PRICE, 24);
        vm.stopPrank();

        // Bidder 1 bids 0.06 ETH
        uint256 bid1 = 0.06 ether;
        vm.prank(bidder1);
        marketplaceContract.placeBid{value: bid1}(1);

        EstateXMarketplace.Auction memory auction1 = marketplaceContract.getAuction(1);
        assertEq(auction1.highestBid, bid1);
        assertEq(auction1.highestBidder, bidder1);

        // Bidder 2 outbids with 0.1 ETH
        uint256 bid2 = 0.1 ether;
        vm.prank(bidder2);
        marketplaceContract.placeBid{value: bid2}(1);

        EstateXMarketplace.Auction memory auction2 = marketplaceContract.getAuction(1);
        assertEq(auction2.highestBid, bid2);
        assertEq(auction2.highestBidder, bidder2);

        // Check Bidder 1 has pending refund
        assertEq(marketplaceContract.pendingBidRefunds(1, bidder1), bid1);

        // Bidder 1 claims refund
        uint256 bidder1BalBefore = bidder1.balance;
        vm.prank(bidder1);
        marketplaceContract.claimBidRefund(1);

        assertEq(bidder1.balance - bidder1BalBefore, bid1);
        assertEq(marketplaceContract.pendingBidRefunds(1, bidder1), 0);
    }

    function test_EndAuction_Success() public {
        vm.startPrank(seller);
        uint256 tokenId = nftContract.mintProperty(SAMPLE_URI);
        nftContract.approve(address(marketplaceContract), tokenId);
        marketplaceContract.createAuction(address(nftContract), tokenId, START_PRICE, 24);
        vm.stopPrank();

        uint256 winningBid = 0.1 ether;
        vm.prank(bidder2);
        marketplaceContract.placeBid{value: winningBid}(1);

        // Fast forward 25 hours past auction end
        vm.warp(block.timestamp + 25 hours);

        // End auction
        vm.prank(seller);
        marketplaceContract.endAuction(1);

        // Highest bidder receives NFT
        assertEq(nftContract.ownerOf(tokenId), bidder2);

        EstateXMarketplace.Auction memory auction = marketplaceContract.getAuction(1);
        assertTrue(auction.ended);
    }

    function test_RevertIf_EndAuctionBeforeExpiry() public {
        vm.startPrank(seller);
        uint256 tokenId = nftContract.mintProperty(SAMPLE_URI);
        nftContract.approve(address(marketplaceContract), tokenId);
        marketplaceContract.createAuction(address(nftContract), tokenId, START_PRICE, 24);
        vm.stopPrank();

        vm.prank(bidder1);
        marketplaceContract.placeBid{value: 0.06 ether}(1);

        // Try ending before 24 hours
        vm.prank(seller);
        vm.expectRevert();
        marketplaceContract.endAuction(1);
    }

    // =========================================================================
    // 4. REAL ESTATE RENTAL INCOME SYSTEM TESTS
    // =========================================================================

    function test_ListPropertyForRent() public {
        vm.startPrank(seller);
        uint256 tokenId = nftContract.mintProperty(SAMPLE_URI);
        marketplaceContract.listPropertyForRent(address(nftContract), tokenId, PRICE_PER_DAY);
        vm.stopPrank();

        EstateXMarketplace.Rental memory rental = marketplaceContract.getRental(1);
        assertEq(rental.rentalId, 1);
        assertEq(rental.landlord, seller);
        assertEq(rental.pricePerDay, PRICE_PER_DAY);
        assertTrue(rental.isListedForRent);
    }

    function test_RentProperty() public {
        vm.startPrank(seller);
        uint256 tokenId = nftContract.mintProperty(SAMPLE_URI);
        marketplaceContract.listPropertyForRent(address(nftContract), tokenId, PRICE_PER_DAY);
        vm.stopPrank();

        uint256 landlordBalBefore = seller.balance;
        uint256 daysCount = 5;
        uint256 totalCost = PRICE_PER_DAY * daysCount; // 0.05 ETH

        vm.prank(tenant);
        marketplaceContract.rentProperty{value: totalCost}(1, daysCount);

        EstateXMarketplace.Rental memory rental = marketplaceContract.getRental(1);
        assertEq(rental.tenant, tenant);
        assertEq(rental.rentedUntil, block.timestamp + (daysCount * 1 days));

        // Landlord receives 97.5% of rent income (2.5% protocol fee)
        uint256 expectedLandlordPayout = (totalCost * 9750) / 10000;
        assertEq(seller.balance - landlordBalBefore, expectedLandlordPayout);
    }

    function test_CancelRentalListing() public {
        vm.startPrank(seller);
        uint256 tokenId = nftContract.mintProperty(SAMPLE_URI);
        marketplaceContract.listPropertyForRent(address(nftContract), tokenId, PRICE_PER_DAY);

        marketplaceContract.cancelRentalListing(1);
        vm.stopPrank();

        EstateXMarketplace.Rental memory rental = marketplaceContract.getRental(1);
        assertFalse(rental.isListedForRent);
    }

    // =========================================================================
    // 5. PROTOCOL ADMINISTRATION & PAUSABILITY TESTS
    // =========================================================================

    function test_UpdatePlatformFee() public {
        vm.prank(owner);
        marketplaceContract.setFeeBasisPoints(300); // 3%
        assertEq(marketplaceContract.feeBasisPoints(), 300);
    }

    function test_RevertIf_UpdatePlatformFee_NotOwner() public {
        vm.prank(seller);
        vm.expectRevert();
        marketplaceContract.setFeeBasisPoints(300);
    }

    function test_PauseAndUnpause() public {
        vm.prank(owner);
        marketplaceContract.pause();
        assertTrue(marketplaceContract.paused());

        // Actions revert when paused
        vm.startPrank(seller);
        uint256 tokenId = nftContract.mintProperty(SAMPLE_URI);
        nftContract.approve(address(marketplaceContract), tokenId);

        vm.expectRevert();
        marketplaceContract.listProperty(address(nftContract), tokenId, LISTING_PRICE);
        vm.stopPrank();

        vm.prank(owner);
        marketplaceContract.unpause();
        assertFalse(marketplaceContract.paused());
    }
}
