/**
 * AnimationMixer 模块
 * 
 * 动画混合器，负责管理动画播放状态和更新骨骼/可见性变换。
 * 它是动画系统的核心控制器，每帧调用 update() 方法来驱动动画。
 * 
 * @module core/animation/AnimationMixer
 */

import * as THREE from 'three'
import { AnimationClip } from './AnimationClip'
import { Skeleton } from '../skeleton'
import { AnimationState } from '../data/types'

/**
 * AnimationMixer 类
 * 
 * 动画混合器，负责：
 * - 管理动画播放状态（播放、暂停、停止）
 * - 每帧更新骨骼变换
 * - 每帧更新网格可见性
 * 
 * @验证需求: 3.6, 3.7, 3.8
 */
export class AnimationMixer {
  /** 当前动画片段 */
  private currentClip: AnimationClip | null = null

  /** 目标骨骼系统（用于骨骼动画） - 自定义 Skeleton 类 */
  private skeleton: Skeleton | null = null

  /** Three.js 骨骼对象（用于实际渲染） */
  private threeSkeleton: THREE.Skeleton | null = null

  /** 目标模型组（用于可见性动画） */
  private modelGroup: THREE.Group | null = null

  /** 当前播放时间（秒） */
  private currentTime: number = 0

  /** 当前帧索引 */
  private currentFrame: number = 0

  /** 是否正在播放 */
  private isPlaying: boolean = false

  /** 是否循环播放 */
  private loop: boolean = true

  /** 网格名称到 THREE.Object3D 的缓存映射 */
  private meshCache: Map<string, THREE.Object3D> = new Map()

  /** 骨骼名称到 THREE.Bone 的映射（用于快速查找） */
  private boneMap: Map<string, THREE.Bone> = new Map()

  /** 初始骨骼变换数据（用于恢复到 T-Pose） */
  private initialBoneTransforms: Map<string, { position: THREE.Vector3, quaternion: THREE.Quaternion, scale: THREE.Vector3 }> = new Map()

  /** 是否应用动画中的缩放变换 */
  private applyScale: boolean = true

  /**
   * 创建 AnimationMixer 实例
   */
  constructor() {
    // 初始化为默认状态
  }

  /**
   * 设置是否应用动画中的缩放变换
   * 
   * 当设置为 false 时，动画中的缩放变换将被忽略，
   * 骨骼将保持 (1, 1, 1) 的缩放值。
   * 
   * @param apply - 是否应用缩放
   */
  setApplyScale(apply: boolean): void {
    this.applyScale = apply
  }

  /**
   * 获取是否应用动画中的缩放变换
   * 
   * @returns 是否应用缩放
   */
  getApplyScale(): boolean {
    return this.applyScale
  }

  /**
   * 设置目标骨骼系统
   * 
   * 骨骼动画将应用到此骨骼系统上
   * 
   * @param skeleton - 目标骨骼系统
   */
  setSkeleton(skeleton: Skeleton): void {
    this.skeleton = skeleton
  }

  /**
   * 设置 Three.js 骨骼对象
   * 
   * 动画将直接更新此骨骼对象，用于实际渲染
   * 
   * @param threeSkeleton - Three.js Skeleton 对象，或 null 以清除绑定
   */
  setThreeSkeleton(threeSkeleton: THREE.Skeleton | null): void {
    this.threeSkeleton = threeSkeleton
    // 构建骨骼名称到 THREE.Bone 的映射
    this.buildBoneMap()
  }

  /**
   * 构建骨骼名称到 THREE.Bone 的映射
   * 同时保存初始骨骼变换，用于恢复到 T-Pose
   * 
   * @private
   */
  private buildBoneMap(): void {
    this.boneMap.clear()
    this.initialBoneTransforms.clear()
    if (!this.threeSkeleton) return

    for (const bone of this.threeSkeleton.bones) {
      if (bone.name) {
        this.boneMap.set(bone.name, bone)
        // 保存初始变换（克隆以避免引用问题）
        this.initialBoneTransforms.set(bone.name, {
          position: bone.position.clone(),
          quaternion: bone.quaternion.clone(),
          scale: bone.scale.clone()
        })
      }
    }
  }

  /**
   * 设置目标模型组
   * 
   * 可见性动画将应用到此模型组中的网格上
   * 
   * @param group - 目标模型组
   */
  setModelGroup(group: THREE.Group): void {
    this.modelGroup = group
    // 清除网格缓存，因为模型组已更改
    this.meshCache.clear()
  }

  /**
   * 加载动画片段
   * 
   * 加载新的动画片段并重置播放状态
   * 
   * @param clip - 要加载的动画片段
   */
  loadClip(clip: AnimationClip): void {
    this.currentClip = clip
    // 重置播放状态
    this.currentTime = 0
    this.currentFrame = 0
    this.isPlaying = false
    // 使用动画片段的循环设置
    this.loop = clip.loop
  }

