/**
 * SkeletonData 类
 * 
 * 存储骨骼层次结构和绑定姿势的纯数据类。
 * 实现 ISkeletonData 接口，提供骨骼数据的存储和查询功能。
 */

import * as THREE from 'three'
import { ISkeletonData, BoneData } from './types'

/**
 * 骨骼数据类
 * 
 * 用于存储骨骼层次结构数据，提供按名称和索引查找骨骼的方法。
 * 这是一个纯数据类，不包含 Three.js 运行时对象。
 */
export class SkeletonData implements ISkeletonData {
  /**
   * 骨骼数据数组
   */
  readonly bones: BoneData[]

  /**
   * 骨骼名称到骨骼数据的映射，用于快速按名称查找
   */
  private readonly boneNameMap: Map<string, BoneData>

  /**
   * 创建 SkeletonData 实例
   * 
   * @param bones - 骨骼数据数组
   */
  constructor(bones: BoneData[]) {
    this.bones = bones
    
    // 构建名称映射以支持快速查找
    this.boneNameMap = new Map()
    for (const bone of bones) {
      this.boneNameMap.set(bone.name, bone)
    }
  }

  /**
   * 获取骨骼数量
   */
  get boneCount(): number {
    return this.bones.length
  }

  /**
   * 根据名称查找骨骼数据
   * 
   * @param name - 骨骼名称
   * @returns 找到的骨骼数据，如果不存在则返回 null
   */
  getBoneByName(name: string): BoneData | null {
    return this.boneNameMap.get(name) ?? null
  }

  /**
   * 根据索引查找骨骼数据
   * 
   * @param index - 骨骼索引
   * @returns 找到的骨骼数据，如果索引越界则返回 null
   */
  getBoneByIndex(index: number): BoneData | null {
    if (index < 0 || index >= this.bones.length) {
      return null
    }
    return this.bones[index]
  }

  /**
   * 将 SkeletonData 转换为 Three.js Skeleton 对象
   * 
   * 创建 Three.js 骨骼层次结构，包括：
   * 1. 创建所有 THREE.Bone 对象
   * 2. 设置每个骨骼的局部变换
   * 3. 建立父子关系
   * 4. 计算逆绑定矩阵
   * 
   * @returns Three.js Skeleton 对象
   */
  toThreeSkeleton(): THREE.Skeleton {
    // 创建所有 THREE.Bone 对象
    const threeBones: THREE.Bone[] = []
    
    for (const boneData of this.bones) {
      const bone = new THREE.Bone()
      bone.name = boneData.name
      
      // 设置局部变换
      bone.position.copy(boneData.localPosition)
      bone.rotation.copy(boneData.localRotation)
      bone.scale.copy(boneData.localScale)
      
      threeBones.push(bone)
    }

    // 建立父子关系
    for (let i = 0; i < this.bones.length; i++) {
      const boneData = this.bones[i]
      const bone = threeBones[i]
      
      if (boneData.parentIndex >= 0 && boneData.parentIndex < threeBones.length) {
        const parentBone = threeBones[boneData.parentIndex]
        parentBone.add(bone)
      }
    }

    // 更新所有骨骼的世界矩阵
    // 首先找到根骨骼并更新它们的矩阵
    for (let i = 0; i < this.bones.length; i++) {
      const boneData = this.bones[i]
      if (boneData.parentIndex < 0) {
        // 这是根骨骼，更新其矩阵世界
        threeBones[i].updateMatrixWorld(true)
      }
    }

    // 计算逆绑定矩阵
    const boneInverses: THREE.Matrix4[] = []
    for (const bone of threeBones) {
      const inverseMatrix = new THREE.Matrix4()
      inverseMatrix.copy(bone.matrixWorld).invert()
      boneInverses.push(inverseMatrix)
    }

    // 创建 Skeleton
    const skeleton = new THREE.Skeleton(threeBones, boneInverses)
    
    return skeleton
  }

  /**
   * 从骨骼数据数组创建 SkeletonData 实例
   * 
   * @param bonesData - 骨骼数据数组
   * @returns SkeletonData 实例
   */
  static fromBoneDataArray(bonesData: BoneData[]): SkeletonData {
    return new SkeletonData(bonesData)
  }
}
