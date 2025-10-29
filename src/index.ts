import { engine, GltfContainer, Transform, MeshCollider, MeshRenderer, Material, LightSource, AudioSource, executeTask, TextShape, Billboard, BillboardMode, VideoPlayer } from '@dcl/sdk/ecs'
import { setupNFTBurnSystem, makeBurnable, initCollectionsFromContracts, initCollectionFromURN } from './burnModule'
import { createCubeMappedSkybox, createSecondSkybox } from './skybox'
import { movePlayerTo } from '~system/RestrictedActions'
import { Vector3, Quaternion, Color3, Color4 } from '@dcl/sdk/math'
import * as utils from '@dcl-sdk/utils'
import { createWalkingNPC, createSpawnExitTrigger } from './npcSystem'
import { showMetaMaskPrompt } from './burnModule/ui'
import { showKersplatImage } from './kersplatUI'
import { createCandles, createCircularCandleArray } from './candleMaker'
import { setupTreeCinematicCamera, setupPortalCinematicCamera, setupNPCCinematicCamera, setupRunningCinematicCamera, setupLandingCinematicCamera, createCameraTriggers, resetTreeCamera } from './cameraSystem'
import { checkCurrentPlayerHasName } from './nameGate'
import { showNameGatePrompt, showNameVerificationNotification } from './nameGateUI'

// ═══════════════════════════════════════════════════════════════
// MASTER SHUTDOWN CONTROL - RockScape Portal & Teleport
// ═══════════════════════════════════════════════════════════════
// Set to TRUE to permanently disable the portal model and teleport at rockScape
const ROCKSCAPE_PORTAL_SHUTDOWN = false
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// TIMED LAUNCH CONTROL - RockScape Portal & Teleport
// ═══════════════════════════════════════════════════════════════
// Set to TRUE to enable timed launch (countdown timer until portal appears)
const ENABLE_TIMED_LAUNCH = true

// Launch time configuration (UTC timestamps)
// Example: new Date('2025-10-28T20:00:00Z').getTime() for Oct 28, 2025 8:00 PM UTC
const LAUNCH_START_TIME = new Date('2025-11-01T01:00:00Z').getTime()  // Portal becomes visible at this time
const LAUNCH_END_TIME = 0    // Portal closes at this time (set to 0 to never close)

// Countdown display position (above the teleport trigger that goes down)
const COUNTDOWN_POSITION = Vector3.create(168.8, 24, -32)  // 2m above teleport trigger
// ═══════════════════════════════════════════════════════════════

// Create entity for the TV
const tv = engine.addEntity()

// Create entity for the rockScape
const rockScape = engine.addEntity()

// Create entity for the rockFloor
const rockFloor = engine.addEntity()

// Create entity for the fog
const fog = engine.addEntity()

// Create entity for the second fog
const fog2 = engine.addEntity()

// Create entity for the third fog
const fog3 = engine.addEntity()

// Create entity for the fourth fog (duplicate of fog2, 40m higher)
const fog4 = engine.addEntity()

// Create entity for the customLava
const customLava = engine.addEntity()

// Create entity for the altar
const altar = engine.addEntity()

// Create entity for the rainbow
const rainbow = engine.addEntity()

// Create entity for the portalRed
const portalRed = engine.addEntity()

// Create entity for the portalScapeTop
const portalScapeTop = engine.addEntity()

// Create entity for the rockScapeStage
const rockScapeStage = engine.addEntity()

// Create entity for the hauntedScape
const hauntedScape = engine.addEntity()

// Create entity for the hauntedScapeAssets
const hauntedScapeAssets = engine.addEntity()

// Create entity for the hauntedTree
const hauntedTree = engine.addEntity()

// Create entity for the video screen
const videoScreen = engine.addEntity()

// Create entity for the portalScapeTop rotated 180 degrees
const portalScapeTopRotated = engine.addEntity()

// Create entity for the indicator portal at tree dialog trigger
export const indicatorPortal = engine.addEntity()

// Create entity for the containmentZone
const containmentZone = engine.addEntity()

// Create entity for blocker1 (disabled after tree warning)
export const blocker1 = engine.addEntity()

// Create entity for blocker2 (disabled after guardian NPC dialog)
export const blocker2 = engine.addEntity()

// Create entity for road1
const road1 = engine.addEntity()

// Music - Main Theme (hauntedScape area)
export const mainMusic = engine.addEntity()

// Music - Burn Theme (rockScape area)
export const burnMusic = engine.addEntity()

// SFX - Teleport Sound
export const teleportSound = engine.addEntity()

// SFX - Kersplat Sound
export const kersplatSound = engine.addEntity()

// SFX - Portal Red Sound
export const portalRedSound = engine.addEntity()

// Countdown timer entity for timed launch
const countdownTimer = engine.addEntity()

// Instant teleport zone for players waiting at portal when it opens
const instantTeleportZone = engine.addEntity()
const instantTeleportDebugBox = engine.addEntity()

// State tracking for timed launch
let isPortalActive = false
let countdownText = ''
let timeSinceLastCheck = 0
let triggerAdded = false  // Track if trigger has been added to avoid duplicates
let instantTeleportCheckActive = false  // Track if we've checked for instant teleport