  /**
   * 开始或继续播放动画
   * 
   * @验证需求: 3.6 - 播放控制
   */
  play(): void {
    if (!this.currentClip) return
    this.isPlaying = true
  }

  /**
   * 暂停动画播放
   * 
   * 保持当前播放时间，可以通过 play() 继续播放
   * 
   * @验证需求: 3.6 - 播放控制
   */
  pause(): void {
    this.isPlaying = false
  }

  /**
   * 停止动画播放
   * 
   * 重置播放时间到开始位置，并将骨骼恢复到初始姿势（T-Pose）
   * 
   * @验证需求: 3.6 - 播放控制
   */
  stop(): void {
    this.isPlaying = false
    this.currentTime = 0
    this.currentFrame = 0
    
    // 恢复骨骼到初始姿势（T-Pose）
    this.resetToInitialPose()
  }

  /**
   * 将骨骼恢复到初始姿势（T-Pose）
   * 
   * @private
   */
  private resetToInitialPose(): void {
    // 恢复 THREE.Skeleton 的骨骼变换
    if (this.threeSkeleton) {
      for (const bone of this.threeSkeleton.bones) {
        const initialTransform = this.initialBoneTransforms.get(bone.name)
        if (initialTransform) {
          bone.position.copy(initialTransform.position)
          bone.quaternion.copy(initialTransform.quaternion)
          bone.scale.copy(initialTransform.scale)
        }
      }
    }

    // 同时恢复自定义 Skeleton 的骨骼变换
    if (this.skeleton) {
      for (const bone of this.skeleton.bones) {
        const initialTransform = this.initialBoneTransforms.get(bone.name)
        if (initialTransform) {
          bone.setLocalTransform(
            initialTransform.position,
            initialTransform.quaternion,
            initialTransform.scale
          )
        }
      }
      // 更新世界矩阵
      this.skeleton.updateWorldMatrices()
    }

    // 恢复所有网格的可见性为 true
    this.resetMeshVisibility()
  }

