/**
 * AnimationTrack 模块
 * 
 * 实现动画轨道基类和各种子类，包括：
 * - AnimationTrack: 抽象基类
 * - VectorTrack: 向量轨道（位置、缩放使用）
 * - RotationTrack: 旋转轨道（含48位四元数解包）
 * - BoolTrack: 布尔轨道（可见性使用）
 * 
 * @module core/animation/AnimationTrack
 */

import * as THREE from 'three'
import { TrackType, VectorTrackData, RotationTrackData, BoolTrackData } from '../data/types'

// ==================== 抽象基类 ====================

/**
 * AnimationTrack 抽象基类
 * 
 * 所有动画轨道的基类，定义了获取指定时间点属性值的接口。
 * 
 * @abstract
 */
export abstract class AnimationTrack<T> {
  /**
   * 目标对象名称（骨骼名或网格名）
   */
  readonly targetName: string

  constructor(targetName: string) {
    this.targetName = targetName
  }

  /**
   * 获取指定帧的值
   * @param frame - 帧索引
   * @returns 该帧的值
   */
  abstract getValueAtFrame(frame: number): T;

  /**
   * 获取指定时间的值
   * @param time - 时间（秒）
   * @param frameRate - 帧率
   * @returns 该时间点的值
   */
  abstract getValueAtTime(time: number, frameRate: number): T;
}

// ==================== 向量轨道类型 ====================

/**
 * 向量轨道接口
 * 用于位置和缩放动画
 */
export interface IVectorTrack {
  readonly type: TrackType;
  getValue(frame: number): THREE.Vector3;
  getInterpolatedValue(frame: number): THREE.Vector3;
}

/**
 * 固定向量轨道
 * 整个动画期间值不变
 */
export class FixedVectorTrack implements IVectorTrack {
  readonly type: TrackType = 'fixed'
  private readonly value: THREE.Vector3

  constructor(x: number, y: number, z: number) {
    this.value = new THREE.Vector3(x, y, z)
  }

  getValue(_frame: number): THREE.Vector3 {
    return this.value.clone()
  }

  getInterpolatedValue(_frame: number): THREE.Vector3 {
    return this.value.clone()
  }

  /**
   * 从 VectorTrackData 创建
   */
  static fromData(data: VectorTrackData): FixedVectorTrack {
    if (data.values.length < 3) {
      return new FixedVectorTrack(0, 0, 0)
    }
    return new FixedVectorTrack(data.values[0], data.values[1], data.values[2])
  }
}

/**
 * 动态向量轨道
 * 每帧一个值的数组
 */
export class DynamicVectorTrack implements IVectorTrack {
  readonly type: TrackType = 'dynamic'
  private readonly values: Float32Array
  private readonly frameCount: number

  constructor(values: Float32Array) {
    this.values = values
    this.frameCount = Math.floor(values.length / 3)
  }

  getValue(frame: number): THREE.Vector3 {
    const clampedFrame = Math.max(0, Math.min(frame, this.frameCount - 1))
    const index = Math.floor(clampedFrame) * 3
    return new THREE.Vector3(
      this.values[index],
      this.values[index + 1],
      this.values[index + 2]
    )
  }

  getInterpolatedValue(frame: number): THREE.Vector3 {
    if (this.frameCount === 0) {
      return new THREE.Vector3(0, 0, 0)
    }

    const clampedFrame = Math.max(0, Math.min(frame, this.frameCount - 1))
    const frameIndex = Math.floor(clampedFrame)
    const t = clampedFrame - frameIndex

    if (t === 0 || frameIndex >= this.frameCount - 1) {
      return this.getValue(frameIndex)
    }

    // 线性插值
    const v1 = this.getValue(frameIndex)
    const v2 = this.getValue(frameIndex + 1)
    return v1.lerp(v2, t)
  }

  static fromData(data: VectorTrackData): DynamicVectorTrack {
    return new DynamicVectorTrack(data.values)
  }
}

/**
 * 关键帧向量轨道（16位帧索引）
 */
