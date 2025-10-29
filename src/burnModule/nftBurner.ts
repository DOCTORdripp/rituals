/**
 * NFT BURN SYSTEM - CORE MODULE
 * 
 * A modular, drop-in system for burning NFTs in Decentraland scenes.
 * Supports Polygon network with MetaMask integration.
 * 
 * @author Burning Graveyard System
 * @version 1.0.0
 */

import { Entity, pointerEventsSystem, InputAction, executeTask, engine, Transform, AudioSource } from '@dcl/sdk/ecs'
import { showBurnModal, hideBurnModal, isModalOpen, showCollectionSelectionModal, showLoadingNFTs, showErrorModal, CollectionInfo, updateDetectedReward } from './ui'
import * as crypto from 'dcl-crypto-toolkit'
import { getPlayer } from '@dcl/sdk/players'

// Helper to wait for a specified time (in milliseconds)
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    const startTime = Date.now()
    const checkInterval = () => {
      if (Date.now() - startTime >= ms) {
        resolve()
      } else {
        engine.addSystem(() => {
          checkInterval()
          return false // remove system after first run
        })
      }
    }
    checkInterval()
  })
}

// Declare window for browser environment
declare const window: any

export interface NFTBurnConfig {
  contractAddress: string
  burnAddress?: string
  chainId?: number
  rpcUrl?: string
  testMode?: boolean
  // Multi-collection support (optional)
  collections?: CollectionInfo[]
  enableCollectionSelection?: boolean
}

export interface UserNFT {
  tokenId: string
  contractAddress: string
  name?: string
  imageUrl?: string
  mintNumber?: string  // The actual mint number (extracted from description if available)
}

let config: NFTBurnConfig = {
  contractAddress: '',
  burnAddress: '0x000000000000000000000000000000000000dead',
  chainId: 137, // Polygon
  rpcUrl: 'https://polygon-rpc.com',
  testMode: false,
  collections: [],
  enableCollectionSelection: false
}

let userOwnedNFTs: UserNFT[] = []
let selectedNFT: UserNFT | null = null
let currentBurnableEntity: Entity | null = null

// Create sacrifice sound entity once
const sacrificeSound = engine.addEntity()
Transform.create(sacrificeSound, {
  position: { x: 0, y: 0, z: 0 }
})
AudioSource.create(sacrificeSound, {
  audioClipUrl: 'sounds/sacrifice.mp3',
  loop: false,
  playing: false,
  volume: 1
})

/**
 * Initialize the NFT burn system with your configuration
 */
export function initNFTBurnSystem(userConfig: NFTBurnConfig) {
  config = { ...config, ...userConfig }
  console.log('🔥 NFT Burn System initialized')
  console.log('   Contract:', config.contractAddress)
  console.log('   Network: Polygon (137)')
  console.log('   Test Mode:', config.testMode ? 'ENABLED' : 'DISABLED')
  console.log('   Collection Selection:', config.enableCollectionSelection ? 'ENABLED' : 'DISABLED')
  if (config.enableCollectionSelection && config.collections) {
    console.log('   Collections:', config.collections.length)
  }
}

/**
 * Initialize collections dynamically by fetching metadata from contracts
 * This will fetch collection names and images from the blockchain
 * @param contractAddresses - Array of contract addresses to fetch metadata for
 * @param fallbackImages - Optional fallback images if metadata fetch fails
 */
export async function initCollectionsFromContracts(
  contractAddresses: string[],
  fallbackImages?: string[]
): Promise<CollectionInfo[]> {
  console.log('📚 Initializing collections from contracts...')
  
  // Filter out empty strings and trim whitespace
  const validAddresses = contractAddresses.filter(addr => addr && addr.trim() !== '')
  
  if (validAddresses.length === 0) {
    console.log('   ⚠️ No valid contract addresses provided')
    return []
  }
  
  const collections: CollectionInfo[] = []
  
  for (let i = 0; i < validAddresses.length; i++) {
    const address = validAddresses[i]
    console.log(`\n   📦 Fetching metadata for collection ${i + 1}/${validAddresses.length}`)
    console.log(`   📍 Contract: ${address}`)
    
    const metadata = await fetchCollectionMetadata(address)
    
    console.log(`   📊 Metadata result:`)
    console.log(`      - Name: ${metadata?.name || 'NOT FOUND'}`)
    console.log(`      - Image: ${metadata?.image || 'NOT FOUND'}`)
    
    const fallbackImage = (fallbackImages && fallbackImages[i]) || 'images/doge.png'
    
    const collectionInfo: CollectionInfo = {
      type: 'collection',
      address: address,
      title: metadata?.name || `Collection ${i + 1}`,
      imageUrl: metadata?.image || fallbackImage
    }
    
    console.log(`   ✅ Final collection ${i + 1}:`)
    console.log(`      - Title: ${collectionInfo.title}`)
    console.log(`      - Image URL: ${collectionInfo.imageUrl}`)
    console.log(`      - Using: ${metadata?.image ? 'DYNAMIC IMAGE' : 'FALLBACK IMAGE'}`)
    
    collections.push(collectionInfo)
  }
  
  console.log('✅ Collections initialized:', collections.length)
  return collections
}

/**
 * Parse a Decentraland URN to extract contract address and token ID
 * Format: urn:decentraland:matic:collections-v2:{contractAddress}:{tokenId}
 */
function parseURN(urn: string): { address: string; tokenId: string } | null {
  try {
    const parts = urn.split(':')
    if (parts.length >= 6 && parts[0] === 'urn' && parts[1] === 'decentraland') {
      const address = parts[4]
      const tokenId = parts[5]
      return { address, tokenId }
    }
    console.error('Invalid URN format:', urn)
    return null
  } catch (error) {
    console.error('Error parsing URN:', error)
    return null
  }
}

/**
 * Initialize a collection from a specific URN
 * This will fetch metadata for the specific NFT and create a CollectionInfo
 * @param urn - The full URN of the NFT (e.g., urn:decentraland:matic:collections-v2:0x....:0)
 * @param fallbackImage - Optional fallback image if metadata fetch fails
 */