  /**
   * 重置所有网格的可见性为 true
   * 
   * @private
   */
  private resetMeshVisibility(): void {
    if (!this.modelGroup) return

    this.modelGroup.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.visible = true
      }
    })
  }

  /**
   * 设置是否循环播放
   * 
   * @param loop - 是否循环
   */
  setLoop(loop: boolean): void {
    this.loop = loop
  }

  /**
   * 跳转到指定时间
   * 
   * @param time - 目标时间（秒）
   */
  setTime(time: number): void {
    if (!this.currentClip) return

    // 限制时间范围
    this.currentTime = Math.max(0, Math.min(time, this.currentClip.duration))
    
    // 更新当前帧
    this.currentFrame = Math.floor(this.currentTime * this.currentClip.frameRate)
    
    // 确保帧索引不超过最大帧数
    if (this.currentFrame >= this.currentClip.frameCount) {
      this.currentFrame = this.currentClip.frameCount - 1
    }
  }

  /**
   * 核心更新方法 - 每帧调用
   * 
   * 更新动画时间、计算当前帧、应用骨骼变换和网格可见性
   * 
   * @param deltaTime - 距离上一帧的时间间隔（秒）
   * 
   * @验证需求: 3.7 - 骨骼变换应用
   * @验证需求: 3.8 - 网格可见性应用
   */
  update(deltaTime: number): void {
    // 如果没有播放或没有动画片段，直接返回
    if (!this.isPlaying || !this.currentClip) return

    // 1. 更新时间
    this.currentTime += deltaTime

    // 2. 处理循环/结束
    if (this.currentTime >= this.currentClip.duration) {
      if (this.loop) {
        // 循环播放：重置到第1帧（不是第0帧，避免闪烁）
        const frameTime = 1 / this.currentClip.frameRate
        this.currentTime = frameTime
        this.currentFrame = 1
      } else {
        // 非循环：停止在最后一帧
        this.currentTime = this.currentClip.duration
        this.currentFrame = this.currentClip.frameCount - 1
        this.isPlaying = false
      }
    } else {
      // 3. 计算当前帧
      this.currentFrame = Math.floor(this.currentTime * this.currentClip.frameRate)
      
      // 确保帧索引不超过最大帧数
      if (this.currentFrame >= this.currentClip.frameCount) {
        this.currentFrame = this.currentClip.frameCount - 1
      }
    }

    // 4. 更新骨骼变换
    this.updateBoneTransforms()

    // 5. 更新网格可见性
    this.updateMeshVisibility()
  }

  /**
   * 更新骨骼变换
   * 
   * 遍历所有骨骼轨道，获取当前帧的变换并应用到骨骼上
   * 优先更新 THREE.Skeleton（用于实际渲染），同时也更新自定义 Skeleton
   * 
   * @验证需求: 3.7 - 骨骼变换应用
   */
  private updateBoneTransforms(): void {
    if (!this.currentClip) return

    // 优先更新 THREE.Skeleton（用于实际渲染）
    if (this.threeSkeleton) {
      for (const [boneName, track] of this.currentClip.boneTracks) {
        const threeBone = this.boneMap.get(boneName)
        if (threeBone) {
          // 获取当前帧的变换
          const transform = track.getTransformAtFrame(this.currentFrame)
          
          // 直接设置 THREE.Bone 的局部变换
          threeBone.position.set(
            transform.position.x,
            transform.position.y,
            transform.position.z
          )
          threeBone.quaternion.set(
            transform.rotation.x,
            transform.rotation.y,
            transform.rotation.z,
            transform.rotation.w
          )
          
          // 检查是否应用缩放（全局设置或单个骨骼设置）
          const customBone = this.skeleton?.getBoneByName(boneName)
          if (!this.applyScale || customBone?.isIgnoreScale) {
            // 忽略缩放，设置为 (1, 1, 1)
            threeBone.scale.set(1, 1, 1)
          } else {
            threeBone.scale.set(
              transform.scale.x,
              transform.scale.y,
              transform.scale.z
            )
          }
        }
      }
    }

    // 同时更新自定义 Skeleton（如果存在）
    if (this.skeleton) {
      for (const [boneName, track] of this.currentClip.boneTracks) {
        const bone = this.skeleton.getBoneByName(boneName)
        if (bone) {
          // 获取当前帧的变换
          const transform = track.getTransformAtFrame(this.currentFrame)
          
          // 应用变换到骨骼（isIgnoreScale 会在 updateWorldMatrix 中处理）
          bone.setLocalTransform(
            transform.position,
            transform.rotation,
            transform.scale
          )
        }
      }

      // 批量更新所有骨骼的世界矩阵
      this.skeleton.updateWorldMatrices()
    }
  }

  /**
   * 更新网格可见性
   * 
   * 遍历所有可见性轨道，获取当前帧的可见性并应用到网格上
   * 
   * @验证需求: 3.8 - 网格可见性应用
   */
  private updateMeshVisibility(): void {
    if (!this.modelGroup || !this.currentClip) return

    // 遍历所有可见性轨道
    for (const [meshName, track] of this.currentClip.visibilityTracks) {
      const mesh = this.findMeshByName(meshName)
      if (mesh) {
        // 获取当前帧的可见性并应用
        mesh.visible = track.getVisibilityAtFrame(this.currentFrame)
      }
    }
  }

  /**
   * 根据名称查找网格
   * 
   * 使用缓存优化查找性能
   * 
   * @param name - 网格名称
   * @returns 找到的网格对象，如果不存在则返回 null
   */
  private findMeshByName(name: string): THREE.Object3D | null {
    if (!this.modelGroup) return null

    // 先检查缓存
    if (this.meshCache.has(name)) {
      return this.meshCache.get(name) || null
    }

    // 在模型组中递归查找
    let foundMesh: THREE.Object3D | null = null
    
    this.modelGroup.traverse((object) => {
      if (object.name === name) {
        foundMesh = object
      }
    })

    // 缓存结果（即使是 null 也缓存，避免重复查找）
    if (foundMesh) {
      this.meshCache.set(name, foundMesh)
    }

    return foundMesh
  }

  /**
   * 获取当前动画状态
   * 
   * @returns 当前动画状态对象
   */
  getState(): AnimationState {
    return {
      currentTime: this.currentTime,
      duration: this.currentClip?.duration ?? 0,
      currentFrame: this.currentFrame,
      frameCount: this.currentClip?.frameCount ?? 0,
      isPlaying: this.isPlaying,
      loop: this.loop,
    }
  }

  /**
   * 获取当前加载的动画片段
   * 
   * @returns 当前动画片段，如果没有加载则返回 null
   */
  getCurrentClip(): AnimationClip | null {
    return this.currentClip
  }

  /**
   * 检查是否有动画正在播放
   * 
   * @returns 是否正在播放
   */
  getIsPlaying(): boolean {
    return this.isPlaying
  }

  /**
   * 获取当前播放时间
   * 
   * @returns 当前时间（秒）
   */
  getCurrentTime(): number {
    return this.currentTime
  }

  /**
   * 获取当前帧索引
   * 
   * @returns 当前帧索引
   */
  getCurrentFrame(): number {
    return this.currentFrame
  }

  /**
   * 释放资源
   * 
   * 清理所有引用和缓存
   */
  dispose(): void {
    this.currentClip = null
    this.skeleton = null
    this.threeSkeleton = null
    this.modelGroup = null
    this.meshCache.clear()
    this.boneMap.clear()
    this.initialBoneTransforms.clear()
    this.currentTime = 0
    this.currentFrame = 0
    this.isPlaying = false
  }
}
