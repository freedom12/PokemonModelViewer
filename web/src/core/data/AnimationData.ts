/**
 * AnimationData 类
 * 
 * 存储动画轨道数据的纯数据类。
 * 实现 IAnimationData 接口，提供动画数据的存储和查询功能。
 * 
 * @module core/data/AnimationData
 */

import {
  IAnimationData,
  AnimationTrackData,
  BoneTrackData,
  VisibilityTrackData,
  MaterialTrackData
} from './types'

/**
 * AnimationData 类实现
 * 
 * 用于存储解析后的动画轨道数据，包括骨骼动画轨道和可见性动画轨道。
 * 这是一个纯数据类，不包含播放状态或 Three.js 运行时对象。
 * 
 * @implements {IAnimationData}
 * 
 * @example
 * ```typescript
 * const animationData = new AnimationData(
 *   'idle',
 *   2.0,      // duration in seconds
 *   30,       // frameRate
 *   60,       // frameCount
 *   true,     // loop
 *   tracks    // animation tracks
 * );
 * 
 * // 获取骨骼轨道
 * const boneTrack = animationData.getBoneTrackByName('spine');
 * 
 * // 获取可见性轨道
 * const visibilityTrack = animationData.getVisibilityTrackByName('mesh_01');
 * ```
 */
export class AnimationData implements IAnimationData {
  /**
   * 动画名称
   */
  readonly name: string

  /**
   * 动画持续时间（秒）
   */
  readonly duration: number

  /**
   * 帧率（每秒帧数）
   */
  readonly frameRate: number

  /**
   * 总帧数
   */
  readonly frameCount: number

  /**
   * 是否循环播放
   */
  readonly loop: boolean

  /**
   * 所有动画轨道
   */
  readonly tracks: AnimationTrackData[]

  /**
   * 骨骼轨道名称映射，用于快速查找
   */
  private readonly boneTrackMap: Map<string, BoneTrackData>

  /**
   * 可见性轨道名称映射，用于快速查找
   */
  private readonly visibilityTrackMap: Map<string, VisibilityTrackData>

  /**
   * 材质轨道名称映射，用于快速查找（预留扩展）
   */
  private readonly materialTrackMap: Map<string, MaterialTrackData>

  /**
   * 创建 AnimationData 实例
   * 
   * @param name - 动画名称
   * @param duration - 动画持续时间（秒）
   * @param frameRate - 帧率（每秒帧数）
   * @param frameCount - 总帧数
   * @param loop - 是否循环播放
   * @param tracks - 动画轨道数组
   */
  constructor(
    name: string,
    duration: number,
    frameRate: number,
    frameCount: number,
    loop: boolean,
    tracks: AnimationTrackData[]
  ) {
    this.name = name
    this.duration = duration
    this.frameRate = frameRate
    this.frameCount = frameCount
    this.loop = loop
    this.tracks = tracks

    // 构建轨道映射以支持快速查找
    this.boneTrackMap = new Map()
    this.visibilityTrackMap = new Map()
    this.materialTrackMap = new Map()

    for (const track of tracks) {
      switch (track.type) {
        case 'bone':
          this.boneTrackMap.set(track.targetName, track as BoneTrackData)
          break
        case 'visibility':
          this.visibilityTrackMap.set(track.targetName, track as VisibilityTrackData)
          break
        case 'material':
          this.materialTrackMap.set(track.targetName, track as MaterialTrackData)
          break
      }
    }
  }

  /**
   * 获取骨骼轨道数量
   */
  get boneTrackCount(): number {
    return this.boneTrackMap.size
  }

  /**
   * 获取可见性轨道数量
   */
  get visibilityTrackCount(): number {
    return this.visibilityTrackMap.size
  }

  /**
   * 获取材质轨道数量
   */
  get materialTrackCount(): number {
    return this.materialTrackMap.size
  }

  /**
   * 获取所有骨骼轨道
   * 
   * @returns 骨骼轨道数组
   */
  getBoneTracks(): BoneTrackData[] {
    return Array.from(this.boneTrackMap.values())
  }

  /**
   * 获取所有可见性轨道
   * 
   * @returns 可见性轨道数组
   */
  getVisibilityTracks(): VisibilityTrackData[] {
    return Array.from(this.visibilityTrackMap.values())
  }

  /**
   * 获取所有材质轨道
   * 
   * @returns 材质轨道数组
   */
  getMaterialTracks(): MaterialTrackData[] {
    return Array.from(this.materialTrackMap.values())
  }