export async function initCollectionFromURN(
  urn: string,
  fallbackImage?: string
): Promise<CollectionInfo | null> {
  console.log('🎯 Initializing collection from URN...')
  console.log(`   URN: ${urn}`)
  
  const parsed = parseURN(urn)
  if (!parsed) {
    console.error('❌ Failed to parse URN')
    return null
  }
  
  console.log(`   📍 Contract: ${parsed.address}`)
  console.log(`   🔢 Token ID: ${parsed.tokenId}`)
  
  // Fetch metadata for this specific URN from Decentraland's content server
  let metadata: { name?: string; image?: string } | null = null
  
  try {
    // Construct DCL URLs with the specific URN (includes token ID)
    const dclImageUrl = `https://peer.decentraland.org/lambdas/collections/contents/${urn}/thumbnail`
    const dclMetadataUrl = `https://peer.decentraland.org/lambdas/collections/contents/${urn}`
    
    console.log(`   🌐 DCL Image URL: ${dclImageUrl}`)
    console.log(`   🌐 DCL Metadata URL: ${dclMetadataUrl}`)
    
    // Try to fetch metadata from Decentraland's content server first (most reliable for DCL items)
    try {
      console.log(`   📡 Fetching metadata from DCL content server for URN...`)
      const response = await fetch(dclMetadataUrl)
      if (response.ok) {
        const dclMetadata = await response.json()
        console.log(`   ✅ DCL metadata received:`, dclMetadata)
        
        if (dclMetadata && dclMetadata.name) {
          console.log(`   ✅ Got name from DCL: "${dclMetadata.name}"`)
          metadata = {
            name: dclMetadata.name,
            image: dclImageUrl
          }
        }
      } else {
        console.log(`   ⚠️ DCL content server returned ${response.status}`)
        
        // Try standard ERC721 endpoint (uses item ID from URN)
        console.log(`   🔄 Trying standard ERC721 endpoint...`)
        // URN format: urn:decentraland:matic:collections-v2:{contract}:{itemId}
        // Standard endpoint: /standard/erc721/137/{contract}/{itemId}/0 (0 is placeholder token ID for item metadata)
        const standardUrl = `https://peer.decentraland.org/lambdas/collections/standard/erc721/137/${parsed.address.toLowerCase()}/${parsed.tokenId}/0`
        console.log(`   📡 Standard URL: ${standardUrl}`)
        console.log(`   🔢 Using item ID: ${parsed.tokenId} from URN`)
        
        try {
          const standardResponse = await fetch(standardUrl)
          if (standardResponse.ok) {
            const standardData = await standardResponse.json()
            console.log(`   ✅ Standard endpoint data received:`, standardData)
            
            if (standardData && standardData.name) {
              console.log(`   ✅ Got item name from standard API: "${standardData.name}"`)
              metadata = {
                name: standardData.name,
                image: dclImageUrl
              }
            }
          } else {
            console.log(`   ⚠️ Standard endpoint returned ${standardResponse.status}`)
          }
        } catch (standardError) {
          console.log(`   ⚠️ Standard endpoint fetch failed:`, standardError)
        }
      }
    } catch (dclError) {
      console.log(`   ⚠️ DCL content server fetch failed:`, dclError)
    }
    
    // Fallback to blockchain tokenURI if DCL fetch failed
    if (!metadata || !metadata.name) {
      console.log(`   🔗 Falling back to blockchain tokenURI for CONTRACT: ${parsed.address}, TOKEN: ${parsed.tokenId}`)
      const nftMetadata = await fetchNFTMetadata(parsed.address, parsed.tokenId)
      
      console.log(`   🔎 fetchNFTMetadata returned:`, nftMetadata)
      
      if (nftMetadata && nftMetadata.name) {
        console.log(`   ✅ NFT metadata found: "${nftMetadata.name}" for token ${parsed.tokenId}`)
        metadata = {
          name: nftMetadata.name,
          image: dclImageUrl
        }
      } else {
        console.log(`   ⚠️ NFT metadata not found, using fallback name for token ${parsed.tokenId}`)
        metadata = {
          name: `Item #${parsed.tokenId}`,
          image: dclImageUrl
        }
      }
    }
    
    console.log(`   📝 Final metadata for URN collection:`)
    console.log(`      - Name: ${metadata.name}`)
    console.log(`      - Token ID: ${parsed.tokenId}`)
    console.log(`      - Image: ${metadata.image}`)
  } catch (error) {
    console.log('   ⚠️ Error fetching metadata:', error)
    metadata = {
      name: `Item #${parsed.tokenId}`,
      image: fallbackImage || 'images/doge.png'
    }
  }
  
  const collectionInfo: CollectionInfo = {
    type: 'urn',
    address: parsed.address,
    urn: urn,
    tokenId: parsed.tokenId,
    title: metadata?.name || `Item #${parsed.tokenId}`,
    imageUrl: metadata?.image || fallbackImage || 'images/doge.png'
  }
  
  console.log(`   ✅ URN collection created:`)
  console.log(`      - Title: ${collectionInfo.title}`)
  console.log(`      - Token ID: ${collectionInfo.tokenId}`)
  console.log(`      - Image URL: ${collectionInfo.imageUrl}`)
  
  return collectionInfo
}

/**
 * Initialize collections from an array of URNs
 * @param urns - Array of URN strings
 * @param fallbackImages - Optional fallback images for each URN
 */
export async function initCollectionsFromURNs(
  urns: string[],
  fallbackImages?: string[]
): Promise<CollectionInfo[]> {
  console.log('📚 Initializing collections from URNs...')
  console.log(`   Total URNs: ${urns.length}`)
  
  const collections: CollectionInfo[] = []
  
  for (let i = 0; i < urns.length; i++) {
    const urn = urns[i]
    const fallbackImage = (fallbackImages && fallbackImages[i]) || 'images/doge.png'
    
    console.log(`\n   🎯 Processing URN ${i + 1}/${urns.length}`)
    const collectionInfo = await initCollectionFromURN(urn, fallbackImage)
    
    if (collectionInfo) {
      collections.push(collectionInfo)
    } else {
      console.error(`   ❌ Failed to initialize URN ${i + 1}`)
    }
  }
  
  console.log('✅ URN collections initialized:', collections.length)
  return collections
}