export class Framed16VectorTrack implements IVectorTrack {
  readonly type: TrackType = 'framed16'
  private readonly values: Float32Array
  private readonly frames: Uint16Array
  private readonly keyframeCount: number

  constructor(values: Float32Array, frames: Uint16Array) {
    this.values = values
    this.frames = frames
    this.keyframeCount = frames.length
  }

  getValue(frame: number): THREE.Vector3 {
    return this.getInterpolatedValue(frame)
  }

  getInterpolatedValue(frame: number): THREE.Vector3 {
    if (this.keyframeCount === 0) {
      return new THREE.Vector3(0, 0, 0)
    }

    // 如果只有一个关键帧，直接返回
    if (this.keyframeCount === 1) {
      return new THREE.Vector3(
        this.values[0],
        this.values[1],
        this.values[2]
      )
    }

    // 找到当前帧所在的两个关键帧
    let prevIndex = 0
    let nextIndex = 1

    for (let i = 0; i < this.keyframeCount - 1; i++) {
      if (frame >= this.frames[i] && frame <= this.frames[i + 1]) {
        prevIndex = i
        nextIndex = i + 1
        break
      }
    }

    // 如果帧超出范围，返回最后一个值
    if (frame >= this.frames[this.keyframeCount - 1]) {
      const lastIndex = (this.keyframeCount - 1) * 3
      return new THREE.Vector3(
        this.values[lastIndex],
        this.values[lastIndex + 1],
        this.values[lastIndex + 2]
      )
    }

    // 如果帧在第一个关键帧之前，返回第一个值
    if (frame < this.frames[0]) {
      return new THREE.Vector3(
        this.values[0],
        this.values[1],
        this.values[2]
      )
    }

    const prevFrame = this.frames[prevIndex]
    const nextFrame = this.frames[nextIndex]

    // 计算插值因子
    const t = (frame - prevFrame) / (nextFrame - prevFrame)

    // 获取两个关键帧的值
    const prevValueIndex = prevIndex * 3
    const nextValueIndex = nextIndex * 3

    const prevVec = new THREE.Vector3(
      this.values[prevValueIndex],
      this.values[prevValueIndex + 1],
      this.values[prevValueIndex + 2]
    )

    const nextVec = new THREE.Vector3(
      this.values[nextValueIndex],
      this.values[nextValueIndex + 1],
      this.values[nextValueIndex + 2]
    )

    // 线性插值
    return prevVec.lerp(nextVec, t)
  }

  static fromData(data: VectorTrackData): Framed16VectorTrack {
    const frames = data.frames instanceof Uint16Array 
      ? data.frames 
      : new Uint16Array(data.frames || [])
    return new Framed16VectorTrack(data.values, frames)
  }
}

/**
 * 关键帧向量轨道（8位帧索引）
 */
export class Framed8VectorTrack implements IVectorTrack {
  readonly type: TrackType = 'framed8'
  private readonly values: Float32Array
  private readonly frames: Uint8Array
  private readonly keyframeCount: number

  constructor(values: Float32Array, frames: Uint8Array) {
    this.values = values
    this.frames = frames
    this.keyframeCount = frames.length
  }

  getValue(frame: number): THREE.Vector3 {
    return this.getInterpolatedValue(frame)
  }

