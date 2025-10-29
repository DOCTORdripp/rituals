# ✅ Integration Checklist

Quick checklist for adding the NFT Burn Module to any Decentraland scene.

---

## 📦 Step 1: Copy Files

- [ ] Copy the entire `burnModule` folder to your scene's `src/` directory

Your structure should look like:
```
your-scene/
  └── src/
      ├── burnModule/
      │   ├── index.ts
      │   ├── nftBurner.ts
      │   ├── ui.tsx
      │   └── README.md
      └── index.ts
```

---

## 📝 Step 2: Update src/index.ts

Add these imports at the top:

```typescript
import { setupNFTBurnSystem, makeBurnable } from './burnModule'
```

In your `main()` function, add:

```typescript
export function main() {
  // Initialize burn system
  setupNFTBurnSystem({
    contractAddress: '0xYourNFTContractAddress',  // ← CHANGE THIS!
    testMode: false  // true for testing, false for production
  })
  
  // Your existing code...
}
```

- [ ] Added imports
- [ ] Called `setupNFTBurnSystem()` with your contract address

---

## 🎮 Step 3: Make Objects Burnable

Add burn functionality to any entity:

```typescript
const myObject = engine.addEntity()
// ... create your object ...
makeBurnable(myObject, 'Burn NFT')
```

Or use existing scene entities:

```typescript
const house = engine.getEntityOrNullByName(EntityNames.House)
if (house) {
  makeBurnable(house, 'Click to Burn')
}
```

- [ ] Called `makeBurnable()` on at least one entity

---

## 🧪 Step 4: Test in Local Preview

1. Set `testMode: true`
2. Run `npm start`
3. Click your burnable object
4. Verify modal appears with fake NFTs
5. Test selection and confirmation flow

- [ ] Tested with `testMode: true`
- [ ] Modal appears and works correctly

---

## 🚀 Step 5: Deploy for Production

1. Set `testMode: false`
2. Build your scene
3. Deploy to Decentraland
4. Visit deployed scene
5. Connect MetaMask
6. Test burning a real NFT

- [ ] Set `testMode: false`
- [ ] Deployed scene
- [ ] Tested MetaMask integration

---

## 📋 Quick Reference

### Change Contract Address
```typescript
contractAddress: '0xYourNewAddress'
```

### Enable Test Mode
```typescript
testMode: true
```

### Custom Hover Text
```typescript
makeBurnable(entity, 'Your Custom Text')
```

### Multiple Objects
```typescript
makeBurnable(object1, 'Burn at Altar')
makeBurnable(object2, 'Burn in Fire')
makeBurnable(object3, 'Portal Sacrifice')
```

---

## ✨ Done!

Your scene now has NFT burning functionality!

**For full documentation**, see `README.md` in the `burnModule` folder.

