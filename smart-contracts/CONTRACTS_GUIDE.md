# EstateX Smart Contracts Architecture & Fee Guide

This guide details the architecture, design choices, functionality, and fee distribution rules for the **EstateX** real estate smart contract protocol.

---

## 🏛️ Smart Contract Architecture

The protocol consists of two primary smart contracts working in tandem:

```
                  ┌──────────────────────┐
                  │     EstateXNFT       │
                  │ (ERC-721 Property)   │
                  └──────────┬───────────┘
                             │ (Mint & Verify)
                             ▼
                  ┌──────────────────────┐
                  │  EstateXMarketplace  │
                  │ (Sales/Rent/Auction) │
                  └──────────────────────┘
```

### 1. [`EstateXNFT.sol`](contracts/EstateXNFT.sol)
An ERC-721 token contract representing property deeds.
*   **IPFS Metadata Linkage:** Inherits OpenZeppelin's `ERC721URIStorage` to link each token to an immutable JSON metadata file (describing coordinates, features, size, and images) hosted on IPFS.
*   **ERC-2981 Royalties:** Implements standard Web3 royalties. By default, the creator receives a **1% royalty** on any secondary marketplace transaction.
*   **On-Chain Verification:** Trusted platform administrators can toggle the property verification badge status (`setPropertyVerification`), signaling to buyers that physical property titles have been legally vetted.

### 2. [`EstateXMarketplace.sol`](contracts/EstateXMarketplace.sol)
The core business logic contract facilitating decentralized real estate commerce. It operates under a **ReentrancyGuard** for financial security and contains an emergency pause switch (**Pausable**) controlled by the platform owner.

---

## 💸 Protocol Fee Architecture (2.5% Platform Fee)

The marketplace implements a platform fee of **2.5%** (250 basis points) on all successfully completed trade agreements (sales, auctions, and rentals). 

Here is exactly how the fees and payouts are distributed for each of the three transaction modes:

### 1. 🏷️ Fixed-Price Buying & Selling
*   **Who pays the listing cost?** The **Buyer** pays the exact listing price in ETH.
*   **Who pays the platform fee?** The **Seller** pays the fee out of their sale proceeds.
*   **How funds are distributed:**
    *   `Total Paid by Buyer` = $Price$ (in ETH)
    *   `Platform Fee (2.5%)` = $Price \times 0.025$ (Sent to the Marketplace Owner)
    *   `Creator Royalty (1.0%)` = $Price \times 0.010$ (Sent to the Original Minter)
    *   `Seller Payout` = $Price - (\text{Platform Fee} + \text{Creator Royalty})$

*Example:* A property is sold for **10 ETH**. The buyer pays **10 ETH**. The platform collects **0.25 ETH**. The original creator gets **0.10 ETH**. The seller receives **9.65 ETH**.

---

### 🔨 2. Timed Auctions
*   **Who pays the winning cost?** The **Winning Bidder (Highest Bidder)** pays their winning bid in ETH (which was locked in the contract during the active bidding phase).
*   **Who pays the platform fee?** The **Seller** pays the fee out of the winning bid proceeds.
*   **How funds are distributed:**
    *   `Total Paid by Winner` = $Winning\ Bid$ (in ETH)
    *   `Platform Fee (2.5%)` = $Winning\ Bid \times 0.025$ (Sent to the Marketplace Owner)
    *   `Creator Royalty (1.0%)` = $Winning\ Bid \times 0.010$ (Sent to the Original Minter)
    *   `Seller Payout` = $Winning\ Bid - (\text{Platform Fee} + \text{Creator Royalty})$

*Note:* Outbid users do not pay any fees. Their full bids are automatically credited to their accounts, which they can withdraw fee-free via the `withdrawBidRefund` function.

---

### 🔑 3. Real Estate Rentals
*   **Who pays the rent cost?** The **Tenant** pays the full lease amount upfront based on the number of days rented.
*   **Who pays the platform fee?** The **Landlord** pays the fee out of their incoming rent earnings.
*   **How funds are distributed:**
    *   `Total Paid by Tenant` = $\text{Daily Rate} \times \text{Number of Days}$
    *   `Platform Fee (2.5%)` = $\text{Total Paid} \times 0.025$ (Sent to the Marketplace Owner)
    *   `Landlord Payout` = $\text{Total Paid} \times 0.975$ (Sent directly to the landlord's wallet)

*Example:* A tenant rents a villa for 30 days at a rate of 0.1 ETH/day. The tenant pays **3 ETH**. The platform collects **0.075 ETH**. The landlord receives **2.925 ETH** instantly.

---

## 🛠️ Public Functions Reference Table

| Function Signature | Role | Payable? | Who Can Call? |
|---|---|---|---|
| `mintProperty(string uri)` | Mints a property deed NFT | No | Anyone |
| `listProperty(address contract, uint256 id, uint256 price)` | Lists NFT for fixed-price sale | No | NFT Owner |
| `updateListingPrice(uint256 listId, uint256 price)` | Adjusts listing price | No | Seller |
| `buyProperty(uint256 listId)` | Purchases a listed property | **Yes** | Anyone (not Seller) |
| `createAuction(address contract, uint256 id, uint256 minBid, uint256 hours)` | Starts a timed auction | No | NFT Owner |
| `placeBid(uint256 auctionId)` | Places a bid in an active auction | **Yes** | Anyone (not Seller) |
| `endAuction(uint256 auctionId)` | Closes auction & transfers assets | No | Anyone (post-end) |
| `listPropertyForRent(address contract, uint256 id, uint256 dailyPrice)` | Lists property for daily lease | No | NFT Owner |
| `rentProperty(uint256 rentId, uint256 days)` | Rents property for $N$ days | **Yes** | Anyone |
| `setPropertyVerification(uint256 id, bool status)` | Verifies/Vets a property deed | No | Protocol Admin |
