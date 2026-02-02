/**
 * AnimationClip 模块
 * 
 * 表示一个动画片段的完整数据，包含所有骨骼轨道和可见性轨道。
 * 它是纯数据对象，不包含播放状态。
 * 
 * @module core/animation/AnimationClip
 */

import {
  IAnimationData,
  BoneTrackData,
  VisibilityTrackData,
  VectorTrackData,
  RotationTrackData,
  BoolTrackData,
  BoneTransform,
} from '../data/types'
import { BoneAnimationTrack } from './BoneAnimationTrack'
import { VisibilityAnimationTrack } from './VisibilityAnimationTrack'
import { QuaternionUnpacker } from './AnimationTrack'
import {
  TRANM,
  TRACM,
  VectorTrack as VectorTrackEnum,
  RotationTrack as RotationTrackEnum,
  TrackFlag,
  unionToVectorTrack,
  unionToRotationTrack,
  unionToTrackFlag,
  FixedVectorTrack as FBFixedVectorTrack,
  DynamicVectorTrack as FBDynamicVectorTrack,
  Framed16VectorTrack as FBFramed16VectorTrack,
  Framed8VectorTrack as FBFramed8VectorTrack,
  FixedRotationTrack as FBFixedRotationTrack,
  DynamicRotationTrack as FBDynamicRotationTrack,
  Framed16RotationTrack as FBFramed16RotationTrack,
  Framed8RotationTrack as FBFramed8RotationTrack,
  FixedBoolTrack as FBFixedBoolTrack,
  DynamicBoolTrack as FBDynamicBoolTrack,
  Framed16BoolTrack as FBFramed16BoolTrack,
  Framed8BoolTrack as FBFramed8BoolTrack,
  VisibilityShapeTimeline,
} from '../../parsers'

/**
 * AnimationClip 类
 * 
 * 表示一个动画片段的完整数据，包含所有骨骼轨道和可见性轨道。
 * 这是一个纯数据对象，不包含播放状态。
 */
export class AnimationClip {
  /** 动画名称 */
  readonly name: string

  /** 持续时间（秒） */
  readonly duration: number

  /** 帧率（如30fps） */
  readonly frameRate: number

  /** 总帧数 */
  readonly frameCount: number

  /** 是否循环 */
  readonly loop: boolean

  /** 骨骼动画轨道，key是骨骼名称 */
  readonly boneTracks: Map<string, BoneAnimationTrack>

  /** 可见性动画轨道，key是网格名称 */
  readonly visibilityTracks: Map<string, VisibilityAnimationTrack>

  /**
   * 创建 AnimationClip 实例
   * 
   * @param data - 动画数据
   */
  constructor(data: IAnimationData) {
    this.name = data.name
    this.duration = data.duration
    this.frameRate = data.frameRate
    this.frameCount = data.frameCount
    this.loop = data.loop

    // 构建轨道映射
    this.boneTracks = new Map()
    this.visibilityTracks = new Map()

    for (const track of data.tracks) {
      if (track.type === 'bone') {
        const boneTrack = BoneAnimationTrack.fromData(track as BoneTrackData)
        this.boneTracks.set(track.targetName, boneTrack)
      } else if (track.type === 'visibility') {
        const visibilityTrack = VisibilityAnimationTrack.fromData(track as VisibilityTrackData)
        this.visibilityTracks.set(track.targetName, visibilityTrack)
      }
    }
  }

  /**
   * 获取指定骨骼在指定帧的变换
   * 
   * @param boneName - 骨骼名称
   * @param frame - 帧索引
   * @returns 骨骼变换，如果骨骼不存在则返回 null
   */
  getBoneTransformAtFrame(boneName: string, frame: number): BoneTransform | null {
    const track = this.boneTracks.get(boneName)
    if (!track) return null
    return track.getTransformAtFrame(frame)
  }

  /**
   * 获取指定网格在指定帧的可见性
   * 
   * @param meshName - 网格名称
   * @param frame - 帧索引
   * @returns 可见性，如果网格不存在则返回 true（默认可见）
   */
  getVisibilityAtFrame(meshName: string, frame: number): boolean {
    const track = this.visibilityTracks.get(meshName)
    if (!track) return true
    return track.getVisibilityAtFrame(frame)
  }

  /**
   * 获取指定骨骼在指定时间的变换
   * 
   * @param boneName - 骨骼名称
   * @param time - 时间（秒）
   * @returns 骨骼变换，如果骨骼不存在则返回 null
   */
  getBoneTransformAtTime(boneName: string, time: number): BoneTransform | null {
    const track = this.boneTracks.get(boneName)
    if (!track) return null
    return track.getTransformAtTime(time, this.frameRate)
  }

