import ReactEcs, { ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { playBurnCompleteSound } from './nftBurner'

interface UserNFT {
  tokenId: string
  contractAddress: string
  name?: string
  imageUrl?: string
  mintNumber?: string  // The actual mint number (extracted from description if available)
}

export interface RewardInfo {
  urn: string                  // URN of the reward item
  chance: number               // Percentage chance (e.g., 90 for 90%)
  title?: string               // Fetched from blockchain
  imageUrl?: string            // Fetched from blockchain
}

export interface CollectionInfo {
  type: 'collection' | 'urn'  // Type of item: full collection or specific URN
  address: string              // Contract address
  title: string                // Display title
  imageUrl: string             // Display image
  urn?: string                 // Full URN (only for type: 'urn')
  tokenId?: string             // Token ID extracted from URN (only for type: 'urn')
  rewards?: RewardInfo[]       // Optional rewards for burning this item
}

let isModalVisible = false
let availableNFTs: UserNFT[] = []
let selectedNFT: UserNFT | null = null
let showConfirmation = false
let burnStatus: string = ''
let isProcessing: boolean = false
let isCompleted: boolean = false
let completedTxHash: string = ''
let onConfirmCallback: (() => void) | null = null

// Reward detection state
let detectedReward: { name: string, imageUrl?: string } | null = null

// Collection selection state
let showCollectionSelection = false
let collections: CollectionInfo[] = []
let onCollectionSelectCallback: ((collection: CollectionInfo) => void) | null = null
let currentCollection: CollectionInfo | null = null
let hasCollectionSelection = false  // Track if we came from collection selection

// Loading state
let isLoadingNFTs = false
let loadingMessage = 'Loading NFTs...'

// Error state
let showError = false
let errorMessage = ''
let errorTitle = 'No NFTs Found'
let errorImageUrl = ''
let errorContractAddress = ''
let errorTokenId = ''

// MetaMask network prompt state
let isMetaMaskPromptVisible = false
let onMetaMaskConfirmCallback: (() => void) | null = null
let onMetaMaskCancelCallback: (() => void) | null = null

export function showMetaMaskPrompt(onConfirm: () => void, onCancel: () => void) {
  isMetaMaskPromptVisible = true
  onMetaMaskConfirmCallback = onConfirm
  onMetaMaskCancelCallback = onCancel
  console.log('🦊 MetaMask network prompt shown')
}

export function hideMetaMaskPrompt() {
  isMetaMaskPromptVisible = false
  onMetaMaskConfirmCallback = null
  onMetaMaskCancelCallback = null
  console.log('🦊 MetaMask network prompt hidden')
}

export function updateDetectedReward(reward: { name: string, imageUrl?: string }) {
  detectedReward = reward
  console.log('🎁 Reward detected and UI updated:', reward.name)
}

export function clearDetectedReward() {
  detectedReward = null
}

export function showCollectionSelectionModal(collectionList: CollectionInfo[], onSelect: (collection: CollectionInfo) => void) {
  isModalVisible = true
  showCollectionSelection = true
  collections = collectionList
  onCollectionSelectCallback = onSelect
  hasCollectionSelection = true
  availableNFTs = []
  selectedNFT = null
  showConfirmation = false
  burnStatus = ''
  isProcessing = false
  isCompleted = false
  completedTxHash = ''
  isLoadingNFTs = false
  console.log('📚 Collection selection modal shown with', collectionList.length, 'collections')
}

export function showLoadingNFTs(message?: string) {
  showCollectionSelection = false
  isLoadingNFTs = true
  showError = false
  if (message) loadingMessage = message
  console.log('⏳ Loading NFTs...')
}

export function showErrorModal(title: string, message: string, imageUrl?: string, contractAddress?: string, tokenId?: string) {
  isModalVisible = true
  showCollectionSelection = false
  isLoadingNFTs = false
  showError = true
  errorTitle = title
  errorMessage = message
  errorImageUrl = imageUrl || ''
  errorContractAddress = contractAddress || ''
  errorTokenId = tokenId || ''
  console.log('❌ Error modal shown:', title)
}

export function showBurnModal(nfts: UserNFT[], onConfirm: (nft: UserNFT, onStatusChange: (status: string) => void) => void, collection?: CollectionInfo) {
  isModalVisible = true
  showCollectionSelection = false
  isLoadingNFTs = false
  showError = false
  availableNFTs = nfts
  selectedNFT = null
  showConfirmation = false
  burnStatus = ''
  isProcessing = false
  isCompleted = false
  completedTxHash = ''
  onConfirmCallback = onConfirm as any
  currentCollection = collection || null
}

export function hideBurnModal() {
  isModalVisible = false
  showCollectionSelection = false
  isLoadingNFTs = false
  showError = false
  errorImageUrl = ''
  errorContractAddress = ''
  errorTokenId = ''
  collections = []
  onCollectionSelectCallback = null
  currentCollection = null
  hasCollectionSelection = false
  availableNFTs = []
  selectedNFT = null
  showConfirmation = false
  burnStatus = ''
  isProcessing = false
  isCompleted = false
  completedTxHash = ''
  onConfirmCallback = null
  detectedReward = null
}

function goBackToCollectionSelection() {
  // Go back to collection selection screen
  showCollectionSelection = true
  isLoadingNFTs = false
  showError = false
  errorImageUrl = ''
  errorContractAddress = ''
  errorTokenId = ''
  currentCollection = null
  availableNFTs = []
  selectedNFT = null
  showConfirmation = false
  burnStatus = ''
  isProcessing = false
  isCompleted = false
  completedTxHash = ''
  console.log('🔙 Going back to collection selection')
}

export function isModalOpen() {
  return isModalVisible
}

function selectNFT(nft: UserNFT) {
  selectedNFT = nft
  showConfirmation = true
}

function goBack() {
  selectedNFT = null
  showConfirmation = false
}

const BurnModalUI = () => {
  // Determine which view to show
  let modalWidth = 700
  let modalHeight = 860
  let titleText = 'Select NFT to Burn'
  let titleColor = Color4.create(1, 0.3, 0.2, 1)
  
  if (showCollectionSelection) {
    modalWidth = 700
    // Calculate height based on number of collections (supports wrapping)
    const rowsNeeded = Math.ceil(collections.length / 3)
    modalHeight = 120 + (rowsNeeded * 230) + 100  // Title + (rows * card height) + button
    titleText = 'Select Collection Item to Burn'
    titleColor = Color4.create(1, 0.3, 0.2, 1)
  } else if (isLoadingNFTs) {
    modalWidth = 500
    modalHeight = 250
    titleText = 'Loading NFTs'
    titleColor = Color4.create(1, 0.8, 0.2, 1)
  } else if (showError) {
    modalWidth = 500
    modalHeight = errorImageUrl ? 450 : 300
    titleText = errorTitle
    titleColor = Color4.create(1, 0.3, 0.2, 1)
  } else if (isCompleted) {
    modalWidth = 500
    modalHeight = 350
    titleText = 'BURN COMPLETE'
    titleColor = Color4.create(0.2, 1, 0.3, 1)
  } else if (isProcessing) {
    modalWidth = 500
    modalHeight = 250
    titleText = 'Processing...'
    titleColor = Color4.create(1, 0.8, 0.2, 1)
  } else if (showConfirmation) {
    modalWidth = 500
    // Calculate height based on rewards (if any)
    let rewardsHeight = 0
    if (currentCollection && currentCollection.rewards && currentCollection.rewards.length > 0) {
      rewardsHeight = 60 + (currentCollection.rewards.length * 50) // Title + (rewards * item height)
    }
    modalHeight = 400 + rewardsHeight
    titleText = 'Confirm Burn'
  }
  
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        display: isModalVisible ? 'flex' : 'none',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column'
      }}
    >
      {/* Dark overlay */}
      <UiEntity
        uiTransform={{
          width: '100%',
          height: '100%',
          positionType: 'absolute'
        }}
        uiBackground={{
          color: Color4.create(0, 0, 0, 0.7)
        }}
      />

      {/* Background image layer */}
      <UiEntity
        uiTransform={{
          width: 2048,
          height: 2048,
          positionType: 'absolute'
        }}
        uiBackground={{
          textureMode: 'center',
          texture: {
            src: 'images/ui-bg-long.png'
          }
        }}
      />

      {/* Modal container (transparent) */}
      <UiEntity
        uiTransform={{
          width: modalWidth,
          height: modalHeight,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 20
        }}
        uiBackground={{
          color: Color4.create(0, 0, 0, 0)
        }}
      >
        {/* Title */}
        <UiEntity
          uiTransform={{
            width: '100%',
            height: showError ? 40 : 50,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            margin: { bottom: showError ? 5 : 10 }
          }}
          uiText={{
            value: titleText,
            fontSize: 28,
            color: titleColor,
            textAlign: 'middle-center'
          }}
        />

        {/* Content Area (grows to fill space) */}
        <UiEntity
          uiTransform={{
            width: '100%',
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: showCollectionSelection || showConfirmation || isProcessing || isCompleted ? 'center' : 'flex-start',
            alignItems: 'center'
          }}
        >
          {/* Collection Selection View */}
          {showCollectionSelection && collections.length > 0 && (
            <UiEntity
              uiTransform={{
                width: '100%',
                height: 'auto',
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 10,
                margin: { top: 20 }
              }}
            >
            {collections.map((collection, index) => (
              <UiEntity
                key={`collection-${index}`}
                uiTransform={{
                  width: 180,
                  height: 220,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: 10,
                  margin: { left: 8, right: 8, top: 5, bottom: 5 }
                }}
                uiBackground={{
                  color: Color4.create(0.25, 0.25, 0.25, 1)
                }}
                onMouseDown={() => {
                  if (onCollectionSelectCallback) {
                    console.log(`🎯 Collection selected: ${collection.title}`)
                    onCollectionSelectCallback(collection)
                  }
                }}
              >
                {/* Collection Image */}
                <UiEntity
                  uiTransform={{
                    width: 130,
                    height: 130,
                    margin: { bottom: 10 }
                  }}
                  uiBackground={{
                    textureMode: 'stretch',
                    texture: {
                      src: collection.imageUrl
                    }
                  }}
                />
                {/* Collection Title */}
                <UiEntity
                  uiTransform={{
                    width: '100%',
                    height: 'auto'
                  }}
                  uiText={{
                    value: collection.title,
                    fontSize: 14,
                    color: Color4.White(),
                    textAlign: 'middle-center'
                  }}
                />
              </UiEntity>
            ))}
            </UiEntity>
          )}

          {/* NFT Selection Grid (when not confirming and not processing and not completed) */}
          {!showCollectionSelection && !showConfirmation && !isProcessing && !isCompleted && !showError && !isLoadingNFTs && (
            <UiEntity
              uiTransform={{
                width: '100%',
                height: 650,
                overflow: 'scroll',
                margin: { top: 5 }
              }}
            >
              <UiEntity
                uiTransform={{
                  width: '100%',
                  height: 'auto',
                  display: 'flex',
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  alignContent: 'flex-start',
                  padding: { top: 5, bottom: 10, left: 10, right: 10 }
                }}
              >
              {availableNFTs.map((nft, index) => (
              <UiEntity
                key={`nft-${nft.tokenId}`}
                uiTransform={{
                  width: 130,
                  height: 200,
                  margin: { left: 10, right: 10, top: 10, bottom: 10 },
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: 10
                }}
                uiBackground={{
                  color: Color4.create(0.25, 0.25, 0.25, 1)
                }}
                onMouseDown={() => selectNFT(nft)}
              >
                {/* NFT Image */}
                <UiEntity
                  uiTransform={{
                    width: 110,
                    height: 110,
                    margin: { bottom: 10 }
                  }}
                  uiBackground={{
                    textureMode: 'stretch',
                    texture: {
                      src: nft.imageUrl || 'images/doge.png'
                    }
                  }}
                />
                {/* NFT Name */}
                {nft.name && (
                  <UiEntity
                    uiTransform={{
                      width: '100%',
                      height: 'auto',
                      margin: { bottom: 3 }
                    }}
                    uiText={{
                      value: nft.name,
                      fontSize: 12,
                      color: Color4.create(0.9, 0.9, 0.9, 1),
                      textAlign: 'middle-center'
                    }}
                  />
                )}
                {/* Mint Number or Token ID */}
                <UiEntity
                  uiTransform={{
                    width: '100%',
                    height: 'auto'
                  }}
                  uiText={{
                    value: nft.mintNumber ? `Mint #${nft.mintNumber}` : `#${nft.tokenId}`,
                    fontSize: 14,
                    color: Color4.White(),
                    textAlign: 'middle-center'
                  }}
                />
              </UiEntity>
            ))}
              </UiEntity>
            </UiEntity>
          )}

          {/* Confirmation View */}
          {showConfirmation && selectedNFT && !isProcessing && !isCompleted && (
            <UiEntity
              uiTransform={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
            {/* NFT Image */}
            <UiEntity
              uiTransform={{
                width: 150,
                height: 150,
                margin: { bottom: 15 },
                flexShrink: 0
              }}
              uiBackground={{
                textureMode: 'stretch',
                texture: {
                  src: selectedNFT.imageUrl || 'images/doge.png'
                }
              }}
            />

            {/* NFT Name */}
            {selectedNFT.name && (
              <UiEntity
                uiTransform={{
                  width: '90%',
                  height: 'auto',
                  margin: { bottom: 5 },
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
                uiText={{
                  value: selectedNFT.name,
                  fontSize: 20,
                  color: Color4.create(0.9, 0.9, 0.9, 1),
                  textAlign: 'middle-center'
                }}
              />
            )}
            {/* Mint Number or Token ID */}
            <UiEntity
              uiTransform={{
                width: '90%',
                height: 'auto',
                margin: { bottom: 10 },
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              uiText={{
                value: selectedNFT.mintNumber ? `Mint #${selectedNFT.mintNumber}` : `Token ID: ${selectedNFT.tokenId}`,
                fontSize: 22,
                color: Color4.create(1, 1, 1, 1),
                textAlign: 'middle-center'
              }}
            />

            {/* Warning */}
            <UiEntity
              uiTransform={{
                width: '90%',
                height: 'auto',
                margin: { bottom: 20 },
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              uiText={{
                value: '⚠️ This action cannot be undone!\nYour NFT will be sent to the burn address.',
                fontSize: 16,
                color: Color4.create(1, 0.8, 0.2, 1),
                textAlign: 'middle-center'
              }}
            />

            {/* Rewards Section (if configured) */}
            {currentCollection && currentCollection.rewards && currentCollection.rewards.length > 0 && (
              <UiEntity
                uiTransform={{
                  width: '90%',
                  height: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  margin: { bottom: 20 }
                }}
              >
                {/* Rewards Title */}
                <UiEntity
                  uiTransform={{
                    width: '100%',
                    height: 'auto',
                    margin: { bottom: 10 },
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                  uiText={{
                    value: 'Possible Rewards (OR)',
                    fontSize: 18,
                    color: Color4.create(0.2, 1, 0.3, 1),
                    textAlign: 'middle-center'
                  }}
                />

                {/* Reward Items */}
                {currentCollection.rewards.map((reward, index) => (
                  <UiEntity
                    key={`reward-${index}`}
                    uiTransform={{
                      width: '100%',
                      height: 'auto',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: { bottom: 8 }
                    }}
                  >
                    {/* Reward Image */}
                    {reward.imageUrl && (
                      <UiEntity
                        uiTransform={{
                          width: 40,
                          height: 40,
                          margin: { right: 10 }
                        }}
                        uiBackground={{
                          textureMode: 'stretch',
                          texture: {
                            src: reward.imageUrl
                          }
                        }}
                      />
                    )}
                    
                    {/* Reward Name and Chance */}
                    <UiEntity
                      uiTransform={{
                        width: 'auto',
                        height: 'auto'
                      }}
                      uiText={{
                        value: `${reward.title || 'Reward'} (${reward.chance}%)`,
                        fontSize: 14,
                        color: Color4.create(0.9, 0.9, 0.9, 1),
                        textAlign: 'middle-left'
                      }}
                    />
                  </UiEntity>
                ))}
              </UiEntity>
            )}

            <UiEntity
              uiTransform={{
                width: '100%',
                height: 60,
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-around',
                alignItems: 'center'
              }}
            >
              <UiEntity
                uiTransform={{
                  width: 120,
                  height: 50
                }}
                uiBackground={{
                  color: Color4.create(0.3, 0.3, 0.3, 1)
                }}
                uiText={{
                  value: 'Back',
                  fontSize: 18,
                  color: Color4.White(),
                  textAlign: 'middle-center'
                }}
                onMouseDown={() => goBack()}
              />

              <UiEntity
                uiTransform={{
                  width: 150,
                  height: 50
                }}
                uiBackground={{
                  color: Color4.create(0.8, 0.2, 0.1, 1)
                }}
                uiText={{
                  value: 'BURN',
                  fontSize: 20,
                  color: Color4.White(),
                  textAlign: 'middle-center'
                }}
                onMouseDown={() => {
                  console.log('🔥 BURN button clicked!')
                  console.log('   selectedNFT:', selectedNFT)
                  console.log('   onConfirmCallback exists:', !!onConfirmCallback)
                  if (onConfirmCallback && selectedNFT) {
                    console.log('   Calling burn callback...')
                    isProcessing = true
                    burnStatus = 'Initializing...'
                    ;(async () => {
                      const result = await (onConfirmCallback as any)(selectedNFT, (status: string) => {
                        console.log('📝 Status update:', status)
                        burnStatus = status
                      })
                      
                      // Check result and update state
                      if (result && result.success) {
                        isProcessing = false
                        isCompleted = true
                        completedTxHash = result.txHash || ''
                        console.log('✅ Burn complete with tx hash:', completedTxHash)
                        
                        // Play completion sound
                        playBurnCompleteSound()
                      } else if (burnStatus.toLowerCase().includes('confirmed') || burnStatus.toLowerCase().includes('complete')) {
                        isProcessing = false
                        isCompleted = true
                        
                        // Play completion sound
                        playBurnCompleteSound()
                      }
                    })()
                  } else {
                    console.log('   ❌ Cannot burn: missing callback or NFT')
                  }
                }}
              />
            </UiEntity>
            </UiEntity>
          )}
          
          {/* Loading NFTs View */}
          {isLoadingNFTs && (
            <UiEntity
              uiTransform={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
            <UiEntity
              uiTransform={{
                width: '100%',
                height: 'auto',
                margin: { bottom: 20 },
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              uiText={{
                value: loadingMessage,
                fontSize: 20,
                color: Color4.create(1, 1, 1, 1),
                textAlign: 'middle-center'
              }}
            />
            
            <UiEntity
              uiTransform={{
                width: '100%',
                height: 'auto',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              uiText={{
                value: 'Please wait while we fetch your NFTs...',
                fontSize: 14,
                color: Color4.create(0.7, 0.7, 0.7, 1),
                textAlign: 'middle-center'
              }}
            />
            </UiEntity>
          )}
          
          {/* Error View */}
          {showError && (
            <UiEntity
              uiTransform={{
                width: '100%',
                height: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                margin: { top: 20 }
              }}
            >
              {errorImageUrl && (
                <UiEntity
                  uiTransform={{
                    width: 150,
                    height: 150,
                    margin: { bottom: 15 },
                    flexShrink: 0
                  }}
                  uiBackground={{
                    textureMode: 'stretch',
                    texture: {
                      src: errorImageUrl
                    }
                  }}
                />
              )}
              
              {!errorImageUrl && (
                <UiEntity
                  uiTransform={{
                    width: '100%',
                    height: 'auto',
                    margin: { bottom: 20 }
                  }}
                  uiText={{
                    value: '❌',
                    fontSize: 60,
                    color: Color4.create(1, 0.3, 0.2, 1),
                    textAlign: 'middle-center'
                  }}
                />
              )}
              
              <UiEntity
                uiTransform={{
                  width: '90%',
                  height: 'auto',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
                uiText={{
                  value: errorMessage,
                  fontSize: 18,
                  color: Color4.White(),
                  textAlign: 'middle-center'
                }}
              />
            </UiEntity>
          )}
          
          {/* Processing View */}
          {isProcessing && (
            <UiEntity
              uiTransform={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
            <UiEntity
              uiTransform={{
                width: '90%',
                height: 'auto',
                margin: { bottom: 20 }
              }}
              uiText={{
                value: burnStatus || 'Processing transaction...',
                fontSize: 18,
                color: Color4.create(1, 1, 1, 1),
                textAlign: 'middle-center'
              }}
            />
            
            <UiEntity
              uiTransform={{
                width: '90%',
                height: 'auto'
              }}
              uiText={{
                value: 'Please wait while your transaction is being confirmed on the blockchain.',
                fontSize: 14,
                color: Color4.create(0.7, 0.7, 0.7, 1),
                textAlign: 'middle-center'
              }}
            />
            </UiEntity>
          )}
          
          {/* Completion View */}
          {isCompleted && (
            <UiEntity
              uiTransform={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
            {/* Show congratulations if reward detected, otherwise show processing */}
            {detectedReward && (
              <UiEntity
                uiTransform={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                {/* Congratulations Title */}
                <UiEntity
                  uiTransform={{
                    width: '100%',
                    height: 'auto',
                    margin: { bottom: 20 },
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                  uiText={{
                    value: '🎉 CONGRATULATIONS! 🎉',
                    fontSize: 24,
                    color: Color4.create(1, 0.84, 0, 1), // Gold color
                    textAlign: 'middle-center'
                  }}
                />
                
                {/* Reward Image */}
                {detectedReward.imageUrl && (
                  <UiEntity
                    uiTransform={{
                      width: 150,
                      height: 150,
                      margin: { bottom: 15 }
                    }}
                    uiBackground={{
                      textureMode: 'stretch',
                      texture: {
                        src: detectedReward.imageUrl
                      }
                    }}
                  />
                )}
                
                {/* Reward Text */}
                <UiEntity
                  uiTransform={{
                    width: '90%',
                    height: 'auto',
                    margin: { bottom: 20 },
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                  uiText={{
                    value: `You received:\n${detectedReward.name}`,
                    fontSize: 20,
                    color: Color4.create(0.2, 1, 0.3, 1),
                    textAlign: 'middle-center'
                  }}
                />
              </UiEntity>
            )}
            
            {!detectedReward && (
              <UiEntity
                uiTransform={{
                  width: '100%',
                  height: 'auto',
                  margin: { bottom: 20 },
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
                uiText={{
                  value: 'REWARD PROCESSING...',
                  fontSize: 20,
                  color: Color4.create(0.2, 1, 0.3, 1),
                  textAlign: 'middle-center'
                }}
              />
            )}
            
            {completedTxHash && (
              <UiEntity
                uiTransform={{
                  width: 200,
                  height: 50,
                  margin: { bottom: 15 }
                }}
                uiBackground={{
                  color: Color4.create(0.4, 0.4, 0.8, 1)
                }}
                uiText={{
                  value: 'View on Polygonscan',
                  fontSize: 16,
                  color: Color4.White(),
                  textAlign: 'middle-center'
                }}
                onMouseDown={async () => {
                  const url = `https://polygonscan.com/tx/${completedTxHash}`
                  console.log('Opening Polygonscan:', url)
                  try {
                    const { openExternalUrl } = await import('~system/RestrictedActions')
                    await openExternalUrl({ url })
                  } catch (error) {
                    console.error('Error opening URL:', error)
                  }
                }}
              />
            )}
            
            <UiEntity
              uiTransform={{
                width: 150,
                height: 50
              }}
              uiBackground={{
                color: Color4.create(0.2, 0.8, 0.3, 1)
              }}
              uiText={{
                value: 'Close',
                fontSize: 20,
                color: Color4.White(),
                textAlign: 'middle-center'
              }}
              onMouseDown={() => hideBurnModal()}
            />
            </UiEntity>
          )}
        </UiEntity>

        {/* Button section for error view */}
        {showError && (
          <UiEntity
            uiTransform={{
              width: '100%',
              height: 60,
              margin: { top: 15 },
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            {/* Back button */}
            <UiEntity
              uiTransform={{
                width: 150,
                height: 50,
                margin: { left: 5, right: 5 }
              }}
              uiBackground={{
                color: Color4.create(0.3, 0.3, 0.3, 1)
              }}
              uiText={{
                value: 'Back',
                fontSize: 20,
                color: Color4.White(),
                textAlign: 'middle-center'
              }}
              onMouseDown={() => {
                if (hasCollectionSelection) {
                  goBackToCollectionSelection()
                } else {
                  hideBurnModal()
                }
              }}
            />

            {/* Marketplace link button (only if we have the contract address) */}
            {errorContractAddress && (
              <UiEntity
                uiTransform={{
                  width: 200,
                  height: 50,
                  margin: { left: 5, right: 5 }
                }}
                uiBackground={{
                  color: Color4.create(0.4, 0.4, 0.8, 1)
                }}
                uiText={{
                  value: 'View in Marketplace',
                  fontSize: 16,
                  color: Color4.White(),
                  textAlign: 'middle-center'
                }}
                onMouseDown={async () => {
                  // Use different URL format based on whether it's a specific item (URN) or collection
                  const url = errorTokenId 
                    ? `https://decentraland.org/marketplace/contracts/${errorContractAddress}/items/${errorTokenId}`
                    : `https://decentraland.org/marketplace/collections/${errorContractAddress}`
                  console.log('Opening marketplace:', url)
                  try {
                    const { openExternalUrl } = await import('~system/RestrictedActions')
                    await openExternalUrl({ url })
                  } catch (error) {
                    console.error('Error opening URL:', error)
                  }
                }}
              />
            )}
          </UiEntity>
        )}

        {/* Button section for NFT selection view */}
        {!showCollectionSelection && !showConfirmation && !isProcessing && !isCompleted && !isLoadingNFTs && !showError && (
          <UiEntity
            uiTransform={{
              width: '100%',
              height: 60,
              margin: { top: 30 },
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            {/* Back button */}
            <UiEntity
              uiTransform={{
                width: 150,
                height: 50,
                margin: { left: 5, right: 5 }
              }}
              uiBackground={{
                color: Color4.create(0.3, 0.3, 0.3, 1)
              }}
              uiText={{
                value: 'Back',
                fontSize: 20,
                color: Color4.White(),
                textAlign: 'middle-center'
              }}
              onMouseDown={() => {
                if (hasCollectionSelection) {
                  goBackToCollectionSelection()
                } else {
                  hideBurnModal()
                }
              }}
            />

            {/* Marketplace link button (if we have collection info) */}
            {currentCollection && (
              <UiEntity
                uiTransform={{
                  width: 200,
                  height: 50,
                  margin: { left: 5, right: 5 }
                }}
                uiBackground={{
                  color: Color4.create(0.4, 0.4, 0.8, 1)
                }}
                uiText={{
                  value: 'View in Marketplace',
                  fontSize: 16,
                  color: Color4.White(),
                  textAlign: 'middle-center'
                }}
                onMouseDown={async () => {
                  if (!currentCollection) return
                  // Use different URL format based on whether it's a specific item (URN) or collection
                  const url = currentCollection.type === 'urn' && currentCollection.tokenId
                    ? `https://decentraland.org/marketplace/contracts/${currentCollection.address}/items/${currentCollection.tokenId}`
                    : `https://decentraland.org/marketplace/collections/${currentCollection.address}`
                  console.log('Opening marketplace:', url)
                  try {
                    const { openExternalUrl } = await import('~system/RestrictedActions')
                    await openExternalUrl({ url })
                  } catch (error) {
                    console.error('Error opening URL:', error)
                  }
                }}
              />
            )}
          </UiEntity>
        )}

        {/* Cancel button for collection selection view only */}
        {showCollectionSelection && (
          <UiEntity
            uiTransform={{
              width: 150,
              height: 50,
              margin: { top: 30 },
              padding: { top: 12, bottom: 12, left: 20, right: 20 }
            }}
            uiBackground={{
              color: Color4.create(0.3, 0.3, 0.3, 1)
            }}
            uiText={{
              value: 'Back',
              fontSize: 20,
              color: Color4.White(),
              textAlign: 'middle-center'
            }}
            onMouseDown={() => hideBurnModal()}
          />
        )}
      </UiEntity>
    </UiEntity>
  )
}

import { NpcUtilsUi } from 'dcl-npc-toolkit'

function MetaMaskPromptUI() {
  if (!isMetaMaskPromptVisible) return null

  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        positionType: 'absolute'
      }}
    >
      {/* Dark overlay */}
      <UiEntity
        uiTransform={{
          width: '100%',
          height: '100%',
          positionType: 'absolute'
        }}
        uiBackground={{
          color: Color4.create(0, 0, 0, 0.7)
        }}
      />

      {/* Background image layer */}
      <UiEntity
        uiTransform={{
          width: 2048,
          height: 2048,
          positionType: 'absolute'
        }}
        uiBackground={{
          textureMode: 'center',
          texture: {
            src: 'images/ui-bg-long.png'
          }
        }}
      />

      {/* Modal container */}
      <UiEntity
        uiTransform={{
          width: 500,
          height: 300,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}
        uiBackground={{
          color: Color4.create(0, 0, 0, 0)
        }}
      >
        {/* Title */}
        <UiEntity
          uiTransform={{
            width: '90%',
            height: 60,
            margin: { bottom: 20 }
          }}
          uiText={{
            value: 'Network Change Required',
            fontSize: 28,
            color: Color4.White(),
            textAlign: 'middle-center'
          }}
        />

        {/* Message */}
        <UiEntity
          uiTransform={{
            width: '90%',
            height: 100,
            margin: { bottom: 20 }
          }}
          uiText={{
            value: 'Please manually set your WEB BROWSER WALLET to Polygon chain before proceeding.',
            fontSize: 20,
            color: Color4.create(0.9, 0.9, 0.9, 1),
            textAlign: 'middle-center'
          }}
        />

        {/* Buttons container */}
        <UiEntity
          uiTransform={{
            width: '90%',
            height: 60,
            flexDirection: 'row',
            justifyContent: 'space-between'
          }}
        >
          {/* Cancel button */}
          <UiEntity
            uiTransform={{
              width: 200,
              height: 50
            }}
            uiBackground={{
              color: Color4.create(0.4, 0.4, 0.4, 1)
            }}
            uiText={{
              value: 'Cancel',
              fontSize: 22,
              color: Color4.White(),
              textAlign: 'middle-center'
            }}
            onMouseDown={() => {
              console.log('🦊 User cancelled MetaMask prompt')
              if (onMetaMaskCancelCallback) {
                onMetaMaskCancelCallback()
              }
              hideMetaMaskPrompt()
            }}
          />

          {/* OK button */}
          <UiEntity
            uiTransform={{
              width: 200,
              height: 50
            }}
            uiBackground={{
              color: Color4.create(0.2, 0.8, 0.2, 1)
            }}
            uiText={{
              value: "OK, I'M DONE",
              fontSize: 22,
              color: Color4.White(),
              textAlign: 'middle-center'
            }}
            onMouseDown={() => {
              console.log('🦊 User confirmed MetaMask network change')
              if (onMetaMaskConfirmCallback) {
                onMetaMaskConfirmCallback()
              }
              hideMetaMaskPrompt()
            }}
          />
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}

import { KersplatUI } from '../kersplatUI'
import { NameGateUI, NameVerificationUI } from '../nameGateUI'

const SceneOwnedUi = () => [
  BurnModalUI(),
  NpcUtilsUi(),
  MetaMaskPromptUI(),
  KersplatUI(),
  NameGateUI(),
  NameVerificationUI()
]

export function setupUi() {
  // Combine both UIs: Burn Modal + NPC Dialog
  ReactEcsRenderer.setUiRenderer(SceneOwnedUi)
}

