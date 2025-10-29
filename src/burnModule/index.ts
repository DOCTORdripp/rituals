/**
 * NFT BURN MODULE - Main Export
 * 
 * Drop-in module for burning NFTs in Decentraland scenes.
 * 
 * @example
 * ```typescript
 * import { setupNFTBurnSystem, makeBurnable } from './burnModule'
 * 
 * export function main() {
 *   setupNFTBurnSystem({
 *     contractAddress: '0xYourNFTContract',
 *     testMode: false
 *   })
 *   
 *   const myEntity = engine.addEntity()
 *   makeBurnable(myEntity, 'Burn NFT')
 * }
 * ```
 */

export { initNFTBurnSystem, makeBurnable, burnNFT, getUserNFTs, playBurnCompleteSound, initCollectionsFromContracts, initCollectionFromURN, initCollectionsFromURNs } from './nftBurner'
export type { NFTBurnConfig, UserNFT } from './nftBurner'
export { setupUi } from './ui'
export type { CollectionInfo } from './ui'

import { initNFTBurnSystem } from './nftBurner'
import { setupUi } from './ui'
import type { NFTBurnConfig } from './nftBurner'

/**
 * Quick setup function - initializes both the burn system and UI
 * @param config - Your NFT burn configuration
 */
export function setupNFTBurnSystem(config: NFTBurnConfig) {
  initNFTBurnSystem(config)
  setupUi()
}

