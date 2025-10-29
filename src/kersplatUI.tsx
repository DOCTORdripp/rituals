import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import * as utils from '@dcl-sdk/utils'

let isKersplatVisible = false

export function showKersplatImage() {
  isKersplatVisible = true
  
  // Auto-close after 2 seconds
  utils.timers.setTimeout(() => {
    hideKersplatImage()
  }, 2000)
}

export function hideKersplatImage() {
  isKersplatVisible = false
}

// Export the UI component to be used in the main UI renderer
export function KersplatUI() {
  if (!isKersplatVisible) return null

  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        positionType: 'absolute'
      }}
      uiBackground={{
        color: Color4.create(0, 0, 0, 0.8)
      }}
      onMouseDown={() => {
        console.log('🖱️ Kersplat UI closed by user')
        hideKersplatImage()
      }}
    >
      {/* Kersplat Image */}
      <UiEntity
        uiTransform={{
          width: 1200,
          height: 1200
        }}
        uiBackground={{
          textureMode: 'stretch',
          texture: {
            src: 'images/kersplat.png'
          }
        }}
      />
    </UiEntity>
  )
}