  getInterpolatedValue(frame: number): THREE.Vector3 {
    if (this.keyframeCount === 0) {
      return new THREE.Vector3(0, 0, 0)
    }

    // 如果只有一个关键帧，直接返回
    if (this.keyframeCount === 1) {
      return new THREE.Vector3(
        this.values[0],
        this.values[1],
        this.values[2]
      )
    }

    // 找到当前帧所在的两个关键帧
    let prevIndex = 0
    let nextIndex = 1

    for (let i = 0; i < this.keyframeCount - 1; i++) {
      if (frame >= this.frames[i] && frame <= this.frames[i + 1]) {
        prevIndex = i
        nextIndex = i + 1
        break
      }
    }

    // 如果帧超出范围，返回最后一个值
    if (frame >= this.frames[this.keyframeCount - 1]) {
      const lastIndex = (this.keyframeCount - 1) * 3
      return new THREE.Vector3(
        this.values[lastIndex],
        this.values[lastIndex + 1],
        this.values[lastIndex + 2]
      )
    }

    // 如果帧在第一个关键帧之前，返回第一个值
    if (frame < this.frames[0]) {
      return new THREE.Vector3(
        this.values[0],
        this.values[1],
        this.values[2]
      )
    }

    const prevFrame = this.frames[prevIndex]
    const nextFrame = this.frames[nextIndex]

    // 计算插值因子
    const t = (frame - prevFrame) / (nextFrame - prevFrame)

    // 获取两个关键帧的值
    const prevValueIndex = prevIndex * 3
    const nextValueIndex = nextIndex * 3

    const prevVec = new THREE.Vector3(
      this.values[prevValueIndex],
      this.values[prevValueIndex + 1],
      this.values[prevValueIndex + 2]
    )

    const nextVec = new THREE.Vector3(
      this.values[nextValueIndex],
      this.values[nextValueIndex + 1],
      this.values[nextValueIndex + 2]
    )

    // 线性插值
    return prevVec.lerp(nextVec, t)
  }

  static fromData(data: VectorTrackData): Framed8VectorTrack {
    const frames = data.frames instanceof Uint8Array 
      ? data.frames 
      : new Uint8Array(data.frames || [])
    return new Framed8VectorTrack(data.values, frames)
  }
}

/**
 * 向量轨道联合类型
 */
export type VectorTrack = 
  | FixedVectorTrack 
  | DynamicVectorTrack 
  | Framed16VectorTrack 
  | Framed8VectorTrack;

/**
 * 从 VectorTrackData 创建对应的 VectorTrack
 */
export function createVectorTrack(data: VectorTrackData | null): VectorTrack | null {
  if (!data) return null

  switch (data.type) {
    case 'fixed':
      return FixedVectorTrack.fromData(data)
    case 'dynamic':
      return DynamicVectorTrack.fromData(data)
    case 'framed16':
      return Framed16VectorTrack.fromData(data)
    case 'framed8':
      return Framed8VectorTrack.fromData(data)
    default:
      console.warn(`Unknown vector track type: ${data.type}`)
      return null
  }
}

// ==================== 旋转轨道类型 ====================


/**
 * 48位四元数解包工具类
 * 
 * 用于解包 Pokemon 动画文件中使用的压缩四元数格式。
 * 48位格式将四元数压缩为3个16位整数，通过省略最大分量来节省空间。
 */
export class QuaternionUnpacker {
  private static readonly SCALE = 0x7fff
  private static readonly PI_QUARTER = Math.PI / 4.0
  private static readonly PI_HALF = Math.PI / 2.0

  /**
   * 展开打包的浮点数
   * @param i - 打包的整数值
   * @returns 展开后的浮点数
   */
  private static expandFloat(i: number): number {
    return i * (this.PI_HALF / this.SCALE) - this.PI_QUARTER
  }

  /**
   * 解包48位四元数
   * 
   * 48位格式说明：
   * - 3个16位整数 (x, y, z) 组成48位数据
   * - 低3位表示缺失分量的索引 (0-3)
   * - 第3位表示是否需要取反
   * - 其余位存储3个压缩的四元数分量
   * 
   * @param x - 第一个16位整数
   * @param y - 第二个16位整数
   * @param z - 第三个16位整数
   * @returns 解包后的四元数
   */
  static unpack(x: number, y: number, z: number): THREE.Quaternion {
    // 组合成48位数据
    const pack = (BigInt(z) << 32n) | (BigInt(y) << 16n) | BigInt(x)
    
    // 提取3个压缩的分量
    const q1 = this.expandFloat(Number((pack >> 3n) & 0x7fffn))
    const q2 = this.expandFloat(Number((pack >> 18n) & 0x7fffn))
    const q3 = this.expandFloat(Number((pack >> 33n) & 0x7fffn))
    
    const values = [q1, q2, q3]
    
    // 计算缺失的分量（使用四元数归一化约束）
    const maxComponent = Math.max(1.0 - (q1 * q1 + q2 * q2 + q3 * q3), 0.0)
    const missingComponent = Math.sqrt(maxComponent)
    
    // 获取缺失分量的索引
    const missingIndex = Number(pack & 0x3n)
    values.splice(missingIndex, 0, missingComponent)
    
    // 检查是否需要取反
    const isNegative = (pack & 0x4n) !== 0n
    
    if (isNegative) {
      return new THREE.Quaternion(-values[0], -values[1], -values[2], -values[3])
    } else {
      return new THREE.Quaternion(values[0], values[1], values[2], values[3])
    }
  }