/**
 * Get user's Ethereum address using crypto toolkit
 */
async function getUserAddress(): Promise<string | null> {
  try {
    // Try DCL UserIdentity first
    try {
      const { getUserData } = await import('~system/UserIdentity')
      const userData = await getUserData({})
      
      if (userData && userData.data && userData.data.publicKey) {
        console.log('✅ Found wallet address:', userData.data.publicKey)
        return userData.data.publicKey
      }
    } catch (identityError) {
      console.log('⚠️ UserIdentity not available')
    }

    // Fallback to window.ethereum
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const ethereum = (window as any).ethereum
        const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
        if (accounts && accounts.length > 0) {
          console.log('✅ Found wallet address via wallet:', accounts[0])
          return accounts[0]
        }
      } catch (ethError) {
        console.log('⚠️ Wallet access denied or not available')
      }
    }

    console.log('⚠️ No wallet address found')
    return null
  } catch (error) {
    console.error('❌ Error getting user address:', error)
    return null
  }
}

/**
 * Make an RPC call to the blockchain
 */
async function makeRpcCall(method: string, params: any[]): Promise<any> {
  try {
    const response = await fetch(config.rpcUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: 1
      })
    })

    const data = await response.json()
    return data.result
  } catch (error) {
    console.error('RPC call error:', error)
    throw error
  }
}

/**
 * Fetch collection metadata from Decentraland's content server and contract
 * Tries DCL content server first, then falls back to blockchain methods
 */
async function fetchCollectionMetadata(contractAddress: string): Promise<{ name?: string, image?: string } | null> {
  try {
    console.log('📡 Fetching collection metadata for:', contractAddress)
    
    // Try DCL content server first (most reliable for Decentraland collections)
    try {
      console.log('   🌐 Trying Decentraland content server...')
      const dclImageUrl = `https://peer.decentraland.org/lambdas/collections/contents/urn:decentraland:matic:collections-v2:${contractAddress.toLowerCase()}:0/thumbnail`
      console.log('   📸 Image URL:', dclImageUrl)
      
      // Try to get collection name from blockchain first (more reliable)
      let collectionName: string | undefined = await fetchCollectionName(contractAddress)
      
      // Always return the DCL image URL - it will show 404 placeholder if doesn't exist
      // which is better than our generic placeholder
      console.log('   ✅ Using DCL thumbnail URL')
      console.log('   📝 Collection name:', collectionName || 'Unknown')
      return { 
        name: collectionName, 
        image: dclImageUrl 
      }
    } catch (error) {
      console.log('   ⚠️ DCL content server error:', error)
      console.log('   🔄 Falling back to blockchain methods...')
    }
    
    // Fallback to blockchain methods
    console.log('   🔗 Fetching from blockchain...')
    
    // Try contractURI() first (ERC-721 collection-level metadata)
    try {
      const contractURISignature = '0xe8a3d485' // contractURI()
      const contractURIResult = await makeRpcCall('eth_call', [
        {
          to: contractAddress,
          data: contractURISignature
        },
        'latest'
      ])
      
      if (contractURIResult && contractURIResult !== '0x') {
        const uri = decodeURIFromHex(contractURIResult)
        if (uri) {
          console.log('   Found contractURI:', uri)
          const metadata = await fetchMetadataFromURI(uri)
          if (metadata) return metadata
        }
      }
    } catch (error) {
      console.log('   contractURI not available, trying tokenURI...')
    }
    
    // Fallback: Try tokenURI(0)
    try {
      const tokenURISignature = '0xc87b56dd' // tokenURI(uint256)
      const paddedTokenId = '0'.padStart(64, '0')
      const tokenURIResult = await makeRpcCall('eth_call', [
        {
          to: contractAddress,
          data: tokenURISignature + paddedTokenId
        },
        'latest'
      ])
      
      if (tokenURIResult && tokenURIResult !== '0x') {
        const uri = decodeURIFromHex(tokenURIResult)
        if (uri) {
          console.log('   Found tokenURI:', uri)
          const metadata = await fetchMetadataFromURI(uri)
          if (metadata) return metadata
        }
      }
    } catch (error) {
      console.log('   tokenURI not available')
    }
    
    // Try name() function to at least get the collection name
    const name = await fetchCollectionName(contractAddress)
    return { name, image: undefined }
  } catch (error) {
    console.error('Error fetching collection metadata:', error)
    return null
  }
}

/**
 * Fetch just the collection name from the blockchain
 */
async function fetchCollectionName(contractAddress: string): Promise<string | undefined> {
  try {
    const nameSignature = '0x06fdde03' // name()
    const nameResult = await makeRpcCall('eth_call', [
      {
        to: contractAddress,
        data: nameSignature
      },
      'latest'
    ])
    
    if (nameResult && nameResult !== '0x') {
      const name = decodeStringFromHex(nameResult)
      console.log('   Found collection name:', name)
      return name
    }
  } catch (error) {
    console.log('   name() not available')
  }
  return undefined
}

/**
 * Decode a URI string from hex-encoded contract response
 */
function decodeURIFromHex(hexString: string): string | undefined {
  try {
    // Remove 0x prefix
    const hex = hexString.startsWith('0x') ? hexString.slice(2) : hexString
    
    // The first 64 chars (32 bytes) are the offset, next 64 are the length
    const offset = parseInt(hex.slice(0, 64), 16) * 2
    const length = parseInt(hex.slice(64, 128), 16) * 2
    
    // Extract the actual string data
    const stringHex = hex.slice(128, 128 + length)
    
    // Convert hex to string
    let result = ''
    for (let i = 0; i < stringHex.length; i += 2) {
      const byte = parseInt(stringHex.substr(i, 2), 16)
      if (byte !== 0) result += String.fromCharCode(byte)
    }
    
    return result || undefined
  } catch (error) {
    console.error('Error decoding URI from hex:', error)
    return undefined
  }
}

