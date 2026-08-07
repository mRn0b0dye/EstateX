const axios = require('axios');
require('dotenv').config({ path: '../.env' });

async function testServices() {
  console.log('====================================');
  console.log('🔍 Testing EstateX Third-Party Services');
  console.log('====================================\n');

  // 1. Test Sepolia RPC URL (Alchemy)
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) {
    console.error('❌ SEPOLIA_RPC_URL is missing in .env');
  } else {
    try {
      console.log('🔄 1. Testing Sepolia RPC Connection...');
      const response = await axios.post(rpcUrl, {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: []
      });
      if (response.data && response.data.result) {
        const blockNumHex = response.data.result;
        const blockNumDec = parseInt(blockNumHex, 16);
        console.log(`✅ Sepolia RPC works! Current Block Number: ${blockNumDec} (Hex: ${blockNumHex})`);
      } else {
        console.error('❌ Sepolia RPC returned unexpected response:', response.data);
      }
    } catch (err) {
      console.error('❌ Sepolia RPC connection failed:', err.message);
    }
  }
  console.log('\n------------------------------------\n');

  // 2. Test Etherscan API Key
  const etherscanKey = process.env.ETHERSCAN_API_KEY;
  if (!etherscanKey) {
    console.error('❌ ETHERSCAN_API_KEY is missing in .env');
  } else {
    try {
      console.log('🔄 2. Testing Etherscan API Key...');
      // Requesting block number by timestamp to verify API key using Etherscan API V2
      const url = `https://api.etherscan.io/v2/api?chainid=11155111&module=block&action=getblocknobytime&timestamp=1578364800&closest=before&apikey=${etherscanKey}`;
      const response = await axios.get(url);
      if (response.data && (response.data.status === '1' || response.data.status === 'success')) {
        console.log(`✅ Etherscan API Key works! Test response block: ${response.data.result}`);
      } else if (response.data && (response.data.message === 'NOTOK' || response.data.status === 'error')) {
        console.error(`❌ Etherscan API Key invalid: ${response.data.result}`);
      } else {
        console.error('❌ Etherscan API returned unexpected status:', response.data);
      }
    } catch (err) {
      console.error('❌ Etherscan API request failed:', err.message);
    }
  }
  console.log('\n------------------------------------\n');

  // 3. Test Pinata IPFS (JWT)
  const pinataJwt = process.env.PINATA_JWT;
  if (!pinataJwt) {
    console.error('❌ PINATA_JWT is missing in .env');
  } else {
    try {
      console.log('🔄 3. Testing Pinata IPFS Authentication (JWT)...');
      const response = await axios.get('https://api.pinata.cloud/data/testAuthentication', {
        headers: {
          Authorization: `Bearer ${pinataJwt}`
        }
      });
      if (response.status === 200 && response.data && response.data.message) {
        console.log(`✅ Pinata JWT authentication works! Message: "${response.data.message}"`);
      } else {
        console.error('❌ Pinata authenticated but got non-200 or empty response:', response.data);
      }
    } catch (err) {
      console.error('❌ Pinata JWT authentication failed:', err.response ? err.response.data : err.message);
    }
  }
  console.log('\n====================================');
}

testServices();
