'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { connectWallet } from '../utils/web3';
import toast from 'react-hot-toast';

export default function Navbar() {
  const pathname = usePathname();
  const [address, setAddress] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            setAddress(accounts[0]);
          }
        } catch (e) {
          console.error("Wallet check failed:", e);
        }

        window.ethereum.on?.('accountsChanged', (accounts) => {
          if (accounts.length > 0) {
            setAddress(accounts[0]);
          } else {
            setAddress('');
          }
        });
      }
    };
    checkConnection();
  }, []);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const signer = await connectWallet();
      const addr = await signer.getAddress();
      setAddress(addr);
      toast.success(`Connected: ${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`);
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const formatAddress = (addr) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const navLinks = [
    { name: 'Marketplace', href: '/' },
    { name: 'Tokenize Property', href: '/mint' },
    { name: 'My Portfolio', href: '/dashboard' },
  ];

  return (
    <nav className="glass-card flex items-center justify-between mb-8 sticky top-4 z-50 px-6 py-4 border-slate-700/50">
      <div className="flex items-center gap-10">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 group no-underline">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-cyan-500 p-[1.5px] flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:shadow-cyan-500/30 transition-all">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <svg className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-extrabold tracking-tight gradient-text">
              ESTATEX
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 -mt-1">
              RWA Protocol
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <div className="hidden md:flex items-center gap-2">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-purple-500/15 text-white border border-purple-500/40 shadow-sm shadow-purple-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Right Controls: Network Indicator + Wallet */}
      <div className="flex items-center gap-3">
        {/* Network Chip */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/60 text-xs font-medium text-slate-300">
          <span className="status-dot"></span>
          <span>Sepolia</span>
        </div>

        {/* Connect / Address */}
        {address ? (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 border border-cyan-500/40 text-sm font-semibold text-cyan-300 shadow-lg shadow-cyan-500/10">
            <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="mono text-xs">{formatAddress(address)}</span>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="btn btn-primary text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-purple-600/30"
          >
            {isConnecting ? (
              <div className="flex items-center gap-2">
                <div className="loader w-4 h-4 border-2"></div>
                <span>Connecting...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Connect Wallet</span>
              </div>
            )}
          </button>
        )}
      </div>
    </nav>
  );
}
