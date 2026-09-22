# EstateX — Tokenized Real Estate Protocol

[![Ethereum Sepolia](https://img.shields.io/badge/Network-Ethereum_Sepolia-blue)](https://sepolia.etherscan.io)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-lightgrey)](https://soliditylang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![IPFS](https://img.shields.io/badge/Storage-Pinata_IPFS-teal)](https://pinata.cloud)

EstateX is a decentralized Web3 real estate platform where property deeds are tokenized as ERC-721 NFTs. The protocol supports fixed-price listings, interactive timed bidding auctions, and a rental income system where landlords can lease out properties on a daily basis.

---

## 🌟 Core Protocol Features

### 1. 🏠 ERC-721 Property Minting & Verification
- Mint unique property NFTs with metadata and property images stored on IPFS.
- Platform admin can officially verify property deeds on-chain (`setPropertyVerification`).
- Standard **ERC-2981** creator royalties (default 1%) configured to execute on secondary sales.

### 2. 🏷️ Fixed-Price Sales & Reselling
- Sellers list property NFTs for a fixed price in ETH.
- Ability to update listing price (`updateListingPrice`) without needing to cancel and re-list.
- Automated 2.5% platform fee collection.
- Quick reselling interface for new property owners.

### 3. 🔨 Timed Auctions & Bidding System
- Sellers can launch timed auctions specifying a reserve price and duration.
- Bidders place active bids in ETH (minimum 5% increase required over the previous bid).
- Outbid users can withdraw their bid refunds safely (`withdrawBidRefund`).
- Finalizing the auction automatically pays out the seller and transfers NFT ownership to the winner.

### 4. 🔑 Real Estate Rental Income System
- Landlords can list properties for lease specifying the daily rental rate in ETH.
- Tenants rent properties for a customized duration of days.
- Payouts are distributed automatically to landlords (97.5%) and the platform fee pool (2.5%) upon reservation.

### 5. 🛡️ Protocol Security & Admin controls
- Emergency pause circuit breaker (`pauseMarketplace` / `unpauseMarketplace`).
- Non-reentrant modifiers on all financial payout states to prevent reentrancy attacks.
- Tracked total volume statistics (`totalVolume`) across sales, auctions, and rentals.

---

## 🌐 Deployed Smart Contract Addresses (Sepolia Testnet)

| Contract | Address | Verified Explorer Code Link |
|---|---|---|
| **EstateXNFT** | `0x242C060dBaC5E3ae04Ef37EF0959Fd35e272c3Ba` | [Etherscan Sepolia](https://sepolia.etherscan.io/address/0x242C060dBaC5E3ae04Ef37EF0959Fd35e272c3Ba#code) |
| **EstateXMarketplace** | `0xc8B92A13422659fF895bdc329b2E451c639AE378` | [Etherscan Sepolia](https://sepolia.etherscan.io/address/0xc8B92A13422659fF895bdc329b2E451c639AE378#code) |

---

## 🛠️ Project Structure

```
EstateX/
├── smart-contracts/        # Hardhat & Foundry development module
│   ├── contracts/          # EstateXNFT.sol & EstateXMarketplace.sol
│   ├── scripts/            # Deployment, verification & service checks
│   ├── test/               # Dual test suites (Hardhat & Foundry)
│   │   ├── EstateX.test.js # Hardhat Chai/Ethers.js tests
│   │   └── EstateX.t.sol   # Foundry Solidity unit tests
│   ├── foundry.toml        # Foundry configuration
│   ├── remappings.txt      # Dependency remappings
│   └── hardhat.config.js
├── frontend/               # Next.js 14 Web3 application
│   ├── app/                # Mint, Browse, Dashboard & Detail pages
│   ├── components/         # Reusable Web3 UI elements
│   ├── utils/              # Contract connectors & MetaMask hook wrapper
│   └── constants/          # Decoupled ABI & Address configurations
├── .env.example            # Credentials setup template
└── README.md
```

---

## 🚀 Local Installation & Tests

### Prerequisites
- Node.js (v18+)
- Foundry (`forge` CLI) or WSL Ubuntu
- MetaMask extension
- Sepolia Testnet ETH

### 1. Run Tests with Foundry (Recommended for Speed & Tracing)
```bash
cd smart-contracts
forge test -vvv
```

To run gas analysis:
```bash
forge test --gas-report
```

### 2. Run Tests with Hardhat
```bash
cd smart-contracts
npm install
npx hardhat test
```

### 3. Local Contract Deployment
```bash
npx hardhat run scripts/deploy.js
```
*This deploys contracts on local network and auto-exports ABI and Address files to the frontend module.*

---

## 📜 License
MIT License