/**
 * Decode a string from hex-encoded contract response (for name())
 */
function decodeStringFromHex(hexString: string): string | undefined {
  try {
    const hex = hexString.startsWith('0x') ? hexString.slice(2) : hexString
    const offset = parseInt(hex.slice(0, 64), 16) * 2
    const length = parseInt(hex.slice(64, 128), 16) * 2
    const stringHex = hex.slice(128, 128 + length)
    
    let result = ''
    for (let i = 0; i < stringHex.length; i += 2) {
      const byte = parseInt(stringHex.substr(i, 2), 16)
      if (byte !== 0) result += String.fromCharCode(byte)
    }
    
    return result || undefined
  } catch (error) {
    return undefined
  }
}

/**
 * Base64 decode helper (since atob is not available in DCL)
 */
function base64Decode(base64: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
  let output = ''
  
  base64 = base64.replace(/[^A-Za-z0-9+/=]/g, '')
  
  for (let i = 0; i < base64.length; i += 4) {
    const enc1 = chars.indexOf(base64.charAt(i))
    const enc2 = chars.indexOf(base64.charAt(i + 1))
    const enc3 = chars.indexOf(base64.charAt(i + 2))
    const enc4 = chars.indexOf(base64.charAt(i + 3))
    
    const chr1 = (enc1 << 2) | (enc2 >> 4)
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2)
    const chr3 = ((enc3 & 3) << 6) | enc4
    
    output += String.fromCharCode(chr1)
    
    if (enc3 !== 64) {
      output += String.fromCharCode(chr2)
    }
    if (enc4 !== 64) {
      output += String.fromCharCode(chr3)
    }
  }
  
  return output
}

/**
 * Fetch and parse metadata JSON from URI (supports IPFS, HTTP, data URIs)
 */
async function fetchMetadataFromURI(uri: string): Promise<{ name?: string, image?: string, description?: string } | null> {
  try {
    // Handle IPFS URIs
    if (uri.startsWith('ipfs://')) {
      uri = uri.replace('ipfs://', 'https://ipfs.io/ipfs/')
    }
    
    // Handle data URIs
    if (uri.startsWith('data:application/json')) {
      try {
        const base64Data = uri.split(',')[1]
        const jsonString = base64Decode(base64Data)
        const metadata = JSON.parse(jsonString)
        return {
          name: metadata.name,
          image: metadata.image ? normalizeImageURL(metadata.image) : undefined,
          description: metadata.description
        }
      } catch (error) {
        console.error('Error parsing data URI:', error)
        return null
      }
    }
    
    // Fetch HTTP(S) URIs
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      const response = await fetch(uri)
      const metadata = await response.json()
      return {
        name: metadata.name || metadata.title,
        image: metadata.image ? normalizeImageURL(metadata.image) : undefined,
        description: metadata.description
      }
    }
    
    return null
  } catch (error) {
    console.error('Error fetching metadata from URI:', error)
    return null
  }
}

/**
 * Normalize image URLs (convert IPFS to HTTP gateway)
 */
function normalizeImageURL(imageUrl: string): string {
  if (imageUrl.startsWith('ipfs://')) {
    return imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/')
  }
  return imageUrl
}

/**
 * Extract mint number from description text
 * Looks for patterns like "Mint #123", "Mint: 123", "DCL Wearable 123/1000", etc.
 */