  /**
   * 获取指定网格在指定时间的可见性
   * 
   * @param meshName - 网格名称
   * @param time - 时间（秒）
   * @returns 可见性，如果网格不存在则返回 true（默认可见）
   */
  getVisibilityAtTime(meshName: string, time: number): boolean {
    const track = this.visibilityTracks.get(meshName)
    if (!track) return true
    return track.getVisibilityAtTime(time, this.frameRate)
  }

  /**
   * 检查是否有骨骼动画轨道
   */
  hasBoneTracks(): boolean {
    return this.boneTracks.size > 0
  }

  /**
   * 检查是否有可见性动画轨道
   */
  hasVisibilityTracks(): boolean {
    return this.visibilityTracks.size > 0
  }

  /**
   * 获取所有骨骼名称
   */
  getBoneNames(): string[] {
    return Array.from(this.boneTracks.keys())
  }

  /**
   * 获取所有网格名称（可见性轨道）
   */
  getMeshNames(): string[] {
    return Array.from(this.visibilityTracks.keys())
  }

  // ==================== 静态工厂方法 ====================

  /**
   * 从 TRANM FlatBuffers 数据创建 AnimationClip（骨骼动画）
   * 
   * @param tranm - TRANM FlatBuffers 对象
   * @param name - 动画名称（可选，默认为 'bone_animation'）
   * @returns AnimationClip 实例
   */
  static fromTRANM(tranm: TRANM, name: string = 'bone_animation'): AnimationClip {
    const info = tranm.info()
    if (!info) {
      throw new Error('TRANM data has no animation info')
    }

    const frameCount = info.animationCount()
    const frameRate = info.animationRate()
    const duration = frameCount / frameRate
    const loop = info.doesLoop() !== 0

    const tracks: BoneTrackData[] = []

    const boneAnimation = tranm.track()
    if (boneAnimation) {
      const tracksLength = boneAnimation.tracksLength()
      for (let i = 0; i < tracksLength; i++) {
        const boneTrack = boneAnimation.tracks(i)
        if (!boneTrack) continue

        const boneName = boneTrack.boneName()
        if (!boneName) continue

        // 解析位置轨道
        const positionTrack = AnimationClip.parseVectorTrack(
          boneTrack.translateType(),
          (obj) => boneTrack.translate(obj)
        )

        // 解析旋转轨道（需要解包48位四元数）
        const rotationTrack = AnimationClip.parseRotationTrack(
          boneTrack.rotateType(),
          (obj) => boneTrack.rotate(obj)
        )

        // 解析缩放轨道
        const scaleTrack = AnimationClip.parseVectorTrack(
          boneTrack.scaleType(),
          (obj) => boneTrack.scale(obj)
        )

        tracks.push({
          type: 'bone',
          targetName: boneName,
          positionTrack,
          rotationTrack,
          scaleTrack,
        })
      }
    }

    return new AnimationClip({
      name,
      duration,
      frameRate,
      frameCount,
      loop,
      tracks,
    })
  }

  /**
   * 从 TRACM FlatBuffers 数据创建 AnimationClip（可见性动画）
   * 
   * @param tracm - TRACM FlatBuffers 对象
   * @param name - 动画名称（可选，默认为 'visibility_animation'）
   * @returns AnimationClip 实例
   */
  static fromTRACM(tracm: TRACM, name: string = 'visibility_animation'): AnimationClip {
    const config = tracm.config()
    if (!config) {
      throw new Error('TRACM data has no config')
    }

    const frameDuration = config.duration()
    const frameRate = config.framerate() || 60
    const frameCount = frameDuration
    const duration = frameDuration / frameRate
    const loop = true // TRACM 默认循环

    const tracks: VisibilityTrackData[] = []

    const tracksLength = tracm.tracksLength()
    for (let i = 0; i < tracksLength; i++) {
      const track = tracm.tracks(i)
      if (!track) continue

      const visibilityAnimation = track.visibilityAnimation()
      if (!visibilityAnimation) continue

      const trackPath = track.trackPath() || ''
      if (!trackPath) continue

      // 解析可见性轨道
      const visibilityTrack = AnimationClip.parseVisibilityTrack(visibilityAnimation)
      if (visibilityTrack) {
        tracks.push({
          type: 'visibility',
          targetName: trackPath,
          visibilityTrack,
        })
      }
    }

    return new AnimationClip({
      name,
      duration,
      frameRate,
      frameCount,
      loop,
      tracks,
    })
  }

