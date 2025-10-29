# 🔥 NFT Burn Module

**A drop-in, modular system for burning NFTs in Decentraland scenes.**

Supports Polygon network with MetaMask integration. Completely self-contained and easy to integrate into any SDK7 scene.

**NEW:** Now supports both full collections AND specific URN items! See [URN_GUIDE.md](./URN_GUIDE.md) for details.

---

## 📦 Installation

### Step 1: Copy the Module

Copy the entire `burnModule` folder into your scene's `src/` directory:

```
your-scene/
  └── src/
      └── burnModule/          ← Drop this folder here
          ├── index.ts
          ├── nftBurner.ts
          ├── ui.tsx
          └── README.md
```

### Step 2: Import and Initialize

In your `src/index.ts`, add these imports at the top:

```typescript
import { setupNFTBurnSystem, makeBurnable } from './burnModule'
```

### Step 3: Configure in `main()`

Add this to your `main()` function:

```typescript
export function main() {
  // Initialize the NFT burn system
  setupNFTBurnSystem({
    contractAddress: '0xYourNFTContractAddress',  // ← CHANGE THIS!
    testMode: false  // Set to true for testing without real NFTs
  })
  
  // Your existing scene code...
}
```

### Step 4: Make Any Entity Burnable

Add burn functionality to any object:

```typescript
// Example: Make a skull burnable
const skull = engine.addEntity()
GltfContainer.create(skull, {
  src: 'models/skull.glb'
})
Transform.create(skull, {
  position: Vector3.create(8, 0, 8)
})

// This line makes it burnable!
makeBurnable(skull, 'Burn NFT 🔥')
```

**That's it!** Your scene now has NFT burning functionality.

---

## ✨ Key Features

### 🎯 Real-Time Transaction Monitoring
- **Automatic confirmation tracking** - System waits for blockchain confirmation
- **Live status updates** - Shows transaction progress in real-time
- **User-friendly feedback** - Clear messaging at each step
- **Success notification** - Displays "MINT COMPLETE" message when done
- **No manual checking** - Users don't need to check Polygonscan

### 💎 Other Features
- **Polygon network support** with automatic network switching
- **MetaMask integration** for secure wallet transactions  
- **Test mode** for development without real NFTs
- **Multi-NFT support** - Display up to 8 NFTs per selection
- **Fully modular** - Drop into any SDK7 scene
- **Customizable UI** - Easy to modify colors and text

---

## ⚙️ Configuration Options

### Full Config Object

```typescript
setupNFTBurnSystem({
  contractAddress: '0xYourNFTContract',  // Required
  burnAddress: '0x000000000000000000000000000000000000dead',  // Optional (default shown)
  chainId: 137,  // Optional (Polygon mainnet, default)
  rpcUrl: 'https://polygon-rpc.com',  // Optional (default shown)
  testMode: false  // Optional (default false)
})
```

### Configuration Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `contractAddress` | string | ✅ Yes | - | Your NFT contract address on Polygon |
| `burnAddress` | string | No | `0x...dead` | Address to send burned NFTs |
| `chainId` | number | No | `137` | Polygon = 137 |
| `rpcUrl` | string | No | `https://polygon-rpc.com` | RPC endpoint |
| `testMode` | boolean | No | `false` | Enable test mode (fake NFTs) |

---

## 🎯 URN Support (NEW!)

You can now burn specific URN items instead of entire collections!

### Burn Specific URN Items

```typescript
import { setupNFTBurnSystem, makeBurnable, initCollectionsFromURNs } from './burnModule'
import { executeTask } from '@dcl/sdk/ecs'

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

**See [URN_GUIDE.md](./URN_GUIDE.md) for complete URN documentation and examples.**

---

## 🎮 Usage Examples

### Example 1: Basic Setup

```typescript
import { engine } from '@dcl/sdk/ecs'
import { setupNFTBurnSystem, makeBurnable } from './burnModule'

