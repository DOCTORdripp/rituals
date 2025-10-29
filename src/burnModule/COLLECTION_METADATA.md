# Dynamic Collection Metadata Fetching

## Overview

The burn module now supports **dynamic fetching** of collection metadata directly from the blockchain. This means collection names and images are automatically retrieved from smart contracts instead of being hardcoded.

## How It Works

The system fetches collection metadata using a multi-tier approach:

1. **Decentraland Content Server (Primary)** - Uses DCL's official collection API
   - URL: `https://peer.decentraland.org/lambdas/collections/contents/urn:decentraland:matic:collections-v2:{address}:0/thumbnail`
   - Most reliable for Decentraland-deployed collections
   - Fast and cached by DCL infrastructure

2. **Blockchain `contractURI()` (Fallback 1)** - ERC-721 collection-level metadata
3. **Blockchain `tokenURI(0)` (Fallback 2)** - Individual token metadata
4. **Blockchain `name()` (Fallback 3)** - Just the collection name
5. **Local fallback images (Last resort)** - Your provided images if all else fails

### Supported Metadata Sources

- ✅ **Decentraland Content Server** - Primary source for DCL collections
- ✅ **HTTP/HTTPS URLs** - Direct metadata JSON endpoints
- ✅ **IPFS URLs** - Automatically converts `ipfs://` to HTTP gateway
- ✅ **Data URIs** - Base64-encoded JSON metadata
- ✅ **Contract name()** - Collection name from blockchain

## Usage

### Automatic (Recommended)

```typescript
import { setupNFTBurnSystem, initCollectionsFromContracts } from './burnModule'

// Fetch collections dynamically on startup
executeTask(async () => {
  const collections = await initCollectionsFromContracts(
    [
      '0xc494f4cdcf95de946a3e36d4cee7baf9c87f08de',
      '0x575d45501ef293066f772e2ec3093c6ab79ec462'
    ],
    // Optional: fallback images if blockchain fetch fails
    ['images/collection1.png', 'images/collection2.png']
  )
  
  setupNFTBurnSystem({
    contractAddress: '0xc494f4cdcf95de946a3e36d4cee7baf9c87f08de',
    testMode: false,
    enableCollectionSelection: true,
    collections: collections
  })
})
```

### Manual (If you prefer hardcoded values)

```typescript
setupNFTBurnSystem({
  contractAddress: '0xc494f4cdcf95de946a3e36d4cee7baf9c87f08de',
  testMode: false,
  enableCollectionSelection: true,
  collections: [
    {
      address: '0xc494f4cdcf95de946a3e36d4cee7baf9c87f08de',
      title: 'My Cool NFTs',
      imageUrl: 'images/collection1.png'
    },
    {
      address: '0x575d45501ef293066f772e2ec3093c6ab79ec462',
      title: 'Other NFTs',
      imageUrl: 'images/collection2.png'
    }
  ]
})
```

## Benefits

### Dynamic Approach ✨
- ✅ Automatically gets collection names
- ✅ Automatically gets collection images
- ✅ No manual updates needed
- ✅ Works with any ERC-721 contract
- ✅ IPFS support built-in
- ⚠️ Requires network calls on startup (slight delay)

### Manual Approach 🔧
- ✅ Instant display (no network delay)
- ✅ Full control over names/images
- ⚠️ Requires manual updates
- ⚠️ Need to host/provide images yourself

## Metadata JSON Format

Your NFT contract's metadata should follow this standard format:

```json
{
  "name": "Collection Name",
  "description": "Collection description",
  "image": "ipfs://QmXxx.../image.png",
  "external_link": "https://...",
  ...
}
```

The system will extract:
- `name` or `title` → Collection title
- `image` → Collection image URL (auto-converts IPFS URLs)

## Troubleshooting

### No Image Showing?
- Check if contract implements `contractURI()` or `tokenURI()`
- Verify metadata JSON has `image` field
- Check console for fetch errors
- Ensure IPFS URLs are accessible
- Use fallback images as backup

### Wrong Name?
- Contract's `name()` function takes priority if metadata fails
- Override by using manual configuration

### Slow Loading?
- Network calls happen on scene startup
- Consider using manual config for instant display
- Fallback images display immediately if fetch fails

## Example Contract Methods

Your NFT contract should implement one of these:

```solidity
// Option 1: Collection-level metadata (best)
function contractURI() public view returns (string memory) {
    return "https://api.example.com/collection-metadata.json";
}

// Option 2: Token-level metadata (fallback)
function tokenURI(uint256 tokenId) public view returns (string memory) {
    return string(abi.encodePacked("ipfs://QmXxx/", tokenId.toString()));
}

// Option 3: Just the name (minimal)
function name() public view returns (string memory) {
    return "My NFT Collection";
}
```

## Notes

- Metadata fetching happens **asynchronously** on scene load
- Fallback images ensure UI always shows something
- IPFS URLs are automatically converted to `https://ipfs.io/ipfs/...`
- The system is compatible with OpenSea metadata standards


