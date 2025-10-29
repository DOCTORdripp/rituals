import { getUserData } from '~system/UserIdentity'

// Decentraland Names collection address (Ethereum mainnet)
const DCL_NAMES_CONTRACT = '0x2a187453064356c898cae034eaed119e1663acb8'

// Cache to avoid repeated API calls
const nameOwnershipCache = new Map<string, boolean>()

/**
 * Checks if a user owns a Decentraland Name
 * @param userAddress The user's Ethereum address
 * @returns Promise<boolean> true if user owns at least one name
 */
export async function checkDecentralandNameOwnership(userAddress: string): Promise<boolean> {
  // Normalize address to lowercase
  const normalizedAddress = userAddress.toLowerCase()
  
  // Check cache first
  if (nameOwnershipCache.has(normalizedAddress)) {
    const cached = nameOwnershipCache.get(normalizedAddress)!
    console.log(`🎭 Name ownership cache hit for ${normalizedAddress}: ${cached}`)
    return cached
  }

  try {
    console.log(`🎭 Checking Decentraland Name ownership for address: ${normalizedAddress}`)
    
    // Try multiple methods to check ownership
    
    // Method 1: Check via Decentraland Graph API
    const graphUrl = 'https://api.studio.thegraph.com/query/49472/marketplace-ethereum/version/latest'
    const graphQuery = {
      query: `
        query GetNames($owner: String!) {
          nfts(first: 1, where: {owner: $owner, category: ens}) {
            id
            tokenId
            owner
          }
        }
      `,
      variables: {
        owner: normalizedAddress
      }
    }
    
    console.log(`🎭 Querying Graph API for address: ${normalizedAddress}`)
    
    const graphResponse = await fetch(graphUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(graphQuery)
    })
    
    if (graphResponse.ok) {
      const graphData = await graphResponse.json()
      console.log(`🎭 Graph API response:`, JSON.stringify(graphData))
      
      if (graphData.data && graphData.data.nfts && graphData.data.nfts.length > 0) {
        console.log(`✅ User ${normalizedAddress} HAS a Decentraland Name (via Graph)`)
        console.log(`🎭 Found ${graphData.data.nfts.length} names`)
        nameOwnershipCache.set(normalizedAddress, true)
        return true
      } else {
        console.log(`🎭 Graph API returned no names or empty data`)
      }
    } else {
      console.log(`🎭 Graph API failed with status: ${graphResponse.status}`)
    }
    
    // Method 2: Check via NFT API as fallback
    const nftApiUrl = `https://nft-api.decentraland.org/v1/nfts?owner=${normalizedAddress}&contractAddress=${DCL_NAMES_CONTRACT}&first=1`
    
    console.log(`🎭 Trying NFT API: ${nftApiUrl}`)
    
    const nftResponse = await fetch(nftApiUrl)
    
    if (nftResponse.ok) {
      const nftData = await nftResponse.json()
      console.log(`🎭 NFT API response:`, JSON.stringify(nftData))
      console.log(`🎭 NFT API data array:`, nftData.data)
      console.log(`🎭 NFT API data length:`, nftData.data ? nftData.data.length : 'undefined')
      console.log(`🎭 NFT API total count:`, nftData.total)
      
      // Check either the data array has items OR the total count is > 0
      const hasName = (nftData.data && nftData.data.length > 0) || (nftData.total && nftData.total > 0)
      
      // Cache the result
      nameOwnershipCache.set(normalizedAddress, hasName)
      
      console.log(`🎭 User ${normalizedAddress} ${hasName ? 'HAS' : 'DOES NOT HAVE'} a Decentraland Name (via NFT API)`)
      
      return hasName
    } else {
      console.log(`🎭 NFT API failed with status: ${nftResponse.status}`)
    }
    
    // If both methods fail, deny access
    console.error(`🎭 All API methods failed for ${normalizedAddress}`)
    return false
    
  } catch (error) {
    console.error('🎭 Error checking Decentraland Name ownership:', error)
    // On error, deny access to be safe
    return false
  }
}

/**
 * Checks if the current player owns a Decentraland Name
 * @returns Promise<boolean> true if current player owns at least one name
 */
export async function checkCurrentPlayerHasName(): Promise<boolean> {
  try {
    // Get player's user data (using same method as burn module)
    const userData = await getUserData({})
    
    console.log('🎭 Raw user data:', userData)
    
    if (!userData || !userData.data) {
      console.error('🎭 Failed to get user data - userData:', userData)
      return false
    }
    
    console.log('🎭 User data.data:', userData.data)
    
    // Use publicKey (wallet address) instead of userId
    const userAddress = userData.data.publicKey
    
    if (!userAddress) {
      console.error('🎭 No wallet address found in userData.data.publicKey')
      console.error('🎭 Available keys:', Object.keys(userData.data))
      return false
    }
    
    console.log(`🎭 Found wallet address: ${userAddress}`)
    console.log(`🎭 Checking name ownership for address: ${userAddress}`)
    
    return await checkDecentralandNameOwnership(userAddress)
  } catch (error) {
    console.error('🎭 Error checking current player name ownership:', error)
    return false
  }
}

/**
 * Clears the ownership cache (useful for testing or manual refresh)
 */
export function clearNameOwnershipCache() {
  nameOwnershipCache.clear()
  console.log('🎭 Name ownership cache cleared')
}