function extractMintNumber(description?: string): string | undefined {
  if (!description) return undefined
  
  // Try various patterns to find mint number
  const patterns = [
    /(?:DCL\s+)?Wearable\s+(\d+)\//i,  // "DCL Wearable 123/1000" or "Wearable 123/1000" (most common for DCL)
    /Mint[:\s#]+(\d+)/i,                // "Mint #123" or "Mint: 123"
    /#(\d+)\s+of/i,                     // "#123 of 1000"
    /Edition[:\s#]+(\d+)/i,             // "Edition #123"
    /Number[:\s#]+(\d+)/i,              // "Number #123"
    /\bMint\b[^\d]*(\d+)/i,             // "Mint" followed by a number
    /(\d+)\/\d+/                        // Any format like "123/1000"
  ]
  
  for (const pattern of patterns) {
    const match = description.match(pattern)
    if (match && match[1]) {
      console.log(`      🔢 Extracted mint number: ${match[1]} from description: "${description}"`)
      return match[1]
    }
  }
  
  console.log(`      ⚠️ Could not extract mint number from description: "${description}"`)
  return undefined
}

/**
 * Fetch individual NFT metadata (name, image, and description with mint number) from tokenURI
 */
async function fetchNFTMetadata(contractAddress: string, tokenId: string): Promise<{ name?: string, image?: string, description?: string, mintNumber?: string } | null> {
  try {
    console.log(`      🔍 Fetching metadata for CONTRACT: ${contractAddress}, TOKEN: ${tokenId}`)
    
    // Fetch tokenURI from the blockchain
    try {
      const tokenURISignature = '0xc87b56dd' // tokenURI(uint256)
      const paddedTokenId = BigInt(tokenId).toString(16).padStart(64, '0')
      console.log(`      🔢 Padded token ID for RPC call: ${paddedTokenId}`)
      console.log(`      📞 Calling tokenURI(${tokenId}) on ${contractAddress}`)
      
      const tokenURIResult = await makeRpcCall('eth_call', [
        {
          to: contractAddress,
          data: tokenURISignature + paddedTokenId
        },
        'latest'
      ])
      
      console.log(`      📥 Token URI result received: ${tokenURIResult ? tokenURIResult.substring(0, 40) + '...' : 'null'}`)
      
      if (tokenURIResult && tokenURIResult !== '0x') {
        const uri = decodeURIFromHex(tokenURIResult)
        if (uri) {
          console.log(`      📡 Decoded Token URI: ${uri}`)
          const metadata = await fetchMetadataFromURI(uri)
          if (metadata) {
            console.log(`      ✅ Got metadata for token ${tokenId}: ${metadata.name || 'No name'}`)
            if (metadata.description) {
              console.log(`      📝 Description: ${metadata.description.substring(0, 100)}...`)
            }
            
            // Try to extract mint number from description
            const mintNumber = extractMintNumber(metadata.description)
            
            return {
              name: metadata.name || `Token #${tokenId}`,
              image: metadata.image,
              description: metadata.description,
              mintNumber: mintNumber
            }
          }
        }
      }
    } catch (error) {
      console.log(`      ⚠️ Could not fetch metadata for token ${tokenId}:`, error)
    }
    
    // Return minimal data if metadata fetch failed
    return { name: `Token #${tokenId}`, image: undefined, description: undefined, mintNumber: undefined }
  } catch (error) {
    console.error('Error fetching NFT metadata:', error)
    return null
  }
}

/**
 * Check user's NFT balance
 */
async function checkUserNFTs(collection: CollectionInfo): Promise<UserNFT[]> {
  try {
    const targetContract = collection.address
    
    if (config.testMode) {
      console.log('🧪 TEST MODE: Simulating NFT ownership')
      return [
        { tokenId: '12345', contractAddress: targetContract, name: 'Test NFT #12345', imageUrl: 'images/doge.png', mintNumber: '1' },
        { tokenId: '67890', contractAddress: targetContract, name: 'Test NFT #67890', imageUrl: 'images/kersplat.png', mintNumber: '2' },
        { tokenId: '11111', contractAddress: targetContract, name: 'Test NFT #11111', imageUrl: 'images/doge.png', mintNumber: '3' },
        { tokenId: '22222', contractAddress: targetContract, name: 'Test NFT #22222', imageUrl: 'images/kersplat.png', mintNumber: '4' },
        { tokenId: '33333', contractAddress: targetContract, name: 'Test NFT #33333', imageUrl: 'images/doge.png', mintNumber: '5' },
        { tokenId: '44444', contractAddress: targetContract, name: 'Test NFT #44444', imageUrl: 'images/kersplat.png', mintNumber: '6' },
        { tokenId: '55555', contractAddress: targetContract, name: 'Test NFT #55555', imageUrl: 'images/doge.png', mintNumber: '7' },
        { tokenId: '66666', contractAddress: targetContract, name: 'Test NFT #66666', imageUrl: 'images/kersplat.png', mintNumber: '8' },
        { tokenId: '77777', contractAddress: targetContract, name: 'Test NFT #77777', imageUrl: 'images/doge.png', mintNumber: '9' },
        { tokenId: '88888', contractAddress: targetContract, name: 'Test NFT #88888', imageUrl: 'images/kersplat.png', mintNumber: '10' },
        { tokenId: '99999', contractAddress: targetContract, name: 'Test NFT #99999', imageUrl: 'images/doge.png', mintNumber: '11' },
        { tokenId: '10101', contractAddress: targetContract, name: 'Test NFT #10101', imageUrl: 'images/kersplat.png', mintNumber: '12' }
      ]
    }

    const userAddress = await getUserAddress()
    if (!userAddress) {
      console.log('No user address available')
      return []
    }

    console.log('Checking NFTs for address:', userAddress)

    // Handle URN type - check ownership of tokens from specific item
    if (collection.type === 'urn' && collection.tokenId) {
      console.log(`🎯 Checking ownership of URN item #${collection.tokenId}`)
      console.log(`   Note: In Collections V2, this is an ITEM ID, not token ID`)
      console.log(`   Will fetch all user tokens and filter by this item`)
      
      try {
        // For Collections V2, we need to:
        // 1. Get all tokens owned by user
        // 2. For each token, get its item ID
        // 3. Filter to only show tokens from the specific item
        
        const itemId = collection.tokenId  // This is the item ID from the URN
        
        // Get balance
        const balanceOfSignature = '0x70a08231'
        const paddedAddress = userAddress.slice(2).padStart(64, '0')
        const balanceData = balanceOfSignature + paddedAddress

        const balanceHex = await makeRpcCall('eth_call', [
          {
            to: targetContract,
            data: balanceData
          },
          'latest'
        ])

        const balance = parseInt(balanceHex, 16)
        console.log(`   User has ${balance} total NFTs from this contract`)

        if (balance === 0) {
          console.log('❌ User owns no NFTs from this contract')
          return []
        }

        const ownedTokensFromItem: UserNFT[] = []
        const limit = Math.min(balance, 50) // Check up to 50 tokens
        
        console.log(`   Checking ${limit} tokens for item #${itemId}...`)
        
        for (let i = 0; i < limit; i++) {
          try {
            // Get token ID at index
            const tokenOfOwnerSignature = '0x2f745c59' // tokenOfOwnerByIndex
            const paddedAddr = userAddress.slice(2).padStart(64, '0')
            const paddedIndex = i.toString(16).padStart(64, '0')
            const tokenData = tokenOfOwnerSignature + paddedAddr + paddedIndex

            const tokenIdHex = await makeRpcCall('eth_call', [
              {
                to: targetContract,
                data: tokenData
              },
              'latest'
            ])

            // Convert hex to string, using BigInt to handle large numbers
            let tokenId: string
            try {
              tokenId = BigInt(tokenIdHex).toString()
            } catch (e) {
              console.error(`     ⚠️ Error converting token ID hex ${tokenIdHex}:`, e)
              continue
            }
            
            // Fetch metadata for this token
            const metadata = await fetchNFTMetadata(targetContract, tokenId)
            
            // Filter by name - only include tokens that match the URN's title exactly
            const tokenName = metadata?.name || ''
            const expectedName = collection.title
            
            console.log(`     Token #${tokenId}: "${tokenName}"`)
            console.log(`     Looking for: "${expectedName}"`)
            
            if (tokenName === expectedName) {
              console.log(`     ✅ Name matches - INCLUDED`)
              
              ownedTokensFromItem.push({
                tokenId: tokenId,
                contractAddress: targetContract,
                name: metadata?.name || collection.title,
                imageUrl: metadata?.image || collection.imageUrl,
                mintNumber: metadata?.mintNumber
              })
            } else {
              console.log(`     ❌ Name doesn't match - SKIPPING`)
            }
          } catch (error) {
            console.error(`     Error checking token at index ${i}:`, error)
          }
        }

        console.log(`   Found ${ownedTokensFromItem.length} tokens from item #${itemId}`)
        return ownedTokensFromItem
      } catch (error) {
        console.error('Error checking URN ownership:', error)
        return []
      }
    }

    // Handle collection type - scan all owned NFTs
    console.log('📦 Checking entire collection...')
    
    const balanceOfSignature = '0x70a08231'
    const paddedAddress = userAddress.slice(2).padStart(64, '0')
    const data = balanceOfSignature + paddedAddress

    const balanceHex = await makeRpcCall('eth_call', [
      {
        to: targetContract,
        data: data
      },
      'latest'
    ])

    const balance = parseInt(balanceHex, 16)
    console.log('User NFT balance:', balance)

    if (balance === 0) {
      return []
    }

    const ownedNFTs: UserNFT[] = []
    const limit = Math.min(balance, 12)
    
    console.log(`Fetching ${limit} token IDs...`)
    
    for (let i = 0; i < limit; i++) {
      try {
        const tokenOfOwnerSignature = '0x2f745c59'
        const paddedAddr = userAddress.slice(2).padStart(64, '0')
        const paddedIndex = i.toString(16).padStart(64, '0')
        const data = tokenOfOwnerSignature + paddedAddr + paddedIndex

        const tokenIdHex = await makeRpcCall('eth_call', [
          {
            to: targetContract,
            data: data
          },
          'latest'
        ])

        // Convert hex to string, using BigInt to handle large numbers
        let tokenId: string
        try {
          tokenId = BigInt(tokenIdHex).toString()
        } catch (e) {
          console.error(`  Error converting token ID hex ${tokenIdHex}:`, e)
          continue
        }
        console.log(`  Token ${i + 1}/${limit}: ID ${tokenId}`)
        
        // Fetch metadata for this NFT
        const metadata = await fetchNFTMetadata(targetContract, tokenId)
        
        ownedNFTs.push({
          tokenId: tokenId,
          contractAddress: targetContract,
          name: metadata?.name,
          imageUrl: metadata?.image,
          mintNumber: metadata?.mintNumber
        })
        
        console.log(`     Name: ${metadata?.name || 'Unknown'}`)
        if (metadata?.mintNumber) {
          console.log(`     Mint #: ${metadata.mintNumber}`)
        }
        if (metadata?.image) {
          console.log(`     Image: ${metadata.image.substring(0, 60)}...`)
        }
      } catch (error) {
        console.error(`Error fetching token at index ${i}:`, error)
      }
    }

    return ownedNFTs
  } catch (error) {
    console.error('Error checking user NFTs:', error)
    return []
  }
}

/**
 * Wait for transaction confirmation by polling for receipt
 */
async function waitForTransactionConfirmation(txHash: string, maxAttempts: number = 60): Promise<boolean> {
  console.log('⏳ Waiting for transaction confirmation...')
  console.log('   Transaction hash:', txHash)
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const receipt = await makeRpcCall('eth_getTransactionReceipt', [txHash])
      
      if (receipt && receipt.blockNumber) {
        console.log('✅ Transaction confirmed!')
        console.log('   Block number:', parseInt(receipt.blockNumber, 16))
        console.log('   Status:', receipt.status === '0x1' ? 'Success' : 'Failed')
        
        return receipt.status === '0x1'
      }
      
      // Wait 2 seconds before next attempt
      await delay(2000)
      
      if (attempt % 5 === 0 && attempt > 0) {
        console.log(`   Still waiting... (${attempt * 2}s elapsed)`)
      }
    } catch (error) {
      console.error('Error checking transaction receipt:', error)
    }
  }
  
  console.log('⚠️ Transaction confirmation timed out after', maxAttempts * 2, 'seconds')
  return false
}

/**
 * Get player's current wearables
 */
async function getPlayerWearables(): Promise<string[]> {
  try {
    const player = getPlayer()
    if (player?.wearables) {
      return player.wearables
    }
    return []
  } catch (error) {
    console.error('❌ Error getting player wearables:', error)
    return []
  }
}

/**
 * Poll for new wearables after burning
 * Checks every 3 seconds for up to 60 seconds
 */
async function pollForNewWearable(initialWearables: string[]): Promise<void> {
  console.log('🔍 Starting wearable detection polling...')
  console.log('   Initial wearables:', initialWearables.length)
  
  const maxAttempts = 20  // 20 attempts * 10 seconds = 200 seconds max
  const pollInterval = 10000  // 10 seconds
  
  for (let i = 0; i < maxAttempts; i++) {
    await delay(pollInterval)
    
    const currentWearables = await getPlayerWearables()
    console.log(`🔍 Poll attempt ${i + 1}/${maxAttempts}: ${currentWearables.length} wearables`)
    
    // Check if there's a new wearable
    const newWearables = currentWearables.filter(w => !initialWearables.includes(w))
    
    if (newWearables.length > 0) {
      console.log('🎁 New wearable(s) detected!', newWearables)
      
      // Get the first new wearable
      const newWearableUrn = newWearables[0]
      
      // Try to fetch wearable metadata
      try {
        const wearableData = await fetchWearableMetadata(newWearableUrn)
        console.log('✅ Wearable metadata fetched:', wearableData)
        
        updateDetectedReward({
          name: wearableData.name || 'New Wearable',
          imageUrl: wearableData.imageUrl
        })
      } catch (error) {
        console.error('❌ Failed to fetch wearable metadata:', error)
        // Still show something even if metadata fetch fails
        updateDetectedReward({
          name: 'New Wearable Received!'
        })
      }
      
      return
    }
  }
  
  console.log('⏰ Wearable detection polling timed out after 60 seconds')
}

/**
 * Fetch wearable metadata from URN
 */
async function fetchWearableMetadata(urn: string): Promise<{ name: string, imageUrl?: string }> {
  try {
    // Extract collection address and item ID from URN
    // URN format: urn:decentraland:matic:collections-v2:0xCONTRACT:ITEM_ID
    const parts = urn.split(':')
    
    if (parts.length >= 5) {
      const contractAddress = parts[4]
      const itemId = parts[5] || '0'
      
      console.log('📡 Fetching metadata for:', { contractAddress, itemId })
      
      // Fetch from Decentraland's content server
      const url = `https://peer.decentraland.org/lambdas/collections/wearables?collectionId=${contractAddress}`
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.wearables && data.wearables.length > 0) {
        const wearable = data.wearables.find((w: any) => w.id === urn) || data.wearables[0]
        
        return {
          name: wearable.name || wearable.title || 'Wearable',
          imageUrl: wearable.thumbnail || wearable.image
        }
      }
    }
    
    // Fallback if parsing fails
    return { name: 'New Wearable' }
  } catch (error) {
    console.error('❌ Error fetching wearable metadata:', error)
    return { name: 'New Wearable' }
  }
}