  /**
   * 合并骨骼动画和可见性动画
   * 
   * 将两个 AnimationClip 合并为一个，骨骼轨道来自 boneClip，
   * 可见性轨道来自 visibilityClip。
   * 
   * @param boneClip - 骨骼动画片段
   * @param visibilityClip - 可见性动画片段
   * @param name - 合并后的动画名称（可选）
   * @returns 合并后的 AnimationClip 实例
   */
  static merge(
    boneClip: AnimationClip,
    visibilityClip: AnimationClip,
    name?: string
  ): AnimationClip {
    // 使用骨骼动画的时间参数作为主参数
    const mergedName = name || `${boneClip.name}_merged`
    const duration = Math.max(boneClip.duration, visibilityClip.duration)
    const frameRate = boneClip.frameRate
    const frameCount = Math.max(boneClip.frameCount, visibilityClip.frameCount)
    const loop = boneClip.loop || visibilityClip.loop

    // 创建新的 AnimationClip
    const mergedClip = new AnimationClip({
      name: mergedName,
      duration,
      frameRate,
      frameCount,
      loop,
      tracks: [],
    })

    // 复制骨骼轨道
    for (const [boneName, track] of boneClip.boneTracks) {
      mergedClip.boneTracks.set(boneName, track)
    }

    // 复制可见性轨道
    for (const [meshName, track] of visibilityClip.visibilityTracks) {
      mergedClip.visibilityTracks.set(meshName, track)
    }

    return mergedClip
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 解析向量轨道（位置、缩放）
   */
  private static parseVectorTrack(
    trackType: VectorTrackEnum,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FlatBuffers union accessor 需要 any 类型
    accessor: (obj: any) => any
  ): VectorTrackData | null {
    const track = unionToVectorTrack(trackType, accessor)
    if (!track) return null

    switch (trackType) {
      case VectorTrackEnum.FixedVectorTrack: {
        const fixedTrack = track as FBFixedVectorTrack
        const vec = fixedTrack.co()
        if (!vec) return null
        return {
          type: 'fixed',
          values: new Float32Array([vec.x(), vec.y(), vec.z()]),
        }
      }

      case VectorTrackEnum.DynamicVectorTrack: {
        const dynamicTrack = track as FBDynamicVectorTrack
        const length = dynamicTrack.coLength()
        const values = new Float32Array(length * 3)
        for (let i = 0; i < length; i++) {
          const vec = dynamicTrack.co(i)
          if (vec) {
            values[i * 3] = vec.x()
            values[i * 3 + 1] = vec.y()
            values[i * 3 + 2] = vec.z()
          }
        }
        return {
          type: 'dynamic',
          values,
        }
      }

      case VectorTrackEnum.Framed16VectorTrack: {
        const framedTrack = track as FBFramed16VectorTrack
        const framesLength = framedTrack.framesLength()
        const valuesLength = framedTrack.coLength()
        
        const frames = new Uint16Array(framesLength)
        for (let i = 0; i < framesLength; i++) {
          frames[i] = framedTrack.frames(i) ?? 0
        }
        
        const values = new Float32Array(valuesLength * 3)
        for (let i = 0; i < valuesLength; i++) {
          const vec = framedTrack.co(i)
          if (vec) {
            values[i * 3] = vec.x()
            values[i * 3 + 1] = vec.y()
            values[i * 3 + 2] = vec.z()
          }
        }
        
        return {
          type: 'framed16',
          values,
          frames,
        }
      }

      case VectorTrackEnum.Framed8VectorTrack: {
        const framedTrack = track as FBFramed8VectorTrack
        const framesLength = framedTrack.framesLength()
        const valuesLength = framedTrack.coLength()
        
        const frames = new Uint8Array(framesLength)
        for (let i = 0; i < framesLength; i++) {
          frames[i] = framedTrack.frames(i) ?? 0
        }
        
        const values = new Float32Array(valuesLength * 3)
        for (let i = 0; i < valuesLength; i++) {
          const vec = framedTrack.co(i)
          if (vec) {
            values[i * 3] = vec.x()
            values[i * 3 + 1] = vec.y()
            values[i * 3 + 2] = vec.z()
          }
        }
        
        return {
          type: 'framed8',
          values,
          frames,
        }
      }

      default:
        return null
    }
  }

  /**
   * 解析旋转轨道（需要解包48位四元数）
   */
  private static parseRotationTrack(
    trackType: RotationTrackEnum,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FlatBuffers union accessor 需要 any 类型
    accessor: (obj: any) => any
  ): RotationTrackData | null {
    const track = unionToRotationTrack(trackType, accessor)
    if (!track) return null

    switch (trackType) {
      case RotationTrackEnum.FixedRotationTrack: {
        const fixedTrack = track as FBFixedRotationTrack
        const vec = fixedTrack.co()
        if (!vec) return null
        // 解包48位四元数
        const q = QuaternionUnpacker.unpack(vec.x(), vec.y(), vec.z())
        return {
          type: 'fixed',
          values: new Float32Array([q.x, q.y, q.z, q.w]),
        }
      }

      case RotationTrackEnum.DynamicRotationTrack: {
        const dynamicTrack = track as FBDynamicRotationTrack
        const length = dynamicTrack.coLength()
        const values = new Float32Array(length * 4)
        for (let i = 0; i < length; i++) {
          const vec = dynamicTrack.co(i)
          if (vec) {
            // 解包48位四元数
            const q = QuaternionUnpacker.unpack(vec.x(), vec.y(), vec.z())
            values[i * 4] = q.x
            values[i * 4 + 1] = q.y
            values[i * 4 + 2] = q.z
            values[i * 4 + 3] = q.w
          }
        }
        return {
          type: 'dynamic',
          values,
        }
      }

      case RotationTrackEnum.Framed16RotationTrack: {
        const framedTrack = track as FBFramed16RotationTrack
        const framesLength = framedTrack.framesLength()
        const valuesLength = framedTrack.coLength()
        
        const frames = new Uint16Array(framesLength)
        for (let i = 0; i < framesLength; i++) {
          frames[i] = framedTrack.frames(i) ?? 0
        }
        
        const values = new Float32Array(valuesLength * 4)
        for (let i = 0; i < valuesLength; i++) {
          const vec = framedTrack.co(i)
          if (vec) {
            // 解包48位四元数
            const q = QuaternionUnpacker.unpack(vec.x(), vec.y(), vec.z())
            values[i * 4] = q.x
            values[i * 4 + 1] = q.y
            values[i * 4 + 2] = q.z
            values[i * 4 + 3] = q.w
          }
        }
        
        return {
          type: 'framed16',
          values,
          frames,
        }
      }

      case RotationTrackEnum.Framed8RotationTrack: {
        const framedTrack = track as FBFramed8RotationTrack
        const framesLength = framedTrack.framesLength()
        const valuesLength = framedTrack.coLength()
        
        const frames = new Uint8Array(framesLength)
        for (let i = 0; i < framesLength; i++) {
          frames[i] = framedTrack.frames(i) ?? 0
        }
        
        const values = new Float32Array(valuesLength * 4)
        for (let i = 0; i < valuesLength; i++) {
          const vec = framedTrack.co(i)
          if (vec) {
            // 解包48位四元数
            const q = QuaternionUnpacker.unpack(vec.x(), vec.y(), vec.z())
            values[i * 4] = q.x
            values[i * 4 + 1] = q.y
            values[i * 4 + 2] = q.z
            values[i * 4 + 3] = q.w
          }
        }
        
        return {
          type: 'framed8',
          values,
          frames,
        }
      }

      default:
        return null
    }
  }

  /**
   * 解析可见性轨道
   */
  private static parseVisibilityTrack(
    timeline: VisibilityShapeTimeline
  ): BoolTrackData | null {
    const info = timeline.info()
    if (!info) return null

    const flagType = info.valuesType()
    const flagValue = unionToTrackFlag(flagType, (obj) => info.values(obj))

    switch (flagType) {
      case TrackFlag.FixedBoolTrack: {
        const fixedTrack = flagValue as FBFixedBoolTrack
        if (!fixedTrack) return null
        return {
          type: 'fixed',
          values: new Uint8Array([fixedTrack.value() ? 1 : 0]),
        }
      }

      case TrackFlag.DynamicBoolTrack: {
        const dynamicTrack = flagValue as FBDynamicBoolTrack
        if (!dynamicTrack) return null
        const length = dynamicTrack.valueLength()
        const values = new Uint8Array(length)
        for (let i = 0; i < length; i++) {
          values[i] = dynamicTrack.value(i) ? 1 : 0
        }
        return {
          type: 'dynamic',
          values,
        }
      }

      case TrackFlag.Framed16BoolTrack: {
        const framedTrack = flagValue as FBFramed16BoolTrack
        if (!framedTrack) return null
        const framesLength = framedTrack.framesLength()
        const valuesLength = framedTrack.valueLength()
        
        const frames = new Uint16Array(framesLength)
        for (let i = 0; i < framesLength; i++) {
          frames[i] = framedTrack.frames(i) ?? 0
        }
        
        const values = new Uint8Array(valuesLength)
        for (let i = 0; i < valuesLength; i++) {
          values[i] = framedTrack.value(i) ? 1 : 0
        }
        
        return {
          type: 'framed16',
          values,
          frames,
        }
      }

      case TrackFlag.Framed8BoolTrack: {
        const framedTrack = flagValue as FBFramed8BoolTrack
        if (!framedTrack) return null
        const framesLength = framedTrack.framesLength()
        const valuesLength = framedTrack.valueLength()
        
        const frames = new Uint8Array(framesLength)
        for (let i = 0; i < framesLength; i++) {
          frames[i] = framedTrack.frames(i) ?? 0
        }
        
        const values = new Uint8Array(valuesLength)
        for (let i = 0; i < valuesLength; i++) {
          values[i] = framedTrack.value(i) ? 1 : 0
        }
        
        return {
          type: 'framed8',
          values,
          frames,
        }
      }

      default:
        return null
    }
  }
}