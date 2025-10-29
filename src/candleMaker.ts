import { engine, Transform, GltfContainer } from '@dcl/sdk/ecs'
import { Vector3, Quaternion } from '@dcl/sdk/math'

/**
 * Create a candle entity at the specified position
 * @param position - Vector3 position for the candle
 * @param scale - Optional scale (defaults to 1, 1, 1)
 * @param rotation - Optional rotation quaternion (defaults to no rotation)
 * @returns The created candle entity
 */
export function createCandle(
  position: Vector3,
  scale?: Vector3,
  rotation?: Quaternion
) {
  const candle = engine.addEntity()
  
  Transform.create(candle, {
    position: position,
    scale: scale || Vector3.create(1, 1, 1),
    rotation: rotation || Quaternion.Identity()
  })
  
  GltfContainer.create(candle, {
    src: 'models/candleLit.glb'
  })
  
  return candle
}

/**
 * Create multiple candles at once from an array of positions
 * @param positions - Array of Vector3 positions
 * @param scale - Optional scale to apply to all candles
 * @param rotation - Optional rotation to apply to all candles
 * @returns Array of created candle entities
 */
export function createCandles(
  positions: Vector3[],
  scale?: Vector3,
  rotation?: Quaternion
) {
  return positions.map(pos => createCandle(pos, scale, rotation))
}

/**
 * Create candles arranged in a circular pattern
 * @param centerPosition - Vector3 center position of the circle
 * @param radius - Distance from center to each candle (in meters)
 * @param count - Number of candles to create around the circle
 * @param startAngleDegrees - Optional starting angle in degrees (default 0) to rotate the entire pattern
 * @param scale - Optional scale to apply to all candles
 * @param rotation - Optional rotation to apply to all candles
 * @returns Array of created candle entities
 */
export function createCircularCandleArray(
  centerPosition: Vector3,
  radius: number,
  count: number,
  startAngleDegrees: number = 0,
  scale?: Vector3,
  rotation?: Quaternion
) {
  const candles = []
  const angleStep = (Math.PI * 2) / count  // Full circle divided by count
  const startAngleRadians = (startAngleDegrees * Math.PI) / 180  // Convert to radians
  
  for (let i = 0; i < count; i++) {
    const angle = startAngleRadians + (angleStep * i)
    const x = centerPosition.x + radius * Math.cos(angle)
    const z = centerPosition.z + radius * Math.sin(angle)
    const y = centerPosition.y
    
    const position = Vector3.create(x, y, z)
    candles.push(createCandle(position, scale, rotation))
  }
  
  return candles
}

