import { Dialog } from 'dcl-npc-toolkit'
import { Transform, engine, AudioSource } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import * as utils from '@dcl-sdk/utils'
import { mainMusic, burnMusic, blocker1, blocker2 } from './index'
import { startTreeCameraOrbit, resetTreeCamera } from './cameraSystem'

// Create audio entities for dialog sounds
const tree1Sound = engine.addEntity()
const tree2Sound = engine.addEntity()
const tree3Sound = engine.addEntity()
const tree4Sound = engine.addEntity()
const tree5Sound = engine.addEntity()
const tree6Sound = engine.addEntity()
const npc1Sound = engine.addEntity()
const npc2Sound = engine.addEntity()
const npc3Sound = engine.addEntity()
const npc4Sound = engine.addEntity()
const npc5Sound = engine.addEntity()

// Initialize all dialog audio
// Tree1 sound positioned halfway between spawn (168, 2, 102) and tree trigger (144, 2, 108)
Transform.create(tree1Sound, { position: Vector3.create(156, 2, 105) })
AudioSource.create(tree1Sound, { audioClipUrl: 'sounds/tree1.mp3', loop: false, playing: false })

// Tree2-6 sounds positioned at the tree trigger zone (144, 2, 108)
Transform.create(tree2Sound, { position: Vector3.create(144, 2, 108) })
AudioSource.create(tree2Sound, { audioClipUrl: 'sounds/tree2.mp3', loop: false, playing: false })

Transform.create(tree3Sound, { position: Vector3.create(144, 2, 108) })
AudioSource.create(tree3Sound, { audioClipUrl: 'sounds/tree3.mp3', loop: false, playing: false })

Transform.create(tree4Sound, { position: Vector3.create(144, 2, 108) })
AudioSource.create(tree4Sound, { audioClipUrl: 'sounds/tree4.mp3', loop: false, playing: false })

Transform.create(tree5Sound, { position: Vector3.create(144, 2, 108) })
AudioSource.create(tree5Sound, { audioClipUrl: 'sounds/tree5.mp3', loop: false, playing: false })

Transform.create(tree6Sound, { position: Vector3.create(144, 2, 108) })
AudioSource.create(tree6Sound, { audioClipUrl: 'sounds/tree6.mp3', loop: false, playing: false })

// NPC sounds positioned at the NPC trigger zone (187, 5, 93)
Transform.create(npc1Sound, { position: Vector3.create(187, 5, 93) })
AudioSource.create(npc1Sound, { audioClipUrl: 'sounds/npc1.mp3', loop: false, playing: false })

Transform.create(npc2Sound, { position: Vector3.create(187, 5, 93) })
AudioSource.create(npc2Sound, { audioClipUrl: 'sounds/npc2.mp3', loop: false, playing: false })

Transform.create(npc3Sound, { position: Vector3.create(187, 5, 93) })
AudioSource.create(npc3Sound, { audioClipUrl: 'sounds/npc3.mp3', loop: false, playing: false })

Transform.create(npc4Sound, { position: Vector3.create(187, 5, 93) })
AudioSource.create(npc4Sound, { audioClipUrl: 'sounds/npc4.mp3', loop: false, playing: false })

Transform.create(npc5Sound, { position: Vector3.create(187, 5, 93) })
AudioSource.create(npc5Sound, { audioClipUrl: 'sounds/npc5.mp3', loop: false, playing: false })

// Helper function to stop all dialog audio
function stopAllDialogAudio() {
  AudioSource.getMutable(tree1Sound).playing = false
  AudioSource.getMutable(tree2Sound).playing = false
  AudioSource.getMutable(tree3Sound).playing = false
  AudioSource.getMutable(tree4Sound).playing = false
  AudioSource.getMutable(tree5Sound).playing = false
  AudioSource.getMutable(tree6Sound).playing = false
  AudioSource.getMutable(npc1Sound).playing = false
  AudioSource.getMutable(npc2Sound).playing = false
  AudioSource.getMutable(npc3Sound).playing = false
  AudioSource.getMutable(npc4Sound).playing = false
  AudioSource.getMutable(npc5Sound).playing = false
}

// Helper function to play a specific dialog sound
function playDialogSound(sound: any) {
  stopAllDialogAudio()
  AudioSource.getMutable(sound).playing = true
}

