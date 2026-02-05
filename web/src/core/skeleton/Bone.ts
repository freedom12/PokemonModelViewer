/**
 * Bone 类
 *
 * 表示单个骨骼节点，封装骨骼的各种变换计算和层次结构管理。
 *
 * 功能：
 * - 存储和设置局部变换（位置、旋转、缩放）
 * - 计算局部矩阵
 * - 计算世界矩阵（考虑父骨骼）
 * - 计算逆绑定矩阵
 *
 * @验证需求: 2.1, 2.3, 2.4, 2.5
 */

import * as THREE from 'three';
import { BoneData } from '../data/types';

/**
 * 骨骼类
 *
 * 用于表示骨骼层次结构中的单个骨骼节点。
 * 提供局部变换存储、矩阵计算和层次结构管理功能。
 */
export class Bone {
  /**
   * 骨骼索引
   */
  readonly index: number;

  /**
   * 骨骼名称
   */
  readonly name: string;

  /**
   * 父骨骼引用，根骨骼为 null
   */
  parent: Bone | null = null;

  /**
   * 子骨骼数组
   */
  children: Bone[] = [];

  /**
   * 节点类型：Default=0, Chained=1, Floating=2
   */
  readonly type: number;

  /**
   * 局部位置
   */
  localPosition: THREE.Vector3;

  /**
   * 局部旋转（四元数）
   */
  localRotation: THREE.Quaternion;

  /**
   * 局部缩放
   */
  localScale: THREE.Vector3;

  /**
   * 局部变换矩阵（私有，通过 getter 访问）
   */
  private _localMatrix: THREE.Matrix4;

  /**
   * 世界变换矩阵（私有，通过 getter 访问）
   */
  private _worldMatrix: THREE.Matrix4;

  /**
   * 逆绑定矩阵（私有，通过 getter 访问）
   */
  private _inverseBindMatrix: THREE.Matrix4;

  /**
   * 标记局部矩阵是否需要更新
   */
  private _localMatrixNeedsUpdate: boolean = true;

  /**
   * 标记世界矩阵是否需要更新
   */
  private _worldMatrixNeedsUpdate: boolean = true;

  /**
   * 创建 Bone 实例
   *
   * @param data - 骨骼数据，包含索引、名称、父索引和局部变换
   */
  constructor(data: BoneData) {
    this.index = data.index;
    this.name = data.name;
    this.type = data.type;

    // 初始化局部变换
    this.localPosition = data.localPosition.clone();

    // 将 Euler 转换为 Quaternion
    this.localRotation = new THREE.Quaternion().setFromEuler(data.localRotation);

    this.localScale = data.localScale.clone();

    // 初始化矩阵
    this._localMatrix = new THREE.Matrix4();
    this._worldMatrix = new THREE.Matrix4();
    this._inverseBindMatrix = new THREE.Matrix4();

    // 初始计算局部矩阵
    this.updateLocalMatrix();
  }

  /**
   * 获取局部变换矩阵
   *
   * 如果局部变换已更改，会自动重新计算矩阵。
   */
  get localMatrix(): THREE.Matrix4 {
    if (this._localMatrixNeedsUpdate) {
      this.updateLocalMatrix();
    }
    return this._localMatrix;
  }

  /**
   * 获取世界变换矩阵
   *
   * 注意：需要先调用 updateWorldMatrix() 确保矩阵是最新的。
   */
  get worldMatrix(): THREE.Matrix4 {
    return this._worldMatrix;
  }

  /**
   * 获取逆绑定矩阵
   *
   * 注意：需要先调用 computeInverseBindMatrix() 确保矩阵是最新的。
   */
  get inverseBindMatrix(): THREE.Matrix4 {
    return this._inverseBindMatrix;
  }

  /**
   * 更新局部变换矩阵
   *
   * 根据当前的 localPosition、localRotation、localScale 计算局部矩阵。
   * 使用 TRS（平移-旋转-缩放）顺序组合变换。
   *
   * @验证需求: 2.3 - 支持设置局部变换
   */
  updateLocalMatrix(): void {
    // 使用 compose 方法从位置、旋转、缩放构建矩阵
    this._localMatrix.compose(this.localPosition, this.localRotation, this.localScale);

    this._localMatrixNeedsUpdate = false;
    this._worldMatrixNeedsUpdate = true;
  }

  /**
   * 更新世界变换矩阵
   *
   * 如果有父骨骼，世界矩阵 = 父骨骼世界矩阵 × 局部矩阵
   * 如果没有父骨骼（根骨骼），世界矩阵 = 局部矩阵
   *
   * @param parentWorldMatrix - 可选的父骨骼世界矩阵，如果提供则使用它而不是从 parent 获取
   *
   * @验证需求: 2.4 - 计算骨骼世界变换矩阵
   */
  updateWorldMatrix(parentWorldMatrix?: THREE.Matrix4): void {
    // 确保局部矩阵是最新的
    if (this._localMatrixNeedsUpdate) {
      this.updateLocalMatrix();
    }

    const effectiveParentMatrix = parentWorldMatrix ?? this.parent?.worldMatrix;

    if (effectiveParentMatrix) {
      // Floating类型（type=2）的骨骼不继承父骨骼的缩放
      if (this.type === 2) {
        // 提取父骨骼的位置和旋转（不含缩放）
        const tempMatrix = new THREE.Matrix4();
        const parentPos = new THREE.Vector3();
        const parentQuat = new THREE.Quaternion();
        const parentScale = new THREE.Vector3();
        
        effectiveParentMatrix.decompose(parentPos, parentQuat, parentScale);
        tempMatrix.compose(parentPos, parentQuat, new THREE.Vector3(1, 1, 1));
        
        // 世界矩阵 = 父矩阵（不含缩放） × 局部矩阵
        this._worldMatrix.multiplyMatrices(tempMatrix, this._localMatrix);
      } else {
        // 默认情况：世界矩阵 = 父矩阵 × 局部矩阵
        this._worldMatrix.multiplyMatrices(effectiveParentMatrix, this._localMatrix);
      }
    } else {
      // 根骨骼，世界矩阵等于局部矩阵
      this._worldMatrix.copy(this._localMatrix);
    }

    this._worldMatrixNeedsUpdate = false;
  }

