import { engine, Transform, VirtualCamera, MainCamera } from '@dcl/sdk/ecs'
import { Vector3, Quaternion } from '@dcl/sdk/math'
import * as utils from '@dcl-sdk/utils'

// Create camera entities for cinematic views
const treeCinematicCamera = engine.addEntity()
const portalCinematicCamera = engine.addEntity()
const npcCinematicCamera = engine.addEntity()
const runningCinematicCamera = engine.addEntity()
const landingCinematicCamera = engine.addEntity()

// Create a camera target entity for the tree camera to look at
const treeCameraTarget = engine.addEntity()
const portalCameraTarget = engine.addEntity()
const npcCameraTarget = engine.addEntity()
const runningCameraTarget = engine.addEntity()
const landingCameraTarget = engine.addEntity()

// Track active camera state and animation state
let activeCinematicCamera: number | null = null
let isAnimating = false
let animationStartTime = 0
let animationDuration = 0
let animationType: 'tree' | 'portal' | 'npc' | 'running' | 'landing' | null = null
let orbitStartAngle = 0
let orbitCenter = Vector3.Zero()
let orbitRadius = 4
let initialPitch = 0
let playerFacingAngle = 0
let treeCameraPhase: 'tilt' | 'hold' | 'orbit' | 'return' = 'tilt'
let treeTriggerUsed = false
let npcTriggerUsed = false
let returnStartPos = Vector3.Zero()
let returnStartTime = 0

// Helper function to calculate a position that looks at a target
function lookAtTarget(cameraPos: Vector3, targetPos: Vector3): Quaternion {
  const direction = Vector3.subtract(targetPos, cameraPos)
  const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z)
  
  if (length === 0) {
    return Quaternion.Identity()
  }
  
  const normalizedDir = Vector3.scale(direction, 1 / length)
  
  // Calculate yaw (rotation around Y axis)
  const yaw = Math.atan2(normalizedDir.x, normalizedDir.z)
  
  // Calculate pitch (rotation around X axis)
  const pitch = Math.asin(-normalizedDir.y)
  
  return Quaternion.fromEulerDegrees(
    pitch * (180 / Math.PI),
    yaw * (180 / Math.PI),
    0
  )
}

// Helper to reset camera to default
function resetToDefaultCamera() {
  if (activeCinematicCamera !== null) {
    // Remove MainCamera to return control to player
    MainCamera.getMutable(engine.CameraEntity).virtualCameraEntity = undefined
    
    activeCinematicCamera = null
    isAnimating = false
    animationType = null
    treeCameraPhase = 'tilt' // Reset tree camera phase
    console.log('📹 Camera reset to player view')
  }
}

// Export function to start tree camera orbit from dialog
export function startTreeCameraOrbit() {
  if (animationType === 'tree' && treeCameraPhase === 'hold') {
    console.log('🎬 Starting tree camera 180° orbit (triggered by "altar" dialog)')
    treeCameraPhase = 'orbit'
    animationStartTime = Date.now()
    isAnimating = true
  }
}

// Export function for dialog to reset camera when dialog ends with smooth transition
export function resetTreeCamera() {
  console.log('🎬 Dialog ended - starting smooth camera return animation')
  if (animationType === 'tree') {
    // Store current position and start return animation
    returnStartPos = Transform.get(treeCinematicCamera).position
    returnStartTime = Date.now()
    treeCameraPhase = 'return'
    isAnimating = true
  } else {
    // Fallback to instant reset for other camera types
    resetToDefaultCamera()
  }
}

