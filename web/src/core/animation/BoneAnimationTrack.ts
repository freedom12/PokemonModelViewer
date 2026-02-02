/**
 * BoneAnimationTrack 模块
 * 
 * 骨骼动画轨道，整合位置、旋转、缩放三个子轨道。
 * 提供获取指定帧或时间点的完整骨骼变换的方法。
 * 
 * @module core/animation/BoneAnimationTrack
 */

import * as THREE from 'three'
import {
  AnimationTrack,
  VectorTrack,
  RotationTrack,
  createVectorTrack,
  createRotationTrack,
} from './AnimationTrack'
import { BoneTrackData, BoneTransform } from '../data/types'

/**
 * 默认骨骼变换
 * 位置为原点，无旋转，缩放为1
 */
const DEFAULT_TRANSFORM: Readonly<BoneTransform> = {
  position: new THREE.Vector3(0, 0, 0),
  rotation: new THREE.Quaternion(0, 0, 0, 1),
  scale: new THREE.Vector3(1, 1, 1),
}

/**
 * BoneAnimationTrack 类
 * 
 * 骨骼动画轨道，包含位置、旋转、缩放三个子轨道。
 * 每个子轨道可以是不同类型（固定值、动态数组、关键帧）。
 * 
 * @extends AnimationTrack<BoneTransform>
 * 
 * @example
 * ```typescript
 * // 从数据创建骨骼动画轨道
 * const track = BoneAnimationTrack.fromData(boneTrackData);
 * 
 * // 获取第10帧的变换
 * const transform = track.getTransformAtFrame(10);
 * 
 * // 获取0.5秒时的变换（30fps）
 * const transformAtTime = track.getTransformAtTime(0.5, 30);
 * ```
 */
export class BoneAnimationTrack extends AnimationTrack<BoneTransform> {
  /** 位置轨道 */
  readonly positionTrack: VectorTrack | null
  
  /** 旋转轨道（四元数） */
  readonly rotationTrack: RotationTrack | null
  
  /** 缩放轨道 */
  readonly scaleTrack: VectorTrack | null

  /**
   * 创建骨骼动画轨道
   * 
   * @param targetName - 目标骨骼名称
   * @param positionTrack - 位置轨道，可为 null
   * @param rotationTrack - 旋转轨道，可为 null
   * @param scaleTrack - 缩放轨道，可为 null
   */
  constructor(
    targetName: string,
    positionTrack: VectorTrack | null,
    rotationTrack: RotationTrack | null,
    scaleTrack: VectorTrack | null
  ) {
    super(targetName)
    this.positionTrack = positionTrack
    this.rotationTrack = rotationTrack
    this.scaleTrack = scaleTrack
  }

  /**
   * 获取指定帧的完整变换
   * 
   * 对于没有轨道的属性，返回默认值：
   * - 位置: (0, 0, 0)
   * - 旋转: 单位四元数 (0, 0, 0, 1)
   * - 缩放: (1, 1, 1)
   * 
   * @param frame - 帧索引
   * @returns 该帧的骨骼变换
   */
  getValueAtFrame(frame: number): BoneTransform {
    return this.getTransformAtFrame(frame)
  }

  /**
   * 获取指定时间的完整变换
   * 
   * 会进行帧间插值以获得平滑的动画效果。
   * 
   * @param time - 时间（秒）
   * @param frameRate - 帧率（如 30）
   * @returns 该时间点的骨骼变换
   */
  getValueAtTime(time: number, frameRate: number): BoneTransform {
    return this.getTransformAtTime(time, frameRate)
  }

  /**
   * 获取指定帧的完整变换
   * 
   * @param frame - 帧索引（整数或小数）
   * @returns 该帧的骨骼变换
   */
  getTransformAtFrame(frame: number): BoneTransform {
    // 获取位置
    const position = this.positionTrack
      ? this.positionTrack.getInterpolatedValue(frame)
      : DEFAULT_TRANSFORM.position.clone()

    // 获取旋转
    const rotation = this.rotationTrack
      ? this.rotationTrack.getInterpolatedValue(frame)
      : DEFAULT_TRANSFORM.rotation.clone()

    // 获取缩放
    const scale = this.scaleTrack
      ? this.scaleTrack.getInterpolatedValue(frame)
      : DEFAULT_TRANSFORM.scale.clone()

    return { position, rotation, scale }
  }

  /**
   * 获取指定时间的完整变换（会进行帧间插值）
   * 
   * @param time - 时间（秒）
   * @param frameRate - 帧率
   * @returns 该时间点的骨骼变换
   */
  getTransformAtTime(time: number, frameRate: number): BoneTransform {
    // 将时间转换为帧（可能是小数）
    const frame = time * frameRate
    return this.getTransformAtFrame(frame)
  }

  /**
   * 检查是否有任何轨道数据
   * 
   * @returns 如果至少有一个轨道，返回 true
   */
  hasAnyTrack(): boolean {
    return this.positionTrack !== null || 
           this.rotationTrack !== null || 
           this.scaleTrack !== null
  }

  /**
   * 检查是否有位置轨道
   */
  hasPositionTrack(): boolean {
    return this.positionTrack !== null
  }

  /**
   * 检查是否有旋转轨道
   */
  hasRotationTrack(): boolean {
    return this.rotationTrack !== null
  }

  /**
   * 检查是否有缩放轨道
   */
  hasScaleTrack(): boolean {
    return this.scaleTrack !== null
  }

  /**
   * 从 BoneTrackData 创建 BoneAnimationTrack
   * 
   * @param data - 骨骼轨道数据
   * @returns BoneAnimationTrack 实例
   */
  static fromData(data: BoneTrackData): BoneAnimationTrack {
    const positionTrack = createVectorTrack(data.positionTrack)
    const rotationTrack = createRotationTrack(data.rotationTrack)
    const scaleTrack = createVectorTrack(data.scaleTrack)

    return new BoneAnimationTrack(
      data.targetName,
      positionTrack,
      rotationTrack,
      scaleTrack
    )
  }
}
