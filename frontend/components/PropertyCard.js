import Link from 'next/link';
import { resolveIPFS } from '../utils/pinata';
import { formatEth } from '../utils/web3';

export default function PropertyCard({ property }) {
  const imageUrl = resolveIPFS(property.image || property.metadata?.image);
  
  const renderPrice = () => {
    if (property.isRental) {
      return (
        <span className="flex items-baseline gap-1">
          <span className="text-xl font-extrabold text-emerald-400">{formatEth(property.rentPerDay)} ETH</span>
          <span className="text-xs text-slate-400 font-normal">/ day</span>
        </span>
      );
    }
    if (property.isAuction) {
      const highest = property.highestBid > 0 ? property.highestBid : property.price;
      return (
        <span className="flex items-baseline gap-1">
          <span className="text-xl font-extrabold text-purple-400">{formatEth(highest)} ETH</span>
          <span className="text-xs text-slate-400 font-normal">top bid</span>
        </span>
      );
    }
    return (
      <span className="text-xl font-extrabold text-cyan-400">{formatEth(property.price)} ETH</span>
    );
  };

  const renderStatus = () => {
    if (property.status === 0n) {
      if (property.isAuction) return <span className="badge badge-lavender">🔥 Timed Auction</span>;
      if (property.isRental) return <span className="badge badge-mint">💎 For Rent</span>;
      return <span className="badge badge-cyan">⚡ Buy Now</span>;
    }
    if (property.status === 1n) return <span className="badge badge-gray">Sold Out</span>;
    if (property.status === 2n) return <span className="badge badge-gray">Cancelled</span>;
    return null;
  };

  // Find attributes
  const attrs = property.metadata?.attributes || [];
  const beds = attrs.find(a => a.trait_type?.toLowerCase().includes('bed'))?.value;
  const baths = attrs.find(a => a.trait_type?.toLowerCase().includes('bath'))?.value;
  const area = attrs.find(a => a.trait_type?.toLowerCase().includes('area'))?.value;

  return (
    <div className="glass-card flex flex-col p-4 group transition-all duration-300 hover:border-purple-500/40">
      {/* Property Image Container */}
      <div className="relative w-full rounded-xl overflow-hidden bg-slate-900 mb-4 flex-none" style={{ height: '180px', minHeight: '180px' }}>
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={property.metadata?.name || 'Property'} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900/80">
            <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
            <span className="text-xs">No media preview</span>
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-3 left-3 z-10">
          {renderStatus()}
        </div>

        {/* Token ID Chip */}
        <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-white/10 text-[11px] font-mono text-slate-300">
          #{property.tokenId?.toString()}
        </div>

        {/* Specs Pills Overlay */}
        {(beds || baths || area) && (
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between z-10">
            <div className="flex gap-1.5">
              {beds && (
                <span className="px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md border border-white/10 text-[10px] font-bold text-slate-200">
                  {beds} BEDS
                </span>
              )}
              {baths && (
                <span className="px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md border border-white/10 text-[10px] font-bold text-slate-200">
                  {baths} BATHS
                </span>
              )}
            </div>
            {area && (
              <span className="px-2 py-0.5 rounded-md bg-slate-950/80 backdrop-blur-md border border-white/10 text-[10px] font-bold text-cyan-300">
                {area} SQFT
              </span>
            )}
          </div>
        )}

        {/* Gradient shadow for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent pointer-events-none"></div>
      </div>
      
      {/* Content */}
      <div className="flex flex-col flex-grow">
        <h3 className="text-lg font-bold text-white truncate mb-1 group-hover:text-purple-300 transition-colors" title={property.metadata?.name}>
          {property.metadata?.name || `Real Estate Title #${property.tokenId?.toString()}`}
        </h3>
        
        <p className="text-xs text-slate-400 flex items-center gap-1.5 truncate mb-4" title={property.metadata?.location}>
          <svg style={{ width: 14, height: 14, flexShrink: 0 }} className="text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{property.metadata?.location || 'Digital Title (Sepolia)'}</span>
        </p>

        {/* Price */}
        <div className="mt-auto pt-3 flex items-center justify-between mb-4 border-t border-slate-800/80">
          <span className="text-xs font-bold text-slate-500">
            {property.isRental ? 'Daily Rate' : (property.isAuction ? 'Current Bid' : 'Price')}
          </span>
          {renderPrice()}
        </div>

        <Link 
          href={`/property/${property.id}`} 
          className="btn btn-primary w-full py-2.5 text-xs"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}