// Helper function to play sound at player's position
function playDialogSoundAtPlayer(sound: any) {
  stopAllDialogAudio()
  // Get player position and set sound source there
  const playerPos = Transform.get(engine.PlayerEntity).position
  Transform.getMutable(sound).position = playerPos
  AudioSource.getMutable(sound).playing = true
}

// Export function to stop all dialog audio (useful when closing dialogs)
export function stopDialogAudio() {
  stopAllDialogAudio()
}

// Export functions to play the first sound of each dialog
export function playSpawnWarningSound() {
  playDialogSound(tree1Sound)
}

export function playTreeWarningSound() {
  playDialogSound(tree2Sound)
}

export function playWelcomeSound() {
  playDialogSound(npc1Sound)
}

// First dialog - Tree calls adventurer over
export let spawnWarningDialog: Dialog[] = [
  {
    text: `Psst... Adventurer! Come closer, let me get a better look at you...`,
    portrait: {
      path: 'images/tree.png'
    },
    isEndOfDialog: true,
    triggeredByNext: () => {
      stopAllDialogAudio() // Stop audio when closing
    }
  }
]

// Second dialog - Tree compliments wearables then warns about the altar
export let treeWarningDialog: Dialog[] = [
  {
    text: `My, my... those are some VERY powerful wearables you have there...`,
    portrait: {
      path: 'images/tree.png'
    },
    triggeredByNext: () => {
      playDialogSound(tree3Sound) // Play next sound
    }
  },
  {
    text: `Careful, seeker… the woods aren't kind to the unready.`,
    portrait: {
      path: 'images/tree.png'
    },
    triggeredByNext: () => {
      playDialogSound(tree4Sound) // Play next sound
      startTreeCameraOrbit() // Start 180° camera orbit when "altar" dialog appears
    }
  },
  {
    text: `An altar waits ahead — hungry and ancient.`,
    portrait: {
      path: 'images/tree.png'
    },
    triggeredByNext: () => {
      playDialogSound(tree5Sound) // Play next sound
    }
  },
  {
    text: `Bring what it demands, or be turned away.`,
    portrait: {
      path: 'images/tree.png'
    },
    triggeredByNext: () => {
      playDialogSound(tree6Sound) // Play next sound
    }
  },
  {
    text: `Go, if you dare — the Ritual awaits.`,
    portrait: {
      path: 'images/tree.png'
    },
    isEndOfDialog: true,
    triggeredByNext: () => {
      stopAllDialogAudio() // Stop audio when closing
      // Disable blocker1 when dialog completes
      console.log('🚧 Dialog completed - Disabling blocker1')
      Transform.getMutable(blocker1).scale = Vector3.Zero()
      // Wait 2 seconds before resetting camera
      utils.timers.setTimeout(() => {
        resetTreeCamera()
      }, 1000)
    }
  }
]

export let welcomeDialog: Dialog[] = [
  {
    text: `You're getting close, Seeker.`,
    portrait: {
      path: 'images/doge.png'
    },
    triggeredByNext: () => {
      playDialogSound(npc2Sound) // Play next sound
    }
  },
  {
    text: `Beyond this path lies a ritual that burns the old to awaken the new.`,
    portrait: {
      path: 'images/doge.png'
    },
    triggeredByNext: () => {
      playDialogSound(npc3Sound) // Play next sound
    }
  },
  {
    text: `Those who offer their wearables to the flame may see them reborn — stronger, rarer........changed.`,
    portrait: {
      path: 'images/doge.png'
    },
    triggeredByNext: () => {
      playDialogSound(npc4Sound) // Play next sound
    }
  },
  {
    text: `If you wish to take part, be sure you have what the altar demands.`,
    portrait: {
      path: 'images/doge.png'
    },
    triggeredByNext: () => {
      playDialogSound(npc5Sound) // Play next sound
    }
  },
  {
    text: `Now go… your fate smolders just ahead.`,
    portrait: {
      path: 'images/doge.png'
    },
    isEndOfDialog: true,
    triggeredByNext: () => {
      stopAllDialogAudio() // Stop audio when closing
      // Disable blocker2 when dialog ends
      console.log('🚧 Dialog completed - Disabling blocker2')
      Transform.getMutable(blocker2).scale = Vector3.Zero()
      // Wait 1 second before resetting NPC camera
      utils.timers.setTimeout(() => {
        resetTreeCamera() // Reusing same reset function
      }, 1000)
    }
  }
]
