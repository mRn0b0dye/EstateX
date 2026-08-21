'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { connectWallet, getContracts } from '../../utils/web3';

export default function MintProperty() {
  const router = useRouter();
  const [isMinting, setIsMinting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    description: '',
    beds: '',
    baths: '',
    area: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imageFile) {
      toast.error('Please upload a property photo.');
      return;
    }

    let toastId;
    try {
      setIsMinting(true);
      toastId = toast.loading('Connecting wallet...');
      
      const signer = await connectWallet();
      const { nftContract } = await getContracts(signer);

      // 1. Upload Image to Pinata
      toast.loading('Pinning image to IPFS via Pinata...', { id: toastId });
      
      const imgFormData = new FormData();
      imgFormData.append("file", imageFile);

      const fileRes = await fetch("/api/pinata/upload-file", {
        method: "POST",
        body: imgFormData,
      });
      
      const fileData = await fileRes.json();
      if (!fileRes.ok) {
        throw new Error(fileData.error || "Image upload failed");
      }
      const imageUrl = `ipfs://${fileData.IpfsHash}`;

      // 2. Upload Metadata to Pinata
      toast.loading('Publishing metadata to IPFS...', { id: toastId });
      const metadata = {
        name: formData.name,
        description: formData.description,
        image: imageUrl,
        location: formData.location,
        attributes: [
          { trait_type: 'Beds', value: formData.beds },
          { trait_type: 'Baths', value: formData.baths },
          { trait_type: 'Area (sq ft)', value: formData.area },
          { trait_type: 'Standard', value: 'ERC-721' },
          { trait_type: 'Network', value: 'Sepolia' },
        ]
      };

      const jsonRes = await fetch("/api/pinata/upload-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      });
      
      const jsonData = await jsonRes.json();
      if (!jsonRes.ok) {
        throw new Error(jsonData.error || "Metadata upload failed");
      }
      const tokenUri = `ipfs://${jsonData.IpfsHash}`;

      // 3. Mint NFT
      toast.loading('Confirming transaction on Sepolia...', { id: toastId });
      const tx = await nftContract.mintProperty(tokenUri);
      
      toast.loading('Awaiting block confirmation...', { id: toastId });
      await tx.wait();

      toast.success('Property Tokenized Successfully! 🎉', { id: toastId });
      router.push('/dashboard');

    } catch (error) {
      console.error("Minting Error Detailed:", error);
      if (toastId) toast.dismiss(toastId);
      toast.error(`Minting failed: ${error.reason || error.message || 'Unknown error'}`);
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6">
      <div className="glass-card p-8 md:p-10 border-slate-700/60 shadow-2xl relative">
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-xs font-semibold text-cyan-300 mb-3">
            <span>✨ ERC-721 Digital Title Minting</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-2">
            Tokenize <span className="gradient-text">Real Estate</span>
          </h1>
          <p className="text-sm text-slate-400">
            Convert a real-world physical deed into an immutable on-chain token with decentralized IPFS metadata.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Property Image Box */}
          <div className="form-group">
            <label className="form-label flex items-center justify-between">
              <span>Property Imagery</span>
              <span className="text-xs text-slate-400 font-normal">PNG, JPG, WEBP (Max 5MB)</span>
            </label>
            
            <div className="relative w-full h-56 rounded-xl overflow-hidden border-2 border-dashed border-slate-700/80 bg-slate-900/60 hover:border-purple-500/50 hover:bg-slate-900/90 transition-all flex items-center justify-center">
              {imagePreview ? (
                <div className="relative w-full h-full group">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button 
                      type="button" 
                      onClick={removeImage} 
                      className="px-4 py-2 rounded-lg text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 transition-all"
                    >
                      ✕ Remove Photo
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer p-6 text-center">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3 group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-white mb-1">
                    Click to upload property photo
                  </p>
                  <p className="text-xs text-slate-500">
                    Will be pinned to decentralized IPFS storage
                  </p>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                </label>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="form-group">
            <label className="form-label">Property Title</label>
            <input 
              required 
              type="text" 
              name="name" 
              value={formData.name} 
              onChange={handleInputChange} 
              className="form-input" 
              placeholder="e.g. Celestial Horizon Penthouse | Dubai Marina" 
            />
          </div>

          {/* Location */}
          <div className="form-group">
            <label className="form-label">Physical Location & Address</label>
            <input 
              required 
              type="text" 
              name="location" 
              value={formData.location} 
              onChange={handleInputChange} 
              className="form-input" 
              placeholder="e.g. 88 Marina Boulevard, Dubai, UAE" 
            />
          </div>

          {/* Specifications */}
          <div className="grid grid-cols-3 gap-3">
            <div className="form-group">
              <label className="form-label">Bedrooms</label>
              <input 
                required 
                type="number" 
                name="beds" 
                value={formData.beds} 
                onChange={handleInputChange} 
                className="form-input" 
                placeholder="3" 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Bathrooms</label>
              <input 
                required 
                type="number" 
                name="baths" 
                value={formData.baths} 
                onChange={handleInputChange} 
                className="form-input" 
                placeholder="2" 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Area (sq ft)</label>
              <input 
                required 
                type="number" 
                name="area" 
                value={formData.area} 
                onChange={handleInputChange} 
                className="form-input" 
                placeholder="2450" 
              />
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">Architectural Overview & Amenities</label>
            <textarea 
              required 
              name="description" 
              value={formData.description} 
              onChange={handleInputChange} 
              className="form-textarea" 
              placeholder="Detail luxury finishes, smart home integrations, deed status, panoramic views..." 
            />
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={isMinting} 
            className="btn btn-primary mt-2 py-3.5 text-base w-full rounded-xl shadow-xl shadow-purple-600/30"
          >
            {isMinting ? (
              <div className="flex items-center gap-3">
                <div className="loader w-5 h-5 border-2"></div>
                <span>Tokenizing on Sepolia...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>Tokenize Property Title</span>
              </div>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
