# URN Support Guide

The Burn Module now supports both **full collections** and **specific URN items**. This allows you to:
1. Scan all NFTs from an entire collection (original behavior)
2. Allow burning only specific NFT items by their URN

## What's a URN?

A URN (Uniform Resource Name) is Decentraland's identifier for NFT items. Format:
```
urn:decentraland:matic:collections-v2:{contractAddress}:{tokenId}
```

Example:
```
urn:decentraland:matic:collections-v2:0x8c0da3299e4e226213e8fbd5f8644cf1527e1949:0
```

## Usage Examples

### Option 1: Use Full Collections (Original Behavior)

This will scan all NFTs the user owns from the specified collections:

```typescript
import { setupNFTBurnSystem, makeBurnable, initCollectionsFromContracts } from './burnModule'

executeTask(async () => {
  const collections = await initCollectionsFromContracts(
    [
      '0xc494f4cdcf95de946a3e36d4cee7baf9c87f08de',
      '0x575d45501ef293066f772e2ec3093c6ab79ec462'
    ],
    ['images/doge.png', 'images/kersplat.png'] // Fallback images
  )
  
  setupNFTBurnSystem({
    contractAddress: '0xc494f4cdcf95de946a3e36d4cee7baf9c87f08de',
    testMode: false,
    enableCollectionSelection: true,
    collections: collections
  })
})
```

### Option 2: Use Specific URNs

This will only allow burning specific NFT items:

```typescript
import { setupNFTBurnSystem, makeBurnable, initCollectionsFromURNs } from './burnModule'

executeTask(async () => {
  const collections = await initCollectionsFromURNs(
    [
      'urn:decentraland:matic:collections-v2:0x8c0da3299e4e226213e8fbd5f8644cf1527e1949:0',
      'urn:decentraland:matic:collections-v2:0x15e7a4712e1ba72ddc2adfc09591c443bacf114e:1'
    ],
    ['images/item1.png', 'images/item2.png'] // Fallback images (optional)
  )
  
  setupNFTBurnSystem({
    contractAddress: '0x8c0da3299e4e226213e8fbd5f8644cf1527e1949', // Primary contract
    testMode: false,
    enableCollectionSelection: true,
    collections: collections
  })
})
```

### Option 3: Mix Collections and URNs

You can combine both approaches:

```typescript
import { 
  setupNFTBurnSystem, 
  makeBurnable, 
  initCollectionsFromContracts, 
  initCollectionFromURN 
} from './burnModule'

executeTask(async () => {
  // Get a full collection
  const fullCollections = await initCollectionsFromContracts(
    ['0xc494f4cdcf95de946a3e36d4cee7baf9c87f08de'],
    ['images/doge.png']
  )
  
  // Get a specific URN item
  const specificItem = await initCollectionFromURN(
    'urn:decentraland:matic:collections-v2:0x15e7a4712e1ba72ddc2adfc09591c443bacf114e:1',
    'images/kersplat.png'
  )
  
  // Combine them
  const collections = specificItem ? [...fullCollections, specificItem] : fullCollections
  
  setupNFTBurnSystem({
    contractAddress: '0xc494f4cdcf95de946a3e36d4cee7baf9c87f08de',
    testMode: false,
    enableCollectionSelection: true,
    collections: collections
  })
})
```

## How It Works

### For Collections (`type: 'collection'`)
1. User selects the collection
2. System calls `balanceOf()` to get how many NFTs the user owns
3. System calls `tokenOfOwnerByIndex()` to enumerate all owned tokens (up to 12)
4. Displays all owned NFTs for the user to select one to burn

### For URNs (`type: 'urn'`)
1. User selects the URN item
2. System calls `ownerOf(tokenId)` to check if the user owns this specific token
3. If owned, displays only that one NFT
4. If not owned, shows "no NFTs" message

## Image Fetching

### For Collections
- Tries Decentraland Content Server first: `https://peer.decentraland.org/lambdas/collections/wearables-by-owner/{userAddress}?collectionId={contractAddress}`
- Falls back to blockchain metadata (`contractURI()`, `tokenURI(0)`, `name()`)
- Uses fallback image if all else fails

### For URNs
- Uses Decentraland Content Server: `https://peer.decentraland.org/lambdas/collections/contents/{urn}/thumbnail`
- Also fetches NFT metadata via `tokenURI(tokenId)` from blockchain
- Uses fallback image if metadata fetch fails

## API Reference

### `initCollectionsFromContracts(addresses, fallbackImages?)`
Initialize collections from contract addresses (scans all owned NFTs)
- `addresses`: Array of contract addresses
- `fallbackImages`: Optional array of fallback image paths
- Returns: `Promise<CollectionInfo[]>`

### `initCollectionsFromURNs(urns, fallbackImages?)`
Initialize collections from URN strings (specific NFTs only)
- `urns`: Array of URN strings
- `fallbackImages`: Optional array of fallback image paths
- Returns: `Promise<CollectionInfo[]>`

### `initCollectionFromURN(urn, fallbackImage?)`
Initialize a single collection from one URN
- `urn`: URN string
- `fallbackImage`: Optional fallback image path
- Returns: `Promise<CollectionInfo | null>`

## CollectionInfo Type

```typescript
interface CollectionInfo {
  type: 'collection' | 'urn'  // Type of item
  address: string              // Contract address
  title: string                // Display title
  imageUrl: string             // Display image URL
  urn?: string                 // Full URN (only for type: 'urn')
  tokenId?: string             // Token ID (only for type: 'urn')
}
```

## Tips

1. **URNs are great for limited editions**: If you want to allow burning only specific items (e.g., "Sacrifice 1 of these 3 rare items"), use URNs

2. **Collections are great for bulk burns**: If you want to allow any NFT from a collection to be burned, use collections

3. **Test Mode**: Always test with `testMode: true` first to avoid burning real NFTs during development

4. **Image Fallbacks**: Always provide fallback images in case metadata fetch fails

5. **URN Format**: Make sure your URNs follow the correct format:
   ```
   urn:decentraland:{network}:collections-v2:{contractAddress}:{tokenId}
   ```

## Example Use Cases

### Use Case 1: Sacrifice Quest
Allow players to burn one of three specific quest items:
```typescript
const questItems = await initCollectionsFromURNs([
  'urn:decentraland:matic:collections-v2:0x....:42',  // Quest Item A
  'urn:decentraland:matic:collections-v2:0x....:43',  // Quest Item B
  'urn:decentraland:matic:collections-v2:0x....:44'   // Quest Item C
])
```

### Use Case 2: General Burn Altar
Allow players to burn any NFT from two collections:
```typescript
const collections = await initCollectionsFromContracts([
  '0x....',  // Collection A
  '0x....'   // Collection B
])
```

### Use Case 3: Mixed Requirements
Allow burning any item from Collection A, OR a specific legendary item from Collection B:
```typescript
const collectionA = await initCollectionsFromContracts(['0x....'])
const legendaryItem = await initCollectionFromURN('urn:decentraland:matic:collections-v2:0x....:999')
const combined = [...collectionA, legendaryItem]
```

## Troubleshooting

**Q: URN image not showing?**
- Verify the URN format is correct
- Check if the item exists in Decentraland's content server
- Provide a fallback image

**Q: "User does not own this NFT" even though they do?**
- Verify the contract address in the URN matches the actual contract
- Check if the token ID is correct
- Make sure the user's wallet is connected

**Q: Can I use mainnet URNs?**
- The current implementation uses Polygon (matic). For mainnet, you'll need to update the RPC URL and chain ID in the config

