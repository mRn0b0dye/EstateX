import { ethers } from 'ethers';
import addresses from '../constants/addresses.json';
import NFTABI from '../constants/EstateXNFT.json';
import MarketplaceABI from '../constants/EstateXMarketplace.json';

export const getProvider = () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    return new ethers.BrowserProvider(window.ethereum);
  }
  return null;
};

export const connectWallet = async () => {
  try {
    if (!window.ethereum) throw new Error("MetaMask not installed");
    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = await provider.getSigner();
    
    const network = await provider.getNetwork();
    if (network.chainId !== BigInt(addresses.chainId)) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${addresses.chainId.toString(16)}` }],
        });
      } catch (error) {
        throw new Error(`Please connect to the Sepolia testnet.`);
      }
    }
    
    return signer;
  } catch (error) {
    console.error("Wallet connection error:", error);
    throw error;
  }
};

export const getContracts = async (signerOrProvider) => {
  const nftAbi = NFTABI.abi || NFTABI;
  const marketplaceAbi = MarketplaceABI.abi || MarketplaceABI;
  
  const nftContract = new ethers.Contract(addresses.nftContract, nftAbi, signerOrProvider);
  const marketplaceContract = new ethers.Contract(addresses.marketplaceContract, marketplaceAbi, signerOrProvider);
  return { nftContract, marketplaceContract };
};

export const formatEth = (weiValue) => {
  if (!weiValue) return "0";
  return ethers.formatEther(weiValue);
};

export const parseEth = (ethValue) => {
  if (!ethValue) return "0";
  return ethers.parseEther(ethValue.toString());
};
