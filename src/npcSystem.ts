import * as npc from 'dcl-npc-toolkit'
import { Vector3, Quaternion } from '@dcl/sdk/math'
import { welcomeDialog, spawnWarningDialog, treeWarningDialog, playSpawnWarningSound, playTreeWarningSound, playWelcomeSound } from './dialogs'
import * as utils from '@dcl-sdk/utils'
import { engine, Transform, MeshRenderer, Material } from '@dcl/sdk/ecs'
import { blocker1, blocker2, indicatorPortal } from './index'

// Create invisible NPC for spawn warning dialog
let warningNPC: any
let treeWarningNPC: any

// Track if warnings have been shown
let firstWarningShown = false
let secondWarningShown = false

// Reference to the second trigger zone
let secondTriggerZone: any

// Create spawn area exit trigger
export function createSpawnExitTrigger() {
  // Spawn point from scene.json: (168.93, 1.28, 103)
  const spawnPosition = Vector3.create(168, 2, 102)
  
  // Create invisible NPC for the first warning dialog
  warningNPC = npc.create(
    {
      position: Vector3.create(168.93, -100, 103), // Hidden underground
      scale: Vector3.Zero() // Invisible
    },
    {
      type: npc.NPCType.CUSTOM,
      model: {
        src: 'models/npc.glb'
      },
      portrait: { path: 'images/tree.png' },
      onActivate: () => {
        // Empty - triggered externally
      }
    }
  )
  
  // Create invisible NPC for the second warning dialog
  treeWarningNPC = npc.create(
    {
      position: Vector3.create(148, -100, 124), // Hidden underground
      scale: Vector3.Zero() // Invisible
    },
    {
      type: npc.NPCType.CUSTOM,
      model: {
        src: 'models/npc.glb'
      },
      portrait: { path: 'images/tree.png' },
      onActivate: () => {
        // Empty - triggered externally
      }
    }
  )
  
  // Create the spawn safe zone (6x6x6)
  const spawnZone = engine.addEntity()
  
  Transform.create(spawnZone, {
    position: spawnPosition,
    scale: Vector3.create(6, 6, 6)
  })
  
  // Track if player is inside the zone
  let playerInZone = true // Start true since they spawn here
  
  // Check trigger every frame to detect exit
  utils.triggers.addTrigger(
    spawnZone,
    utils.NO_LAYERS,
    utils.LAYER_1,
    [{ type: 'box', scale: { x: 6, y: 6, z: 6 } }],
    function(otherEntity) {
      // Player entered/is in the zone
      playerInZone = true
    },
    function(otherEntity) {
      // Player exited the zone
      if (playerInZone && !firstWarningShown) {
        console.log('⚠️ Player left spawn safe zone - showing first warning!')
        firstWarningShown = true
        playSpawnWarningSound() // Play first sound
        npc.talk(warningNPC, spawnWarningDialog)
        
        // Reveal second trigger zone and indicator portal immediately
        console.log('✅ Revealing second trigger zone and indicator portal')
        if (secondTriggerZone) {
          Transform.getMutable(secondTriggerZone).scale = Vector3.create(3, 3, 3)
        }
        // Show indicator portal
        Transform.getMutable(indicatorPortal).scale = Vector3.create(1, 1, 1)
      }
      playerInZone = false
    }
  )
  
  // Create second trigger zone between blue and purple lights
  // Blue light at (148, 7, 144), Purple light at (148, 5, 104)
  // Midpoint at height 2: (148, 2, 124)
  const secondTriggerPosition = Vector3.create(144, 2, 108)
  secondTriggerZone = engine.addEntity()
  
  // Start with scale 0 (invisible/inactive)
  Transform.create(secondTriggerZone, {
    position: secondTriggerPosition,
    scale: Vector3.Zero()
  })
  
  // Add trigger for second warning
  utils.triggers.addTrigger(
    secondTriggerZone,
    utils.NO_LAYERS,
    utils.LAYER_1,
    [{ type: 'box', scale: { x: 3, y: 3, z: 3 } }],
    function(otherEntity) {
      if (!secondWarningShown) {
        console.log('⚠️ Player entered second trigger - showing tree warning!')
        secondWarningShown = true
        playTreeWarningSound() // Play first sound
        npc.talk(treeWarningNPC, treeWarningDialog)
        // Blocker1 will be disabled by dialog's triggeredByNext callback
        
        // Hide indicator portal when player enters tree trigger
        Transform.getMutable(indicatorPortal).scale = Vector3.Zero()
      }
    }
  )
  
  console.log('⚠️ Spawn exit trigger created at (168, 2, 102)')
  console.log('⚠️ Second trigger (hidden) created at (148, 2, 124)')
}

// Create the stationary NPC near the first red light
export function createWalkingNPC() {
  // Position near the red light at (188, 9, 96), raised by 2m
  const npcPosition = Vector3.create(188, 2.1, 92)
  
  const walkingNPC = npc.create(
    {
      position: npcPosition,
      rotation: Quaternion.fromEulerDegrees(0, -15, 0),
      scale: Vector3.create(2, 2, 2)
    },
    {
      type: npc.NPCType.CUSTOM,
      model: {
        src: 'models/npc.glb'
      },
      idleAnim: 'idle',  // Play idle animation from the model
      faceUser: true,
      portrait: { path: 'images/doge.png' },
      reactDistance: 0,  // Disable proximity interaction
      onlyExternalTrigger: true,  // Only allow external triggers (our trigger box)
      onActivate: () => {
        // Empty - dialog is triggered by the separate trigger zone
      }
    }
  )
  
  // Create trigger zone 8 units to the right (+8 on x axis) of the NPC
  const triggerZone = engine.addEntity()
  const triggerPosition = Vector3.create(187, 5, 93)  // NPC position + 8 on x
  
  // Create transform for the trigger (3x larger)
  Transform.create(triggerZone, {
    position: triggerPosition,
    scale: Vector3.create(12, 18, 12)
  })
  
  utils.triggers.addTrigger(
    triggerZone,
    utils.NO_LAYERS,
    utils.LAYER_1,
    [{ type: 'box', scale: { x: 9, y: 9, z: 9 } }],
    function(otherEntity) {
      console.log('Player entered NPC trigger zone!')
      playWelcomeSound() // Play first sound
      npc.talk(walkingNPC, welcomeDialog)
      // Blocker2 will be disabled by dialog's button actions or triggeredByNext callback
    }
  )
  
  console.log('🧍 Stationary NPC created at (188, 2.2, 92)')
  console.log('🎯 Trigger zone created at (196, 2.2, 92)')
  
  return walkingNPC
}

