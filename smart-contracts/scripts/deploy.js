const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("==================================================");
  console.log(`🚀 Deploying EstateX Smart Contracts to Network: ${network.name}`);
  console.log("==================================================\n");

  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deployer Account: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Account Balance: ${ethers.formatEther(balance)} ETH\n`);

  // 1. Deploy EstateXNFT Contract
  console.log("⏳ Deploying EstateXNFT...");
  const NFTFactory = await ethers.getContractFactory("EstateXNFT");
  const nftContract = await NFTFactory.deploy();
  await nftContract.waitForDeployment();
  const nftAddress = await nftContract.getAddress();
  console.log(`✅ EstateXNFT Deployed at: ${nftAddress}`);

  // 2. Deploy EstateXMarketplace Contract
  console.log("\n⏳ Deploying EstateXMarketplace...");
  const MarketplaceFactory = await ethers.getContractFactory("EstateXMarketplace");
  const marketplaceContract = await MarketplaceFactory.deploy();
  await marketplaceContract.waitForDeployment();
  const marketplaceAddress = await marketplaceContract.getAddress();
  console.log(`✅ EstateXMarketplace Deployed at: ${marketplaceAddress}`);

  console.log("\n==================================================");
  console.log("🎉 Deployment Successful!");
  console.log("==================================================");
  console.log(`EstateXNFT:          ${nftAddress}`);
  console.log(`EstateXMarketplace:  ${marketplaceAddress}`);
  console.log("==================================================\n");

  // 3. Export Addresses & ABIs to Frontend
  const frontendConstantsDir = path.join(__dirname, "../../frontend/constants");

  if (!fs.existsSync(frontendConstantsDir)) {
    fs.mkdirSync(frontendConstantsDir, { recursive: true });
  }

  const addressesData = {
    network: network.name,
    chainId: network.config.chainId || 31337,
    nftContract: nftAddress,
    marketplaceContract: marketplaceAddress
  };

  fs.writeFileSync(
    path.join(frontendConstantsDir, "addresses.json"),
    JSON.stringify(addressesData, null, 2)
  );

  fs.writeFileSync(
    path.join(frontendConstantsDir, "addresses.js"),
    `export const NFT_CONTRACT_ADDRESS = "${nftAddress}";\nexport const MARKETPLACE_CONTRACT_ADDRESS = "${marketplaceAddress}";\nexport const CHAIN_ID = ${network.config.chainId || 31337};\n`
  );

  // Copy ABIs
  const nftArtifact = require("../artifacts/contracts/EstateXNFT.sol/EstateXNFT.json");
  const marketplaceArtifact = require("../artifacts/contracts/EstateXMarketplace.sol/EstateXMarketplace.json");

  fs.writeFileSync(
    path.join(frontendConstantsDir, "EstateXNFT.json"),
    JSON.stringify(nftArtifact.abi, null, 2)
  );

  fs.writeFileSync(
    path.join(frontendConstantsDir, "EstateXMarketplace.sol.json"),
    JSON.stringify(marketplaceArtifact.abi, null, 2)
  );

  fs.writeFileSync(
    path.join(frontendConstantsDir, "EstateXMarketplace.json"),
    JSON.stringify(marketplaceArtifact.abi, null, 2)
  );

  console.log(`📂 Contract ABIs and addresses exported to frontend/constants!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
