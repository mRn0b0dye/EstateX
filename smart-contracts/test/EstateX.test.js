const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EstateX All-in-One Real Estate Protocol", function () {
  let nftContract;
  let marketplaceContract;
  let owner;
  let seller;
  let buyer;
  let bidder1;
  let bidder2;

  const sampleURI = "ipfs://QmSamplePropertyMetadataCID123";
  const listingPrice = ethers.parseEther("0.1"); // 0.1 ETH
  const startPrice = ethers.parseEther("0.05");  // 0.05 ETH
  const pricePerDay = ethers.parseEther("0.01"); // 0.01 ETH / day

  beforeEach(async function () {
    [owner, seller, buyer, bidder1, bidder2] = await ethers.getSigners();

    const NFTFactory = await ethers.getContractFactory("EstateXNFT");
    nftContract = await NFTFactory.deploy();

    const MarketplaceFactory = await ethers.getContractFactory("EstateXMarketplace");
    marketplaceContract = await MarketplaceFactory.deploy();
  });

  describe("1. NFT Minting & Verification", function () {
    it("Should mint property NFT and track minter", async function () {
      await nftContract.connect(seller).mintProperty(sampleURI);
      expect(await nftContract.ownerOf(1)).to.equal(seller.address);
      expect(await nftContract.propertyMinter(1)).to.equal(seller.address);
    });

    it("Should allow owner to set property verification status", async function () {
      await nftContract.connect(seller).mintProperty(sampleURI);
      await nftContract.connect(owner).setPropertyVerification(1, true);
      expect(await nftContract.isPropertyVerified(1)).to.be.true;
    });
  });

  describe("2. Fixed Price Sale & Reselling", function () {
    beforeEach(async function () {
      await nftContract.connect(seller).mintProperty(sampleURI);
      await nftContract.connect(seller).approve(await marketplaceContract.getAddress(), 1);
    });

    it("Should list, buy, and distribute 2.5% platform fee", async function () {
      const sellerBalBefore = await ethers.provider.getBalance(seller.address);
      const ownerBalBefore = await ethers.provider.getBalance(owner.address);

      await marketplaceContract.connect(seller).listProperty(await nftContract.getAddress(), 1, listingPrice);
      
      const tx = await marketplaceContract.connect(buyer).buyProperty(1, { value: listingPrice });
      const receipt = await tx.wait();

      expect(await nftContract.ownerOf(1)).to.equal(buyer.address);
      const listing = await marketplaceContract.getListing(1);
      expect(listing.status).to.equal(1); // Sold

      const sellerBalAfter = await ethers.provider.getBalance(seller.address);
      const ownerBalAfter = await ethers.provider.getBalance(owner.address);

      // Payout is price minus platform fee (2.5%) and royalty (1% to owner)
      const platformFee = (listingPrice * 250n) / 10000n;
      const royaltyFee = (listingPrice * 100n) / 10000n;
      const expectedPayout = listingPrice - platformFee - royaltyFee;

      // Seller paid gas for listing, so balance change is expectedPayout - gas
      expect(sellerBalAfter).to.be.greaterThan(sellerBalBefore);
      expect(ownerBalAfter - ownerBalBefore).to.equal(platformFee + royaltyFee);
    });
  });

  describe("3. Timed Auction & Bidding System", function () {
    beforeEach(async function () {
      await nftContract.connect(seller).mintProperty(sampleURI);
      await nftContract.connect(seller).approve(await marketplaceContract.getAddress(), 1);
    });

    it("Should create auction, accept bids, and end auction with highest bidder winning", async function () {
      // 1. Create 24 hour auction
      await marketplaceContract.connect(seller).createAuction(
        await nftContract.getAddress(),
        1,
        startPrice,
        24
      );

      // 2. Bidder 1 bids 0.06 ETH
      const bid1 = ethers.parseEther("0.06");
      await marketplaceContract.connect(bidder1).placeBid(1, { value: bid1 });

      // 3. Bidder 2 outbids with 0.1 ETH
      const bid2 = ethers.parseEther("0.1");
      await marketplaceContract.connect(bidder2).placeBid(1, { value: bid2 });

      // Check bidder 1 refund balance
      const refund = await marketplaceContract.pendingBidRefunds(1, bidder1.address);
      expect(refund).to.equal(bid1);

      // Fast forward time by 25 hours
      await ethers.provider.send("evm_increaseTime", [25 * 3600]);
      await ethers.provider.send("evm_mine");

      // 4. End auction
      await marketplaceContract.connect(seller).endAuction(1);

      // Check NFT transferred to highest bidder (bidder2)
      expect(await nftContract.ownerOf(1)).to.equal(bidder2.address);
    });
  });

  describe("4. Real Estate Rental Income System", function () {
    beforeEach(async function () {
      await nftContract.connect(seller).mintProperty(sampleURI);
    });

    it("Should list property for rent and allow tenant to pay for 5 days of rent", async function () {
      // Landlord lists for rent at 0.01 ETH/day
      await marketplaceContract.connect(seller).listPropertyForRent(
        await nftContract.getAddress(),
        1,
        pricePerDay
      );

      const landlordBalBefore = await ethers.provider.getBalance(seller.address);

      // Tenant rents for 5 days (0.05 ETH total)
      const rentDuration = 5;
      const totalRentCost = ethers.parseEther("0.05");

      await marketplaceContract.connect(buyer).rentProperty(1, rentDuration, { value: totalRentCost });

      const rental = await marketplaceContract.getRental(1);
      expect(rental.tenant).to.equal(buyer.address);

      // Check landlord received 97.5% of rent income
      const landlordBalAfter = await ethers.provider.getBalance(seller.address);
      const expectedPayout = (totalRentCost * 9750n) / 10000n; // 0.04875 ETH
      expect(landlordBalAfter - landlordBalBefore).to.equal(expectedPayout);
    });
  });
});