  /**
   * 从 Float32Array 解包四元数（用于已解包的数据）
   * @param values - 包含 x, y, z, w 的数组
   * @param offset - 起始偏移
   * @returns 四元数
   */
  static fromFloat32Array(values: Float32Array, offset: number = 0): THREE.Quaternion {
    return new THREE.Quaternion(
      values[offset],
      values[offset + 1],
      values[offset + 2],
      values[offset + 3]
    )
  }
}

/**
 * 旋转轨道接口
 * 用于骨骼旋转动画
 */
export interface IRotationTrack {
  readonly type: TrackType;
  getValue(frame: number): THREE.Quaternion;
  getInterpolatedValue(frame: number): THREE.Quaternion;
}

/**
 * 固定旋转轨道
 * 整个动画期间旋转不变
 */
export class FixedRotationTrack implements IRotationTrack {
  readonly type: TrackType = 'fixed'
  private readonly value: THREE.Quaternion

  constructor(quaternion: THREE.Quaternion) {
    this.value = quaternion.clone()
  }

  getValue(_frame: number): THREE.Quaternion {
    return this.value.clone()
  }

  getInterpolatedValue(_frame: number): THREE.Quaternion {
    return this.value.clone()
  }

  /**
   * 从 RotationTrackData 创建（数据已解包为四元数）
   */
  static fromData(data: RotationTrackData): FixedRotationTrack {
    if (data.values.length < 4) {
      return new FixedRotationTrack(new THREE.Quaternion(0, 0, 0, 1))
    }
    const q = new THREE.Quaternion(
      data.values[0],
      data.values[1],
      data.values[2],
      data.values[3]
    )
    return new FixedRotationTrack(q)
  }

  /**
   * 从48位压缩数据创建
   */
  static fromPacked(x: number, y: number, z: number): FixedRotationTrack {
    const q = QuaternionUnpacker.unpack(x, y, z)
    return new FixedRotationTrack(q)
  }
}

/**
 * 动态旋转轨道
 * 每帧一个旋转值
 */
export class DynamicRotationTrack implements IRotationTrack {
  readonly type: TrackType = 'dynamic'
  private readonly values: Float32Array
  private readonly frameCount: number

  constructor(values: Float32Array) {
    this.values = values
    this.frameCount = Math.floor(values.length / 4)
  }

  getValue(frame: number): THREE.Quaternion {
    if (this.frameCount === 0) {
      return new THREE.Quaternion(0, 0, 0, 1)
    }

    const clampedFrame = Math.max(0, Math.min(frame, this.frameCount - 1))
    const index = Math.floor(clampedFrame) * 4
    return new THREE.Quaternion(
      this.values[index],
      this.values[index + 1],
      this.values[index + 2],
      this.values[index + 3]
    )
  }

  getInterpolatedValue(frame: number): THREE.Quaternion {
    if (this.frameCount === 0) {
      return new THREE.Quaternion(0, 0, 0, 1)
    }

    const clampedFrame = Math.max(0, Math.min(frame, this.frameCount - 1))
    const frameIndex = Math.floor(clampedFrame)
    const t = clampedFrame - frameIndex

    if (t === 0 || frameIndex >= this.frameCount - 1) {
      return this.getValue(frameIndex)
    }

    // 球面线性插值 (slerp)
    const q1 = this.getValue(frameIndex)
    const q2 = this.getValue(frameIndex + 1)
    return q1.slerp(q2, t)
  }