  /**
   * 计算逆绑定矩阵
   *
   * 逆绑定矩阵是世界矩阵的逆矩阵，用于蒙皮计算。
   * 在绑定姿势下，逆绑定矩阵 × 世界矩阵 = 单位矩阵。
   *
   * 注意：调用此方法前应确保世界矩阵已更新。
   *
   * @验证需求: 2.5 - 计算骨骼逆绑定矩阵
   */
  computeInverseBindMatrix(): void {
    this._inverseBindMatrix.copy(this._worldMatrix).invert();
  }

  /**
   * 设置局部变换
   *
   * 一次性设置位置、旋转和缩放，并标记矩阵需要更新。
   *
   * @param position - 新的局部位置
   * @param rotation - 新的局部旋转（四元数）
   * @param scale - 新的局部缩放
   *
   * @验证需求: 2.3 - 支持设置局部变换
   */
  setLocalTransform(
    position: THREE.Vector3,
    rotation: THREE.Quaternion,
    scale: THREE.Vector3
  ): void {
    this.localPosition.copy(position);
    this.localRotation.copy(rotation);
    this.localScale.copy(scale);

    this._localMatrixNeedsUpdate = true;
    this._worldMatrixNeedsUpdate = true;
  }

  /**
   * 设置局部位置
   *
   * @param position - 新的局部位置
   */
  setLocalPosition(position: THREE.Vector3): void {
    this.localPosition.copy(position);
    this._localMatrixNeedsUpdate = true;
    this._worldMatrixNeedsUpdate = true;
  }

  /**
   * 设置局部旋转
   *
   * @param rotation - 新的局部旋转（四元数）
   */
  setLocalRotation(rotation: THREE.Quaternion): void {
    this.localRotation.copy(rotation);
    this._localMatrixNeedsUpdate = true;
    this._worldMatrixNeedsUpdate = true;
  }

  /**
   * 设置局部缩放
   *
   * @param scale - 新的局部缩放
   */
  setLocalScale(scale: THREE.Vector3): void {
    this.localScale.copy(scale);
    this._localMatrixNeedsUpdate = true;
    this._worldMatrixNeedsUpdate = true;
  }

  /**
   * 添加子骨骼
   *
   * @param child - 要添加的子骨骼
   */
  addChild(child: Bone): void {
    if (child.parent) {
      child.parent.removeChild(child);
    }
    child.parent = this;
    this.children.push(child);
  }

  /**
   * 移除子骨骼
   *
   * @param child - 要移除的子骨骼
   */
  removeChild(child: Bone): void {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parent = null;
    }
  }

  /**
   * 获取骨骼的世界位置
   *
   * @returns 世界坐标系中的位置
   */
  getWorldPosition(): THREE.Vector3 {
    const position = new THREE.Vector3();
    position.setFromMatrixPosition(this._worldMatrix);
    return position;
  }

  /**
   * 获取骨骼的世界旋转
   *
   * @returns 世界坐标系中的旋转（四元数）
   */
  getWorldRotation(): THREE.Quaternion {
    const rotation = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    this._worldMatrix.decompose(position, rotation, scale);
    return rotation;
  }

  /**
   * 获取骨骼的世界缩放
   *
   * @returns 世界坐标系中的缩放
   */
  getWorldScale(): THREE.Vector3 {
    const scale = new THREE.Vector3();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    this._worldMatrix.decompose(position, rotation, scale);
    return scale;
  }

  /**
   * 检查是否是根骨骼
   *
   * @returns 如果没有父骨骼则返回 true
   */
  isRoot(): boolean {
    return this.parent === null;
  }

  /**
   * 检查是否是叶子骨骼
   *
   * @returns 如果没有子骨骼则返回 true
   */
  isLeaf(): boolean {
    return this.children.length === 0;
  }

  /**
   * 克隆骨骼
   *
   * 创建一个新的 Bone 实例，复制当前骨骼的所有属性。
   * 注意：不会复制父子关系。
   *
   * @returns 新的 Bone 实例
   */
  clone(): Bone {
    const boneData: BoneData = {
      index: this.index,
      name: this.name,
      parentIndex: this.parent ? this.parent.index : -1,
      localPosition: this.localPosition.clone(),
      localRotation: new THREE.Euler().setFromQuaternion(this.localRotation),
      localScale: this.localScale.clone(),
      type: this.type,
    };

    const cloned = new Bone(boneData);
    cloned._localMatrix.copy(this._localMatrix);
    cloned._worldMatrix.copy(this._worldMatrix);
    cloned._inverseBindMatrix.copy(this._inverseBindMatrix);

    return cloned;
  }
}