/**
 * Play the burn completion sound at the current burnable entity (the "Click to Burn NFT" trigger area)
 */
export function playBurnCompleteSound() {
  if (!currentBurnableEntity) {
    console.log('⚠️ No burnable entity stored')
    return
  }
  
  const transform = Transform.getOrNull(currentBurnableEntity)
  if (!transform) {
    console.log('⚠️ Burnable entity has no Transform')
    return
  }
  
  console.log('🔊 Playing sacrifice sound at burnable entity position:', transform.position)
  
  // Update sound position to burnable entity location and play
  Transform.getMutable(sacrificeSound).position = transform.position
  AudioSource.getMutable(sacrificeSound).playing = true
}

/**
 * Burn an NFT (transfer to burn address) using dcl-crypto-toolkit
 * Returns: { success: boolean, txHash?: string }
 */
export async function burnNFT(nft: UserNFT, onStatusChange?: (status: string) => void): Promise<{ success: boolean, txHash?: string }> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔥 burnNFT() CALLED')
  console.log('   Token ID:', nft.tokenId)
  console.log('   Contract:', nft.contractAddress)
  console.log('   Test Mode:', config.testMode)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  // Capture player's wearables before burning
  const initialWearables = await getPlayerWearables()
  console.log('📸 Captured initial wearables:', initialWearables.length)
  
  try {
    if (config.testMode) {
      console.log('🧪 TEST MODE: Simulating NFT burn')
      console.log('   Token:', nft.tokenId)
      console.log('   From contract:', nft.contractAddress)
      console.log('   To burn address:', config.burnAddress)
      
      if (onStatusChange) onStatusChange('Simulating transaction...')
      await delay(2000)
      
      if (onStatusChange) onStatusChange('Confirming transaction...')
      
      await delay(3000)
      
      if (onStatusChange) onStatusChange('Transaction confirmed! Burn complete.')
      
      console.log('✅ TEST: NFT burn would succeed here!')
      
      // Start polling for new wearables (don't wait for it)
      pollForNewWearable(initialWearables).catch(err => {
        console.error('❌ Error polling for wearables:', err)
      })
      
      return { success: true, txHash: '0xtest' + Date.now() }
    }

    const userAddress = await getUserAddress()
    if (!userAddress) {
      console.error('❌ No user address available')
      console.log('💡 Deploy to Genesis City to test with real wallet')
      return { success: false }
    }

    console.log('⚠️ Preparing to burn NFT on Polygon blockchain')
    console.log('   Token ID:', nft.tokenId)
    console.log('   From:', userAddress)
    console.log('   To burn address:', config.burnAddress)
    console.log('   Using crypto toolkit with custom contract call')
    
    try {
      // Import the DCL ethereum provider (this is what makes MetaMask work in DCL client)
      const { createEthereumProvider } = await import('@dcl/sdk/ethereum-provider')
      
      console.log('🔌 Creating Ethereum provider for DCL client...')
      const provider = await createEthereumProvider()
      
      // Switch to Polygon network
      console.log('🔄 Switching to Polygon network...')
      if (onStatusChange) onStatusChange('Connecting to Polygon...')
      
      try {
        await new Promise((resolve, reject) => {
          provider.sendAsync({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x89' }]
          }, (error: any, result: any) => {
            if (error) reject(error)
            else resolve(result)
          })
        })
        console.log('✅ Switched to Polygon')
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          console.log('📡 Adding Polygon network...')
          await new Promise((resolve, reject) => {
            provider.sendAsync({
              jsonrpc: '2.0',
              id: Date.now(),
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x89',
                chainName: 'Polygon Mainnet',
                nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
                rpcUrls: ['https://polygon-rpc.com'],
                blockExplorerUrls: ['https://polygonscan.com/']
              }]
            }, (error: any, result: any) => {
              if (error) reject(error)
              else resolve(result)
            })
          })
          console.log('✅ Polygon network added')
        }
      }
      
      // Prepare transaction data for safeTransferFrom
      const safeTransferFromSignature = '0x42842e0e'
      const paddedFrom = userAddress.slice(2).padStart(64, '0')
      const paddedTo = config.burnAddress!.slice(2).padStart(64, '0')
      const paddedTokenId = BigInt(nft.tokenId).toString(16).padStart(64, '0')
      const data = safeTransferFromSignature + paddedFrom + paddedTo + paddedTokenId

      console.log('📝 Sending burn transaction on Polygon...')
      console.log('   From:', userAddress)
      console.log('   To:', config.burnAddress)
      console.log('   Token ID:', nft.tokenId)
      
      if (onStatusChange) onStatusChange('Awaiting wallet signature...')
      
      // Send transaction using the DCL provider (this will open MetaMask properly)
      const txHash = await new Promise<string>((resolve, reject) => {
        provider.sendAsync({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'eth_sendTransaction',
          params: [{
            from: userAddress,
            to: nft.contractAddress,
            data: data,
            gas: '0x7A120'
          }]
        }, (error: any, result: any) => {
          if (error) reject(error)
          else resolve(result?.result || result)
        })
      })

      console.log('✅ NFT burn transaction sent!')
      console.log('📋 Transaction hash:', txHash)
      console.log('🔗 View on Polygonscan:', `https://polygonscan.com/tx/${txHash}`)
      
      if (onStatusChange) onStatusChange('Transaction submitted! Confirming...')
      
      // Wait for transaction confirmation
      const confirmed = await waitForTransactionConfirmation(txHash)
      
      if (confirmed) {
        console.log('✅ NFT burn confirmed on blockchain!')
        if (onStatusChange) onStatusChange('Transaction confirmed! Burn complete.')
        
        // Start polling for new wearables (don't wait for it)
        pollForNewWearable(initialWearables).catch(err => {
          console.error('❌ Error polling for wearables:', err)
        })
        
        return { success: true, txHash }
      } else {
        console.log('⚠️ Transaction confirmation timeout')
        if (onStatusChange) onStatusChange('Transaction timeout')
        return { success: false, txHash }
      }
      
    } catch (error: any) {
      console.error('❌ Burn transaction failed:', error)
      
      if (error.message && (error.message.includes('User denied') || error.message.includes('rejected'))) {
        console.log('⚠️ User cancelled the transaction')
      } else if (error.message && error.message.includes('insufficient funds')) {
        console.log('⚠️ Insufficient MATIC for gas fees')
      } else {
        console.log('⚠️ Transaction error:', error.message || error)
      }
      
      return { success: false }
    }
  } catch (error) {
    console.error('❌ Error burning NFT:', error)
    return { success: false }
  }
}

