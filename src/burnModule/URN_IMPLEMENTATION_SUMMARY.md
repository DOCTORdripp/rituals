# URN Implementation Summary

## What Was Added

The burn module now supports **both full collections AND specific URN items**. This gives you flexibility in what players can burn.

## Key Changes

### 1. Updated `CollectionInfo` Interface
```typescript
interface CollectionInfo {
  type: 'collection' | 'urn'  // NEW: Type field
  address: string
  title: string
  imageUrl: string
  urn?: string                 // NEW: Full URN string
  tokenId?: string             // NEW: Token ID from URN
}
```

### 2. New Functions Added

#### `initCollectionFromURN(urn, fallbackImage?)`
Initialize a single item from a URN:
```typescript
const item = await initCollectionFromURN(
  'urn:decentraland:matic:collections-v2:0x8c0da3299e4e226213e8fbd5f8644cf1527e1949:0',
  'images/fallback.png'
)
```

#### `initCollectionsFromURNs(urns, fallbackImages?)`
Initialize multiple URN items at once:
```typescript
const items = await initCollectionsFromURNs([
  'urn:decentraland:matic:collections-v2:0x....:0',
  'urn:decentraland:matic:collections-v2:0x....:1'
])
```

### 3. Smart NFT Checking

The `checkUserNFTs()` function now handles both types:

**For Collections** (`type: 'collection'`):
- Calls `balanceOf()` to get total owned NFTs
- Enumerates tokens with `tokenOfOwnerByIndex()`
- Shows up to 12 owned NFTs

**For URNs** (`type: 'urn'`):
- Calls `ownerOf(tokenId)` to check specific token ownership
- Shows only that one NFT if owned
- Shows "no NFTs" if not owned

### 4. Image Fetching

**For URNs**, images are fetched from:
1. Decentraland Content Server: `https://peer.decentraland.org/lambdas/collections/contents/{urn}/thumbnail`
2. Blockchain metadata via `tokenURI(tokenId)`
3. Fallback image if all else fails

## Usage Examples

### Example 1: Full Collections (Current Behavior)
```typescript
import { setupNFTBurnSystem, initCollectionsFromContracts } from './burnModule'

executeTask(async () => {
  const collections = await initCollectionsFromContracts([
    '0xc494f4cdcf95de946a3e36d4cee7baf9c87f08de',
    '0x575d45501ef293066f772e2ec3093c6ab79ec462'
  ])
  
  setupNFTBurnSystem({
    contractAddress: '0xc494f4cdcf95de946a3e36d4cee7baf9c87f08de',
    testMode: false,
    enableCollectionSelection: true,
    collections: collections
  })
})
```

### Example 2: Specific URNs (NEW!)
```typescript
import { setupNFTBurnSystem, initCollectionsFromURNs } from './burnModule'

executeTask(async () => {
  const collections = await initCollectionsFromURNs([
    'urn:decentraland:matic:collections-v2:0x8c0da3299e4e226213e8fbd5f8644cf1527e1949:0',
    'urn:decentraland:matic:collections-v2:0x15e7a4712e1ba72ddc2adfc09591c443bacf114e:1'
  ])
  
  setupNFTBurnSystem({
    contractAddress: '0x8c0da3299e4e226213e8fbd5f8644cf1527e1949',
    testMode: false,
    enableCollectionSelection: true,
    collections: collections
  })
})
```

### Example 3: Mix Both (NEW!)
```typescript
import { 
  setupNFTBurnSystem, 
  initCollectionsFromContracts, 
  initCollectionFromURN 
} from './burnModule'

executeTask(async () => {
  // Full collection
  const fullCollection = await initCollectionsFromContracts([
    '0xc494f4cdcf95de946a3e36d4cee7baf9c87f08de'
  ])
  
  // Specific rare item
  const rareItem = await initCollectionFromURN(
    'urn:decentraland:matic:collections-v2:0x15e7a4712e1ba72ddc2adfc09591c443bacf114e:999'
  )
  
  // Combine them
  const collections = rareItem ? [...fullCollection, rareItem] : fullCollection
  
  setupNFTBurnSystem({
    contractAddress: '0xc494f4cdcf95de946a3e36d4cee7baf9c87f08de',
    testMode: false,
    enableCollectionSelection: true,
    collections: collections
  })
})
```

## Files Modified

1. **`src/burnModule/ui.tsx`**
   - Updated `CollectionInfo` interface with URN support
   - No UI changes needed (handled automatically)

2. **`src/burnModule/nftBurner.ts`**
   - Added `parseURN()` function
   - Added `initCollectionFromURN()` function
   - Added `initCollectionsFromURNs()` function
   - Updated `checkUserNFTs()` to handle both collection and URN types
   - Updated `initCollectionsFromContracts()` to set `type: 'collection'`

3. **`src/burnModule/index.ts`**
   - Exported new URN functions

4. **Documentation**
   - Created `URN_GUIDE.md` (comprehensive guide)
   - Updated `README.md` (added URN section)
   - Created this summary file

## Backward Compatibility

✅ **Fully backward compatible!** Existing code continues to work without changes.

Your current implementation using `initCollectionsFromContracts()` will continue to work exactly as before, now with `type: 'collection'` set automatically.

## Testing

All changes compile successfully with no linter errors. Build output:
```
[1/2] Bundling file ... ✅
[2/2] Running type checker ... ✅
Type checking completed without errors
```

## Next Steps

1. Test with `testMode: true` first
2. Try using specific URNs for your use case
3. See `URN_GUIDE.md` for more examples and use cases

## Use Cases

**Use URNs when:**
- You want to limit burning to specific items only
- Creating a quest that requires specific items
- Building a sacrifice system with curated items
- Allowing only certain editions/rarities

**Use Collections when:**
- You want to allow burning any NFT from a collection
- Building a general-purpose burn altar
- Accepting any item from specific collections

