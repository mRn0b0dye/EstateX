'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getProvider, getContracts, formatEth, connectWallet } from '../utils/web3';
import PropertyCard from '../components/PropertyCard';
import toast from 'react-hot-toast';

export default function Home() {
  const [properties, setProperties] = useState([]);
  const [filteredProperties, setFilteredProperties] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all'); // all, sale, auction, rental
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Wallet info for sidebar dashboard
  const [address, setAddress] = useState('');
  const [balance, setBalance] = useState('0.0');
  const [ownedCount, setOwnedCount] = useState(0);

  useEffect(() => {
    fetchMarketplace();
    checkWalletConnection();
  }, []);

  useEffect(() => {
    filterItems();
  }, [properties, activeFilter, searchQuery]);

  const checkWalletConnection = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          updateWalletStats(accounts[0]);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const updateWalletStats = async (userAddress) => {
    try {
      const provider = getProvider();
      if (!provider) return;
      const bal = await provider.getBalance(userAddress);
      setBalance(parseFloat(formatEth(bal)).toFixed(3));

      const { nftContract } = await getContracts(provider);
      const totalProps = await nftContract.getTotalProperties();
      let count = 0;
      for (let i = 1; i <= Number(totalProps); i++) {
        try {
          const owner = await nftContract.ownerOf(i);
          if (owner.toLowerCase() === userAddress.toLowerCase()) {
            count++;
          }
        } catch (e) {}
      }
      setOwnedCount(count);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSidebarConnect = async () => {
    try {
      const signer = await connectWallet();
      const addr = await signer.getAddress();
      setAddress(addr);
      updateWalletStats(addr);
      toast.success("Wallet Connected!");
    } catch (e) {
      toast.error(e.message || "Connection failed");
    }
  };

  const fetchMarketplace = async () => {
    try {
      setIsLoading(true);
      const provider = getProvider();
      if (!provider) {
        setIsLoading(false);
        return;
      }

      const { nftContract, marketplaceContract } = await getContracts(provider);

      // Fetch all items
      const listings = await marketplaceContract.getAllListings();
      const auctions = await marketplaceContract.getAllAuctions();
      const rentals = await marketplaceContract.getAllRentals();

      const items = [];
      const now = Math.floor(Date.now() / 1000);

      // Process Fixed Price Listings
      for (const listing of listings) {
        if (listing.status === 0n) {
          try {
            const tokenUri = await nftContract.tokenURI(listing.tokenId);
            const meta = await fetchMetadata(tokenUri);
            items.push({
              id: `listing-${listing.listingId}`,
              listingId: listing.listingId.toString(),
              nftContract: listing.nftContract,
              tokenId: listing.tokenId.toString(),
              price: listing.price.toString(),
              seller: listing.seller,
              status: listing.status,
              isAuction: false,
              isRental: false,
              metadata: meta,
            });
          } catch (e) {}
        }
      }

      // Process Auctions
      for (const auction of auctions) {
        if (!auction.ended && auction.endTime > BigInt(now)) {
          try {
            const tokenUri = await nftContract.tokenURI(auction.tokenId);
            const meta = await fetchMetadata(tokenUri);
            items.push({
              id: `auction-${auction.auctionId}`,
              listingId: auction.auctionId.toString(),
              nftContract: auction.nftContract,
              tokenId: auction.tokenId.toString(),
              price: auction.startPrice.toString(),
              highestBid: auction.highestBid.toString(),
              seller: auction.seller,
              status: 0n,
              isAuction: true,
              isRental: false,
              metadata: meta,
              endTime: auction.endTime.toString(),
            });
          } catch (e) {}
        }
      }

      // Process Rentals
      for (const rental of rentals) {
        if (rental.isListedForRent && rental.rentedUntil < BigInt(now)) {
          try {
            const tokenUri = await nftContract.tokenURI(rental.tokenId);
            const meta = await fetchMetadata(tokenUri);
            items.push({
              id: `rental-${rental.rentalId}`,
              listingId: rental.rentalId.toString(),
              nftContract: rental.nftContract,
              tokenId: rental.tokenId.toString(),
              rentPerDay: rental.pricePerDay.toString(),
              seller: rental.landlord,
              status: 0n,
              isAuction: false,
              isRental: true,
              metadata: meta,
            });
          } catch (e) {}
        }
      }

      setProperties(items);
    } catch (error) {
      console.error("Error fetching marketplace:", error);
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

  const filterItems = () => {
    let result = [...properties];

    if (activeFilter === 'sale') {
      result = result.filter(p => !p.isAuction && !p.isRental);
    } else if (activeFilter === 'auction') {
      result = result.filter(p => p.isAuction);
    } else if (activeFilter === 'rental') {
      result = result.filter(p => p.isRental);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.metadata?.name?.toLowerCase().includes(query) ||
        p.metadata?.location?.toLowerCase().includes(query) ||
        p.tokenId?.toString().includes(query)
      );
    }

    setFilteredProperties(result);
  };

  return (
    <div className="flex flex-col gap-10">
      {/* Hero Section */}
      <div className="text-center py-6 max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight leading-tight">
          Discover Premium Real Estate on the <span className="gradient-text">Blockchain</span>
        </h1>
        <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto mb-6">
          Tokenize physical property titles, collect daily on-chain rental yields, and participate in decentralized timed auctions on Ethereum Sepolia.
        </p>
        <div className="flex items-center justify-center gap-4">
          <a href="#catalog" className="btn btn-primary px-6 py-2.5 rounded-xl text-sm shadow-lg shadow-purple-600/25">
            Explore Properties
          </a>
          <Link href="/mint" className="btn btn-secondary px-6 py-2.5 rounded-xl text-sm">
            Tokenize Property
          </Link>
        </div>
      </div>

      {/* Grid Layout */}
      <div id="catalog" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Gallery & Filters (Takes 8 Cols out of 12) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-2xl font-bold text-white tracking-tight">Gallery</h2>
            
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <svg style={{ width: 16, height: 16 }} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search location, name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="form-input pl-9 py-2 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2.5 overflow-x-auto pb-2 relative z-10">
            {[
              { id: 'all', label: 'All Properties' },
              { id: 'sale', label: '⚡ Buy Now' },
              { id: 'auction', label: '🔥 Auction' },
              { id: 'rental', label: '💎 Rental' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveFilter(tab.id);
                  toast.success(`Filter set to: ${tab.label}`);
                }}
                className={`tag-pill ${activeFilter === tab.id ? 'tag-pill-active' : 'tag-pill-inactive'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Listings 2-Column Grid (Compact Card Size) */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="loader w-8 h-8 border-4"></div>
              <p className="text-xs text-slate-400">Syncing contract deeds...</p>
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="glass-card text-center py-16 px-4">
              <h3 className="text-lg font-bold text-white mb-2">No Listings Found</h3>
              <p className="text-xs text-slate-400 mb-4">
                No properties are currently listed under <strong>{
                  activeFilter === 'sale' ? 'Buy Now' : 
                  activeFilter === 'auction' ? 'Auctions' : 
                  activeFilter === 'rental' ? 'Rentals' : 'All Properties'
                }</strong>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredProperties.map(prop => (
                <PropertyCard key={prop.id} property={prop} />
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: User Dashboard Panel (Takes 4 Cols out of 12) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <h2 className="text-xl font-bold text-white tracking-tight text-right lg:text-left">User Dashboard</h2>

          <div className="glass-card p-5 flex flex-col gap-5 border-purple-500/25">
            {address ? (
              <>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Wallet Address</span>
                  <div className="flex items-center gap-1.5 p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>{address.substring(0, 6)}...{address.substring(address.length - 4)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Balance</span>
                    <span className="text-base font-extrabold text-white">{balance} ETH</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">My Assets</span>
                    <span className="text-base font-extrabold text-purple-300">{ownedCount} Titles</span>
                  </div>
                </div>

                <Link href="/dashboard" className="btn btn-secondary w-full py-2.5 text-xs rounded-xl text-center">
                  Open Portfolio Dashboard
                </Link>
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-slate-400 mb-4">Connect your wallet to see quick stats.</p>
                <button onClick={handleSidebarConnect} className="btn btn-primary w-full py-2.5 text-xs rounded-xl shadow-md">
                  Connect Wallet
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
