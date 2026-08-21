'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getProvider, getContracts, connectWallet, formatEth, parseEth } from '../../utils/web3';
import { resolveIPFS } from '../../utils/pinata';
import toast from 'react-hot-toast';
import addresses from '../../constants/addresses.json';

export default function Dashboard() {
  const [address, setAddress] = useState('');
  const [ownedNFTs, setOwnedNFTs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [activeListings, setActiveListings] = useState({});
  // Listing state
  const [listingTokenId, setListingTokenId] = useState(null);
  const [listingType, setListingType] = useState('sale'); // sale, auction, rent
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('24'); // For auction
  const [manageInfo, setManageInfo] = useState(null);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          fetchMyProperties(accounts[0]);
        }
      } catch (e) {
        console.error("Connection check failed:", e);
      }
    }
  };

  const fetchMyProperties = async (userAddress) => {
    try {
      setIsLoading(true);
      const provider = getProvider();
      if (!provider) return;

      const { nftContract, marketplaceContract } = await getContracts(provider);
      
      const allListings = await marketplaceContract.getAllListings();
      const allAuctions = await marketplaceContract.getAllAuctions();
      const allRentals = await marketplaceContract.getAllRentals();

      const listedMap = {};
      const now = Math.floor(Date.now() / 1000);
      
      allListings.forEach(l => {
        if (l.status === 0n) listedMap[l.tokenId.toString()] = { type: 'sale', id: l.listingId.toString(), price: formatEth(l.price) };
      });
      allAuctions.forEach(a => {
        if (!a.ended && a.endTime > BigInt(now)) listedMap[a.tokenId.toString()] = { type: 'auction', id: a.auctionId.toString() };
      });
      allRentals.forEach(r => {
        if (r.isListedForRent && r.rentedUntil < BigInt(now)) listedMap[r.tokenId.toString()] = { type: 'rent', id: r.rentalId.toString() };
      });
      setActiveListings(listedMap);

      const totalProps = await nftContract.getTotalProperties();
      const myItems = [];

      for (let i = 1; i <= Number(totalProps); i++) {
        try {
          const owner = await nftContract.ownerOf(i);
          if (owner.toLowerCase() === userAddress.toLowerCase()) {
            const tokenUri = await nftContract.tokenURI(i);
            const meta = await fetchMetadata(tokenUri);
            myItems.push({
              tokenId: i,
              owner,
              metadata: meta
            });
          }
        } catch (e) {
          // Token burned or not minted
        }
      }
      setOwnedNFTs(myItems);
    } catch (error) {
      console.error("Error fetching properties:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMetadata = async (tokenUri) => {
    try {
      const url = tokenUri.startsWith('ipfs://') 
        ? tokenUri.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')
        : tokenUri;
      const res = await fetch(url);
      return await res.json();
    } catch (e) {
      return {};
    }
  };

  const handleCancelListing = async () => {
    let toastId;
    try {
      toastId = toast.loading('Cancelling listing...');
      const signer = await connectWallet();
      const { marketplaceContract } = await getContracts(signer);
      
      let tx;
      if (manageInfo.type === 'sale') {
        tx = await marketplaceContract.cancelListing(manageInfo.id);
      } else if (manageInfo.type === 'rent') {
        tx = await marketplaceContract.cancelRentalListing(manageInfo.id);
      } else {
        toast.error('Cannot cancel this listing type directly here');
        if (toastId) toast.dismiss(toastId);
        return;
      }
      
      toast.loading('Awaiting confirmation...', { id: toastId });
      await tx.wait();
      toast.success('Listing cancelled!', { id: toastId });
      setManageInfo(null);
      fetchMyProperties(address);
    } catch (e) {
      if (toastId) toast.dismiss(toastId);
      toast.error(`Cancel failed: ${e.reason || e.message}`);
    }
  };

  const handleUpdatePrice = async () => {
    if (!price || parseFloat(price) <= 0) return toast.error('Enter valid price');
    let toastId;
    try {
      toastId = toast.loading('Updating price...');
      const signer = await connectWallet();
      const { marketplaceContract } = await getContracts(signer);
      
      const weiPrice = parseEth(price);
      const tx = await marketplaceContract.updateListingPrice(manageInfo.id, weiPrice);
      
      toast.loading('Awaiting confirmation...', { id: toastId });
      await tx.wait();
      toast.success('Price updated!', { id: toastId });
      setManageInfo(null);
      fetchMyProperties(address);
    } catch (e) {
      if (toastId) toast.dismiss(toastId);
      toast.error(`Update failed: ${e.reason || e.message}`);
    }
  };

  const handleListProperty = async () => {
    if (!price || parseFloat(price) <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    let toastId;
    try {
      toastId = toast.loading('Connecting wallet...');
      const signer = await connectWallet();
      const { nftContract, marketplaceContract } = await getContracts(signer);

      // Check marketplace approval
      toast.loading('Checking marketplace authorization...', { id: toastId });
      const isApproved = await nftContract.isApprovedForAll(address, addresses.marketplaceContract);
      if (!isApproved) {
        toast.loading('Authorizing marketplace operator...', { id: toastId });
        const txApprove = await nftContract.setApprovalForAll(addresses.marketplaceContract, true);
        await txApprove.wait();
      }

      toast.loading(`Creating on-chain ${listingType} listing...`, { id: toastId });
      const weiPrice = parseEth(price);
      
      let tx;
      if (listingType === 'sale') {
        tx = await marketplaceContract.listProperty(addresses.nftContract, listingTokenId, weiPrice);
      } else if (listingType === 'auction') {
        tx = await marketplaceContract.createAuction(addresses.nftContract, listingTokenId, weiPrice, parseInt(duration));
      } else if (listingType === 'rent') {
        tx = await marketplaceContract.listPropertyForRent(addresses.nftContract, listingTokenId, weiPrice);
      }
      
      toast.loading('Awaiting block confirmation...', { id: toastId });
      await tx.wait();
      
      toast.success('Property Listed on Marketplace! 🚀', { id: toastId });
      setListingTokenId(null);
      setPrice('');
    } catch (error) {
      console.error(error);
      if (toastId) toast.dismiss(toastId);
      toast.error(`Listing failed: ${error.reason || error.message || 'Unknown error'}`);
    }
  };

  if (!address) {
    return (
      <div className="glass-card text-center py-20 max-w-lg mx-auto flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Connect Your Web3 Wallet</h2>
        <p className="text-slate-400 text-sm mb-6 max-w-xs">
          Connect with MetaMask to view your real estate portfolio, active deeds, and rental yields.
        </p>
        <button 
          onClick={async () => {
            try {
              const signer = await connectWallet();
              const addr = await signer.getAddress();
              setAddress(addr);
              fetchMyProperties(addr);
            } catch (e) {
              toast.error(e.message);
            }
          }} 
          className="btn btn-primary px-8 py-3 rounded-xl text-sm shadow-xl shadow-purple-600/30"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-8">
      {/* Portfolio Header Banner */}
      <div className="glass-card p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-cyan-500 p-[1.5px] shadow-lg shadow-purple-500/30">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-cyan-400 font-extrabold text-xl">
              0x
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-white">Investor Portfolio</h1>
              <span className="badge badge-mint text-[10px]">Verified Wallet</span>
            </div>
            <p className="mono text-xs text-slate-400">{address}</p>
          </div>
        </div>

        {/* Quick Actions & Stats */}
        <div className="flex items-center gap-4">
          <div className="px-5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Owned Properties</span>
            <span className="text-xl font-extrabold gradient-text">{ownedNFTs.length}</span>
          </div>
          <Link href="/mint" className="btn btn-primary px-5 py-2.5 rounded-xl text-sm shadow-lg shadow-purple-600/25">
            + Tokenize Property
          </Link>
        </div>
      </div>

      {/* Owned Properties List */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">My Real Estate Titles</h2>
          <span className="text-xs text-slate-400">ERC-721 Deeds Stored in Wallet</span>
        </div>
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="loader w-10 h-10 border-4"></div>
            <p className="text-sm text-slate-400">Scanning wallet tokens...</p>
          </div>
        ) : ownedNFTs.length === 0 ? (
          <div className="glass-card text-center py-16 px-6 flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-3">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">No Real Estate NFTs Found</h3>
            <p className="text-sm text-slate-400 mb-6">You haven't minted or purchased any property titles on Sepolia yet.</p>
            <Link href="/mint" className="btn btn-primary px-6 py-2.5 text-sm rounded-xl">
              Tokenize Your First Property
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ownedNFTs.map(nft => (
              <div key={nft.tokenId} className="glass-card p-4 flex flex-col gap-4 group">
                <div className="w-full h-44 bg-slate-950 rounded-xl overflow-hidden relative">
                  {nft.metadata?.image ? (
                    <img 
                      src={resolveIPFS(nft.metadata.image)} 
                      alt="NFT" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                      No media
                    </div>
                  )}
                  <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md border border-white/10 text-[11px] font-mono text-cyan-300">
                    Token #{nft.tokenId}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-base text-white truncate mb-1">
                    {nft.metadata?.name || `Property Title #${nft.tokenId}`}
                  </h3>
                  <p className="text-xs text-slate-400 truncate">
                    {nft.metadata?.location || 'Sepolia Testnet'}
                  </p>
                </div>

                {activeListings[nft.tokenId] ? (
                  <div className="flex flex-col gap-2 mt-auto">
                    <button disabled className="btn btn-primary py-2.5 text-xs rounded-xl opacity-50 cursor-not-allowed">
                      Listed on Marketplace
                    </button>
                    <button 
                      onClick={() => {
                        setManageInfo({ tokenId: nft.tokenId, ...activeListings[nft.tokenId] });
                        setPrice(activeListings[nft.tokenId].price || '');
                      }}
                      className="btn btn-secondary py-2.5 text-xs rounded-xl border border-slate-700 hover:border-cyan-500/50 hover:text-cyan-400"
                    >
                      ⚙️ Manage Listing
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => {
                      setListingTokenId(nft.tokenId);
                      setPrice('');
                    }} 
                    className="btn btn-primary mt-auto py-2.5 text-xs rounded-xl shadow-md shadow-purple-600/20"
                  >
                    🚀 List on Marketplace
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Listing / Manage Modal */}
      {(listingTokenId || manageInfo) && (
        <div className="modal-backdrop">
          <div className="modal-dialog flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-white">
                  {manageInfo ? `Manage Property #${manageInfo.tokenId}` : `List Property #${listingTokenId}`}
                </h3>
                <p className="text-xs text-slate-400">
                  {manageInfo ? 'Update your listing price or cancel it.' : 'Choose listing terms to publish to the decentralized market.'}
                </p>
              </div>
              <button 
                onClick={() => { setListingTokenId(null); setManageInfo(null); }}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>
            
            {!manageInfo && (
              <>
                {/* Tab Selector */}
                <div className="flex gap-2 mb-2">
                  {[
                    { id: 'sale', label: '⚡ Buy Now' },
                    { id: 'auction', label: '🔥 Auction' },
                    { id: 'rent', label: '💎 Rent Out' },
                  ].map(tab => (
                    <button 
                      key={tab.id}
                      onClick={() => setListingType(tab.id)} 
                      className={`flex-1 py-2.5 rounded-full font-bold text-xs transition-all duration-300 ${
                        listingType === tab.id 
                          ? 'bg-gradient-to-r from-purple-600 to-cyan-500 text-white shadow-[0_0_15px_rgba(139,92,246,0.4)] border border-transparent' 
                          : 'glass-pill text-slate-300 hover:text-white hover:border-purple-500/50 hover:shadow-[0_0_10px_rgba(139,92,246,0.2)]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Price Field */}
                <div className="form-group mb-0">
                  <label className="form-label">
                    {listingType === 'rent' ? 'Daily Rental Price (ETH)' : (listingType === 'auction' ? 'Starting Reserve Price (ETH)' : 'Fixed Buyout Price (ETH)')}
                  </label>
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="e.g. 1.25"
                    value={price} 
                    onChange={e => setPrice(e.target.value)} 
                    className="form-input" 
                  />
                </div>

                {/* Auction Duration */}
                {listingType === 'auction' && (
                  <div className="form-group mb-0">
                    <label className="form-label">Auction Duration (Hours)</label>
                    <input 
                      type="number" 
                      value={duration} 
                      onChange={e => setDuration(e.target.value)} 
                      className="form-input" 
                    />
                  </div>
                )}

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400 flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span>Protocol Fee</span>
                    <span className="text-slate-300 font-semibold">2.5%</span>
                  </div>
                </div>

                <div className="flex gap-3 mt-2">
                  <button 
                    onClick={() => setListingTokenId(null)} 
                    className="btn btn-outline flex-1 py-2.5 rounded-xl text-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleListProperty} 
                    className="btn btn-primary flex-1 py-2.5 rounded-xl text-sm shadow-lg shadow-purple-600/30"
                  >
                    Confirm Listing
                  </button>
                </div>
              </>
            )}

            {manageInfo && (
              <>
                {manageInfo.type === 'sale' && (
                  <div className="form-group mb-0">
                    <label className="form-label">Update Price (ETH)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={price} 
                      onChange={e => setPrice(e.target.value)} 
                      className="form-input" 
                    />
                  </div>
                )}

                <div className="flex gap-3 mt-2">
                  <button 
                    onClick={handleCancelListing} 
                    className="btn btn-outline flex-1 py-2.5 rounded-xl text-sm border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500 hover:text-red-300"
                  >
                    Cancel Listing
                  </button>
                  {manageInfo.type === 'sale' && (
                    <button 
                      onClick={handleUpdatePrice} 
                      className="btn btn-primary flex-1 py-2.5 rounded-xl text-sm shadow-lg shadow-cyan-600/30"
                    >
                      Update Price
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