export function main() {
  setupNFTBurnSystem({
    contractAddress: '0xc494f4cdcf95de946a3e36d4cee7baf9c87f08de'
  })
  
  const altar = engine.addEntity()
  // ... create your altar ...
  makeBurnable(altar, 'Sacrifice NFT')
}
```

### Example 2: Multiple Burnable Objects

```typescript
export function main() {
  setupNFTBurnSystem({
    contractAddress: '0xYourContract'
  })
  
  // Fire pit
  const firePit = engine.addEntity()
  makeBurnable(firePit, 'Burn NFT in Fire')
  
  // Altar
  const altar = engine.addEntity()
  makeBurnable(altar, 'Sacrifice to Gods')
  
  // Portal
  const portal = engine.addEntity()
  makeBurnable(portal, 'Send Through Portal')
}
```

### Example 3: Use Existing Scene Entities

```typescript
import { EntityNames } from '../assets/scene/entity-names'

export function main() {
  setupNFTBurnSystem({
    contractAddress: '0xYourContract'
  })
  
  // Make existing scene entities burnable
  const skull = engine.getEntityOrNullByName(EntityNames.Skull)
  if (skull) {
    makeBurnable(skull, 'Touch the Skull')
  }
  
  const house = engine.getEntityOrNullByName(EntityNames.House)
  if (house) {
    makeBurnable(house, 'Enter to Burn')
  }
}
```

### Example 4: Test Mode

```typescript
export function main() {
  // Test mode shows fake NFTs - perfect for development!
  setupNFTBurnSystem({
    contractAddress: '0xYourContract',
    testMode: true  // ← Enables test mode
  })
  
  const testObject = engine.addEntity()
  makeBurnable(testObject, 'Test Burn (Demo Mode)')
}
```

---

## 🎯 User Experience Flow

### 1. Player Clicks Object
- Hover text appears: "Burn NFT" (or your custom text)
- System fetches their NFTs from Polygon

### 2. NFT Selection
- Modal shows list of NFTs they own (up to 8 displayed)
- Each shows Token ID
- Player clicks to select one

### 3. Confirmation
- Confirmation screen appears
- Shows selected Token ID
- Warning: "This action cannot be undone!"
- Back button or BURN button

### 4. Burn Transaction
- **MetaMask popup appears** (when deployed)
- Shows transaction details
- Player approves or rejects in their browser
- If approved → Transaction is submitted

### 5. Transaction Monitoring (NEW! 🎉)
- UI shows real-time status updates:
  - "Connecting to Polygon..."
  - "Awaiting wallet signature..."
  - "Transaction submitted! Confirming..."
- System polls blockchain every 2 seconds
- Waits for transaction confirmation (up to 2 minutes)
- **No need to stay on the browser tab!**

### 6. Completion
- When confirmed, displays:
  - **"MINT COMPLETE. CHECK YOUR WALLET TO SEE YOUR REWARD."**
- Green success screen with Close button
- NFT has been burned and reward may be minted

---

## 🧪 Testing

### Test Mode (Local Preview)

Set `testMode: true` to test the UI flow without real NFTs:

```typescript
setupNFTBurnSystem({
  contractAddress: '0xYourContract',
  testMode: true
})
```

This simulates 5 fake NFTs so you can test the selection UI and flow.

### Production Testing (MetaMask)

MetaMask integration **only works when deployed** to Decentraland:

1. Set `testMode: false`
2. Deploy your scene
3. Visit the deployed scene
4. Connect MetaMask
5. Test burning a real NFT

**Note**: MetaMask popup doesn't work in local preview due to sandbox security.

---

## 📋 Integration Checklist

After dropping in the `burnModule` folder:

- [ ] Imported `setupNFTBurnSystem` and `makeBurnable` in `src/index.ts`
- [ ] Called `setupNFTBurnSystem()` with your contract address
- [ ] Called `makeBurnable()` on at least one entity
- [ ] Set `testMode: true` for initial testing
- [ ] Tested clicking the object in local preview
- [ ] Verified the modal appears and works
- [ ] Set `testMode: false` for production
- [ ] Deployed to test MetaMask integration

---

## 🔧 Customization

### Change Modal Colors

Edit `burnModule/ui.tsx`:

**Title color** (line ~89):
```typescript
color: Color4.create(1, 0.3, 0.2, 1)  // Red
```

**Background color** (line ~76):
```typescript
color: Color4.create(0.15, 0.15, 0.15, 1)  // Dark gray
```

**Button colors**:
```typescript
// Cancel button (line ~185)
color: Color4.create(0.3, 0.3, 0.3, 1)  // Gray

