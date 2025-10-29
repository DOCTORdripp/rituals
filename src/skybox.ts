import { 
  engine, 
  Transform, 
  MeshRenderer, 
  Material, 
  TextureUnion,
  Entity
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'

/**
 * Creates a custom AI-generated skybox using cube map textures
 * Based on: https://github.com/decentraland-scenes/skybox-ai-sdk7
 */
export function createSkybox() {
  // Create skybox entity
  const skybox = engine.addEntity()
  
  // Position at bottom-right corner parcel (10, -2)
  Transform.create(skybox, {
    position: Vector3.create(168, 50, -24), // Centered for bottom-right corner
    scale: Vector3.create(500, 500, 500), // Large scale to encompass entire scene
    rotation: Quaternion.fromEulerDegrees(0, 0, 0)
  })

  // Create cube mesh for skybox
  MeshRenderer.setBox(skybox)

  // Apply skybox material with cube map textures
  Material.setPbrMaterial(skybox, {
    texture: Material.Texture.Common({
      src: 'images/skybox/7/px.png' // Positive X
    }),
    roughness: 1.0,
    metallic: 0,
    emissiveTexture: Material.Texture.Common({
      src: 'images/skybox/7/px.png'
    }),
    emissiveColor: { r: 1, g: 1, b: 1 },
    emissiveIntensity: 0.8
  })

  console.log('✅ Skybox created at center of scene')
  
  return skybox
}

/**
 * Creates a full cube-mapped skybox with all 6 faces
 * This is the more advanced version that properly maps all textures
 */
export function createCubeMappedSkybox() {
  const skyboxParent = engine.addEntity()
  
  // Position at bottom-right corner parcel (10, -2)
  Transform.create(skyboxParent, {
    position: Vector3.create(168, 50, -24), // Centered for bottom-right corner
    scale: Vector3.create(1, 1, 1)
  })

  const skyboxSize = 140
  
  // Create 6 faces of the skybox cube (rotated to face inward)
  const faces = [
    // Front face (negative Z) - flip to face inward
    { 
      texture: 'images/skybox/7/nz.png',
      position: Vector3.create(0, 0, -skyboxSize / 2),
      rotation: Quaternion.fromEulerDegrees(0, 180, 0)
    },
    // Back face (positive Z) - flip to face inward
    { 
      texture: 'images/skybox/7/pz.png',
      position: Vector3.create(0, 0, skyboxSize / 2),
      rotation: Quaternion.fromEulerDegrees(0, 0, 0)
    },
    // Left face (negative X) - flip to face inward
    { 
      texture: 'images/skybox/7/nx.png',
      position: Vector3.create(-skyboxSize / 2, 0, 0),
      rotation: Quaternion.fromEulerDegrees(0, -90, 0)
    },
    // Right face (positive X) - flip to face inward
    { 
      texture: 'images/skybox/7/px.png',
      position: Vector3.create(skyboxSize / 2, 0, 0),
      rotation: Quaternion.fromEulerDegrees(0, 90, 0)
    },
    // Top face (positive Y) - flip to face inward
    { 
      texture: 'images/skybox/7/py.png',
      position: Vector3.create(0, skyboxSize / 2, 0),
      rotation: Quaternion.fromEulerDegrees(-90, 90, 0)
    },
    // Bottom face (negative Y) - flip to face inward
   // { 
   //    texture: 'images/skybox/7/ny.png',
   //    position: Vector3.create(0, -skyboxSize / 2, 0),
   //    rotation: Quaternion.fromEulerDegrees(90, 0, 0)
   //  }
  ]

  // Create each face
  faces.forEach((face, index) => {
    const plane = engine.addEntity()
    
    Transform.create(plane, {
      position: face.position,
      rotation: face.rotation,
      scale: Vector3.create(skyboxSize, skyboxSize, 1),
      parent: skyboxParent
    })

    MeshRenderer.setPlane(plane)

    Material.setPbrMaterial(plane, {
      texture: Material.Texture.Common({
        src: face.texture
      }),
      roughness: 1.0,
      metallic: 0,
      emissiveTexture: Material.Texture.Common({
        src: face.texture
      }),
      emissiveColor: { r: 1, g: 1, b: 1 },
      emissiveIntensity: 0.9,
      alphaTest: 0
    })
  })

  console.log('✅ Cube-mapped skybox created with all 6 faces')
  
  return skyboxParent
}

/**
 * Creates a second cube-mapped skybox for the hauntedScape area
 * Positioned to not intersect with the main skybox
 */
export function createSecondSkybox() {
  const skyboxParent = engine.addEntity()
  
  // Position at center of hauntedScape area (between 208,76 and 78,191)
  // Center: x=(208+78)/2=143, z=(76+191)/2=133.5
  Transform.create(skyboxParent, {
    position: Vector3.create(143, 50, 133.5), // Centered for hauntedScape area
    scale: Vector3.create(1, 1, 1)
  })

  const skyboxSize = 160  // Larger to cover the area (130x115) with margin
  
  // Create 6 faces of the skybox cube (rotated to face inward)
  const faces = [
    // Front face (negative Z) - flip to face inward
    { 
      texture: 'images/skybox/7/nz.png',
      position: Vector3.create(0, 0, -skyboxSize / 2),
      rotation: Quaternion.fromEulerDegrees(0, 180, 0)
    },
    // Back face (positive Z) - flip to face inward
    { 
      texture: 'images/skybox/7/pz.png',
      position: Vector3.create(0, 0, skyboxSize / 2),
      rotation: Quaternion.fromEulerDegrees(0, 0, 0)
    },
    // Left face (negative X) - flip to face inward
    { 
      texture: 'images/skybox/7/nx.png',
      position: Vector3.create(-skyboxSize / 2, 0, 0),
      rotation: Quaternion.fromEulerDegrees(0, -90, 0)
    },
    // Right face (positive X) - flip to face inward
    { 
      texture: 'images/skybox/7/px.png',
      position: Vector3.create(skyboxSize / 2, 0, 0),
      rotation: Quaternion.fromEulerDegrees(0, 90, 0)
    },
    // Top face (positive Y) - flip to face inward
    { 
      texture: 'images/skybox/7/py.png',
      position: Vector3.create(0, skyboxSize / 2, 0),
      rotation: Quaternion.fromEulerDegrees(-90, 90, 0)
    },
    // Bottom face (negative Y) - flip to face inward
    { 
      texture: 'images/skybox/7/ny.png',
      position: Vector3.create(0, -skyboxSize / 2, 0),
      rotation: Quaternion.fromEulerDegrees(90, 0, 0)
    }
  ]

  // Create each face
  faces.forEach((face, index) => {
    const plane = engine.addEntity()
    
    Transform.create(plane, {
      position: face.position,
      rotation: face.rotation,
      scale: Vector3.create(skyboxSize, skyboxSize, 1),
      parent: skyboxParent
    })

    MeshRenderer.setPlane(plane)

    Material.setPbrMaterial(plane, {
      texture: Material.Texture.Common({
        src: face.texture
      }),
      roughness: 1.0,
      metallic: 0,
      emissiveTexture: Material.Texture.Common({
        src: face.texture
      }),
      emissiveColor: { r: 1, g: 1, b: 1 },
      emissiveIntensity: 0.9,
      alphaTest: 0
    })
  })

  console.log('✅ Second skybox created for hauntedScape area')
  
  return skyboxParent
}