  static fromData(data: RotationTrackData): DynamicRotationTrack {
    return new DynamicRotationTrack(data.values)
  }
}

/**
 * 关键帧旋转轨道（16位帧索引）
 */
export class Framed16RotationTrack implements IRotationTrack {
  readonly type: TrackType = 'framed16'
  private readonly values: Float32Array
  private readonly frames: Uint16Array
  private readonly keyframeCount: number

  constructor(values: Float32Array, frames: Uint16Array) {
    this.values = values
    this.frames = frames
    this.keyframeCount = frames.length
  }

  getValue(frame: number): THREE.Quaternion {
    return this.getInterpolatedValue(frame)
  }

  getInterpolatedValue(frame: number): THREE.Quaternion {
    if (this.keyframeCount === 0) {
      return new THREE.Quaternion(0, 0, 0, 1)
    }

    // 如果只有一个关键帧，直接返回
    if (this.keyframeCount === 1) {
      return new THREE.Quaternion(
        this.values[0],
        this.values[1],
        this.values[2],
        this.values[3]
      )
    }

    // 找到当前帧所在的两个关键帧
    let prevIndex = 0
    let nextIndex = 1

    for (let i = 0; i < this.keyframeCount - 1; i++) {
      if (frame >= this.frames[i] && frame <= this.frames[i + 1]) {
        prevIndex = i
        nextIndex = i + 1
        break
      }
    }

    // 如果帧超出范围，返回最后一个值
    if (frame >= this.frames[this.keyframeCount - 1]) {
      const lastIndex = (this.keyframeCount - 1) * 4
      return new THREE.Quaternion(
        this.values[lastIndex],
        this.values[lastIndex + 1],
        this.values[lastIndex + 2],
        this.values[lastIndex + 3]
      )
    }

    // 如果帧在第一个关键帧之前，返回第一个值
    if (frame < this.frames[0]) {
      return new THREE.Quaternion(
        this.values[0],
        this.values[1],
        this.values[2],
        this.values[3]
      )
    }

    const prevFrame = this.frames[prevIndex]
    const nextFrame = this.frames[nextIndex]

    // 计算插值因子
    const t = (frame - prevFrame) / (nextFrame - prevFrame)

    // 获取两个关键帧的四元数
    const prevValueIndex = prevIndex * 4
    const nextValueIndex = nextIndex * 4

    const q1 = new THREE.Quaternion(
      this.values[prevValueIndex],
      this.values[prevValueIndex + 1],
      this.values[prevValueIndex + 2],
      this.values[prevValueIndex + 3]
    )

    const q2 = new THREE.Quaternion(
      this.values[nextValueIndex],
      this.values[nextValueIndex + 1],
      this.values[nextValueIndex + 2],
      this.values[nextValueIndex + 3]
    )

    // 球面线性插值
    return q1.slerp(q2, t)
  }

  static fromData(data: RotationTrackData): Framed16RotationTrack {
    const frames = data.frames instanceof Uint16Array 
      ? data.frames 
      : new Uint16Array(data.frames || [])
    return new Framed16RotationTrack(data.values, frames)
  }
}

/**
 * 关键帧旋转轨道（8位帧索引）
 */
export class Framed8RotationTrack implements IRotationTrack {
  readonly type: TrackType = 'framed8'
  private readonly values: Float32Array
  private readonly frames: Uint8Array
  private readonly keyframeCount: number

  constructor(values: Float32Array, frames: Uint8Array) {
    this.values = values
    this.frames = frames
    this.keyframeCount = frames.length
  }

  getValue(frame: number): THREE.Quaternion {
    return this.getInterpolatedValue(frame)
  }

