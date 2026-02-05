/**
 * Skeleton 类
 *
 * 管理骨骼层次结构，提供骨骼查找、遍历和批量更新功能。
 *
 * 功能：
 * - 从 SkeletonData 构建骨骼层次结构
 * - 按名称或索引查找骨骼
 * - 遍历骨骼层次结构
 * - 批量更新世界矩阵
 * - 转换为 Three.js Skeleton 对象
 *
 * @验证需求: 2.2, 2.6, 2.7, 2.8
 */

import * as THREE from 'three';
import { Bone } from './Bone';
import { SkeletonData } from '../data/SkeletonData';

/**
 * 骨骼系统类
 *
 * 用于管理骨骼层次结构，提供骨骼查找、遍历和批量更新功能。
 */
export class Skeleton {
  /**
   * 所有骨骼数组（按索引排序）
   */
  readonly bones: Bone[];

  /**
   * 根骨骼数组（没有父骨骼的骨骼）
   */
  readonly rootBones: Bone[];

  /**
   * 骨骼名称到骨骼对象的映射，用于快速按名称查找
   */
  private boneMap: Map<string, Bone>;

  /**
   * 创建 Skeleton 实例
   *
   * @param data - 骨骼数据对象
   */
  constructor(data: SkeletonData) {
    this.bones = [];
    this.rootBones = [];
    this.boneMap = new Map();

    // 从 SkeletonData 构建骨骼层次结构
    this.buildFromSkeletonData(data);
  }

  /**
   * 从 SkeletonData 构建骨骼层次结构
   *
   * @param data - 骨骼数据对象
   */
  private buildFromSkeletonData(data: SkeletonData): void {
    // 第一遍：创建所有 Bone 对象
    for (const boneData of data.bones) {
      const bone = new Bone(boneData);
      this.bones.push(bone);
      this.boneMap.set(bone.name, bone);
    }

    // 第二遍：建立父子关系
    for (let i = 0; i < data.bones.length; i++) {
      const boneData = data.bones[i];
      const bone = this.bones[i];

      if (boneData.parentIndex >= 0 && boneData.parentIndex < this.bones.length) {
        // 有父骨骼
        const parentBone = this.bones[boneData.parentIndex];
        parentBone.addChild(bone);
      } else {
        // 没有父骨骼，是根骨骼
        this.rootBones.push(bone);
      }
    }

    // 初始化：更新所有骨骼的世界矩阵
    this.updateWorldMatrices();
  }

  /**
   * 根据名称查找骨骼
   *
   * @param name - 骨骼名称
   * @returns 找到的骨骼对象，如果不存在则返回 null
   *
   * @验证需求: 2.6 - 根据名称查找骨骼
   */
  getBoneByName(name: string): Bone | null {
    return this.boneMap.get(name) ?? null;
  }

  /**
   * 根据索引查找骨骼
   *
   * @param index - 骨骼索引
   * @returns 找到的骨骼对象，如果索引越界则返回 null
   *
   * @验证需求: 2.6 - 根据索引查找骨骼
   */
  getBoneByIndex(index: number): Bone | null {
    if (index < 0 || index >= this.bones.length) {
      return null;
    }
    return this.bones[index];
  }

  /**
   * 批量更新所有骨骼的世界矩阵
   *
   * 从根骨骼开始，按层次顺序更新所有骨骼的世界矩阵。
   * 保证父骨骼在子骨骼之前被更新。
   *
   * @验证需求: 2.4 - 计算骨骼世界变换矩阵
   */
  updateWorldMatrices(): void {
    // 从每个根骨骼开始递归更新
    for (const rootBone of this.rootBones) {
      this.updateBoneWorldMatrixRecursive(rootBone);
    }
  }

  /**
   * 递归更新骨骼及其子骨骼的世界矩阵
   *
   * @param bone - 要更新的骨骼
   * @param parentWorldMatrix - 父骨骼的世界矩阵（可选）
   */
  private updateBoneWorldMatrixRecursive(
    bone: Bone,
    parentWorldMatrix?: THREE.Matrix4
  ): void {
    // 更新当前骨骼的世界矩阵
    bone.updateWorldMatrix(parentWorldMatrix);

    // 递归更新子骨骼
    for (const child of bone.children) {
      this.updateBoneWorldMatrixRecursive(child, bone.worldMatrix);
    }
  }

  /**
   * 计算所有骨骼的逆绑定矩阵
   *
   * 在绑定姿势下调用此方法，计算每个骨骼的逆绑定矩阵。
   * 注意：调用此方法前应确保世界矩阵已更新。
   *
   * @验证需求: 2.5 - 计算骨骼逆绑定矩阵
   */
  computeInverseBindMatrices(): void {
    for (const bone of this.bones) {
      bone.computeInverseBindMatrix();
    }
  }

  /**
   * 遍历所有骨骼
   *
   * 按层次顺序遍历所有骨骼，保证父骨骼在子骨骼之前被访问。
   *
   * @param callback - 对每个骨骼调用的回调函数
   *
   * @验证需求: 2.7 - 遍历骨骼层次结构
   */
  traverse(callback: (bone: Bone) => void): void {
    // 从每个根骨骼开始递归遍历
    for (const rootBone of this.rootBones) {
      this.traverseRecursive(rootBone, callback);
    }
  }