// Camera animation system
engine.addSystem((dt: number) => {
  if (!isAnimating || animationType === null) return
  
  const elapsed = Date.now() - animationStartTime
  const progress = Math.min(elapsed / animationDuration, 1)
  
  if (animationType === 'tree') {
    const tiltDuration = 1500 // 1.5 seconds to tilt down
    const orbitDuration = 7400 // ~7.4 seconds for 180° at current speed (was 20s for 540°)
    const returnDuration = 2000 // 2 seconds for smooth return to default
    
    if (treeCameraPhase === 'tilt') {
      // Phase 1: Tilt from looking up at tree down to lower angle (1.5 seconds)
      const tiltProgress = Math.min(elapsed / tiltDuration, 1)
      const startHeight = orbitCenter.y + 2 // Start 2 meters above eye level
      const endHeight = orbitCenter.y - 0.5 // End BELOW eye level for upward angle
      const currentHeight = startHeight + ((endHeight - startHeight) * tiltProgress)
      
      const newPos = Vector3.create(
        orbitCenter.x + Math.sin((orbitStartAngle * Math.PI) / 180) * orbitRadius,
        currentHeight,
        orbitCenter.z + Math.cos((orbitStartAngle * Math.PI) / 180) * orbitRadius
      )
      
      Transform.getMutable(treeCinematicCamera).position = newPos
      
      // Once tilt is done, switch to hold phase
      if (tiltProgress >= 1) {
        treeCameraPhase = 'hold'
        console.log('✅ Tree camera tilt complete - holding position until "altar" dialog')
      }
    } else if (treeCameraPhase === 'hold') {
      // Phase 2: Hold position LOW, looking upward at tree (indefinitely until triggered)
      const holdHeight = orbitCenter.y - 0.5
      const holdPos = Vector3.create(
        orbitCenter.x + Math.sin((orbitStartAngle * Math.PI) / 180) * orbitRadius,
        holdHeight,
        orbitCenter.z + Math.cos((orbitStartAngle * Math.PI) / 180) * orbitRadius
      )
      
      Transform.getMutable(treeCinematicCamera).position = holdPos
    } else if (treeCameraPhase === 'orbit') {
      // Phase 3: Orbit 180 degrees COUNTERCLOCKWISE at LOW height
      const orbitProgress = Math.min(elapsed / orbitDuration, 1)
      const angle = orbitStartAngle - (180 * orbitProgress) // Pan -180 degrees
      
      const currentRadius = orbitRadius
      const currentHeight = orbitCenter.y - 0.5
      
      const newPos = Vector3.create(
        orbitCenter.x + Math.sin((angle * Math.PI) / 180) * currentRadius,
        currentHeight,
        orbitCenter.z + Math.cos((angle * Math.PI) / 180) * currentRadius
      )
      
      Transform.getMutable(treeCinematicCamera).position = newPos
      
      // Once orbit is done, just hold (dialog end will reset)
      if (orbitProgress >= 1) {
        console.log('✅ Tree camera 180° orbit complete - holding on player')
        isAnimating = false
      }
    } else if (treeCameraPhase === 'return') {
      // Phase 4: Smooth return to default camera position
      const returnElapsed = Date.now() - returnStartTime
      const returnProgress = Math.min(returnElapsed / returnDuration, 1)
      
      // Get current player position for smooth transition
      const playerPos = Transform.get(engine.PlayerEntity).position
      const targetPos = Vector3.create(
        playerPos.x,
        playerPos.y + 1.8, // Slightly above player head for smooth transition
        playerPos.z
      )
      
      // Smooth interpolation from current position to behind player
      const currentPos = Vector3.lerp(returnStartPos, targetPos, returnProgress)
      Transform.getMutable(treeCinematicCamera).position = currentPos
      
      // Once return is complete, actually reset camera
      if (returnProgress >= 1) {
        console.log('✅ Tree camera return animation complete - resetting to player control')
        MainCamera.getMutable(engine.CameraEntity).virtualCameraEntity = undefined
        activeCinematicCamera = null
        isAnimating = false
        animationType = null
        treeCameraPhase = 'tilt'
      }
    }
  } else if (animationType === 'portal') {
    // Portal camera just holds position looking at player
    // No animation needed, just wait for timeout
  } else if (animationType === 'npc') {
    // NPC camera holds low angle position with player in foreground
    // No animation needed, just wait for timeout
  } else if (animationType === 'running') {
    // Running camera is STATIC - no frame-by-frame updates
    // Just holds position looking forward, showing player running away
  } else if (animationType === 'landing') {
    // Landing camera - slow pan UP for 3 seconds
    const panDuration = 3000 // 3 seconds total
    const panProgress = Math.min(elapsed / panDuration, 1)
    
    // Pan upward - start low, end at eye level
    const startHeight = orbitCenter.y - 1 // Start 1m below eye level (low)
    const endHeight = orbitCenter.y + 0.5 // End slightly above eye level
    const currentHeight = startHeight + ((endHeight - startHeight) * panProgress)
    
    // Keep camera behind player, just pan up vertically
    const newPos = Vector3.create(
      orbitCenter.x + Math.sin((orbitStartAngle * Math.PI) / 180) * orbitRadius,
      currentHeight,
      orbitCenter.z + Math.cos((orbitStartAngle * Math.PI) / 180) * orbitRadius
    )
    
    Transform.getMutable(landingCinematicCamera).position = newPos
    
    // Auto-reset after 3 seconds
    if (panProgress >= 1) {
      console.log('✅ Landing camera pan complete - resetting to player control')
      resetToDefaultCamera()
    }
  }
})