  getInterpolatedValue(frame: number): THREE.Quaternion {
    if (this.keyframeCount === 0) {
      return new THREE.Quaternion(0, 0, 0, 1)
    }

    // 如果只有一个关键帧，直接返回
    if (this.keyframeCount === 1) {
      return new THREE.Quaternion(
        this.values[0],
        this.values[1],
        this.values[2],
        this.values[3]
      )
    }

    // 找到当前帧所在的两个关键帧
    let prevIndex = 0
    let nextIndex = 1

    for (let i = 0; i < this.keyframeCount - 1; i++) {
      if (frame >= this.frames[i] && frame <= this.frames[i + 1]) {
        prevIndex = i
        nextIndex = i + 1
        break
      }
    }

    // 如果帧超出范围，返回最后一个值
    if (frame >= this.frames[this.keyframeCount - 1]) {
      const lastIndex = (this.keyframeCount - 1) * 4
      return new THREE.Quaternion(
        this.values[lastIndex],
        this.values[lastIndex + 1],
        this.values[lastIndex + 2],
        this.values[lastIndex + 3]
      )
    }

    // 如果帧在第一个关键帧之前，返回第一个值
    if (frame < this.frames[0]) {
      return new THREE.Quaternion(
        this.values[0],
        this.values[1],
        this.values[2],
        this.values[3]
      )
    }

    const prevFrame = this.frames[prevIndex]
    const nextFrame = this.frames[nextIndex]

    // 计算插值因子
    const t = (frame - prevFrame) / (nextFrame - prevFrame)

    // 获取两个关键帧的四元数
    const prevValueIndex = prevIndex * 4
    const nextValueIndex = nextIndex * 4

    const q1 = new THREE.Quaternion(
      this.values[prevValueIndex],
      this.values[prevValueIndex + 1],
      this.values[prevValueIndex + 2],
      this.values[prevValueIndex + 3]
    )

    const q2 = new THREE.Quaternion(
      this.values[nextValueIndex],
      this.values[nextValueIndex + 1],
      this.values[nextValueIndex + 2],
      this.values[nextValueIndex + 3]
    )

    // 球面线性插值
    return q1.slerp(q2, t)
  }

  static fromData(data: RotationTrackData): Framed8RotationTrack {
    const frames = data.frames instanceof Uint8Array 
      ? data.frames 
      : new Uint8Array(data.frames || [])
    return new Framed8RotationTrack(data.values, frames)
  }
}

/**
 * 旋转轨道联合类型
 */
export type RotationTrack = 
  | FixedRotationTrack 
  | DynamicRotationTrack 
  | Framed16RotationTrack 
  | Framed8RotationTrack;

/**
 * 从 RotationTrackData 创建对应的 RotationTrack
 */
export function createRotationTrack(data: RotationTrackData | null): RotationTrack | null {
  if (!data) return null

  switch (data.type) {
    case 'fixed':
      return FixedRotationTrack.fromData(data)
    case 'dynamic':
      return DynamicRotationTrack.fromData(data)
    case 'framed16':
      return Framed16RotationTrack.fromData(data)
    case 'framed8':
      return Framed8RotationTrack.fromData(data)
    default:
      console.warn(`Unknown rotation track type: ${data.type}`)
      return null
  }
}


// ==================== 布尔轨道类型 ====================

/**
 * 布尔轨道接口
 * 用于可见性动画
 */
export interface IBoolTrack {
  readonly type: TrackType;
  getValue(frame: number): boolean;
}

/**
 * 固定布尔轨道
 * 整个动画期间值不变
 */
export class FixedBoolTrack implements IBoolTrack {
  readonly type: TrackType = 'fixed'
  private readonly value: boolean

  constructor(value: boolean) {
    this.value = value
  }

  getValue(_frame: number): boolean {
    return this.value
  }

  static fromData(data: BoolTrackData): FixedBoolTrack {
    if (data.values.length === 0) {
      return new FixedBoolTrack(false)
    }
    return new FixedBoolTrack(!!data.values[0])
  }
}