  /**
   * 根据名称获取骨骼轨道
   * 
   * @param targetName - 目标骨骼名称
   * @returns 找到的骨骼轨道，如果不存在则返回 null
   */
  getBoneTrackByName(targetName: string): BoneTrackData | null {
    return this.boneTrackMap.get(targetName) ?? null
  }

  /**
   * 根据名称获取可见性轨道
   * 
   * @param targetName - 目标网格名称
   * @returns 找到的可见性轨道，如果不存在则返回 null
   */
  getVisibilityTrackByName(targetName: string): VisibilityTrackData | null {
    return this.visibilityTrackMap.get(targetName) ?? null
  }

  /**
   * 根据名称获取材质轨道
   * 
   * @param targetName - 目标材质名称
   * @returns 找到的材质轨道，如果不存在则返回 null
   */
  getMaterialTrackByName(targetName: string): MaterialTrackData | null {
    return this.materialTrackMap.get(targetName) ?? null
  }

  /**
   * 检查是否包含指定骨骼的轨道
   * 
   * @param targetName - 目标骨骼名称
   * @returns 是否包含该骨骼的轨道
   */
  hasBoneTrack(targetName: string): boolean {
    return this.boneTrackMap.has(targetName)
  }

  /**
   * 检查是否包含指定网格的可见性轨道
   * 
   * @param targetName - 目标网格名称
   * @returns 是否包含该网格的可见性轨道
   */
  hasVisibilityTrack(targetName: string): boolean {
    return this.visibilityTrackMap.has(targetName)
  }

  /**
   * 检查是否包含指定材质的轨道
   * 
   * @param targetName - 目标材质名称
   * @returns 是否包含该材质的轨道
   */
  hasMaterialTrack(targetName: string): boolean {
    return this.materialTrackMap.has(targetName)
  }

  /**
   * 获取所有骨骼轨道的目标名称
   * 
   * @returns 骨骼名称数组
   */
  getBoneTrackNames(): string[] {
    return Array.from(this.boneTrackMap.keys())
  }

  /**
   * 获取所有可见性轨道的目标名称
   * 
   * @returns 网格名称数组
   */
  getVisibilityTrackNames(): string[] {
    return Array.from(this.visibilityTrackMap.keys())
  }

  /**
   * 获取所有材质轨道的目标名称
   * 
   * @returns 材质名称数组
   */
  getMaterialTrackNames(): string[] {
    return Array.from(this.materialTrackMap.keys())
  }

  /**
   * 将时间转换为帧索引
   * 
   * @param time - 时间（秒）
   * @returns 帧索引（整数）
   */
  timeToFrame(time: number): number {
    const frame = Math.floor(time * this.frameRate)
    return Math.max(0, Math.min(frame, this.frameCount - 1))
  }

  /**
   * 将帧索引转换为时间
   * 
   * @param frame - 帧索引
   * @returns 时间（秒）
   */
  frameToTime(frame: number): number {
    return frame / this.frameRate
  }

  /**
   * 验证 AnimationData 的完整性
   * 
   * @returns 验证结果，包含是否有效和错误信息
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // 检查基本属性
    if (!this.name || this.name.trim() === '') {
      errors.push('Animation name is required')
    }

    if (this.duration <= 0) {
      errors.push('Duration must be greater than 0')
    }

    if (this.frameRate <= 0) {
      errors.push('Frame rate must be greater than 0')
    }

    if (this.frameCount <= 0) {
      errors.push('Frame count must be greater than 0')
    }

    // 检查帧数与持续时间的一致性
    const expectedFrameCount = Math.ceil(this.duration * this.frameRate)
    if (Math.abs(this.frameCount - expectedFrameCount) > 1) {
      errors.push(
        `Frame count (${this.frameCount}) does not match duration (${this.duration}s) ` +
        `and frame rate (${this.frameRate}fps), expected approximately ${expectedFrameCount} frames`
      )
    }

    // 检查轨道数据
    for (const track of this.tracks) {
      if (!track.targetName || track.targetName.trim() === '') {
        errors.push('Track has empty target name')
      }

      if (!['bone', 'visibility', 'material'].includes(track.type)) {
        errors.push(`Invalid track type: ${track.type}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 克隆 AnimationData 实例
   * 
   * @returns 新的 AnimationData 实例
   */
  clone(): AnimationData {
    // 深拷贝轨道数据
    const clonedTracks = this.tracks.map(track => this.cloneTrack(track))

    return new AnimationData(
      this.name,
      this.duration,
      this.frameRate,
      this.frameCount,
      this.loop,
      clonedTracks
    )
  }

