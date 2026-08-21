'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getProvider, getContracts, formatEth, parseEth, connectWallet } from '../../../utils/web3';
import { NFT_CONTRACT_ADDRESS } from '../../../constants/addresses';
import { resolveIPFS } from '../../../utils/pinata';
import toast from 'react-hot-toast';

export default function PropertyDetail({ params }) {
  const { id } = params; // e.g. "listing-1", "auction-2", "rental-1"
  const [property, setProperty] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Interaction states
  const [bidAmount, setBidAmount] = useState('');
  const [rentDays, setRentDays] = useState('7');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const fetchDetails = async () => {
    try {
      setIsLoading(true);
      const provider = getProvider();
      if (!provider) return;

      const { nftContract, marketplaceContract } = await getContracts(provider);
      
      const parts = id.split('-');
      const type = parts[0];
      const itemId = parts[1];
      
      let item = {};
      let meta = {};
      let nftOwner = '';
      let isVerified = false;

      if (type === 'listing') {
        const listing = await marketplaceContract.getListing(itemId);
        const tokenUri = await nftContract.tokenURI(listing.tokenId);
        meta = await fetchMetadata(tokenUri);
        nftOwner = await nftContract.ownerOf(listing.tokenId);
        try { isVerified = await nftContract.isPropertyVerified(listing.tokenId); } catch (e) {}

        item = {
          ...listing,
          itemId,
          type,
          price: listing.price.toString(),
          seller: listing.seller,
          status: listing.status,
          tokenId: listing.tokenId.toString(),
        };
      } else if (type === 'auction') {
        const auction = await marketplaceContract.getAuction(itemId);
        const tokenUri = await nftContract.tokenURI(auction.tokenId);
        meta = await fetchMetadata(tokenUri);
        nftOwner = await nftContract.ownerOf(auction.tokenId);
        try { isVerified = await nftContract.isPropertyVerified(auction.tokenId); } catch (e) {}

        item = {
          ...auction,
          itemId,
          type,
          price: auction.startPrice.toString(),
          highestBid: auction.highestBid.toString(),
          highestBidder: auction.highestBidder,
          seller: auction.seller,
          status: auction.ended ? 1n : 0n,
          tokenId: auction.tokenId.toString(),
          endTime: auction.endTime.toString()
        };
      } else if (type === 'rental') {
        const rental = await marketplaceContract.getRental(itemId);
        const tokenUri = await nftContract.tokenURI(rental.tokenId);
        meta = await fetchMetadata(tokenUri);
        nftOwner = await nftContract.ownerOf(rental.tokenId);
        try { isVerified = await nftContract.isPropertyVerified(rental.tokenId); } catch (e) {}

        item = {
          ...rental,
          itemId,
          type,
          rentPerDay: rental.pricePerDay.toString(),
          seller: rental.landlord,
          tenant: rental.tenant,
          rentedUntil: rental.rentedUntil.toString(),
          status: rental.isListedForRent ? 0n : 1n,
          tokenId: rental.tokenId.toString(),
        };
      }

      setProperty({ ...item, metadata: meta, nftOwner, isVerified });
    } catch (error) {
      console.error(error);
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

  const handleAction = async (actionType) => {
    let toastId;
    try {
      setIsProcessing(true);
      toastId = toast.loading('Connecting wallet...');
      
      const signer = await connectWallet();
      const { marketplaceContract } = await getContracts(signer);

      if (actionType === 'buy') {
        toast.loading('Confirming property purchase...', { id: toastId });
        const tx = await marketplaceContract.buyProperty(property.itemId, { value: property.price });
        toast.loading('Awaiting block confirmation...', { id: toastId });
        await tx.wait();
        toast.success('Property Deed Acquired Successfully! 🎉', { id: toastId });
      } 
      else if (actionType === 'bid') {
        if (!bidAmount || parseFloat(bidAmount) <= 0) {
          throw new Error("Please enter a valid bid amount.");
        }
        toast.loading('Submitting on-chain bid...', { id: toastId });
        const weiValue = parseEth(bidAmount);
        const tx = await marketplaceContract.placeBid(property.itemId, { value: weiValue });
        toast.loading('Awaiting block confirmation...', { id: toastId });
        await tx.wait();
        toast.success('Bid Placed Successfully! 🔥', { id: toastId });
      }
      else if (actionType === 'rent') {
        const days = parseInt(rentDays);
        if (!days || days <= 0) throw new Error("Please enter at least 1 day.");
        
        toast.loading(`Processing rental lease for ${days} days...`, { id: toastId });
        const totalCost = BigInt(property.rentPerDay) * BigInt(days);
        const tx = await marketplaceContract.rentProperty(property.itemId, days, { value: totalCost });
        toast.loading('Awaiting block confirmation...', { id: toastId });
        await tx.wait();
        toast.success(`Lease Activated for ${days} Days! 💎`, { id: toastId });
      }

      fetchDetails();
    } catch (error) {
      console.error(error);
      if (toastId) toast.dismiss(toastId);
      toast.error(`Transaction failed: ${error.reason || error.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-28 gap-4">
        <div className="loader w-12 h-12 border-4"></div>
        <p className="text-sm text-slate-400">Loading verified digital deed...</p>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="glass-card text-center py-20 max-w-lg mx-auto">
        <h2 className="text-2xl font-bold text-white mb-2">Property Not Found</h2>
        <p className="text-slate-400 text-sm mb-6">The requested listing ID could not be loaded from the protocol.</p>
        <Link href="/" className="btn btn-primary px-6 py-2.5 rounded-xl text-sm">
          Return to Marketplace
        </Link>
      </div>
    );
  }

  const imageUrl = resolveIPFS(property.metadata?.image);
  const now = Math.floor(Date.now() / 1000);
  const isAuctionActive = property.type === 'auction' && !property.ended && BigInt(property.endTime) > BigInt(now);

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
        <Link href="/" className="hover:text-white transition-colors">Marketplace</Link>
        <span>/</span>
        <span className="text-purple-300">Property #{property.tokenId}</span>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Image Showcase & Provenance (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <div className="glass-card p-2 relative overflow-hidden group">
            <div className="relative w-full rounded-xl overflow-hidden bg-slate-950" style={{ height: '340px', maxHeight: '340px' }}>
              {imageUrl ? (
                <img 
                  src={imageUrl} 
                  alt={property.metadata?.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-500">
                  No preview available
                </div>
              )}

              {/* Status Badge overlay */}
              <div className="absolute top-4 left-4 z-10">
                {property.type === 'listing' && <span className="badge badge-cyan">⚡ For Sale</span>}
                {property.type === 'auction' && <span className="badge badge-lavender">🔥 Timed Auction</span>}
                {property.type === 'rental' && <span className="badge badge-mint">💎 Daily Rental</span>}
              </div>

              {/* Token ID Chip */}
              <div className="absolute top-4 right-4 z-10 px-3 py-1 rounded-lg bg-slate-950/80 backdrop-blur-md border border-white/10 text-xs font-mono text-cyan-300">
                Token #{property.tokenId}
              </div>
            </div>
          </div>

          {/* On-Chain Verification Card */}
          <div className="glass-card p-6 flex flex-col gap-4 border-purple-500/30">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white uppercase tracking-wider text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                On-Chain Verification
              </h3>
              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                Verified Deed
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-slate-500 block mb-1 text-[11px]">Owner Address</span>
                <span className="mono text-slate-300 truncate block text-xs" title={property.nftOwner}>
                  {property.nftOwner ? `${property.nftOwner.substring(0, 8)}...${property.nftOwner.substring(property.nftOwner.length - 6)}` : 'Unknown'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-slate-500 block mb-1 text-[11px]">Token Standard</span>
                <span className="text-slate-300 font-semibold text-xs">ERC-721 + ERC-2981</span>
              </div>
            </div>

            {/* NFT Asset Address & Verification Button */}
            <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/30 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-purple-300 block mb-0.5">
                    NFT Asset Address (Token #{property.tokenId})
                  </span>
                  <span className="mono text-xs text-cyan-300 break-all font-semibold">
                    {NFT_CONTRACT_ADDRESS}
                  </span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${NFT_CONTRACT_ADDRESS}`);
                    toast.success("NFT Address Copied to Clipboard!");
                  }}
                  className="btn btn-secondary py-1 px-2.5 text-[11px] rounded-lg text-slate-300 hover:text-white"
                  title="Copy NFT Address"
                >
                  📋 Copy
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-purple-500/20">
                <a 
                  href={`https://sepolia.etherscan.io/nft/${NFT_CONTRACT_ADDRESS}/${property.tokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary py-1.5 px-3 text-xs rounded-lg flex items-center gap-1.5 flex-1 justify-center shadow-sm"
                >
                  <span>Verify NFT #{property.tokenId} on Etherscan</span>
                  <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Details & Interactive Transaction Console (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <div className="glass-card p-6 flex flex-col gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-[10px] uppercase font-bold tracking-wider text-purple-300">
                  Verified Real Estate Deed
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-2">
                {property.metadata?.name || `Property #${property.tokenId}`}
              </h1>
              <p className="text-sm text-slate-400 flex items-center gap-1.5">
                <svg style={{ width: 14, height: 14, flexShrink: 0 }} className="text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{property.metadata?.location || 'Digital Title'}</span>
              </p>
            </div>

            {/* Spec Chips */}
            <div className="grid grid-cols-3 gap-2.5">
              {property.metadata?.attributes?.map((attr, i) => (
                <div key={i} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">{attr.trait_type}</span>
                  <span className="text-sm font-bold text-white">{attr.value}</span>
                </div>
              ))}
            </div>

            {/* Description */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Overview</h4>
              <p className="text-xs md:text-sm text-slate-300 leading-relaxed bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
                {property.metadata?.description || "No architectural summary provided for this title."}
              </p>
            </div>

            {/* Interactive Transaction Box */}
            <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-purple-500/30 shadow-xl shadow-purple-950/30 flex flex-col gap-4">
              
              {/* FIXED PRICE SALE */}
              {property.type === 'listing' && (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-xs text-slate-400 block mb-1">Buyout Price</span>
                      <span className="text-3xl font-extrabold gradient-text">{formatEth(property.price)} ETH</span>
                    </div>
                    <span className="text-xs text-slate-400">Instant on-chain transfer</span>
                  </div>

                  <button 
                    onClick={() => handleAction('buy')} 
                    disabled={isProcessing || property.status !== 0n} 
                    className="btn btn-primary py-3.5 text-base rounded-xl w-full shadow-lg shadow-purple-600/30"
                  >
                    {isProcessing ? 'Confirming...' : (property.status === 0n ? 'Acquire Digital Title' : 'Sold Out')}
                  </button>
                </div>
              )}

              {/* TIMED AUCTION */}
              {property.type === 'auction' && (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-xs text-slate-400 block mb-1">Highest Active Bid</span>
                      <span className="text-3xl font-extrabold text-purple-400">
                        {formatEth(property.highestBid > 0 ? property.highestBid : property.price)} ETH
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block mb-1">Auction Status</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-md ${isAuctionActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                        {isAuctionActive ? 'Active' : 'Closed'}
                      </span>
                    </div>
                  </div>

                  {isAuctionActive ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          step="0.01" 
                          placeholder="Bid in ETH (e.g. 1.5)"
                          value={bidAmount}
                          onChange={e => setBidAmount(e.target.value)}
                          className="form-input text-sm py-3"
                        />
                        <button 
                          onClick={() => handleAction('bid')} 
                          disabled={isProcessing} 
                          className="btn btn-primary px-6 py-3 whitespace-nowrap rounded-xl text-sm"
                        >
                          {isProcessing ? '...' : 'Place Bid'}
                        </button>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Requires minimum +5% over previous highest bid. Outbid funds are safely refundable.
                      </span>
                    </div>
                  ) : (
                    <button disabled className="btn btn-secondary py-3 text-sm rounded-xl w-full">
                      Auction Finalized
                    </button>
                  )}
                </div>
              )}

              {/* RENTAL LEASE */}
              {property.type === 'rental' && (
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <span className="text-xs text-slate-400 block mb-1">Rental Rate</span>
                      <span className="text-3xl font-extrabold text-emerald-400">{formatEth(property.rentPerDay)} ETH</span>
                      <span className="text-xs text-slate-500 ml-1">/ day</span>
                    </div>
                    {property.rentedUntil && BigInt(property.rentedUntil) > BigInt(now) && (
                      <span className="text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30">
                        Leased until {new Date(Number(property.rentedUntil) * 1000).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {property.status === 0n && BigInt(property.rentedUntil || 0) <= BigInt(now) ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-grow">
                          <label className="text-[11px] text-slate-400 block mb-1">Number of Days</label>
                          <input 
                            type="number" 
                            min="1" 
                            value={rentDays} 
                            onChange={e => setRentDays(e.target.value)} 
                            className="form-input text-sm py-2.5" 
                          />
                        </div>
                        <div className="text-right">
                          <label className="text-[11px] text-slate-400 block mb-1">Total Lease Cost</label>
                          <span className="text-sm font-bold text-white mono">
                            {formatEth((BigInt(property.rentPerDay || 0) * BigInt(rentDays || 1)).toString())} ETH
                          </span>
                        </div>
                      </div>

                      <button 
                        onClick={() => handleAction('rent')} 
                        disabled={isProcessing} 
                        className="btn btn-primary py-3 text-sm rounded-xl w-full shadow-lg shadow-purple-600/30"
                      >
                        {isProcessing ? 'Processing...' : `Rent for ${rentDays} Days`}
                      </button>
                    </div>
                  ) : (
                    <button disabled className="btn btn-secondary py-3 text-sm rounded-xl w-full">
                      Currently Occupied by Tenant
                    </button>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