// Create tree cinematic camera that pans around player
export function setupTreeCinematicCamera() {
  const treePosition = Vector3.create(144, 2, 108)
  
  // Position camera 4 units away from tree trigger, at eye level
  const cameraStartPos = Vector3.create(140, 4, 108)
  
  // Setup camera target
  Transform.create(treeCameraTarget, {
    position: Vector3.create(144, 3.7, 108) // Eye level at tree position
  })
  
  // Setup camera entity
  Transform.create(treeCinematicCamera, {
    position: cameraStartPos,
    rotation: Quaternion.Identity()
  })
  
  // Create VirtualCamera component that looks at the target
  VirtualCamera.create(treeCinematicCamera, {
    lookAtEntity: treeCameraTarget,
    defaultTransition: { transitionMode: VirtualCamera.Transition.Time(0) }
  })
  
  console.log('📹 Tree cinematic camera created at', cameraStartPos)
  
  // Return function to start the animation
  return {
    startCinematic: (playerPos: Vector3, playerRotation: Quaternion) => {
      console.log('🎬 Starting tree cinematic camera pan around player')
      
      // Calculate player's forward direction from rotation
      const forward = Vector3.rotate(Vector3.Forward(), playerRotation)
      playerFacingAngle = Math.atan2(forward.x, forward.z) * (180 / Math.PI)
      
      // Calculate orbit around player
      orbitRadius = 5
      const height = 1.7 // Eye level
      orbitCenter = Vector3.create(playerPos.x, playerPos.y + height, playerPos.z)
      
      // Update target to player's eye level
      Transform.getMutable(treeCameraTarget).position = orbitCenter
      
      // Start angle BEHIND player (opposite of facing direction)
      orbitStartAngle = playerFacingAngle + 180
      animationDuration = 1500 // Just tilt duration - orbit triggered by dialog
      
      // Create initial camera position - behind player at medium height (to look up at giant tree)
      const startHeight = orbitCenter.y + 2 // 2 meters above eye level to see giant tree from below
      const startPos = Vector3.create(
        orbitCenter.x + Math.sin((orbitStartAngle * Math.PI) / 180) * orbitRadius,
        startHeight,
        orbitCenter.z + Math.cos((orbitStartAngle * Math.PI) / 180) * orbitRadius
      )
      
      Transform.getMutable(treeCinematicCamera).position = startPos
      
      // Activate this virtual camera using MainCamera
      MainCamera.createOrReplace(engine.CameraEntity, {
        virtualCameraEntity: treeCinematicCamera
      })
      activeCinematicCamera = treeCinematicCamera
      
      // Start animation
      isAnimating = true
      animationType = 'tree'
      animationStartTime = Date.now()
    }
  }
}

