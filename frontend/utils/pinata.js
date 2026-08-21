import axios from 'axios';

// IMPORTANT: In a production app, never expose your Pinata secret keys to the frontend.
// Since this is a test/demo, we'll proxy them through Next.js API routes or use them directly if configured in next.config.js for rapid prototyping.
// For Next.js client-side, environment variables need NEXT_PUBLIC_ prefix, 
// but since the original .env only had PINATA_API_KEY, we will need to create a Next.js API route to handle uploads securely, 
// OR we can pass it via env if explicitly allowed. Let's create an API route.

export const uploadFileToIPFS = async (file) => {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const res = await axios.post("/api/pinata/upload-file", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    
    return `ipfs://${res.data.IpfsHash}`;
  } catch (error) {
    console.error("Error uploading file to Pinata:", error);
    throw new Error("Failed to upload image to IPFS");
  }
};

export const uploadJSONToIPFS = async (jsonData) => {
  try {
    const res = await axios.post("/api/pinata/upload-json", jsonData, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    
    return `ipfs://${res.data.IpfsHash}`;
  } catch (error) {
    console.error("Error uploading JSON to Pinata:", error);
    throw new Error("Failed to upload metadata to IPFS");
  }
};

export const resolveIPFS = (url) => {
  if (!url) return '';
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/');
  }
  return url;
};
