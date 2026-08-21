import './globals.css';
import { Toaster } from 'react-hot-toast';
import Navbar from '../components/Navbar';

export const metadata = {
  title: 'EstateX | Next-Gen Real Estate NFT Protocol',
  description: 'Tokenized Real Estate, Fractional RWA Investment, Daily Rentals, and Timed Auctions on Ethereum Sepolia.',
  keywords: 'Web3 Real Estate, RWA NFTs, Blockchain Property, Fractional Ownership, Sepolia Testnet, EstateX',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <Navbar />
        <main className="container py-8">
          {children}
        </main>
        
        {/* Footer */}
        <footer className="container py-12 mt-16 border-t border-slate-800/60 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-secondary">
          <div className="flex items-center gap-3">
            <span className="font-bold tracking-wider gradient-text text-lg">ESTATEX</span>
            <span className="text-xs text-muted">| Decentralized Real Estate Protocol</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-secondary">
            <span>Sepolia Network</span>
            <span>ERC-721 / ERC-2981</span>
            <span>IPFS Powered by Pinata</span>
          </div>
          <p className="text-xs text-muted">© 2026 EstateX Labs. All digital titles verified on-chain.</p>
        </footer>

        <Toaster 
          position="bottom-right" 
          toastOptions={{
            style: {
              background: '#0F172A',
              color: '#F8FAFC',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7), 0 0 15px rgba(139, 92, 246, 0.2)',
              borderRadius: '12px',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '14px',
            },
            success: {
              iconTheme: {
                primary: '#10B981',
                secondary: '#0F172A',
              },
            },
            error: {
              iconTheme: {
                primary: '#EF4444',
                secondary: '#0F172A',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