// Create NPC cinematic camera - low angle shot with player in foreground
export function setupNPCCinematicCamera() {
  const npcPosition = Vector3.create(188, 2.1, 92) // NPC position
  
  // Setup NPC camera target (look at NPC's head/upper body)
  Transform.create(npcCameraTarget, {
    position: Vector3.create(188, 3.5, 92) // Look at NPC's head area
  })
  
  // Position camera low and to the right of where player will be
  const cameraPosition = Vector3.create(189, 0.5, 93) // Low and to the right
  
  Transform.create(npcCinematicCamera, {
    position: cameraPosition,
    rotation: Quaternion.Identity()
  })
  
  // Create VirtualCamera component
  VirtualCamera.create(npcCinematicCamera, {
    lookAtEntity: npcCameraTarget,
    defaultTransition: { transitionMode: VirtualCamera.Transition.Time(0) }
  })
  
  console.log('📹 NPC cinematic camera created for hero shot')
  
  // Return function to activate the camera view
  return {
    startCinematic: (playerPos: Vector3) => {
      console.log('🎬 Starting NPC cinematic camera - low angle hero shot')
      
      // Position camera BEHIND the player, looking toward NPC
      // Player is between camera and NPC, showing player's back and NPC's front
      const npcPos = Vector3.create(188, 2.1, 92)
      
      const cameraPos = Vector3.create(
        playerPos.x - 0.5, // Slightly to the LEFT - parallax shifts candle to right of frame
        playerPos.y + 2, // 2m above ground to show candle top in frame
        playerPos.z + 4 // 4m BEHIND player (south, higher Z)
      )
      
      Transform.getMutable(npcCinematicCamera).position = cameraPos
      
      // Look at NPC's head/face area for hero shot
      Transform.getMutable(npcCameraTarget).position = Vector3.create(188, 5.5, 92)
      
      // Activate this virtual camera using MainCamera
      MainCamera.createOrReplace(engine.CameraEntity, {
        virtualCameraEntity: npcCinematicCamera
      })
      activeCinematicCamera = npcCinematicCamera
      animationType = 'npc'
      animationStartTime = Date.now()
      animationDuration = 0 // Hold indefinitely
      isAnimating = true
      
      console.log('✅ NPC camera active - dramatic low angle with player in foreground')
      
      // Hold camera view until player walks away (trigger exit handles reset)
    }
  }
}

// Create landing cinematic camera - slow low pan on teleport/kersplat
export function setupLandingCinematicCamera() {
  Transform.create(landingCameraTarget, {
    position: Vector3.create(0, 1.7, 0)
  })
  
  Transform.create(landingCinematicCamera, {
    position: Vector3.create(0, 1, 4),
    rotation: Quaternion.Identity()
  })
  
  VirtualCamera.create(landingCinematicCamera, {
    lookAtEntity: landingCameraTarget,
    defaultTransition: { transitionMode: VirtualCamera.Transition.Time(0) }
  })
  
  console.log('📹 Landing cinematic camera created for teleport arrivals')
  
  return {
    startCinematic: () => {
      const playerTransform = Transform.get(engine.PlayerEntity)
      const playerPos = playerTransform.position
      const playerRotation = playerTransform.rotation
      
      console.log('🎬 Starting landing cinematic camera - slow low pan')
      
      // Calculate player's forward direction
      const forward = Vector3.rotate(Vector3.Forward(), playerRotation)
      playerFacingAngle = Math.atan2(forward.x, forward.z) * (180 / Math.PI)
      
      // Setup orbit around player
      orbitRadius = 5
      const height = 1.7
      orbitCenter = Vector3.create(playerPos.x, playerPos.y + height, playerPos.z)
      
      // Update target to player's eye level
      Transform.getMutable(landingCameraTarget).position = orbitCenter
      
      // Start angle behind player
      orbitStartAngle = playerFacingAngle + 180
      
      // Initial camera position - LOW and behind (1m below eye level)
      const startHeight = orbitCenter.y - 1
      const startPos = Vector3.create(
        orbitCenter.x + Math.sin((orbitStartAngle * Math.PI) / 180) * orbitRadius,
        startHeight,
        orbitCenter.z + Math.cos((orbitStartAngle * Math.PI) / 180) * orbitRadius
      )
      
      Transform.getMutable(landingCinematicCamera).position = startPos
      
      // Activate camera
      MainCamera.createOrReplace(engine.CameraEntity, {
        virtualCameraEntity: landingCinematicCamera
      })
      activeCinematicCamera = landingCinematicCamera
      
      isAnimating = true
      animationType = 'landing'
      animationStartTime = Date.now()
      animationDuration = 3000
      
      console.log('✅ Landing camera active - 3 second upward pan')
    }
  }
}