// Burn button (line ~200)
color: Color4.create(0.8, 0.2, 0.1, 1)  // Red
```

### Change Modal Text

Edit these values in `burnModule/ui.tsx`:

- Title: `'🔥 Select NFT to Burn'` (line ~87)
- Warning: `'⚠️ This action cannot be undone!'` (line ~161)
- Button text: `'BURN'` and `'Cancel'` (lines ~203, ~229)

### Add Custom Logic

```typescript
import { burnNFT, getUserNFTs } from './burnModule'

// Get list of user's NFTs
const nfts = getUserNFTs()

// Manually burn an NFT
const success = await burnNFT({
  tokenId: '12345',
  contractAddress: '0xYourContract'
})
```

---

## 🚀 Deployment

### For Genesis City

1. Remove `worldConfiguration` from `scene.json` if present
2. Deploy normally: `npm run deploy`

### For Decentraland World

Add this to `scene.json`:

```json
{
  "worldConfiguration": {
    "name": "YourName.dcl.eth"
  }
}
```

Then deploy:
```bash
npm run deploy -- --target-content https://worlds-content-server.decentraland.org
```

---

## 📊 Technical Details

### Network
- **Blockchain**: Polygon (Chain ID 137)
- **RPC**: https://polygon-rpc.com
- **Explorer**: https://polygonscan.com

### Smart Contract Functions Used
- `balanceOf(address)` - Check NFT count
- `tokenOfOwnerByIndex(address, index)` - Get token IDs
- `safeTransferFrom(address, address, uint256)` - Burn (transfer to dead address)

### Requirements
- User needs MATIC for gas fees (~$0.01-0.10)
- User must own NFTs from your specified collection
- MetaMask or compatible Web3 wallet

---

## 🐛 Troubleshooting

### "User has no NFTs from this collection"
- Check `contractAddress` is correct
- Verify user actually owns NFTs
- Ensure user is on Polygon network

### "No Web3 wallet detected"
- This is normal in local preview
- Deploy scene to test MetaMask integration
- MetaMask only works in deployed scenes

### Modal doesn't appear
- Check `setupUi()` is called
- Verify `setupNFTBurnSystem()` is called
- Look for errors in browser console

### Transaction fails
- User needs MATIC for gas
- User must approve in MetaMask
- Check user owns the NFT being burned

---

## 💡 Pro Tips

1. **Start with test mode** - Get the UI working first
2. **Test with cheap NFTs** - Don't test with valuable NFTs!
3. **Add signage** - Explain what the burn does in your scene
4. **Monitor console** - Lots of helpful debug logs
5. **Check Polygonscan** - Verify transactions at https://polygonscan.com

---

## 📝 API Reference

### `setupNFTBurnSystem(config)`
Initialize the burn system with your configuration.

**Parameters:**
- `config: NFTBurnConfig` - Configuration object

**Example:**
```typescript
setupNFTBurnSystem({
  contractAddress: '0xYourContract',
  testMode: false
})
```

### `makeBurnable(entity, hoverText?)`
Make any entity burnable by adding click interaction.

**Parameters:**
- `entity: Entity` - The entity to make burnable
- `hoverText: string` - Optional hover text (default: "Burn NFT")

**Example:**
```typescript
makeBurnable(myEntity, 'Click to Burn')
```

### `burnNFT(nft, onStatusChange?)`
Manually burn an NFT (usually called internally).

**Parameters:**
- `nft: UserNFT` - NFT object with tokenId and contractAddress
- `onStatusChange?: (status: string) => void` - Optional callback for status updates

**Returns:** `Promise<{ success: boolean, txHash?: string }>` - Result object with success status and transaction hash

**Example:**
```typescript
const result = await burnNFT(
  { tokenId: '12345', contractAddress: '0xYourContract' },
  (status) => console.log('Status:', status)
)
console.log('Success:', result.success)
console.log('TX Hash:', result.txHash)
```

### `getUserNFTs()`
Get the list of NFTs currently owned by the user.

**Returns:** `UserNFT[]` - Array of NFT objects

---

## 📄 License

This module is part of the Burning Graveyard NFT Burn System.
Free to use and modify for your Decentraland scenes.

---

## 🎉 You're All Set!

Your scene now has a professional, modular NFT burning system!

**Need help?** Check the console logs - they're very detailed and will guide you through any issues.

**Questions?** All the code is commented and easy to customize.

Enjoy burning those NFTs! 🔥