// Helper function to format time remaining
function formatTimeRemaining(milliseconds: number, isBeforeStart: boolean): string {
  if (milliseconds <= 0) {
    return isBeforeStart ? 'PORTAL OPENING SOON...' : 'PORTAL CLOSED'
  }
  
  const totalSeconds = Math.floor(milliseconds / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  
  const prefix = isBeforeStart ? 'PORTAL OPENS IN:\n' : 'PORTAL CLOSES IN:\n'
  
  // Over 1 hour: don't show seconds
  if (days > 0) {
    return `${prefix}${days}d ${hours}h ${minutes}m`
  } else if (hours > 0) {
    return `${prefix}${hours}h ${minutes}m`
  }
  
  // Under 1 hour: show seconds
  if (minutes > 0) {
    return `${prefix}${minutes}m ${seconds}s`
  } else {
    return `${prefix}${seconds}s`
  }
}

// Helper function to check if portal should be active
function shouldPortalBeActive(): boolean {
  // Master shutdown always wins
  if (ROCKSCAPE_PORTAL_SHUTDOWN) return false
  
  // If timed launch is disabled, portal is active
  if (!ENABLE_TIMED_LAUNCH) return true
  
  // Check if current time is within the active window
  const now = Date.now()
  
  // If no end time specified (0), portal stays open after start time
  if (LAUNCH_END_TIME === 0) {
    return now >= LAUNCH_START_TIME
  }
  
  // Otherwise check if within the time window
  return now >= LAUNCH_START_TIME && now < LAUNCH_END_TIME
}

export function main() {
  console.log('🔥 Scene initializing...')
  
  // Create AI-generated skybox (same as CAVERN)
  createCubeMappedSkybox()
  console.log('✨ First skybox initialized')
  
  // Create second skybox for hauntedScape area
  createSecondSkybox()
  console.log('✨ Second skybox initialized')
  
  // Setup Music - Main Theme at height 5 in middle of hauntedScape
  Transform.create(mainMusic, {
    position: Vector3.create(143, 5, 133.5)
  })
  AudioSource.create(mainMusic, {
    audioClipUrl: 'sounds/main.mp3',
    loop: true,
    playing: true,
    volume: 1
  })
  console.log('🎵 Main music created at hauntedScape (143, 5, 133.5)')
  
  // Setup Music - Burn Theme at height 20 in middle of rockScape
  Transform.create(burnMusic, {
    position: Vector3.create(168, 10, -8)
  })
  AudioSource.create(burnMusic, {
    audioClipUrl: 'sounds/burn.mp3',
    loop: true,
    playing: false,
    volume: 1
  })
  console.log('🎵 Burn music created at rockScape (168, 20, -24)')
  
  // Setup SFX - Teleport Sound (position will be updated dynamically)
  Transform.create(teleportSound, {
    position: Vector3.create(0, 0, 0)
  })
  AudioSource.create(teleportSound, {
    audioClipUrl: 'sounds/teleport.mp3',
    loop: false,
    playing: false,
    volume: 1
  })
  console.log('🔊 Teleport sound effect loaded')
  
  // Setup SFX - Kersplat Sound (position near rockscape sky spawn)
  Transform.create(kersplatSound, {
    position: Vector3.create(168, 80, 16)
  })
  AudioSource.create(kersplatSound, {
    audioClipUrl: 'sounds/kersplat.mp3',
    loop: false,
    playing: false,
    volume: 1
  })
  console.log('🔊 Kersplat sound effect loaded')
  
  // Setup SFX - Portal Red Sound (position at 151, 4, 174)
  Transform.create(portalRedSound, {
    position: Vector3.create(151, 4, 174)
  })
  AudioSource.create(portalRedSound, {
    audioClipUrl: 'sounds/portalRed.mp3',
    loop: true,
    playing: false,
    volume: 1
  })
  console.log('🔊 Portal Red sound effect loaded')
  
  // Add bright green point light above spawn location
  const spawnLight = engine.addEntity()
  Transform.create(spawnLight, {
    position: Vector3.create(157, 5, 109)
  })
  LightSource.create(spawnLight, {
    type: LightSource.Type.Point({}),
    color: Color3.Green(),
    intensity: 1600000,
  })
  console.log('💚 Green point light created') 
  
  // Add second green spawn light +20m on z axis
  const spawnLight2 = engine.addEntity()
  Transform.create(spawnLight2, {
    position: Vector3.create(168, 7, 144)
  })
  LightSource.create(spawnLight2, {
    type: LightSource.Type.Point({}),
    color: Color3.Green(),
    intensity: 2600000,
    range: 40,
  })
  console.log('💚 Green spawn light 2 created at (157, 5, 129)') 
  
  // Add blue spawn light -20m x from spawn light 2
  const spawnLight3 = engine.addEntity()
  Transform.create(spawnLight3, {
    position: Vector3.create(148, 7, 144)
  })
  LightSource.create(spawnLight3, {
    type: LightSource.Type.Point({}),
    color: Color3.Purple(),
    intensity: 2600000,
    range: 40,
  })
  console.log('💙 Blue spawn light 3 created at (148, 7, 144)') 
  
  // Add red spawn light in the middle between spawn light 2 and 3, +14m z
  const spawnLight4 = engine.addEntity()
  Transform.create(spawnLight4, {
    position: Vector3.create(153, 9, 161)
  })
  LightSource.create(spawnLight4, {
    type: LightSource.Type.Point({}),
    color: Color3.Red(),
    intensity: 2000000,
  })
  console.log('❤️ Red spawn light 4 created at (158, 7, 158)') 
  
  // Add orange spawn light 5 +12m z from spawn light 4
  const spawnLight5 = engine.addEntity()
  Transform.create(spawnLight5, {
    position: Vector3.create(151, 9, 182)
  })
  LightSource.create(spawnLight5, {
    type: LightSource.Type.Point({}),
    color: Color3.create(1, 0.5, 0),
    intensity: 2000000,
  })
  console.log('🧡 Orange spawn light 5 created at (153, 9, 173)') 
  
  // Add blue point light at -60m on x axis from spawn
  const blueLight = engine.addEntity()
  Transform.create(blueLight, {
    position: Vector3.create(145, 5, 115)
  })
  LightSource.create(blueLight, {
    type: LightSource.Type.Point({}),
    color: Color3.Blue(),
    intensity: 1600000,
  })
  console.log('💙 Blue point light created at x=97')
  
  // Add purple point light -20m on z axis from blue light
  const purpleLight = engine.addEntity()
  Transform.create(purpleLight, {
    position: Vector3.create(148, 5, 104)
  })
  LightSource.create(purpleLight, {
    type: LightSource.Type.Point({}),
    color: Color3.create(0.5, 0, 0.5),
    intensity: 2400000,
  })
  console.log('💜 Purple point light created at z=95')
  
  // Add teal point light +60m on x axis from blue light
  const tealLight = engine.addEntity()
  Transform.create(tealLight, {
    position: Vector3.create(174, 10, 119)
  })
  LightSource.create(tealLight, {
    type: LightSource.Type.Point({}),
    color: Color3.create(0, 0.8, 0.9),
    intensity: 1600000,
  })
  console.log('🩵 Teal point light created at x=205')
  
  // Add red point light -20m z and +4m x from teal light
  const redLight = engine.addEntity()
  Transform.create(redLight, {
    position: Vector3.create(188, 9, 96)
  })
  LightSource.create(redLight, {
    type: LightSource.Type.Point({}),
    color: Color3.Red(),
    intensity: 1000000,
  })
  console.log('❤️ Red point light created at (178, 15, 99)')
  
  // Add purple point light +30m x and +10m height from teal light
  const purpleLight2 = engine.addEntity()
  Transform.create(purpleLight2, {
    position: Vector3.create(193, 10, 110)
  })
  LightSource.create(purpleLight2, {
    type: LightSource.Type.Point({}),
    color: Color3.create(0.5, 0, 0.5),
    intensity: 1600000,
  })
  console.log('💜 Purple point light 2 created at (204, 25, 119)')
  
  // Add green point light +8m x and +20m z from purple light 2
  const greenLight2 = engine.addEntity()
  Transform.create(greenLight2, {
    position: Vector3.create(206, 15, 134)
  })
  LightSource.create(greenLight2, {
    type: LightSource.Type.Point({}),
    color: Color3.Green(),
    intensity: 2000000,
  })
  console.log('💚 Green point light 2 created at (201, 10, 130)')
  
  // Add turquoise point light +12m z from green light 2
  const turquoiseLight = engine.addEntity()
  Transform.create(turquoiseLight, {
    position: Vector3.create(201, 10, 162)
  })
  LightSource.create(turquoiseLight, {
    type: LightSource.Type.Point({}),
    color: Color3.create(0, 0.8, 0.9),
    intensity: 2600000,
  })
  console.log('🩵 Turquoise point light created at (206, 15, 146)')
  
  // Add purple light 5m above top rockscape teleport (168.8, 22, -32)
  const purpleTeleportLight = engine.addEntity()
  Transform.create(purpleTeleportLight, {
    position: Vector3.create(168.8, 27, -34)
  })
  LightSource.create(purpleTeleportLight, {
    type: LightSource.Type.Point({}),
    color: Color3.create(0.5, 0, 0.5),
    intensity: 1600000,
  })
  console.log('💜 Purple teleport light created at (168.8, 27, -32)')
  
  // Add teal light 20m below hauntedScape teleport destination (168, 80, 16)
  const tealTeleportLight = engine.addEntity()
  Transform.create(tealTeleportLight, {
    position: Vector3.create(168, 36, 2)
  })
  LightSource.create(tealTeleportLight, {
    type: LightSource.Type.Point({}),
    color: Color3.create(0, 0.8, 0.9),
    intensity: 2000000,
  })
  console.log('🩵 Teal teleport light created at (168, 60, 16)')
  
  // Add purple light clone 1 at (185, 31, -11)
  const purpleClone1 = engine.addEntity()
  Transform.create(purpleClone1, {
    position: Vector3.create(185, 31, -11)
  })
  LightSource.create(purpleClone1, {
    type: LightSource.Type.Point({}),
    color: Color3.create(0.5, 0, 0.5),
    intensity: 1600000,
  })
  console.log('💜 Purple clone 1 created at (185, 31, -11)')
  
  // Add purple light clone 2 at (153, 31, -11)
  const purpleClone2 = engine.addEntity()
  Transform.create(purpleClone2, {
    position: Vector3.create(153, 31, -11)
  })
  LightSource.create(purpleClone2, {
    type: LightSource.Type.Point({}),
    color: Color3.create(0.5, 0, 0.5),
    intensity: 1600000,
  })
  console.log('💜 Purple clone 2 created at (153, 31, -11)')
  
  // Add red light clone 1 at (148, 27, -28)
  const redClone1 = engine.addEntity()
  Transform.create(redClone1, {
    position: Vector3.create(148, 27, -28)
  })
  LightSource.create(redClone1, {
    type: LightSource.Type.Point({}),
    color: Color3.Red(),
    intensity: 1000000,
  })
  console.log('❤️ Red clone 1 created at (148, 27, -28)')
  
  // Add red light clone 2 at (190, 27, -28)
  const redClone2 = engine.addEntity()
  Transform.create(redClone2, {
    position: Vector3.create(190, 27, -28)
  })
  LightSource.create(redClone2, {
    type: LightSource.Type.Point({}),
    color: Color3.Red(),
    intensity: 1000000,
  })
  console.log('❤️ Red clone 2 created at (190, 27, -28)')
  
  // Add pink light at (169, 6, 10)
  const pinkLight = engine.addEntity()
  Transform.create(pinkLight, {
    position: Vector3.create(169, 6, 10)
  })
  LightSource.create(pinkLight, {
    type: LightSource.Type.Point({}),
    color: Color3.create(1, 0.4, 0.8),
    intensity: 1600000,
  })
  console.log('💗 Pink light created at (169, 6, 10)')
  
  // Add purple light at (169, 8, -22)
  const purpleClone3 = engine.addEntity()
  Transform.create(purpleClone3, {
    position: Vector3.create(169, 8, -22)
  })
  LightSource.create(purpleClone3, {
    type: LightSource.Type.Point({}),
    color: Color3.create(0.5, 0, 0.5),
    intensity: 1600000,
  })
  console.log('💜 Purple light created at (169, 8, -22)')
  
  // Add spotlight 20m along x-axis from spawn point
  /*
  const spotLight = engine.addEntity()
  Transform.create(spotLight, {
    position: Vector3.create(188.93, 3, 101.36),
    rotation: Quaternion.fromEulerDegrees(-90, 0, 0)
  })
  LightSource.create(spotLight, {
    type: LightSource.Type.Spot({
      innerAngle: 30,
      outerAngle: 60
    }),
    shadow: true
  })
  console.log('💡 Spotlight created 20m along x-axis from spawn')
  */
 
  // Initialize burn system with dynamic collection fetching
  // This will fetch collection names and images from the blockchain
  executeTask(async () => {
    console.log('🔥 Initializing burn system with collections and URNs...')
    
    // List of collection contract addresses (add comma-separated addresses here)
    const collectionAddresses = [
      ''
    ]
    
    // List of specific URN items to burn (add comma-separated URNs here)
    const urns = [
      'urn:decentraland:matic:collections-v2:0x8c0da3299e4e226213e8fbd5f8644cf1527e1949:0',
      'urn:decentraland:matic:collections-v2:0x8c0da3299e4e226213e8fbd5f8644cf1527e1949:1',
      'urn:decentraland:matic:collections-v2:0x9fc78e9014dbf0eedb20163b511aa468d34b4bdb:0',
      'urn:decentraland:matic:collections-v2:0x9fc78e9014dbf0eedb20163b511aa468d34b4bdb:1',
      'urn:decentraland:matic:collections-v2:0x9fc78e9014dbf0eedb20163b511aa468d34b4bdb:2',
      'urn:decentraland:matic:collections-v2:0x9fc78e9014dbf0eedb20163b511aa468d34b4bdb:3',
    ]
    
    // Initialize all collections (images will be fetched from blockchain metadata)
    const collectionItems = await initCollectionsFromContracts(collectionAddresses)
    
    // Initialize all URN items (images will be fetched from blockchain metadata)
    const urnItems = await Promise.all(
      urns.map(urn => initCollectionFromURN(urn))
    )
    
    // OPTIONAL: Configure rewards for specific items
    // Rewards show up in the Confirm Burn modal with icon, name, and percentage chance
    // 
    // To add rewards:
    // 1. Specify the FULL URN of the item you want to add rewards to
    // 2. List reward URNs with their percentage chances
    // 3. The system will automatically fetch names and images from the blockchain
    //
    // Example: Add rewards to Red Laser Eyes
    
    const rewardsConfig = {
      'urn:decentraland:matic:collections-v2:0x8c0da3299e4e226213e8fbd5f8644cf1527e1949:0': [
        { urn: 'urn:decentraland:matic:collections-v2:0xb10aab66254ae8584843dc1393dfcf5387684486:0', chance: 90 },  // Green Laser Eyes - 90% chance
        { urn: 'urn:decentraland:matic:collections-v2:0xb10aab66254ae8584843dc1393dfcf5387684486:1', chance: 10 }   // Gold Laser Eyes - 10% chance
      ],
      'urn:decentraland:matic:collections-v2:0x8c0da3299e4e226213e8fbd5f8644cf1527e1949:1': [
        { urn: 'urn:decentraland:matic:collections-v2:0xb10aab66254ae8584843dc1393dfcf5387684486:0', chance: 90 },  // Green Laser Eyes - 90% chance
        { urn: 'urn:decentraland:matic:collections-v2:0xb10aab66254ae8584843dc1393dfcf5387684486:1', chance: 10 }   // Gold Laser Eyes - 10% chance
      ],
      'urn:decentraland:matic:collections-v2:0x9fc78e9014dbf0eedb20163b511aa468d34b4bdb:0': [
        { urn: 'urn:decentraland:matic:collections-v2:0x15e7a4712e1ba72ddc2adfc09591c443bacf114e:0', chance: 100 },  // Demon Horns - 100% chance
      ],
      'urn:decentraland:matic:collections-v2:0x9fc78e9014dbf0eedb20163b511aa468d34b4bdb:1': [
        { urn: 'urn:decentraland:matic:collections-v2:0x15e7a4712e1ba72ddc2adfc09591c443bacf114e:0', chance: 100 },  // Demon Horns - 100% chance
      ],
      'urn:decentraland:matic:collections-v2:0x9fc78e9014dbf0eedb20163b511aa468d34b4bdb:2': [
        { urn: 'urn:decentraland:matic:collections-v2:0x15e7a4712e1ba72ddc2adfc09591c443bacf114e:0', chance: 100 },  // Demon Horns - 100% chance
      ],
      'urn:decentraland:matic:collections-v2:0x9fc78e9014dbf0eedb20163b511aa468d34b4bdb:3': [
        { urn: 'urn:decentraland:matic:collections-v2:0x15e7a4712e1ba72ddc2adfc09591c443bacf114e:0', chance: 100 },  // Demon Horns - 100% chance
      ],
      // Add more items with rewards like this:
      // 'urn:decentraland:matic:collections-v2:0x15e7a4712e1ba72ddc2adfc09591c443bacf114e:1': [
      //   { urn: 'urn:....:0', chance: 50 },
      //   { urn: 'urn:....:1', chance: 50 }
      // ]
    }
    
    // Apply rewards to matching URN items
    for (const [targetUrn, rewardUrns] of Object.entries(rewardsConfig)) {
      // Find the collection that matches this URN
      const targetItem = urnItems.find(item => item && item.urn === targetUrn)
      
      if (targetItem) {
        // Fetch reward metadata
        const rewardData = await Promise.all(
          rewardUrns.map(async r => {
            const data = await initCollectionFromURN(r.urn)
            return { urn: r.urn, chance: r.chance, title: data?.title, imageUrl: data?.imageUrl }
          })
        )
        
        targetItem.rewards = rewardData
        console.log(`✅ Added ${rewardData.length} rewards to ${targetItem.title}`)
      } else {
        console.log(`⚠️ No item found for URN: ${targetUrn}`)
      }
    }
    
    
    // Combine them, filtering out any that failed to load
    const collections = [
      ...collectionItems,
      ...urnItems.filter(item => item !== null)
    ]
    
    console.log(`✅ Initialized ${collections.length} burn options:`)
    collections.forEach((col, i) => {
      console.log(`   ${i + 1}. ${col.title} (${col.type})`)
    })
    
    setupNFTBurnSystem({
      contractAddress: '0xc494f4cdcf95de946a3e36d4cee7baf9c87f08de',
      testMode: false,  // true for testing, false for production
      enableCollectionSelection: true,
      collections: collections
    })
    
    console.log('✅ Burn system initialized with collection + URNs!')
    
    // Make the clickable area burnable (must be done after burn system is initialized)
    makeBurnable(clickArea, 'Burn NFT')
    console.log('✅ Clickable area made burnable')
  })

  // Add transform component to position the TV at bottom-right corner
  Transform.create(tv, {
    position: { x: 106, y: 0, z: -86 },
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0, w: 1 }
  })
  console.log('✅ TV transform created')

  // Add the TV model
  GltfContainer.create(tv, {
    src: 'models/tv.glb'
  })
  console.log('✅ TV model loaded:', 'models/tv.glb')
  
  // Add rockScape at center of bottom-right corner parcel (10, -2)
  Transform.create(rockScape, {
    position: { x: 168, y: 0, z: -24 },  // Center of parcel (10, -2)
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0, w: 1 }
  })
  
  GltfContainer.create(rockScape, {
    src: 'models/rockScape.glb'
  })
  console.log('✅ RockScape model loaded at bottom-right corner')
  
  // Add rockFloor at same position as rockScape
  Transform.create(rockFloor, {
    position: { x: 128.3, y: 0, z: -16 },  // Same position
    scale: { x: 1.8, y: 1, z: 1.5 },
    rotation: { x: 0, y: 0, z: 0, w: 1 }
  })
  
  GltfContainer.create(rockFloor, {
    src: 'models/rockFloor.glb'
  })
  console.log('✅ RockFloor model loaded at bottom-right corner')
  
  // Add fog at same position as rockScape
  Transform.create(fog, {
    position: { x: 168, y: 0, z: -24 },  // Same position
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0, w: 1 }
  })
  
  GltfContainer.create(fog, {
    src: 'models/fog.glb'
  })
  console.log('✅ Fog model loaded at bottom-right corner')
  
  // Add second fog - centered with rockscape using fogFar
  Transform.create(fog2, {
    position: { x: 168, y: 0, z: -24 },  // Centered with rockscape
    scale: { x: 2, y: 1, z: 2 },
    rotation: Quaternion.fromEulerDegrees(0, 180, 0)  // Rotated 180° to reverse animation direction
  })
  
  GltfContainer.create(fog2, {
    src: 'models/fogFar.glb'
  })
  console.log('✅ Second fog (fogFar) loaded at (168, 0, -184) - centered with rockscape')
  
  // Add third fog at elevated height - centered with rockscape using fogFar
  Transform.create(fog3, {
    position: { x: 168, y: 11.5, z: -184 },  // Centered with rockscape, elevated
    scale: { x: 2, y: 0.1, z: 2 },
    rotation: Quaternion.fromEulerDegrees(0, 180, 0)  // Rotated 180° to reverse animation direction
  })
  
  GltfContainer.create(fog3, {
    src: 'models/fogFar.glb'
  })
  console.log('✅ Third fog (fogFar) loaded at (168, 11.5, -24) - centered with rockscape, elevated')
  
  // Add fourth fog (fogSky) at high altitude - same position as fog3 but elevated
  Transform.create(fog4, {
    position: { x: 148, y: 115, z: -84 },  // Centered with rockscape, high altitude
    scale: { x: 2, y: 0.3, z: 2 },
    rotation: Quaternion.fromEulerDegrees(0, 180, 180)  // Rotated 180° to reverse animation direction
  })
  
  GltfContainer.create(fog4, {
    src: 'models/fogSky.glb'
  })
  console.log('✅ Fourth fog (fogSky) loaded at (168, 120, -184) - centered with rockscape, high altitude')
  
  // Add customLava at same position as rockScape
  Transform.create(customLava, {
    position: { x: 168, y: 0, z: -24 },  // Same position
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0, w: 1 }
  })
  
  GltfContainer.create(customLava, {
    src: 'models/customLava.glb'
  })
  console.log('✅ CustomLava model loaded at bottom-right corner')
  
  // Add altar at same position as rockScape and customLava
  Transform.create(altar, {
    position: { x: 168, y: 0, z: -24 },  // Same position
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0, w: 1 }
  })
  
  GltfContainer.create(altar, {
    src: 'models/altar.glb'
  })
  console.log('✅ Altar model loaded at bottom-right corner')
  
  // Add rainbow at same position as rockScape
  Transform.create(rainbow, {
    position: { x: 168, y: 0, z: -24 },  // Same position
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0, w: 1 }
  })
  
  GltfContainer.create(rainbow, {
    src: 'models/rainbow.glb'
  })
  console.log('✅ Rainbow model loaded at rockScape location')
  
  // Add portalRed near hauntedScape teleport
  Transform.create(portalRed, {
    position: { x: 158, y: 4.7, z: 184 },  // HauntedScape teleport position
    scale: { x: 2, y: 2, z: 2 },
    rotation: Quaternion.fromEulerDegrees(90, 215, 0)  // Rotate 90 degrees on X axis
  })
  
  GltfContainer.create(portalRed, {
    src: 'models/portalRed.glb'
  })
  console.log('✅ PortalRed model loaded at hauntedScape teleport (157, 3.96, 183)')
  
  // Add candles throughout the scene
  createCandles([
    Vector3.create(182, 3.1, 100),
    Vector3.create(186, 3.1, 101),
    Vector3.create(175.8, 3.5, 109),
    Vector3.create(174.6, 2.7, 121.8),
    Vector3.create(201.7, 8.34, 121.7),
    Vector3.create(208, 8.45, 118.25),
    Vector3.create(203.65, 4, 156),
    Vector3.create(199, 4.3, 153),
    Vector3.create(187.4, 3.15, 166),
    Vector3.create(187.5, 3.25, 159.1),
    Vector3.create(172.3, 0.2, 151.2),
    Vector3.create(176, 1, 145.1),
    Vector3.create(150.4, 0.6, 161.3),
    Vector3.create(156.6, 0.5, 162)
  ])
  console.log('🕯️ 14 candles placed throughout the scene')
  
  // Add circular candle array around the altar
  createCircularCandleArray(
    Vector3.create(169, 3.28, -27.75),  // Altar position, 3m up
    2.8,                             // 2.8 meter radius
    12,                              // 12 candles
    15                               // Rotate 15 degrees
  )
  console.log('🕯️ 12 candles arranged in circle around altar (2.8m radius, rotated 15°)')
  
  // Add portalScapeTop at same position as rockScape
  Transform.create(portalScapeTop, {
    position: { x: 168, y: 0, z: -24 },  // Same position
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0, w: 1 }
  })
  
  GltfContainer.create(portalScapeTop, {
    src: 'models/portalScapeTop.glb'
  })
  console.log('✅ PortalScapeTop model loaded at bottom-right corner')
  
  // Add rockScapeStage at same position as rockScape
  Transform.create(rockScapeStage, {
    position: { x: 168, y: 0, z: -24 },  // Same position
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0, w: 1 }
  })
  
  GltfContainer.create(rockScapeStage, {
    src: 'models/rockScapeStage.glb'
  })
  console.log('✅ RockScapeStage model loaded at bottom-right corner')
  
  // Add hauntedScape at same position as rockScape
  Transform.create(hauntedScape, {
    position: { x: 168, y: 0, z: -24 },  // Same position
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0, w: 1 }
  })
  
  GltfContainer.create(hauntedScape, {
    src: 'models/hauntedScape.glb'
  })
  console.log('✅ HauntedScape model loaded at bottom-right corner')
  
  // Add hauntedScapeAssets at same position as rockScape
  Transform.create(hauntedScapeAssets, {
    position: { x: 168, y: 0, z: -24 },  // Same position
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0, w: 1 }
  })
  
  GltfContainer.create(hauntedScapeAssets, {
    src: 'models/hauntedScapeAssets.glb'
  })
  console.log('✅ HauntedScapeAssets model loaded at bottom-right corner')
  
  // Add hauntedTree 10m east (+X) from tree dialog trigger (144, 2, 108)
  Transform.create(hauntedTree, {
    position: { x: 126, y: 0.5, z: 105 },
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0, w: 1 }
  })
  
  GltfContainer.create(hauntedTree, {
    src: 'models/hauntedTree.glb'
  })
  console.log('✅ HauntedTree model loaded at (154, 2, 108) - 10m east of tree trigger')
  
  // Add video screen at (168.8, 34, -40) - centered with top portal
  Transform.create(videoScreen, {
    position: Vector3.create(169, 36, -41.2),
    scale: Vector3.create(18, 10.125, 1), // 1.5x bigger: 12 * 1.5 = 18, 6.75 * 1.5 = 10.125
    rotation: Quaternion.fromEulerDegrees(-20, 180, 0) // 180° on Y axis, 15° downward tilt on X axis
  })
  
  // Add plane mesh for screen
  MeshRenderer.setPlane(videoScreen)
  
  // Create video player
  VideoPlayer.create(videoScreen, {
    src: 'https://player.vimeo.com/external/552481870.m3u8?s=c312c8533f97e808fccc92b0510b085c8122a875',
    playing: true,
    loop: true,
    volume: 0
  })
  
  // Create material with video texture and emissive properties
  Material.setPbrMaterial(videoScreen, {
    texture: Material.Texture.Video({ videoPlayerEntity: videoScreen }),
    emissiveTexture: Material.Texture.Video({ videoPlayerEntity: videoScreen }),
    emissiveColor: Color3.White(),
    emissiveIntensity: 0.6,
    roughness: 1.0
  })
  
  console.log('✅ Video screen created at (170, 34, -40) with Vimeo stream')
  
  // Add containmentZone at same position as rockScape
  Transform.create(containmentZone, {
    position: { x: 168, y: 0, z: -24 },  // Same position
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0, w: 1 }
  })
  
  GltfContainer.create(containmentZone, {
    src: 'models/containmentZone.glb'
  })
  console.log('✅ ContainmentZone model loaded at bottom-right corner')
  
  // Add blocker1 at same position as rockScape
  Transform.create(blocker1, {
    position: { x: 168, y: 0, z: -24 },  // Same position
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0, w: 1 }
  })
  
  GltfContainer.create(blocker1, {
    src: 'models/blocker1.glb'
  })
  console.log('✅ Blocker1 model loaded at bottom-right corner')
  
  // Add blocker2 at same position as rockScape
  Transform.create(blocker2, {
    position: { x: 168, y: 0, z: -24 },  // Same position
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0, w: 1 }
  })
  
  GltfContainer.create(blocker2, {
    src: 'models/blocker2.glb'
  })
  console.log('✅ Blocker2 model loaded at bottom-right corner')
  
  // Add road1 at same position as rockScape
  Transform.create(road1, {
    position: { x: 168, y: 0, z: -24 },  // Same position
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0, w: 1 }
  })
  
  GltfContainer.create(road1, {
    src: 'models/road1.glb'
  })
  console.log('✅ Road1 model loaded at bottom-right corner')
  
  // Add portalScapeTop at teleport box location (controlled by shutdown and timed launch)
  isPortalActive = shouldPortalBeActive()
  
  Transform.create(portalScapeTopRotated, {
    position: { x: 167.5, y: 19, z: -65.6 },  // At teleport box position
    scale: isPortalActive ? { x: 1, y: 1, z: 1 } : Vector3.Zero(),
    rotation: Quaternion.fromEulerDegrees(0, 0, 0)  // Same rotation as original
  })
  
  GltfContainer.create(portalScapeTopRotated, {
    src: 'models/portalScapeTop.glb'
  })
  
  if (ROCKSCAPE_PORTAL_SHUTDOWN) {
    console.log('⚠️ PortalScapeTop model DISABLED by ROCKSCAPE_PORTAL_SHUTDOWN')
  } else if (ENABLE_TIMED_LAUNCH && !isPortalActive) {
    console.log('⏰ PortalScapeTop model HIDDEN - Waiting for timed launch')
  } else {
    console.log('✅ PortalScapeTop model loaded at teleport box (168.8, 22, -32)')
  }
  
  // Add indicator portal at tree dialog trigger location
  Transform.create(indicatorPortal, {
    position: { x: 144, y: 1, z: 108 },  // At tree dialog trigger
    scale: Vector3.Zero(),  // Start hidden
    rotation: Quaternion.fromEulerDegrees(0, 0, 0)
  })
  
  GltfContainer.create(indicatorPortal, {
    src: 'models/indicatorPortal.glb'
  })
  console.log('✅ IndicatorPortal model loaded at tree dialog trigger (144, 2, 108)')
  
  // Create clickable area on the altar - 6m wide x 4m tall x 6m deep
  const clickArea = engine.addEntity()
  Transform.create(clickArea, {
    position: { x: 1, y: 3, z: -3 },  // Centered at 1.5m height relative to altar
    scale: { x: 6, y: 4, z: 6 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    parent: altar
  })
  MeshCollider.setBox(clickArea)
  
  console.log('✅ Clickable area created on altar')
  
  // Create NAME GATE ZONE - Large zone that's ALWAYS active around sweep teleport
  // This checks for Decentraland Name ownership before allowing access
  const nameGateZone = engine.addEntity()
  Transform.create(nameGateZone, {
    position: { x: 168.8, y: 22, z: -38 },
    scale: { x: 28, y: 12, z: 16 }  // Large zone - always active
  })
  
  let playerHasNameApproved = false
  
  utils.triggers.addTrigger(
    nameGateZone,
    utils.NO_LAYERS,
    utils.LAYER_1,
    [{ type: 'box', scale: { x: 28, y: 12, z: 16 } }],
    function(otherEntity) {
      // Check every time when entering (with cooldown handled by executeTask)
      console.log('🎭 Player entered name gate zone - checking ownership...')
      
      executeTask(async () => {
        const hasName = await checkCurrentPlayerHasName()
        
        if (hasName) {
          console.log('✅ Player has Decentraland Name - access granted')
          playerHasNameApproved = true
          // Show verification notification for 2 seconds
          showNameVerificationNotification()
        } else {
          console.log('❌ Player does not have Decentraland Name - showing gate prompt')
          playerHasNameApproved = false
          showNameGatePrompt(
            // onConfirm callback (they clicked MINT NAME)
            () => {
              console.log('🎭 Player clicked MINT NAME')
            },
            // onCancel callback
            () => {
              console.log('🎭 Player cancelled name gate')
            }
          )
        }
      })
    }
  )
  
  console.log('✅ Name gate zone created (12x12x12) - always active')
  
  // Create teleport trigger zone (controlled by shutdown and timed launch)
  const triggerZone = engine.addEntity()
  Transform.create(triggerZone, {
    position: { x: 168.8, y: 22, z: -32 },
    scale: isPortalActive ? { x: 2, y: 2, z: 2 } : Vector3.Zero()
  })
  
  // Add trigger that teleports player (only if portal active AND player approved)
  if (isPortalActive) {
    utils.triggers.addTrigger(
      triggerZone,
      utils.NO_LAYERS,
      utils.LAYER_1,
      [{ type: 'box', scale: { x: 2, y: 2, z: 2 } }],
      function(otherEntity) {
        if (playerHasNameApproved) {
          console.log('🌀 Player entered teleport zone - approved, teleporting!')
          // Set teleport sound position to destination and play
          Transform.getMutable(teleportSound).position = Vector3.create(169, 3.4, 9.8)
          AudioSource.getMutable(teleportSound).playing = true
          // Teleport player
          movePlayerTo({ 
            newRelativePosition: Vector3.create(169, 3.4, 9.8),
            cameraTarget: Vector3.create(169, 3.4, -4)
          })
        } else {
          console.log('⛔ Player entered teleport without approval - blocked')
        }
      }
    )
  }
  
  if (ROCKSCAPE_PORTAL_SHUTDOWN) {
    console.log('⚠️ Teleport trigger DISABLED by ROCKSCAPE_PORTAL_SHUTDOWN at (168.8, 22, -32)')
  } else if (ENABLE_TIMED_LAUNCH && !isPortalActive) {
    console.log('⏰ Teleport trigger HIDDEN - Waiting for timed launch at (168.8, 22, -32)')
  } else {
    console.log('✅ Teleport trigger zone created at (168.8, 22, -32)')
  }
  
  // Create second teleport trigger zone (teleports from hauntedScape to rockScape)
  const triggerZone2 = engine.addEntity()
  Transform.create(triggerZone2, {
    position: { x: 157, y: 3.96, z: 183 },
    scale: { x: 3, y: 3, z: 3 }
  })
  
  // Add trigger that teleports player back to spawn point
  utils.triggers.addTrigger(
    triggerZone2,
    utils.NO_LAYERS,
    utils.LAYER_1,
    [{ type: 'box', scale: { x: 2, y: 2, z: 2 } }],
    function(otherEntity) {
      console.log('🌀 Player entering return teleport zone!')
      // Reset portal camera before teleporting
      resetTreeCamera()
      // Stop portal red sound
      AudioSource.getMutable(portalRedSound).playing = false
      // Set teleport sound position to destination and play
      Transform.getMutable(teleportSound).position = Vector3.create(168, 80, 16)
      AudioSource.getMutable(teleportSound).playing = true
      // Toggle music: stop main theme, start burn theme
      AudioSource.getMutable(mainMusic).playing = false
      AudioSource.getMutable(mainMusic).volume = 0
      AudioSource.getMutable(burnMusic).playing = true
      AudioSource.getMutable(burnMusic).volume = 1
      console.log('🎵 Music switched: main.mp3 OFF (volume 0), burn.mp3 ON (volume 1)')
      // Teleport player to rockScape area
      movePlayerTo({ 
        newRelativePosition: Vector3.create(168, 80, 16),
        cameraTarget: Vector3.create(168, 40, -34)
      })
      
      // Start landing cinematic after fall (3.5 seconds - red portal needs extra time)
      utils.timers.setTimeout(() => {
        console.log('🎬 Attempting to start landing camera after red portal teleport')
        landingCamera.startCinematic()
      }, 3500) // Wait for player to fall and land from red portal
    }
  )
  
  console.log('✅ Second teleport trigger zone created at (156.67, 3.96, 182)')
  
  // Create Portal Red sound trigger zone at portalRed location
  const portalRedTriggerZone = engine.addEntity()
  Transform.create(portalRedTriggerZone, {
    position: { x: 169, y: 4.7, z: 170 },
    scale: { x: 32, y: 8, z: 32 }
  })
  
  // Add trigger that plays portal red sound when entering
  utils.triggers.addTrigger(
    portalRedTriggerZone,
    utils.NO_LAYERS,
    utils.LAYER_1,
    [{ type: 'box', scale: { x: 32, y: 8, z: 32 } }],
    function(otherEntity) {
      console.log('🔴 Player entered portal red trigger zone!')
      // Start playing portal red sound in loop
      AudioSource.getMutable(portalRedSound).playing = true
    }
  )
  
  console.log('✅ Portal Red sound trigger zone created at (158, 4.7, 184)')
  
  // Create MetaMask network prompt trigger zone and blocker
  // Position: (169, 4, 2.6)
  const metaMaskBlocker = engine.addEntity()
  Transform.create(metaMaskBlocker, {
    position: { x: 169, y: 5, z: -7 },
    scale: { x: 3, y: 8, z: 18 }
  })
  MeshCollider.setBox(metaMaskBlocker)
  console.log('🚧 MetaMask blocker created at (169, 4, 2.6)')
  
  const metaMaskTriggerZone = engine.addEntity()
  Transform.create(metaMaskTriggerZone, {
    position: { x: 169, y: 4, z: 2.6 },
    scale: { x: 3, y: 3, z: 3 }
  })
  
  let promptShown = false
  utils.triggers.addTrigger(
    metaMaskTriggerZone,
    utils.NO_LAYERS,
    utils.LAYER_1,
    [{ type: 'box', scale: { x: 3, y: 3, z: 3 } }],
    function(otherEntity) {
      if (!promptShown) {
        console.log('🦊 Player entered MetaMask trigger zone - showing prompt')
        promptShown = true
        showMetaMaskPrompt(
          // onConfirm callback
          () => {
            console.log('🦊 User confirmed - removing blocker and trigger zone')
            Transform.getMutable(metaMaskBlocker).scale = Vector3.Zero()
            Transform.getMutable(metaMaskTriggerZone).scale = Vector3.Zero()
          },
          // onCancel callback
          () => {
            console.log('🦊 User cancelled - resetting flag to allow re-prompt')
            promptShown = false
          }
        )
      }
    }
  )
  
  console.log('✅ MetaMask trigger zone created at (169, 4, 2.6)')
  
  // Create spawn exit warning trigger
  createSpawnExitTrigger()
  
  // Create walking NPC near the first red light
  createWalkingNPC()
  
  // Setup cinematic camera system
  console.log('🎬 Initializing cinematic camera system...')
  const treeCamera = setupTreeCinematicCamera()
  const portalCamera = setupPortalCinematicCamera()
  const npcCamera = setupNPCCinematicCamera()
  const runningCamera = setupRunningCinematicCamera()
  const landingCamera = setupLandingCinematicCamera()
  createCameraTriggers(treeCamera, portalCamera, npcCamera, runningCamera)
  console.log('✅ Cinematic camera system initialized')
  
  // Create Kersplat death fall trigger zone at the bottom of rockScape
  // Position at height 4, centered on rockScape area
  const kersplatTriggerZone = engine.addEntity()
  Transform.create(kersplatTriggerZone, {
    position: { x: 168, y: 0, z: -24 },  // At height 4, centered on rockScape
    scale: { x: 140, y: 1, z: 160 }  // Large flat zone covering the entire bottom area
  })
  
  // Add trigger that detects player falling into the death zone
  utils.triggers.addTrigger(
    kersplatTriggerZone,
    utils.NO_LAYERS,
    utils.LAYER_1,
    [{ type: 'box', scale: { x: 140, y: 1, z: 160 } }],
    function(otherEntity) {
      console.log('💥 KERSPLAT! Player fell into death zone!')
      
      // Play kersplat sound at player's current position
      const playerPos = Transform.get(engine.PlayerEntity).position
      Transform.getMutable(kersplatSound).position = playerPos
      AudioSource.getMutable(kersplatSound).playing = true
      
      // Show kersplat image UI
      showKersplatImage()
      
      // Teleport player back to rockscape spawn (the destination of the first hauntedScape teleport)
      // This is the position where the second teleport (triggerZone2) sends the player
      movePlayerTo({ 
        newRelativePosition: Vector3.create(168, 80, 16),
        cameraTarget: Vector3.create(168, 40, -34)
      })
      
      // Start landing cinematic after fall
      utils.timers.setTimeout(() => {
        console.log('🎬 Attempting to start landing camera after kersplat')
        landingCamera.startCinematic()
      }, 3100) // Wait for player to fall and land
      
      console.log('✅ Player respawned at rockscape spawn (168, 80, 16)')
    }
  )
  
  console.log('✅ Kersplat death fall system created at height 4')
  
  // Create second Kersplat death fall trigger zone at height 15 (half scale)
  const kersplatTriggerZone2 = engine.addEntity()
  Transform.create(kersplatTriggerZone2, {
    position: { x: 168, y: 12, z: -24 },  // At height 15, same X/Z position
    scale: { x: 50, y: 1, z: 50 }  // Half the scale of the first zone
  })
  
  // Add trigger that detects player falling into the second death zone
  utils.triggers.addTrigger(
    kersplatTriggerZone2,
    utils.NO_LAYERS,
    utils.LAYER_1,
    [{ type: 'box', scale: { x: 50, y: 0.5, z: 50 } }],
    function(otherEntity) {
      console.log('💥 KERSPLAT! Player fell into death zone 2!')
      
      // Play kersplat sound at player's current position
      const playerPos = Transform.get(engine.PlayerEntity).position
      Transform.getMutable(kersplatSound).position = playerPos
      AudioSource.getMutable(kersplatSound).playing = true
      
      // Show kersplat image UI
      showKersplatImage()
      
      // Teleport player back to rockscape spawn
      movePlayerTo({ 
        newRelativePosition: Vector3.create(168, 80, 16),
        cameraTarget: Vector3.create(168, 40, -34)
      })
      
      // Start landing cinematic after fall
      utils.timers.setTimeout(() => {
        console.log('🎬 Attempting to start landing camera after kersplat')
        landingCamera.startCinematic()
      }, 3100) // Wait for player to fall and land
      
      console.log('✅ Player respawned at rockscape spawn (168, 80, 16)')
    }
  )
  
  console.log('✅ Kersplat death fall system 2 created at height 15')
  
  // Add continuous kersplat position check system (catches fast-falling players)
  let kersplatCooldown = false  // Prevent multiple rapid triggers
  
  engine.addSystem(() => {
    if (kersplatCooldown) return  // Skip if on cooldown
    
    const playerPos = Transform.get(engine.PlayerEntity).position
    
    // Check Kersplat Zone 1 (height 4, 100x2x100)
    const zone1Pos = Vector3.create(168, 0, -24)
    const zone1SizeX = 140
    const zone1SizeY = 1
    const zone1SizeZ = 160
    
    const distX1 = Math.abs(playerPos.x - zone1Pos.x)
    const distY1 = Math.abs(playerPos.y - zone1Pos.y)
    const distZ1 = Math.abs(playerPos.z - zone1Pos.z)
    
    const inZone1 = distX1 <= zone1SizeX / 2 && distY1 <= zone1SizeY / 2 && distZ1 <= zone1SizeZ / 2
    
    // Check Kersplat Zone 2 (height 20, 50x1x50)
    const zone2Pos = Vector3.create(168, 12, -24)
    const zone2SizeX = 50
    const zone2SizeY = 1
    const zone2SizeZ = 50
    
    const distX2 = Math.abs(playerPos.x - zone2Pos.x)
    const distY2 = Math.abs(playerPos.y - zone2Pos.y)
    const distZ2 = Math.abs(playerPos.z - zone2Pos.z)
    
    const inZone2 = distX2 <= zone2SizeX / 2 && distY2 <= zone2SizeY / 2 && distZ2 <= zone2SizeZ / 2
    
    // If player is in either zone, trigger kersplat
    if (inZone1 || inZone2) {
      const zoneNumber = inZone1 ? 1 : 2
      console.log(`💥 KERSPLAT SYSTEM CHECK! Player in zone ${zoneNumber} at (${playerPos.x.toFixed(2)}, ${playerPos.y.toFixed(2)}, ${playerPos.z.toFixed(2)})`)
      
      // Set cooldown
      kersplatCooldown = true
      
      // Play kersplat sound at player's position
      Transform.getMutable(kersplatSound).position = playerPos
      AudioSource.getMutable(kersplatSound).playing = true
      
      // Show kersplat image UI
      showKersplatImage()
      
      // Teleport player back to rockscape spawn
      movePlayerTo({ 
        newRelativePosition: Vector3.create(168, 80, 16),
        cameraTarget: Vector3.create(168, 40, -34)
      })
      
      // Start landing cinematic after fall
      utils.timers.setTimeout(() => {
        console.log('🎬 Attempting to start landing camera after kersplat')
        landingCamera.startCinematic()
      }, 3000) // Wait for player to fall and land
      
      console.log('✅ Player respawned at rockscape spawn (168, 80, 16)')
      
      // Reset cooldown after 3 seconds
      utils.timers.setTimeout(() => {
        kersplatCooldown = false
        console.log('🔄 Kersplat cooldown reset')
      }, 3000)
    }
  })
  
  console.log('✅ Kersplat continuous position check system enabled')
  
  // Setup countdown timer for timed launch (SDK7 style)
  if (ENABLE_TIMED_LAUNCH && !ROCKSCAPE_PORTAL_SHUTDOWN) {
    // Calculate initial countdown text
    const now = Date.now()
    const isBeforeStart = now < LAUNCH_START_TIME
    const isActive = now >= LAUNCH_START_TIME && (LAUNCH_END_TIME === 0 || now < LAUNCH_END_TIME)
    
    let initialCountdown = ''
    if (isBeforeStart) {
      const timeUntilStart = LAUNCH_START_TIME - now
      initialCountdown = formatTimeRemaining(timeUntilStart, true)
    } else if (isActive && LAUNCH_END_TIME === 0) {
      initialCountdown = 'PORTAL ACTIVE'
    } else if (isActive) {
      const timeUntilEnd = LAUNCH_END_TIME - now
      initialCountdown = formatTimeRemaining(timeUntilEnd, false)
    } else {
      initialCountdown = 'PORTAL CLOSED'
    }
    countdownText = initialCountdown
    
    // Create text entity
    Transform.create(countdownTimer, {
      position: COUNTDOWN_POSITION,
      scale: Vector3.create(1, 1, 1)
    })
    
    TextShape.create(countdownTimer, {
      text: initialCountdown,
      fontSize: 5,
      textColor: Color4.create(1, 0.84, 0, 1)  // Gold color
    })
    
    // Add billboard so text faces camera
    Billboard.create(countdownTimer, {
      billboardMode: BillboardMode.BM_Y
    })
    
    // Create instant teleport zone (8x8x8) for players waiting at portal
    const portalPosition = Vector3.create(168.8, 22, -32)  // Same as trigger zone
    Transform.create(instantTeleportZone, {
      position: portalPosition,
      scale: Vector3.create(8, 8, 8)
    })
    
    // Create debug box for instant teleport zone
    Transform.create(instantTeleportDebugBox, {
      position: portalPosition,
      scale: Vector3.create(8, 8, 8)
    })
    
    // Add trigger for instant teleport when portal opens
    utils.triggers.addTrigger(
      instantTeleportZone,
      utils.NO_LAYERS,
      utils.LAYER_1,
      [{ type: 'box', scale: { x: 8, y: 8, z: 8 } }],
      function(otherEntity) {
        // Only teleport if portal just opened and player is in zone
        if (instantTeleportCheckActive) {
          console.log('⚡ Instant teleport triggered for player in waiting zone!')
          Transform.getMutable(teleportSound).position = Vector3.create(169, 3.4, 9.8)
          AudioSource.getMutable(teleportSound).playing = true
          movePlayerTo({ 
            newRelativePosition: Vector3.create(169, 3.4, 9.8),
            cameraTarget: Vector3.create(169, 3.4, -4)
          })
        }
      }
    )
    
    console.log('⏰ Countdown timer enabled at position:', COUNTDOWN_POSITION)
    console.log('⚡ Instant teleport zone (8x8x8) created at portal location')
    console.log('⏰ Initial countdown:', initialCountdown)
    console.log('   Portal opens at:', new Date(LAUNCH_START_TIME).toISOString())
    if (LAUNCH_END_TIME === 0) {
      console.log('   Portal stays open indefinitely (no end time)')
    } else {
      console.log('   Portal closes at:', new Date(LAUNCH_END_TIME).toISOString())
    }
    
    // Add system to update countdown with dynamic check intervals
    engine.addSystem((dt) => {
      timeSinceLastCheck += dt
      
      const now = Date.now()
      const isBeforeStart = now < LAUNCH_START_TIME
      const isActive = now >= LAUNCH_START_TIME && (LAUNCH_END_TIME === 0 || now < LAUNCH_END_TIME)
      
      // Calculate countdown text based on current state
      let newCountdownText = ''
      let timeUntilEvent = 0
      
      if (isBeforeStart) {
        timeUntilEvent = LAUNCH_START_TIME - now
        newCountdownText = formatTimeRemaining(timeUntilEvent, true)
      } else if (isActive && LAUNCH_END_TIME === 0) {
        // Portal is active with no end time - no countdown needed
        newCountdownText = 'PORTAL ACTIVE'
      } else if (isActive) {
        timeUntilEvent = LAUNCH_END_TIME - now
        newCountdownText = formatTimeRemaining(timeUntilEvent, false)
      } else {
        newCountdownText = 'PORTAL CLOSED'
      }
      
      // Check if portal should be active (check this BEFORE interval gating)
      const shouldBeActive = shouldPortalBeActive()
      
      // If portal should be active but isn't, check EVERY FRAME for instant response
      const needsImmediateCheck = shouldBeActive && !isPortalActive
      
      // Dynamic check interval based on time remaining
      let checkInterval = 1  // Default: check every second when at or past the event time
      
      if (needsImmediateCheck) {
        // Portal should open NOW - check every frame!
        checkInterval = 0
      } else if (timeUntilEvent <= 0) {
        // At or past event time: check every second
        checkInterval = 1
      } else if (timeUntilEvent <= 5000) {
        // Less than 5 seconds: check every frame for precision
        checkInterval = 0
      } else if (timeUntilEvent <= 600000) {
        // Less than 10 minutes: check every second
        checkInterval = 1
      } else if (timeUntilEvent <= 3600000) {
        // Less than 1 hour: check every 10 seconds
        checkInterval = 10
      } else {
        // Over 1 hour: check every 60 seconds
        checkInterval = 60
      }
      
      // Only run checks at the specified interval (unless we need immediate check)
      if (!needsImmediateCheck && timeSinceLastCheck < checkInterval) {
        return // Skip this frame
      }
      
      // Reset timer
      timeSinceLastCheck = 0
      
      // Update countdown text
      if (newCountdownText !== countdownText) {
        countdownText = newCountdownText
        TextShape.getMutable(countdownTimer).text = countdownText
        console.log('⏰ Countdown:', countdownText)
      }
      
      // Continuous position check when portal should open but hasn't yet
      if (needsImmediateCheck && !instantTeleportCheckActive) {
        console.log('🔥 PORTAL SHOULD BE ACTIVE! Checking player position...')
        
        // Check if player is currently within the 8x8x8 zone
        const playerPos = Transform.get(engine.PlayerEntity).position
        const zonePos = Vector3.create(168.8, 22, -32)
        const zoneSize = 8
        
        console.log('📍 Player at:', playerPos.x.toFixed(2), playerPos.y.toFixed(2), playerPos.z.toFixed(2))
        console.log('📦 Zone at:', zonePos.x, zonePos.y, zonePos.z)
        
        // Check if player is within bounds
        const distX = Math.abs(playerPos.x - zonePos.x)
        const distY = Math.abs(playerPos.y - zonePos.y)
        const distZ = Math.abs(playerPos.z - zonePos.z)
        
        const isWithinX = distX <= zoneSize / 2
        const isWithinY = distY <= zoneSize / 2
        const isWithinZ = distZ <= zoneSize / 2
        
        console.log('📏 Distance - X:', distX.toFixed(2), 'Y:', distY.toFixed(2), 'Z:', distZ.toFixed(2))
        console.log('✅ Within? X:', isWithinX, 'Y:', isWithinY, 'Z:', isWithinZ)
        
        if (isWithinX && isWithinY && isWithinZ) {
          console.log('🎯🎯🎯 PLAYER IN ZONE - INSTANT TELEPORT!')
          instantTeleportCheckActive = true
          
          Transform.getMutable(teleportSound).position = Vector3.create(169, 3.4, 9.8)
          AudioSource.getMutable(teleportSound).playing = true
          movePlayerTo({ 
            newRelativePosition: Vector3.create(169, 3.4, 9.8),
            cameraTarget: Vector3.create(169, 3.4, -4)
          })
          
          // Deactivate after 2 seconds
          utils.timers.setTimeout(() => {
            instantTeleportCheckActive = false
          }, 2000)
        } else {
          console.log('❌ Player outside zone')
        }
      }
      
      // Check if portal should activate/deactivate
      if (shouldBeActive && !isPortalActive) {
        // Activate portal!
        isPortalActive = true
        console.log('🎉 PORTAL WINDOW OPENED - Portal and teleport now active!')
        
        // Show portal model
        Transform.getMutable(portalScapeTopRotated).scale = { x: 1, y: 1, z: 1 }
        
        // Enable trigger zone
        Transform.getMutable(triggerZone).scale = { x: 2, y: 2, z: 2 }
        
        // Add the trigger listener only once (first time portal opens)
        if (!triggerAdded) {
          utils.triggers.addTrigger(
            triggerZone,
            utils.NO_LAYERS,
            utils.LAYER_1,
            [{ type: 'box', scale: { x: 2, y: 2, z: 2 } }],
            function(otherEntity) {
              if (playerHasNameApproved) {
                console.log('🌀 Player entered teleport zone (timed launch) - approved, teleporting!')
                Transform.getMutable(teleportSound).position = Vector3.create(169, 3.4, 9.8)
                AudioSource.getMutable(teleportSound).playing = true
                movePlayerTo({ 
                  newRelativePosition: Vector3.create(169, 3.4, 9.8),
                  cameraTarget: Vector3.create(169, 3.4, -4)
                })
              } else {
                console.log('⛔ Player entered teleport (timed launch) without approval - blocked')
              }
            }
          )
          triggerAdded = true
          console.log('✅ Teleport trigger listener registered')
        }
      } else if (!shouldBeActive && isPortalActive) {
        // Deactivate portal!
        isPortalActive = false
        console.log('🚫 PORTAL WINDOW CLOSED - Portal and teleport disabled!')
        
        // Hide portal model
        Transform.getMutable(portalScapeTopRotated).scale = Vector3.Zero()
        
        // Disable trigger
        Transform.getMutable(triggerZone).scale = Vector3.Zero()
        
        // Hide countdown timer
        Transform.getMutable(countdownTimer).scale = Vector3.Zero()
      }
      
      return // Continue system
    })
  }
  
  console.log('🔥 Scene ready!')
}