// Create running cinematic camera - static high angle for downhill running
export function setupRunningCinematicCamera() {
  // Static camera position - HIGH angle looking DOWN at the path
  // Positioned after 6th candle (208, 8.45, 118.25) to catch player starting downhill run
  const cameraPos = Vector3.create(206, 15, 130) // High up, 15m above ground
  const lookAtPos = Vector3.create(195, 4, 160) // Looking down at the downhill path
  
  Transform.create(runningCinematicCamera, {
    position: cameraPos,
    rotation: Quaternion.Identity()
  })
  
  Transform.create(runningCameraTarget, {
    position: lookAtPos // Static look-at point down the path
  })
  
  // Create VirtualCamera component
  VirtualCamera.create(runningCinematicCamera, {
    lookAtEntity: runningCameraTarget,
    defaultTransition: { transitionMode: VirtualCamera.Transition.Time(0) }
  })
  
  console.log('📹 Running cinematic camera created - static high angle shot')
  
  // Return function to activate the camera view
  return {
    startCinematic: () => {
      console.log('🎬 Starting running cinematic camera - static high angle looking down')
      
      // Activate this virtual camera using MainCamera
      MainCamera.createOrReplace(engine.CameraEntity, {
        virtualCameraEntity: runningCinematicCamera
      })
      activeCinematicCamera = runningCinematicCamera
      animationType = 'running'
      isAnimating = true
      
      console.log('✅ Running camera active - player runs away from camera')
      
      // Release camera after ~5 seconds (time to run ~25m)
      utils.timers.setTimeout(() => {
        console.log('🏃 Running camera time expired - resetting')
        resetToDefaultCamera()
      }, 3000)
    },
    stopCinematic: () => {
      console.log('🎬 Stopping running cinematic camera')
      resetToDefaultCamera()
    }
  }
}

// Create portal cinematic camera that looks at player from portal
export function setupPortalCinematicCamera() {
  // Position camera at SOUND ORIGIN in left corner (151, 4, 174)
  // Portal is at (158, 4.7, 184) - camera shows both player and portal
  const cameraPosition = Vector3.create(151, 5, 174) // Sound position, slightly elevated
  
  // Setup portal target - will point at player
  Transform.create(portalCameraTarget, {
    position: Vector3.create(157, 4, 183) // Default look position
  })
  
  // Setup camera entity in left corner
  Transform.create(portalCinematicCamera, {
    position: cameraPosition,
    rotation: Quaternion.Identity()
  })
  
  // Create VirtualCamera component
  VirtualCamera.create(portalCinematicCamera, {
    lookAtEntity: portalCameraTarget,
    defaultTransition: { transitionMode: VirtualCamera.Transition.Time(0) }
  })
  
  console.log('📹 Portal cinematic camera created in left corner of room')
  
  // Return function to activate the camera view
  return {
    startCinematic: (playerPos: Vector3) => {
      console.log('🎬 Starting portal cinematic camera - left corner view')
      
      // Look at portal area but LOWER to tilt camera down
      // Portal at Y=4.7, but look at Y=3 to show more ground (portal in top third)
      const lookAtPos = Vector3.create(158, 3, 184)
      Transform.getMutable(portalCameraTarget).position = lookAtPos
      
      // Activate this virtual camera using MainCamera
      MainCamera.createOrReplace(engine.CameraEntity, {
        virtualCameraEntity: portalCinematicCamera
      })
      activeCinematicCamera = portalCinematicCamera
      animationType = 'portal'
      animationStartTime = Date.now()
      animationDuration = 3000
      isAnimating = true
      
      console.log('✅ Portal camera active - showing player and portal from left corner')
      
      // Camera stays active until player teleports (no auto-reset)
    }
  }
}