/**
 * 动态布尔轨道
 * 每帧一个值
 */
export class DynamicBoolTrack implements IBoolTrack {
  readonly type: TrackType = 'dynamic'
  private readonly values: Uint8Array
  private readonly frameCount: number

  constructor(values: Uint8Array) {
    this.values = values
    this.frameCount = values.length
  }

  getValue(frame: number): boolean {
    if (this.frameCount === 0) {
      return false
    }

    // 使用帧号对值数组长度取模（与原始实现一致）
    const index = frame % this.frameCount
    return !!this.values[index]
  }

  static fromData(data: BoolTrackData): DynamicBoolTrack {
    return new DynamicBoolTrack(data.values)
  }
}

/**
 * 关键帧布尔轨道（16位帧索引）
 */
export class Framed16BoolTrack implements IBoolTrack {
  readonly type: TrackType = 'framed16'
  private readonly values: Uint8Array
  private readonly frames: Uint16Array
  private readonly keyframeCount: number

  constructor(values: Uint8Array, frames: Uint16Array) {
    this.values = values
    this.frames = frames
    this.keyframeCount = frames.length
  }

  getValue(frame: number): boolean {
    if (this.keyframeCount === 0 || this.values.length === 0) {
      return false
    }

    // 找到当前帧所在的区间
    let currentIndex = 0
    for (let i = 0; i < this.keyframeCount; i++) {
      if (frame >= this.frames[i]) {
        currentIndex = i
      } else {
        break
      }
    }

    // 如果超出范围，使用最后一个值
    if (currentIndex >= this.values.length) {
      currentIndex = this.values.length - 1
    }

    return !!this.values[currentIndex]
  }

  static fromData(data: BoolTrackData): Framed16BoolTrack {
    const frames = data.frames instanceof Uint16Array 
      ? data.frames 
      : new Uint16Array(data.frames || [])
    return new Framed16BoolTrack(data.values, frames)
  }
}

/**
 * 关键帧布尔轨道（8位帧索引）
 */
export class Framed8BoolTrack implements IBoolTrack {
  readonly type: TrackType = 'framed8'
  private readonly values: Uint8Array
  private readonly frames: Uint8Array
  private readonly keyframeCount: number

  constructor(values: Uint8Array, frames: Uint8Array) {
    this.values = values
    this.frames = frames
    this.keyframeCount = frames.length
  }

  getValue(frame: number): boolean {
    if (this.keyframeCount === 0 || this.values.length === 0) {
      return false
    }

    // 找到当前帧所在的区间
    let currentIndex = 0
    for (let i = 0; i < this.keyframeCount; i++) {
      if (frame >= this.frames[i]) {
        currentIndex = i
      } else {
        break
      }
    }

    // 如果超出范围，使用最后一个值
    if (currentIndex >= this.values.length) {
      currentIndex = this.values.length - 1
    }

    return !!this.values[currentIndex]
  }

  static fromData(data: BoolTrackData): Framed8BoolTrack {
    const frames = data.frames instanceof Uint8Array 
      ? data.frames 
      : new Uint8Array(data.frames || [])
    return new Framed8BoolTrack(data.values, frames)
  }
}

/**
 * 布尔轨道联合类型
 */
export type BoolTrack = 
  | FixedBoolTrack 
  | DynamicBoolTrack 
  | Framed16BoolTrack 
  | Framed8BoolTrack;

/**
 * 从 BoolTrackData 创建对应的 BoolTrack
 */
export function createBoolTrack(data: BoolTrackData | null): BoolTrack | null {
  if (!data) return null

  switch (data.type) {
    case 'fixed':
      return FixedBoolTrack.fromData(data)
    case 'dynamic':
      return DynamicBoolTrack.fromData(data)
    case 'framed16':
      return Framed16BoolTrack.fromData(data)
    case 'framed8':
      return Framed8BoolTrack.fromData(data)
    default:
      console.warn(`Unknown bool track type: ${data.type}`)
      return null
  }
}
