# EstateX — Tokenized Real Estate NFT Marketplace

[![Ethereum Sepolia](https://img.shields.io/badge/Network-Ethereum_Sepolia-blue)](https://sepolia.etherscan.io)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-lightgrey)](https://soliditylang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![IPFS](https://img.shields.io/badge/Storage-Pinata_IPFS-teal)](https://pinata.cloud)

EstateX is a decentralized Web3 real estate marketplace where property owners can mint physical and digital properties as ERC-721 NFTs, list them for sale in ETH, purchase property NFTs with automatic ownership transfer, cancel active listings, and resell owned real estate.

---

## 🌟 Key Features

- 🏠 **ERC-721 Property Minting:** Mint unique property NFTs with metadata stored on IPFS.
- 🏷️ **Marketplace Listings:** List owned properties with ETH selling prices.
- 🛒 **Decentralized Purchasing:** Safe payment handling with automatic NFT transfer.
- 🔄 **Reselling & Cancellation:** Resell purchased properties or cancel active listings.
- 📊 **User Dashboard:** Dedicated tabbed view for Owned, Listed, Purchased, and Sold properties.
- 💼 **Wallet Integration:** MetaMask connection with network detection (Sepolia).

---

## 🛠️ Project Structure

```
EstateX/
├── smart-contracts/        # Hardhat project, Solidity contracts, & tests
│   ├── contracts/          # EstateXNFT.sol & EstateXMarketplace.sol
│   ├── scripts/            # Deployment & verification scripts
│   ├── test/               # Hardhat test suite
│   └── hardhat.config.js
├── frontend/               # Next.js Web3 application
│   ├── app/                # App router pages (Mint, Marketplace, Dashboard, NFT Detail)
│   ├── components/         # Reusable UI components
│   ├── utils/              # Contract & wallet utility functions
│   └── constants/          # ABIs & contract addresses
├── .env.example            # Environment variables template
└── README.md
```

---

## 🚀 Quick Start & Installation

### Prerequisites
- Node.js (v18+)
- MetaMask extension
- Sepolia Testnet ETH

### 1. Smart Contracts Setup
```bash
cd smart-contracts
npm install
npx hardhat test
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 📜 License
MIT License