// Create trigger zones for camera activation
export function createCameraTriggers(
  treeCamera: { startCinematic: (playerPos: Vector3, playerRotation: Quaternion) => void },
  portalCamera: { startCinematic: (playerPos: Vector3) => void },
  npcCamera: { startCinematic: (playerPos: Vector3) => void },
  runningCamera: { startCinematic: () => void, stopCinematic: () => void }
) {
  // Tree trigger zone at (144, 2, 108)
  const treeTriggerZone = engine.addEntity()
  Transform.create(treeTriggerZone, {
    position: Vector3.create(144, 2, 108),
    scale: Vector3.create(4, 3, 4)
  })
  
  let treeCameraActive = false
  
  utils.triggers.addTrigger(
    treeTriggerZone,
    utils.NO_LAYERS,
    utils.LAYER_1,
    [{ type: 'box', scale: { x: 4, y: 3, z: 4 } }],
    function(otherEntity) {
      if (!treeCameraActive && !treeTriggerUsed) {
        console.log('🎬 Player entered tree camera trigger (one-time only)')
        treeCameraActive = true
        treeTriggerUsed = true // Mark as used - can't be triggered again
        const playerTransform = Transform.get(engine.PlayerEntity)
        treeCamera.startCinematic(playerTransform.position, playerTransform.rotation)
      }
    }
    // No exit callback - dialog will control camera reset
  )
  
  // Portal trigger zone - AT SOUND ORIGIN, triggers when entering the room
  const portalTriggerZone = engine.addEntity()
  Transform.create(portalTriggerZone, {
    position: Vector3.create(151, 4, 178), // Near sound origin (151, 4, 174), catches entry
    scale: Vector3.create(12, 6, 12) // Larger to catch player entering room
  })
  
  let portalCameraActive = false
  
  utils.triggers.addTrigger(
    portalTriggerZone,
    utils.NO_LAYERS,
    utils.LAYER_1,
    [{ type: 'box', scale: { x: 12, y: 6, z: 12 } }],
    function(otherEntity) {
      if (!portalCameraActive) {
        console.log('🎬 Player entered portal camera trigger')
        portalCameraActive = true
        const playerPos = Transform.get(engine.PlayerEntity).position
        portalCamera.startCinematic(playerPos)
      }
    },
    function(otherEntity) {
      // On exit - reset camera
      if (portalCameraActive) {
        console.log('🎬 Player exited portal camera trigger - resetting')
        resetToDefaultCamera()
        portalCameraActive = false
      }
    }
  )

  
  // NPC trigger zone at (187, 5, 93) - matches NPC trigger from npcSystem.ts
  const npcTriggerZone = engine.addEntity()
  Transform.create(npcTriggerZone, {
    position: Vector3.create(187, 5, 93),
    scale: Vector3.create(12, 18, 12)
  })
  
  let npcCameraActive = false
  
  utils.triggers.addTrigger(
    npcTriggerZone,
    utils.NO_LAYERS,
    utils.LAYER_1,
    [{ type: 'box', scale: { x: 9, y: 9, z: 9 } }],
    function(otherEntity) {
      if (!npcCameraActive && !npcTriggerUsed) {
        console.log('🎬 Player entered NPC camera trigger (one-time only)')
        npcCameraActive = true
        npcTriggerUsed = true // Mark as used - can't be triggered again
        const playerPos = Transform.get(engine.PlayerEntity).position
        npcCamera.startCinematic(playerPos)
      }
    }
    // No exit callback - dialog will control camera reset after 2 seconds
  )
  
  // Running camera trigger zone - positioned just AFTER 6th candle (208, 8.45, 118.25)
  // Triggers when player starts the downhill run
  const runningTriggerZone = engine.addEntity()
  Transform.create(runningTriggerZone, {
    position: Vector3.create(206, 6, 135), // Just after 6th candle, start of downhill
    scale: Vector3.create(8, 8, 8) // Small trigger to catch player as they start running
  })
  
  let runningCameraActive = false
  
  utils.triggers.addTrigger(
    runningTriggerZone,
    utils.NO_LAYERS,
    utils.LAYER_1,
    [{ type: 'box', scale: { x: 8, y: 8, z: 8 } }],
    function(otherEntity) {
      if (!runningCameraActive) {
        console.log('🏃 Player passed 6th candle - starting downhill camera')
        runningCameraActive = true
        runningCamera.startCinematic()
        
        // Reset flag after 8 seconds (in case they come back)
        utils.timers.setTimeout(() => {
          runningCameraActive = false
        }, 8000)
      }
    }
    // No exit callback - timer controls reset
  )
  
  console.log('✅ Camera trigger zones created (including downhill running camera)')
}