/**
 * Handle click on burnable entity
 */
async function handleBurnClick(entity: Entity) {
  // Prevent reopening modal if it's already open
  if (isModalOpen()) {
    console.log('Modal already open, ignoring click')
    return
  }
  
  console.log('🎯 Burn entity clicked!')
  
  // Store the entity for sound playback
  currentBurnableEntity = entity
  const transform = Transform.getOrNull(entity)
  if (transform) {
    console.log('✅ Stored burnable entity with position:', transform.position)
  } else {
    console.log('⚠️ Clicked entity has no Transform!')
  }
  
  // Check if collection selection is enabled
  if (config.enableCollectionSelection && config.collections && config.collections.length > 0) {
    console.log('📚 Collection selection enabled, showing collection chooser')
    
    // Show collection selection modal
    showCollectionSelectionModal(config.collections, async (selectedCollection: CollectionInfo) => {
      console.log('🎯 Collection selected:', selectedCollection.title)
      console.log('   Address:', selectedCollection.address)
      
      // Show loading state
      showLoadingNFTs(`Loading ${selectedCollection.title}...`)
      
      // Fetch NFTs for the selected collection
      userOwnedNFTs = await checkUserNFTs(selectedCollection)
      
      if (userOwnedNFTs.length === 0) {
        console.log('User has no NFTs from this collection')
        console.log('📝 Note: Check contract address:', selectedCollection.address)
        
        // Show different error message based on type
        if (selectedCollection.type === 'urn') {
          showErrorModal(
            'You Don\'t HODL This NFT',
            `You don't own this specific item.\n\n${selectedCollection.title}`,
            selectedCollection.imageUrl,
            selectedCollection.address,
            selectedCollection.tokenId
          )
        } else {
          showErrorModal(
            'No NFTs Found',
            `You don't own any NFTs from this collection.\n\n${selectedCollection.title}`,
            selectedCollection.imageUrl,
            selectedCollection.address
          )
        }
        return
      }

      console.log('User has', userOwnedNFTs.length, 'NFT(s) from this collection')
      
      // Show NFT selection modal
      showBurnModal(userOwnedNFTs, async (nft: UserNFT, onStatusChange: (status: string) => void) => {
        console.log('🔥 Burn callback invoked for NFT:', nft.tokenId)
        selectedNFT = nft
        const result = await burnNFT(nft, onStatusChange)
        console.log('🔥 Burn result:', result)
        if (result.success) {
          console.log('✅ Burn successful, refreshing NFTs')
          userOwnedNFTs = await checkUserNFTs(selectedCollection)
        } else {
          console.log('❌ Burn failed')
        }
        return result
      }, selectedCollection)
    })
  } else {
    // Original flow - directly show NFTs from the main contract
    const defaultCollection: CollectionInfo = {
      type: 'collection',
      address: config.contractAddress,
      title: 'NFT Collection',
      imageUrl: 'images/doge.png'
    }
    
    userOwnedNFTs = await checkUserNFTs(defaultCollection)
    
    if (userOwnedNFTs.length === 0) {
      console.log('User has no NFTs from this collection')
      console.log('📝 Note: Check contract address:', config.contractAddress)
      showErrorModal(
        'No NFTs Found',
        `You don't own any NFTs from this collection.`,
        'images/doge.png',
        config.contractAddress
      )
      return
    }

    console.log('User has', userOwnedNFTs.length, 'NFT(s) from this collection')
    
    showBurnModal(userOwnedNFTs, async (nft: UserNFT, onStatusChange: (status: string) => void) => {
      console.log('🔥 Burn callback invoked for NFT:', nft.tokenId)
      selectedNFT = nft
      const result = await burnNFT(nft, onStatusChange)
      console.log('🔥 Burn result:', result)
      if (result.success) {
        console.log('✅ Burn successful, refreshing NFTs')
        userOwnedNFTs = await checkUserNFTs(defaultCollection)
      } else {
        console.log('❌ Burn failed')
      }
      return result
    }, defaultCollection)
  }
}

/**
 * Make any entity burnable by adding click interaction
 * @param entity - The entity to make burnable
 * @param hoverText - Custom hover text (default: "Burn NFT")
 */
export function makeBurnable(entity: Entity, hoverText: string = 'Burn NFT') {
  pointerEventsSystem.onPointerDown(
    {
      entity: entity,
      opts: {
        button: InputAction.IA_POINTER,
        hoverText: hoverText
      }
    },
    () => {
      executeTask(async () => {
        await handleBurnClick(entity)
      })
    }
  )
  
  console.log('✅ Entity is now burnable!')
}

/**
 * Get the list of NFTs the user currently owns
 */
export function getUserNFTs(): UserNFT[] {
  return userOwnedNFTs
}

