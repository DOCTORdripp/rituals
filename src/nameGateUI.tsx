import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { openExternalUrl } from '~system/RestrictedActions'
import * as utils from '@dcl-sdk/utils'

// Name gate prompt state
let isNameGateVisible = false
let onConfirmCallback: (() => void) | null = null
let onCancelCallback: (() => void) | null = null

// Verification notification state
let isVerificationVisible = false

export function showNameGatePrompt(onConfirm: () => void, onCancel: () => void) {
  isNameGateVisible = true
  onConfirmCallback = onConfirm
  onCancelCallback = onCancel
  console.log('🎭 Decentraland Name gate prompt shown')
}

export function hideNameGatePrompt() {
  isNameGateVisible = false
  onConfirmCallback = null
  onCancelCallback = null
  console.log('🎭 Decentraland Name gate prompt hidden')
}

export function showNameVerificationNotification() {
  isVerificationVisible = true
  console.log('✅ Showing name verification notification')
  
  // Automatically hide after 2 seconds
  utils.timers.setTimeout(() => {
    isVerificationVisible = false
    console.log('✅ Name verification notification hidden')
  }, 2000)
}

export function hideNameVerificationNotification() {
  isVerificationVisible = false
  console.log('✅ Name verification notification hidden')
}

// Export the UI component to be used in the main UI renderer
export function NameGateUI() {
  if (!isNameGateVisible) return null

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
          width: 600,
          height: 350,
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
            width: '100%',
            height: 50,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            margin: { bottom: 20 }
          }}
          uiText={{
            value: 'ADVENTURER',
            fontSize: 32,
            color: Color4.create(1, 0.84, 0, 1), // Gold color
            textAlign: 'middle-center'
          }}
        />

        {/* Message */}
        <UiEntity
          uiTransform={{
            width: 500,
            height: 120,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            margin: { bottom: 30 }
          }}
          uiText={{
            value: 'YOU MUST HAVE A DECENTRALAND NAME\nTO CONTINUE.\n\nWOULD YOU LIKE TO MINT ONE NOW?',
            fontSize: 18,
            color: Color4.White(),
            textAlign: 'middle-center'
          }}
        />

        {/* Buttons Container */}
        <UiEntity
          uiTransform={{
            width: '100%',
            height: 60,
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          {/* Cancel Button */}
          <UiEntity
            uiTransform={{
              width: 180,
              height: 50,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              margin: { right: 20 }
            }}
            uiBackground={{
              color: Color4.create(0.4, 0.4, 0.4, 1)
            }}
            onMouseDown={() => {
              console.log('🎭 Name gate cancelled by user')
              hideNameGatePrompt()
              if (onCancelCallback) {
                onCancelCallback()
              }
            }}
          >
            <UiEntity
              uiTransform={{
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              uiText={{
                value: 'CANCEL',
                fontSize: 20,
                color: Color4.White(),
                textAlign: 'middle-center'
              }}
            />
          </UiEntity>

          {/* Mint Name Button */}
          <UiEntity
            uiTransform={{
              width: 200,
              height: 50,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              margin: { left: 20 }
            }}
            uiBackground={{
              color: Color4.create(1, 0.5, 0, 1) // Orange color
            }}
            onMouseDown={() => {
              console.log('🎭 User clicked MINT NAME - opening marketplace')
              hideNameGatePrompt()
              // Open the Decentraland Names marketplace
              openExternalUrl({
                url: 'https://decentraland.org/marketplace/names/claim'
              })
              if (onConfirmCallback) {
                onConfirmCallback()
              }
            }}
          >
            <UiEntity
              uiTransform={{
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              uiText={{
                value: 'MINT NAME',
                fontSize: 20,
                color: Color4.White(),
                textAlign: 'middle-center'
              }}
            />
          </UiEntity>
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}

// Verification notification UI component
const NameVerificationUI = () => {
  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        display: isVerificationVisible ? 'flex' : 'none',
        justifyContent: 'center',
        alignItems: 'center',
        positionType: 'absolute',
        flexDirection: 'column'
      }}
    >
      {/* Verification text container - centered horizontally, lower third vertically */}
      <UiEntity
        uiTransform={{
          width: 700,
          height: 100,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
          margin: { top: 300 }
        }}
        uiBackground={{
          color: Color4.create(0, 0, 0, 0.8) // Semi-transparent black background
        }}
      >
        {/* Verification text */}
        <UiEntity
          uiTransform={{
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
          uiText={{
            value: 'DECENTRALAND NAME VERIFIED',
            fontSize: 36,
            color: Color4.create(0, 1, 0.2, 1), // Bright green color
            textAlign: 'middle-center'
          }}
        />
      </UiEntity>
    </UiEntity>
  )
}

export { NameVerificationUI }