  /**
   * 克隆单个轨道数据
   * 
   * @param track - 要克隆的轨道
   * @returns 克隆后的轨道
   */
  private cloneTrack(track: AnimationTrackData): AnimationTrackData {
    switch (track.type) {
      case 'bone':
        return this.cloneBoneTrack(track as BoneTrackData)
      case 'visibility':
        return this.cloneVisibilityTrack(track as VisibilityTrackData)
      case 'material':
        return this.cloneMaterialTrack(track as MaterialTrackData)
      default:
        return { ...track }
    }
  }

  /**
   * 克隆骨骼轨道数据
   */
  private cloneBoneTrack(track: BoneTrackData): BoneTrackData {
    return {
      type: 'bone',
      targetName: track.targetName,
      positionTrack: track.positionTrack ? {
        type: track.positionTrack.type,
        values: new Float32Array(track.positionTrack.values),
        frames: track.positionTrack.frames 
          ? (track.positionTrack.frames instanceof Uint16Array 
              ? new Uint16Array(track.positionTrack.frames)
              : new Uint8Array(track.positionTrack.frames))
          : undefined
      } : null,
      rotationTrack: track.rotationTrack ? {
        type: track.rotationTrack.type,
        values: new Float32Array(track.rotationTrack.values),
        frames: track.rotationTrack.frames
          ? (track.rotationTrack.frames instanceof Uint16Array
              ? new Uint16Array(track.rotationTrack.frames)
              : new Uint8Array(track.rotationTrack.frames))
          : undefined
      } : null,
      scaleTrack: track.scaleTrack ? {
        type: track.scaleTrack.type,
        values: new Float32Array(track.scaleTrack.values),
        frames: track.scaleTrack.frames
          ? (track.scaleTrack.frames instanceof Uint16Array
              ? new Uint16Array(track.scaleTrack.frames)
              : new Uint8Array(track.scaleTrack.frames))
          : undefined
      } : null
    }
  }

  /**
   * 克隆可见性轨道数据
   */
  private cloneVisibilityTrack(track: VisibilityTrackData): VisibilityTrackData {
    return {
      type: 'visibility',
      targetName: track.targetName,
      visibilityTrack: {
        type: track.visibilityTrack.type,
        values: new Uint8Array(track.visibilityTrack.values),
        frames: track.visibilityTrack.frames
          ? (track.visibilityTrack.frames instanceof Uint16Array
              ? new Uint16Array(track.visibilityTrack.frames)
              : new Uint8Array(track.visibilityTrack.frames))
          : undefined
      }
    }
  }

  /**
   * 克隆材质轨道数据
   */
  private cloneMaterialTrack(track: MaterialTrackData): MaterialTrackData {
    return {
      type: 'material',
      targetName: track.targetName,
      propertyName: track.propertyName,
      valueTrack: {
        type: track.valueTrack.type,
        values: new Float32Array(track.valueTrack.values),
        frames: track.valueTrack.frames
          ? (track.valueTrack.frames instanceof Uint16Array
              ? new Uint16Array(track.valueTrack.frames)
              : new Uint8Array(track.valueTrack.frames))
          : undefined
      }
    }
  }

  /**
   * 从轨道数组创建 AnimationData 实例
   * 
   * @param name - 动画名称
   * @param frameRate - 帧率
   * @param frameCount - 总帧数
   * @param loop - 是否循环
   * @param tracks - 动画轨道数组
   * @returns AnimationData 实例
   */
  static fromTracks(
    name: string,
    frameRate: number,
    frameCount: number,
    loop: boolean,
    tracks: AnimationTrackData[]
  ): AnimationData {
    const duration = frameCount / frameRate
    return new AnimationData(name, duration, frameRate, frameCount, loop, tracks)
  }

  /**
   * 合并两个 AnimationData（例如骨骼动画和可见性动画）
   * 
   * 注意：两个动画的帧率和帧数应该相同或兼容
   * 
   * @param anim1 - 第一个动画数据
   * @param anim2 - 第二个动画数据
   * @param name - 合并后的动画名称（可选，默认使用第一个动画的名称）
   * @returns 合并后的 AnimationData 实例
   */
  static merge(
    anim1: AnimationData,
    anim2: AnimationData,
    name?: string
  ): AnimationData {
    // 使用较长的持续时间
    const duration = Math.max(anim1.duration, anim2.duration)
    const frameRate = anim1.frameRate // 假设帧率相同
    const frameCount = Math.max(anim1.frameCount, anim2.frameCount)
    const loop = anim1.loop || anim2.loop

    // 合并轨道
    const tracks: AnimationTrackData[] = [
      ...anim1.tracks,
      ...anim2.tracks
    ]

    return new AnimationData(
      name ?? anim1.name,
      duration,
      frameRate,
      frameCount,
      loop,
      tracks
    )
  }
}