  /**
   * 递归遍历骨骼及其子骨骼
   *
   * @param bone - 当前骨骼
   * @param callback - 回调函数
   */
  private traverseRecursive(bone: Bone, callback: (bone: Bone) => void): void {
    // 先访问当前骨骼
    callback(bone);

    // 再递归访问子骨骼
    for (const child of bone.children) {
      this.traverseRecursive(child, callback);
    }
  }

  /**
   * 将 Skeleton 转换为 Three.js Skeleton 对象
   *
   * 创建 Three.js 骨骼层次结构，包括：
   * 1. 创建所有 THREE.Bone 对象
   * 2. 设置每个骨骼的局部变换
   * 3. 建立父子关系
   * 4. 计算逆绑定矩阵
   *
   * @returns Three.js Skeleton 对象
   *
   * @验证需求: 2.8 - 从 SkeletonData 创建 Three.js Skeleton 对象
   */
  toThreeSkeleton(): THREE.Skeleton {
    // 创建所有 THREE.Bone 对象
    const threeBones: THREE.Bone[] = [];

    for (const bone of this.bones) {
      const threeBone = new THREE.Bone();
      threeBone.name = bone.name;

      // 设置局部变换
      threeBone.position.copy(bone.localPosition);
      threeBone.quaternion.copy(bone.localRotation);
      threeBone.scale.copy(bone.localScale);
      threeBones.push(threeBone);
    }

    // 建立父子关系
    for (let i = 0; i < this.bones.length; i++) {
      const bone = this.bones[i];
      if (bone.parent) {
        const parentIndex = bone.parent.index;
        if (parentIndex >= 0 && parentIndex < threeBones.length) {
          threeBones[parentIndex].add(threeBones[i]);
        }
      }
    }

    // 更新所有根骨骼的世界矩阵
    for (const rootBone of this.rootBones) {
      const rootIndex = rootBone.index;
      if (rootIndex >= 0 && rootIndex < threeBones.length) {
        threeBones[rootIndex].updateMatrixWorld(true);
      }
    }

    // 计算逆绑定矩阵
    const boneInverses: THREE.Matrix4[] = [];
    for (const threeBone of threeBones) {
      const inverseMatrix = new THREE.Matrix4();
      inverseMatrix.copy(threeBone.matrixWorld).invert();
      boneInverses.push(inverseMatrix);
    }

    // 创建并返回 Skeleton
    return new THREE.Skeleton(threeBones, boneInverses);
  }

  /**
   * 创建用于可视化的 Three.js Group
   *
   * 创建一个包含所有骨骼的 THREE.Group，可用于在场景中显示骨骼结构。
   * 骨骼之间的父子关系会被保留。
   *
   * @returns Three.js Group 对象，包含骨骼层次结构
   */
  toThreeBoneGroup(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'SkeletonBoneGroup';

    // 创建所有 THREE.Bone 对象
    const threeBones: THREE.Bone[] = [];

    for (const bone of this.bones) {
      const threeBone = new THREE.Bone();
      threeBone.name = bone.name;

      // 设置局部变换
      threeBone.position.copy(bone.localPosition);
      threeBone.quaternion.copy(bone.localRotation);
      threeBone.scale.copy(bone.localScale);

      threeBones.push(threeBone);
    }

    // 建立父子关系并添加根骨骼到 group
    for (let i = 0; i < this.bones.length; i++) {
      const bone = this.bones[i];

      if (bone.parent) {
        const parentIndex = bone.parent.index;
        if (parentIndex >= 0 && parentIndex < threeBones.length) {
          threeBones[parentIndex].add(threeBones[i]);
        }
      } else {
        // 根骨骼添加到 group
        group.add(threeBones[i]);
      }
    }

    return group;
  }

  /**
   * 获取骨骼数量
   *
   * @returns 骨骼总数
   */
  get boneCount(): number {
    return this.bones.length;
  }

  /**
   * 克隆骨骼系统
   *
   * 创建一个新的 Skeleton 实例，复制当前骨骼系统的所有骨骼。
   *
   * @returns 新的 Skeleton 实例
   */
  clone(): Skeleton {
    // 创建骨骼数据数组
    const boneDataArray = this.bones.map((bone) => ({
      index: bone.index,
      name: bone.name,
      parentIndex: bone.parent ? bone.parent.index : -1,
      localPosition: bone.localPosition.clone(),
      localRotation: new THREE.Euler().setFromQuaternion(bone.localRotation),
      localScale: bone.localScale.clone(),
      type: bone.type,
    }));

    // 创建 SkeletonData
    const skeletonData = new SkeletonData(boneDataArray);

    // 创建新的 Skeleton
    return new Skeleton(skeletonData);
  }

  /**
   * 重置所有骨骼到初始姿势
   *
   * 将所有骨骼的局部变换重置为绑定姿势。
   * 注意：此方法需要保存初始姿势数据才能正确工作。
   * 当前实现仅更新世界矩阵。
   */
  resetToBindPose(): void {
    // 更新所有世界矩阵
    this.updateWorldMatrices();
  }

  /**
   * 获取所有骨骼名称
   *
   * @returns 骨骼名称数组
   */
  getBoneNames(): string[] {
    return this.bones.map((bone) => bone.name);
  }

  /**
   * 检查是否包含指定名称的骨骼
   *
   * @param name - 骨骼名称
   * @returns 如果存在该骨骼则返回 true
   */
  hasBone(name: string): boolean {
    return this.boneMap.has(name);
  }
}
