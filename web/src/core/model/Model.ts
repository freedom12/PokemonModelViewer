/**
 * Model 类
 *
 * 模型整合类，继承自 THREE.Group，整合管理 Skeleton、AnimationMixer、Materials、Meshes。
 * 作为一个整体方便地添加到场景中并提供统一的操作接口。
 *
 * @module core/model/Model
 * @验证需求: 1.5.1, 1.5.2, 1.5.11
 */

import * as THREE from 'three';
import { ModelData, SkeletonData, MaterialData, MeshData } from '../data';
import { Skeleton, Bone } from '../skeleton';
import { AnimationMixer, AnimationClip } from '../animation';
import { AnimationState } from '../data/types';
import { MaterialFactory, registerAllMaterials } from '../../materials';
import { resolveResourcePath } from '../../services/resourceLoader';
import { ModelState } from './ModelState';
import { ModelDisposedError, ModelNotMaterializedError } from './ModelErrors';

/**
 * 模型加载错误类
 */
export class ModelLoadError extends Error {
  type: 'file_not_found' | 'parse_error' | 'network_error' | 'invalid_format';
  filePath?: string;

  constructor(
    message: string,
    type: 'file_not_found' | 'parse_error' | 'network_error' | 'invalid_format',
    filePath?: string
  ) {
    super(message);
    this.name = 'ModelLoadError';
    this.type = type;
    this.filePath = filePath;
  }
}

/**
 * Model 类
 *
 * 模型整合类，继承自 THREE.Group，整合管理以下组件：
 * - Skeleton: 骨骼系统
 * - AnimationMixer: 动画混合器
 * - Materials: 材质数组
 * - Meshes: 网格数组
 *
 * ## 延迟初始化模式
 *
 * Model 类采用延迟初始化模式，将生命周期分为两个阶段：
 * 1. **数据阶段**：构造时仅持有纯数据对象（ModelData、MeshData、MaterialData、SkeletonData）
 * 2. **渲染阶段**：通过 `materialize()` 方法创建 Three.js 渲染对象（GPU 资源）
 *
 * 这种设计实现了数据层和渲染层的完全解耦，支持预加载、按需渲染和资源管理。
 *
 * ## 状态转换
 *
 * - `Unmaterialized` -> `Materialized`: 调用 `materialize()`
 * - `Materialized` -> `Unmaterialized`: 调用 `dematerialize()`
 * - 任意状态 -> `Disposed`: 调用 `dispose()`
 *
 * @extends THREE.Group
 *
 * @example
 * ```typescript
 * // 1. 创建 Model（仅数据层，不创建 GPU 资源）
 * const model = new Model(modelData);
 *
 * // 2. 实例化（创建 GPU 资源）
 * await model.materialize('/SCVI/pm0001/pm0001_00_00/');
 *
 * // 3. 添加到场景
 * scene.add(model);
 *
 * // 4. 在渲染循环中更新
 * function animate() {
 *   const deltaTime = clock.getDelta();
 *   model.update(deltaTime);
 *   renderer.render(scene, camera);
 *   requestAnimationFrame(animate);
 * }
 *
 * // 5. 释放 GPU 资源（保留数据，可重新实例化）
 * model.dematerialize();
 *
 * // 6. 完全销毁（释放所有资源，不可再使用）
 * model.dispose();
 * ```
 */
export class Model extends THREE.Group {
  /**
   * 模型名称
   * @readonly
   */
  readonly modelName: string;

  /**
   * 模型数据
   * @readonly
   */
  readonly data: ModelData;

  // ===== 私有状态 =====

  /**
   * 模型状态
   * @private
   */
  private _state: ModelState;

  /**
   * 纹理文件的基础路径
   * @private
   */
  private _basePath: string | null;

  // ===== 数据/逻辑层对象（构造时创建）=====

  /**
   * 骨骼系统（纯逻辑层，构造时从 SkeletonData 创建）
   * @private
   */
  private _skeleton: Skeleton | null;

  /**
   * 动画混合器
   * @private
   */
  private _animationMixer: AnimationMixer;

  /**
   * 已加载的动画片段映射
   * @private
   */
  private _animationClips: Map<string, AnimationClip>;

  // ===== 渲染层对象（延迟创建）=====

  /**
   * 材质数组（GPU 资源，延迟创建）
   * @private
   */
  private _materials: THREE.Material[];

  /**
   * 网格数组（GPU 资源，延迟创建）
   * @private
   */
  private _meshes: THREE.Mesh[];

  /**
   * Three.js 骨骼对象（GPU 资源，延迟创建）
   * @private
   */
  private _threeSkeleton: THREE.Skeleton | null;

  /**
   * 蒙皮网格数组（GPU 资源，延迟创建）
   * @private
   */
  private _skinnedMeshes: THREE.SkinnedMesh[];

  /**
   * 创建 Model 实例
   *
   * 延迟初始化模式：构造时仅创建逻辑层对象（如 Skeleton），
   * 不创建任何 GPU 资源。GPU 资源在调用 materialize() 时创建。
   *
   * @param data - 模型数据对象
   *
   * @验证需求: 1.1, 3.1, 4.1, 5.1 - 延迟初始化模式
   */
  constructor(data: ModelData) {
    super();

    // 设置模型名称
    this.modelName = data.name;
    this.name = data.name; // THREE.Object3D 的 name 属性

    // 存储模型数据
    this.data = data;

    // 初始化状态
    this._state = ModelState.Unmaterialized;
    this._basePath = null;

    // 初始化动画相关组件
    this._animationMixer = new AnimationMixer();
    this._animationClips = new Map();

    // 创建逻辑层对象（不涉及 GPU）
    // Skeleton 是纯逻辑层，构造时从 SkeletonData 创建
    if (data.skeleton) {
      this._skeleton = new Skeleton(data.skeleton);
    } else {
      this._skeleton = null;
    }

    // 初始化渲染层对象为空/null（延迟创建）
    this._materials = [];
    this._meshes = [];
    this._threeSkeleton = null;
    this._skinnedMeshes = [];

    // 设置动画混合器的目标（仅设置逻辑层对象）
    this.setupAnimationMixer();
  }

  /**
   * 初始化骨骼系统的 GPU 资源
   *
   * 从 Skeleton（逻辑层）创建 THREE.Skeleton（GPU 资源）。
   * 此方法在 materialize() 中调用。
   *
   * @private
   */
  private initializeSkeleton(): void {
    if (this._skeleton) {
      // 创建 Three.js 骨骼对象（GPU 资源）
      this._threeSkeleton = this._skeleton.toThreeSkeleton();
    }
  }

  /**
   * 设置动画混合器
   *
   * 将骨骼系统和模型组设置到动画混合器。
   * 在构造时仅设置逻辑层对象，THREE.Skeleton 在 materialize() 后设置。
   *
   * @private
   */
  private setupAnimationMixer(): void {
    // 设置骨骼系统（逻辑层，构造后即可用）
    if (this._skeleton) {
      this._animationMixer.setSkeleton(this._skeleton);
    }

    // 设置模型组（用于可见性动画）
    this._animationMixer.setModelGroup(this);

    // 注意：THREE.Skeleton 在 materialize() 后设置
    // 此时 _threeSkeleton 为 null
  }

  // ===== 状态查询属性 =====

  /**
   * 检查模型是否已实例化
   *
   * 返回当前是否已创建 GPU 资源。只有在 materialize() 成功完成后，
   * 此属性才返回 true。
   *
   * @returns 如果模型已实例化则返回 true，否则返回 false
   *
   * @验证需求: 1.2, 8.1
   *
   * @example
   * ```typescript
   * if (model.isMaterialized) {
   *   model.playAnimation('idle');
   * } else {
   *   await model.materialize(basePath);
   * }
   * ```
   */
  get isMaterialized(): boolean {
    return this._state === ModelState.Materialized;
  }

  /**
   * 检查模型是否已销毁
   *
   * 返回模型是否已被销毁。一旦模型被销毁，就不能再使用，
   * 任何操作都会抛出错误。
   *
   * @returns 如果模型已销毁则返回 true，否则返回 false
   *
   * @验证需求: 8.2
   *
   * @example
   * ```typescript
   * if (model.isDisposed) {
   *   console.warn('模型已销毁，无法使用');
   *   return;
   * }
   * ```
   */
  get isDisposed(): boolean {
    return this._state === ModelState.Disposed;
  }

  /**
   * 检查模型是否可以实例化
   *
   * 返回模型是否处于可以调用 materialize() 的状态。
   * 只有在 Unmaterialized 状态下才能实例化。
   *
   * @returns 如果模型可以实例化则返回 true，否则返回 false
   *
   * @验证需求: 8.3
   *
   * @example
   * ```typescript
   * if (model.canMaterialize) {
   *   await model.materialize(basePath);
   * }
   * ```
   */
  get canMaterialize(): boolean {
    return this._state === ModelState.Unmaterialized;
  }

  // ===== 实例化控制方法 =====

  /**
   * 实例化模型
   *
   * 创建所有 GPU 资源，包括 THREE.Skeleton、THREE.Material 和 THREE.Mesh。
   * 此方法是幂等的：如果模型已经实例化，则直接返回。
   *
   * @param basePath - 纹理文件的基础路径（如 '/SCVI/pm0001/pm0001_00_00/'）
   * @throws {ModelDisposedError} 如果模型已被销毁
   *
   * @验证需求: 2.1, 2.2, 2.3, 3.2, 4.2, 5.2
   *
   * @example
   * ```typescript
   * const model = new Model(modelData);
   * await model.materialize('/SCVI/pm0001/pm0001_00_00/');
   * scene.add(model);
   * ```
   */
  async materialize(basePath: string): Promise<void> {
    // 检查状态：已销毁则抛出错误
    if (this._state === ModelState.Disposed) {
      throw new ModelDisposedError('materialize');
    }

    // 幂等性：已实例化则直接返回
    if (this._state === ModelState.Materialized) {
      return;
    }

    // 设置状态为 Materializing
    this._state = ModelState.Materializing;
    this._basePath = basePath;

    // 确保材质已注册
    Model.ensureMaterialsRegistered();

    try {
      // 1. 创建 THREE.Skeleton（从 Skeleton.toThreeSkeleton）
      this.initializeSkeleton();

      // 2. 使用 MaterialFactory 创建材质
      this._materials = await MaterialFactory.createAll(this.data.materials, basePath);

      // 3. 创建网格和蒙皮网格
      this.createMeshes();

      // 4. 绑定 AnimationMixer 到 THREE.Skeleton
      this.bindAnimationMixerToSkeleton();

      // 5. 设置状态为 Materialized
      this._state = ModelState.Materialized;
    } catch (error) {
      // 错误处理：清理已创建的部分资源，恢复状态
      this.cleanupPartialResources();
      this._state = ModelState.Unmaterialized;
      throw error;
    }
  }

  /**
   * 创建网格和蒙皮网格
   *
   * 根据 MeshData 创建 THREE.Mesh 和 THREE.SkinnedMesh。
   *
   * @private
   */
  private createMeshes(): void {
    const meshes: THREE.Mesh[] = [];
    const skinnedMeshes: THREE.SkinnedMesh[] = [];

    // 遍历所有网格数据
    for (let i = 0; i < this.data.meshes.length; i++) {
      const meshData = this.data.meshes[i];

      // 创建 BufferGeometry
      const geometry = meshData.toBufferGeometry();

      // 确定使用的材质
      let meshMaterials: THREE.Material | THREE.Material[];

      if (meshData.groups.length > 1) {
        // 多材质网格：根据组的 materialName 查找对应材质
        meshMaterials = meshData.groups.map((group) => {
          const materialName = group.materialName;
          if (materialName) {
            const foundMaterial = this._materials.find((m) => m.name === materialName);
            if (foundMaterial) {
              return foundMaterial;
            }
            console.warn(`未找到材质: ${materialName}，使用默认材质`);
          }
          return MaterialFactory.createDefault();
        });
      } else if (meshData.groups.length === 1) {
        // 单材质网格
        const materialName = meshData.groups[0].materialName;
        if (materialName) {
          const foundMaterial = this._materials.find((m) => m.name === materialName);
          if (foundMaterial) {
            meshMaterials = foundMaterial;
          } else {
            console.warn(`未找到材质: ${materialName}，使用默认材质`);
            meshMaterials = MaterialFactory.createDefault();
          }
        } else {
          meshMaterials = MaterialFactory.createDefault();
        }
      } else {
        // 没有材质组，使用默认材质
        meshMaterials = MaterialFactory.createDefault();
      }

      // 根据是否有蒙皮数据决定创建 SkinnedMesh 还是 Mesh
      if (meshData.hasSkinning && this._threeSkeleton) {
        // 创建蒙皮网格
        const skinnedMesh = new THREE.SkinnedMesh(geometry, meshMaterials);
        skinnedMesh.name = meshData.name;

        // 绑定骨骼
        skinnedMesh.bind(this._threeSkeleton);

        // 添加到蒙皮网格数组
        skinnedMeshes.push(skinnedMesh);

        // 添加到 Model 组
        this.add(skinnedMesh);
      } else {
        // 创建普通网格
        const mesh = new THREE.Mesh(geometry, meshMaterials);
        mesh.name = meshData.name;

        // 添加到网格数组
        meshes.push(mesh);

        // 添加到 Model 组
        this.add(mesh);
      }
    }

    // 更新网格引用
    this._meshes = meshes;
    this._skinnedMeshes = skinnedMeshes;

    // 如果有骨骼，将骨骼根节点添加到 Model
    if (this._threeSkeleton && this._threeSkeleton.bones.length > 0) {
      // 找到根骨骼并添加到 Model
      const rootBones = this._threeSkeleton.bones.filter(
        (bone) => !bone.parent || bone.parent === this
      );
      for (const rootBone of rootBones) {
        if (!rootBone.parent) {
          this.add(rootBone);
        }
      }
    }
  }

  /**
   * 绑定 AnimationMixer 到 THREE.Skeleton
   *
   * 在 materialize 完成后，将 AnimationMixer 绑定到新创建的 THREE.Skeleton。
   *
   * @private
   * @验证需求: 6.2, 6.4
   */
  private bindAnimationMixerToSkeleton(): void {
    if (this._threeSkeleton) {
      this._animationMixer.setThreeSkeleton(this._threeSkeleton);
    }
  }

  /**
   * 反实例化模型
   *
   * 释放所有 GPU 资源，但保留数据层对象（ModelData、Skeleton）。
   * 调用此方法后，模型可以通过再次调用 materialize() 重新实例化。
   *
   * 如果模型未实例化，此方法直接返回（幂等性）。
   *
   * @验证需求: 2.5, 7.3 - dematerialize 释放资源并保留数据
   *
   * @example
   * ```typescript
   * // 释放 GPU 资源以节省内存
   * model.dematerialize();
   *
   * // 稍后可以重新实例化
   * await model.materialize(basePath);
   * ```
   */
  dematerialize(): void {
    // 检查状态：未实例化则直接返回（幂等性）
    if (this._state !== ModelState.Materialized) {
      return;
    }

    // 1. 释放所有材质及其纹理
    for (const material of this._materials) {
      this.disposeMaterial(material);
    }
    this._materials = [];

    // 2. 释放所有网格的几何体并从 Group 中移除
    for (const mesh of this._meshes) {
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      this.remove(mesh);
    }
    this._meshes = [];

    // 3. 释放所有蒙皮网格的几何体并从 Group 中移除
    for (const mesh of this._skinnedMeshes) {
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      this.remove(mesh);
    }
    this._skinnedMeshes = [];

    // 4. 释放 THREE.Skeleton
    if (this._threeSkeleton) {
      this._threeSkeleton.dispose();
      this._threeSkeleton = null;
    }

    // 5. 从 Group 中移除所有子对象（包括骨骼根节点等）
    while (this.children.length > 0) {
      this.remove(this.children[0]);
    }

    // 6. 重置 basePath
    this._basePath = null;

    // 7. 重置 AnimationMixer 的 THREE.Skeleton 绑定
    this._animationMixer.setThreeSkeleton(null);

    // 8. 设置状态为 Unmaterialized
    this._state = ModelState.Unmaterialized;
  }

  /**
   * 清理部分创建的资源
   *
   * 在 materialize 失败时调用，清理已创建的 GPU 资源。
   *
   * @private
   * @验证需求: 2.4
   */
  private cleanupPartialResources(): void {
    // 清理材质
    for (const material of this._materials) {
      this.disposeMaterial(material);
    }
    this._materials = [];

    // 清理网格几何体
    for (const mesh of this._meshes) {
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      this.remove(mesh);
    }
    this._meshes = [];

    // 清理蒙皮网格几何体
    for (const mesh of this._skinnedMeshes) {
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      this.remove(mesh);
    }
    this._skinnedMeshes = [];

    // 清理 THREE.Skeleton
    if (this._threeSkeleton) {
      this._threeSkeleton.dispose();
      this._threeSkeleton = null;
    }

    // 重置 basePath
    this._basePath = null;
  }

  // ===== 数据层访问属性 =====

  /**
   * 获取骨骼数据
   *
   * 返回原始的骨骼数据对象，用于访问骨骼层次结构和绑定姿势。
   * 此属性在任何状态下都可以访问（除了 Disposed 状态）。
   *
   * @returns 骨骼数据，如果模型没有骨骼则返回 null
   *
   * @验证需求: 3.4 - 提供 skeletonData 属性用于访问原始骨骼数据
   *
   * @example
   * ```typescript
   * const skeletonData = model.skeletonData;
   * if (skeletonData) {
   *   console.log(`骨骼数量: ${skeletonData.bones.length}`);
   * }
   * ```
   */
  get skeletonData(): SkeletonData | null {
    return this.data.skeleton;
  }

  /**
   * 获取材质数据列表
   *
   * 返回原始的材质数据数组，用于访问材质属性（纹理引用、shader参数）。
   * 此属性在任何状态下都可以访问（除了 Disposed 状态）。
   *
   * @returns 材质数据数组
   *
   * @验证需求: 4.4 - 提供 materialDataList 属性用于访问原始材质数据数组
   *
   * @example
   * ```typescript
   * const materials = model.materialDataList;
   * for (const mat of materials) {
   *   console.log(`材质: ${mat.name}`);
   * }
   * ```
   */
  get materialDataList(): MaterialData[] {
    return this.data.materials;
  }

  /**
   * 获取网格数据列表
   *
   * 返回原始的网格数据数组，用于访问网格顶点数据。
   * 此属性在任何状态下都可以访问（除了 Disposed 状态）。
   *
   * @returns 网格数据数组
   *
   * @验证需求: 5.4 - 提供 meshDataList 属性用于访问原始网格数据数组
   *
   * @example
   * ```typescript
   * const meshes = model.meshDataList;
   * for (const mesh of meshes) {
   *   console.log(`网格: ${mesh.name}, 顶点数: ${mesh.vertexCount}`);
   * }
   * ```
   */
  get meshDataList(): MeshData[] {
    return this.data.meshes;
  }

  // ===== 骨骼相关属性 =====

  /**
   * 获取骨骼系统
   *
   * @returns 骨骼系统，如果模型没有骨骼则返回 null
   */
  get skeleton(): Skeleton | null {
    return this._skeleton;
  }

  /**
   * 获取 Three.js 骨骼对象
   *
   * @returns Three.js Skeleton 对象，如果模型没有骨骼则返回 null
   */
  get threeSkeleton(): THREE.Skeleton | null {
    return this._threeSkeleton;
  }

  // ===== 动画相关属性 =====

  /**
   * 获取动画混合器
   *
   * @returns 动画混合器实例
   */
  get animationMixer(): AnimationMixer {
    return this._animationMixer;
  }

  // ===== 材质相关属性 =====

  /**
   * 获取材质数组
   *
   * @returns 材质数组
   */
  get materials(): THREE.Material[] {
    return this._materials;
  }

  /**
   * 设置材质数组
   *
   * @param materials - 新的材质数组
   */
  set materials(materials: THREE.Material[]) {
    this._materials = materials;
  }

  // ===== 网格相关属性 =====

  /**
   * 获取网格数组
   *
   * @returns 网格数组
   */
  get meshes(): THREE.Mesh[] {
    return this._meshes;
  }

  /**
   * 设置网格数组
   *
   * @param meshes - 新的网格数组
   */
  set meshes(meshes: THREE.Mesh[]) {
    this._meshes = meshes;
  }

  /**
   * 获取蒙皮网格数组
   *
   * @returns 蒙皮网格数组
   */
  get skinnedMeshes(): THREE.SkinnedMesh[] {
    return this._skinnedMeshes;
  }

  /**
   * 设置蒙皮网格数组
   *
   * @param meshes - 新的蒙皮网格数组
   */
  set skinnedMeshes(meshes: THREE.SkinnedMesh[]) {
    this._skinnedMeshes = meshes;
  }

  // ===== 辅助方法 =====

  /**
   * 检查模型是否有骨骼
   *
   * @returns 如果模型有骨骼则返回 true
   */
  get hasSkeleton(): boolean {
    return this._skeleton !== null;
  }

  /**
   * 获取骨骼数量
   *
   * @returns 骨骼数量，如果没有骨骼则返回 0
   */
  get boneCount(): number {
    return this._skeleton?.boneCount ?? 0;
  }

  /**
   * 获取材质数量
   *
   * @returns 材质数量
   */
  get materialCount(): number {
    return this._materials.length;
  }

  /**
   * 获取网格数量
   *
   * @returns 网格数量
   */
  get meshCount(): number {
    return this._meshes.length;
  }

  /**
   * 获取模型的调试信息字符串
   *
   * @returns 调试信息字符串
   */
  toString(): string {
    const lines: string[] = [
      `Model: ${this.modelName}`,
      `  Skeleton: ${this.hasSkeleton ? `${this.boneCount} bones` : 'none'}`,
      `  Materials: ${this.materialCount}`,
      `  Meshes: ${this.meshCount}`,
      `  Skinned Meshes: ${this._skinnedMeshes.length}`,
    ];

    return lines.join('\n');
  }

  // ===== 骨骼相关接口 =====

  /**
   * 根据名称获取骨骼
   *
   * 通过骨骼名称查找并返回对应的 Bone 对象。
   * 如果模型没有骨骼系统或找不到指定名称的骨骼，返回 null。
   *
   * @param name - 骨骼名称
   * @returns 找到的骨骼对象，如果不存在则返回 null
   *
   * @验证需求: 1.5.3 - 骨骼查找接口
   *
   * @example
   * ```typescript
   * const bone = model.getBoneByName('spine');
   * if (bone) {
   *   console.log(`找到骨骼: ${bone.name}`);
   * }
   * ```
   */
  getBoneByName(name: string): Bone | null {
    // 如果模型没有骨骼系统，返回 null
    if (!this._skeleton) {
      return null;
    }
    return this._skeleton.getBoneByName(name);
  }

  /**
   * 根据索引获取骨骼
   *
   * 通过骨骼索引查找并返回对应的 Bone 对象。
   * 如果模型没有骨骼系统或索引越界，返回 null。
   *
   * @param index - 骨骼索引（从 0 开始）
   * @returns 找到的骨骼对象，如果索引无效则返回 null
   *
   * @验证需求: 1.5.3 - 骨骼查找接口
   *
   * @example
   * ```typescript
   * const bone = model.getBoneByIndex(0);
   * if (bone) {
   *   console.log(`第一个骨骼: ${bone.name}`);
   * }
   * ```
   */
  getBoneByIndex(index: number): Bone | null {
    // 如果模型没有骨骼系统，返回 null
    if (!this._skeleton) {
      return null;
    }
    return this._skeleton.getBoneByIndex(index);
  }

  /**
   * 获取骨骼的世界坐标位置
   *
   * 根据骨骼名称查找骨骼，并返回其在世界坐标系中的位置。
   * 如果模型没有骨骼系统或找不到指定名称的骨骼，返回 null。
   *
   * @param boneName - 骨骼名称
   * @returns 骨骼的世界坐标位置，如果骨骼不存在则返回 null
   * @throws {ModelNotMaterializedError} 如果模型未实例化
   *
   * @验证需求: 1.5.3 - 骨骼世界变换接口
   * @验证需求: 8.4 - 未实例化时抛出错误
   *
   * @example
   * ```typescript
   * const position = model.getBoneWorldPosition('head');
   * if (position) {
   *   console.log(`头部位置: (${position.x}, ${position.y}, ${position.z})`);
   * }
   * ```
   */
  getBoneWorldPosition(boneName: string): THREE.Vector3 | null {
    // 检查状态：未实例化时抛出错误
    if (!this.isMaterialized) {
      throw new ModelNotMaterializedError('get bone world position');
    }

    // 如果模型没有骨骼系统，返回 null
    if (!this._skeleton) {
      return null;
    }

    // 查找骨骼
    const bone = this._skeleton.getBoneByName(boneName);
    if (!bone) {
      return null;
    }

    // 返回骨骼的世界位置
    return bone.getWorldPosition();
  }

  /**
   * 获取骨骼的世界变换矩阵
   *
   * 根据骨骼名称查找骨骼，并返回其世界变换矩阵的副本。
   * 如果模型没有骨骼系统或找不到指定名称的骨骼，返回 null。
   *
   * @param boneName - 骨骼名称
   * @returns 骨骼的世界变换矩阵副本，如果骨骼不存在则返回 null
   * @throws {ModelNotMaterializedError} 如果模型未实例化
   *
   * @验证需求: 1.5.3 - 骨骼世界变换接口
   * @验证需求: 8.4 - 未实例化时抛出错误
   *
   * @example
   * ```typescript
   * const matrix = model.getBoneWorldMatrix('hand_r');
   * if (matrix) {
   *   // 使用矩阵进行变换计算
   *   const position = new THREE.Vector3();
   *   position.setFromMatrixPosition(matrix);
   * }
   * ```
   */
  getBoneWorldMatrix(boneName: string): THREE.Matrix4 | null {
    // 检查状态：未实例化时抛出错误
    if (!this.isMaterialized) {
      throw new ModelNotMaterializedError('get bone world matrix');
    }

    // 如果模型没有骨骼系统，返回 null
    if (!this._skeleton) {
      return null;
    }

    // 查找骨骼
    const bone = this._skeleton.getBoneByName(boneName);
    if (!bone) {
      return null;
    }

    // 返回骨骼世界矩阵的副本（避免外部修改内部状态）
    return bone.worldMatrix.clone();
  }

  // ===== 动画相关接口 =====

  /**
   * 加载动画片段
   *
   * 将动画片段加载到模型中，并存储到动画片段映射中。
   * 加载后可以通过 playAnimation() 播放该动画。
   *
   * @param clip - 要加载的动画片段
   *
   * @验证需求: 1.5.4 - 动画加载接口
   *
   * @example
   * ```typescript
   * const clip = AnimationClip.fromTRANM(tranmData);
   * model.loadAnimation(clip);
   * model.playAnimation(clip.name);
   * ```
   */
  loadAnimation(clip: AnimationClip): void {
    // 将动画片段存储到映射中
    this._animationClips.set(clip.name, clip);

    // 加载到动画混合器
    this._animationMixer.loadClip(clip);
  }

  /**
   * 从 URL 异步加载动画
   *
   * 从指定 URL 加载动画文件（支持 .tranm 和 .tracm 格式），
   * 解析后自动加载到模型中。
   *
   * @param url - 动画文件的 URL 路径
   * @returns Promise，加载完成后 resolve
   * @throws 如果加载或解析失败则抛出错误
   *
   * @验证需求: 1.5.4 - 动画异步加载接口
   *
   * @example
   * ```typescript
   * await model.loadAnimationFromUrl('/SCVI/pm0001/pm0001_00_00/idle.tranm');
   * model.playAnimation('idle');
   * ```
   */
  async loadAnimationFromUrl(url: string): Promise<void> {
    try {
      // 解析资源路径（支持本地/远程切换）
      const resolvedUrl = resolveResourcePath(url);

      // 加载二进制数据
      const response = await fetch(resolvedUrl);
      if (!response.ok) {
        throw new Error(`加载动画文件失败: ${response.status} ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();

      // 根据文件扩展名确定解析方式
      const extension = url.split('.').pop()?.toLowerCase();

      // 从 URL 中提取动画名称
      const filename = url.split('/').pop() || 'animation';
      const animationName = filename.replace(/\.(tranm|tracm)$/i, '');

      let clip: AnimationClip;

      if (extension === 'tranm') {
        // 解析骨骼动画文件
        const { TRANM } = await import('../../parsers');
        const byteBuffer = new (await import('flatbuffers')).ByteBuffer(
          new Uint8Array(buffer)
        );
        const tranm = TRANM.getRootAsTRANM(byteBuffer);
        clip = AnimationClip.fromTRANM(tranm, animationName);
      } else if (extension === 'tracm') {
        // 解析可见性动画文件
        const { TRACM } = await import('../../parsers');
        const byteBuffer = new (await import('flatbuffers')).ByteBuffer(
          new Uint8Array(buffer)
        );
        const tracm = TRACM.getRootAsTRACM(byteBuffer);
        clip = AnimationClip.fromTRACM(tracm, animationName);

        // 如果已经存在同名的骨骼动画，则合并
        const existingClip = this._animationClips.get(animationName);
        if (existingClip && existingClip.boneTracks.size > 0) {
          clip = AnimationClip.merge(existingClip, clip, animationName);
        }
      } else {
        throw new Error(`不支持的动画文件格式: ${extension}`);
      }

      // 加载动画片段
      this.loadAnimation(clip);
    } catch (error) {
      console.error(`[Model] 加载动画失败: ${url}`, error);
      throw error;
    }
  }

  /**
   * 播放动画
   *
   * 开始或继续播放动画。如果指定了动画名称，则切换到该动画并播放；
   * 如果未指定名称，则播放当前加载的动画。
   *
   * @param name - 可选，要播放的动画名称
   * @throws {ModelNotMaterializedError} 如果模型未实例化
   *
   * @验证需求: 1.5.4 - 动画播放控制接口
   * @验证需求: 6.1, 6.3 - 未实例化时播放动画抛出错误
   *
   * @example
   * ```typescript
   * // 播放当前动画
   * model.playAnimation();
   *
   * // 播放指定动画
   * model.playAnimation('walk');
   * ```
   */
  playAnimation(name?: string): void {
    // 检查状态：未实例化时抛出错误
    if (!this.isMaterialized) {
      throw new ModelNotMaterializedError('play animation');
    }

    // 如果指定了动画名称，先切换到该动画
    if (name !== undefined) {
      const clip = this._animationClips.get(name);
      if (clip) {
        this._animationMixer.loadClip(clip);
      } else {
        console.warn(`[Model] 动画不存在: ${name}`);
        return;
      }
    }

    // 开始播放
    this._animationMixer.play();
  }

  /**
   * 暂停动画
   *
   * 暂停当前正在播放的动画，保持当前播放时间。
   * 可以通过 playAnimation() 继续播放。
   *
   * @验证需求: 1.5.4 - 动画播放控制接口
   *
   * @example
   * ```typescript
   * model.pauseAnimation();
   * // 稍后继续播放
   * model.playAnimation();
   * ```
   */
  pauseAnimation(): void {
    this._animationMixer.pause();
  }

  /**
   * 停止动画
   *
   * 停止当前正在播放的动画，并将播放时间重置到开始位置。
   *
   * @验证需求: 1.5.4 - 动画播放控制接口
   *
   * @example
   * ```typescript
   * model.stopAnimation();
   * ```
   */
  stopAnimation(): void {
    this._animationMixer.stop();
  }

  /**
   * 设置动画循环模式
   *
   * 设置动画是否循环播放。
   *
   * @param loop - true 表示循环播放，false 表示播放一次后停止
   *
   * @验证需求: 1.5.4 - 动画循环控制接口
   *
   * @example
   * ```typescript
   * // 设置为循环播放
   * model.setAnimationLoop(true);
   *
   * // 设置为播放一次
   * model.setAnimationLoop(false);
   * ```
   */
  setAnimationLoop(loop: boolean): void {
    this._animationMixer.setLoop(loop);
  }

  /**
   * 设置动画播放时间
   *
   * 跳转到动画的指定时间点。
   *
   * @param time - 目标时间（秒）
   *
   * @验证需求: 1.5.4 - 动画时间控制接口
   *
   * @example
   * ```typescript
   * // 跳转到动画的第 2 秒
   * model.setAnimationTime(2.0);
   * ```
   */
  setAnimationTime(time: number): void {
    this._animationMixer.setTime(time);
  }

  /**
   * 获取当前动画状态
   *
   * 返回当前动画的播放状态信息，包括当前时间、持续时间、
   * 当前帧、总帧数、是否正在播放、是否循环等。
   *
   * @returns 动画状态对象
   *
   * @验证需求: 1.5.4 - 动画状态查询接口
   *
   * @example
   * ```typescript
   * const state = model.getAnimationState();
   * console.log(`当前时间: ${state.currentTime}/${state.duration}`);
   * console.log(`当前帧: ${state.currentFrame}/${state.frameCount}`);
   * console.log(`正在播放: ${state.isPlaying}`);
   * ```
   */
  getAnimationState(): AnimationState {
    return this._animationMixer.getState();
  }

  /**
   * 获取已加载的动画片段列表
   *
   * 返回所有已加载到模型中的动画片段名称数组。
   *
   * @returns 动画名称数组
   *
   * @example
   * ```typescript
   * const animations = model.getAnimationNames();
   * console.log('可用动画:', animations);
   * ```
   */
  getAnimationNames(): string[] {
    return Array.from(this._animationClips.keys());
  }

  /**
   * 获取指定名称的动画片段
   *
   * @param name - 动画名称
   * @returns 动画片段，如果不存在则返回 null
   *
   * @example
   * ```typescript
   * const clip = model.getAnimationClip('idle');
   * if (clip) {
   *   console.log(`动画时长: ${clip.duration}秒`);
   * }
   * ```
   */
  getAnimationClip(name: string): AnimationClip | null {
    return this._animationClips.get(name) || null;
  }

  /**
   * 检查是否有动画正在播放
   *
   * @returns 如果有动画正在播放则返回 true
   *
   * @example
   * ```typescript
   * if (model.isAnimationPlaying()) {
   *   console.log('动画正在播放');
   * }
   * ```
   */
  isAnimationPlaying(): boolean {
    return this._animationMixer.getIsPlaying();
  }

  // ===== 材质相关接口 =====

  /**
   * 根据名称获取材质
   *
   * 通过材质名称查找并返回对应的 THREE.Material 对象。
   * 如果找不到指定名称的材质，返回 null。
   *
   * @param name - 材质名称
   * @returns 找到的材质对象，如果不存在则返回 null
   *
   * @验证需求: 1.5.5 - 材质查找接口
   *
   * @example
   * ```typescript
   * const material = model.getMaterialByName('body_mat');
   * if (material) {
   *   console.log(`找到材质: ${material.name}`);
   * }
   * ```
   */
  getMaterialByName(name: string): THREE.Material | null {
    // 遍历材质数组查找匹配名称的材质
    for (const material of this._materials) {
      if (material.name === name) {
        return material;
      }
    }
    return null;
  }

  /**
   * 根据索引获取材质
   *
   * 通过材质索引查找并返回对应的 THREE.Material 对象。
   * 如果索引越界，返回 null。
   *
   * @param index - 材质索引（从 0 开始）
   * @returns 找到的材质对象，如果索引无效则返回 null
   *
   * @验证需求: 1.5.5 - 材质查找接口
   *
   * @example
   * ```typescript
   * const material = model.getMaterialByIndex(0);
   * if (material) {
   *   console.log(`第一个材质: ${material.name}`);
   * }
   * ```
   */
  getMaterialByIndex(index: number): THREE.Material | null {
    // 检查索引是否有效
    if (index < 0 || index >= this._materials.length) {
      return null;
    }
    return this._materials[index];
  }

  /**
   * 设置材质可见性
   *
   * 根据材质名称设置材质的可见性。
   * 这会影响所有使用该材质的网格的渲染。
   *
   * @param name - 材质名称
   * @param visible - 是否可见
   * @throws {ModelNotMaterializedError} 如果模型未实例化
   *
   * @验证需求: 1.5.5 - 材质可见性控制接口
   * @验证需求: 8.4 - 未实例化时抛出错误
   *
   * @example
   * ```typescript
   * // 隐藏指定材质
   * model.setMaterialVisible('body_mat', false);
   *
   * // 显示指定材质
   * model.setMaterialVisible('body_mat', true);
   * ```
   */
  setMaterialVisible(name: string, visible: boolean): void {
    if (!this.isMaterialized) {
      throw new ModelNotMaterializedError('setMaterialVisible');
    }

    // 查找材质
    const material = this.getMaterialByName(name);
    if (material) {
      // 设置材质的 visible 属性
      material.visible = visible;
    } else {
      console.warn(`[Model] 材质不存在: ${name}`);
    }
  }

  // ===== 网格相关接口 =====

  /**
   * 根据名称获取网格
   *
   * 通过网格名称查找并返回对应的 THREE.Mesh 对象。
   * 会同时搜索普通网格和蒙皮网格。
   * 如果找不到指定名称的网格，返回 null。
   *
   * @param name - 网格名称
   * @returns 找到的网格对象，如果不存在则返回 null
   *
   * @验证需求: 1.5.6 - 网格查找接口
   *
   * @example
   * ```typescript
   * const mesh = model.getMeshByName('body');
   * if (mesh) {
   *   console.log(`找到网格: ${mesh.name}`);
   * }
   * ```
   */
  getMeshByName(name: string): THREE.Mesh | null {
    // 首先在普通网格中查找
    for (const mesh of this._meshes) {
      if (mesh.name === name) {
        return mesh;
      }
    }

    // 然后在蒙皮网格中查找
    for (const mesh of this._skinnedMeshes) {
      if (mesh.name === name) {
        return mesh;
      }
    }

    return null;
  }

  /**
   * 设置网格可见性
   *
   * 根据网格名称设置网格的可见性。
   * 会同时搜索普通网格和蒙皮网格。
   *
   * @param name - 网格名称
   * @param visible - 是否可见
   * @throws {ModelNotMaterializedError} 如果模型未实例化
   *
   * @验证需求: 1.5.6 - 网格可见性控制接口
   * @验证需求: 8.4 - 未实例化时抛出错误
   *
   * @example
   * ```typescript
   * // 隐藏指定网格
   * model.setMeshVisible('body', false);
   *
   * // 显示指定网格
   * model.setMeshVisible('body', true);
   * ```
   */
  setMeshVisible(name: string, visible: boolean): void {
    if (!this.isMaterialized) {
      throw new ModelNotMaterializedError('setMeshVisible');
    }

    // 查找网格
    const mesh = this.getMeshByName(name);
    if (mesh) {
      // 设置网格的 visible 属性
      mesh.visible = visible;
    } else {
      console.warn(`[Model] 网格不存在: ${name}`);
    }
  }

  // ===== 渲染控制接口 =====

  /**
   * 设置线框模式
   *
   * 启用或禁用模型的线框渲染模式。
   * 会同时影响所有材质。
   *
   * @param enabled - 是否启用线框模式
   * @throws {ModelNotMaterializedError} 如果模型未实例化
   *
   * @验证需求: 1.5.7 - 渲染控制接口
   * @验证需求: 8.4 - 未实例化时抛出错误
   *
   * @example
   * ```typescript
   * // 启用线框模式
   * model.setWireframe(true);
   *
   * // 禁用线框模式
   * model.setWireframe(false);
   * ```
   */
  setWireframe(enabled: boolean): void {
    if (!this.isMaterialized) {
      throw new ModelNotMaterializedError('setWireframe');
    }

    // 遍历所有材质设置线框模式
    for (const material of this._materials) {
      // 检查材质是否支持 wireframe 属性
      if ('wireframe' in material) {
        (material as THREE.MeshStandardMaterial).wireframe = enabled;
      }
    }
  }

  /**
   * 设置投射阴影
   *
   * 设置模型是否投射阴影。
   * 会同时影响所有网格和蒙皮网格。
   *
   * @param enabled - 是否投射阴影
   *
   * @验证需求: 1.5.7 - 渲染控制接口
   *
   * @example
   * ```typescript
   * // 启用投射阴影
   * model.setCastShadow(true);
   *
   * // 禁用投射阴影
   * model.setCastShadow(false);
   * ```
   */
  /**
   * 设置投射阴影
   *
   * 设置模型是否投射阴影。
   * 会同时影响所有网格和蒙皮网格。
   *
   * @param enabled - 是否投射阴影
   * @throws {ModelNotMaterializedError} 如果模型未实例化
   *
   * @验证需求: 1.5.7 - 渲染控制接口
   * @验证需求: 8.4 - 未实例化时抛出错误
   *
   * @example
   * ```typescript
   * // 启用投射阴影
   * model.setCastShadow(true);
   *
   * // 禁用投射阴影
   * model.setCastShadow(false);
   * ```
   */
  setCastShadow(enabled: boolean): void {
    if (!this.isMaterialized) {
      throw new ModelNotMaterializedError('setCastShadow');
    }

    // 设置普通网格的投射阴影
    for (const mesh of this._meshes) {
      mesh.castShadow = enabled;
    }

    // 设置蒙皮网格的投射阴影
    for (const mesh of this._skinnedMeshes) {
      mesh.castShadow = enabled;
    }
  }

  /**
   * 设置接收阴影
   *
   * 设置模型是否接收阴影。
   * 会同时影响所有网格和蒙皮网格。
   *
   * @param enabled - 是否接收阴影
   * @throws {ModelNotMaterializedError} 如果模型未实例化
   *
   * @验证需求: 1.5.7 - 渲染控制接口
   * @验证需求: 8.4 - 未实例化时抛出错误
   *
   * @example
   * ```typescript
   * // 启用接收阴影
   * model.setReceiveShadow(true);
   *
   * // 禁用接收阴影
   * model.setReceiveShadow(false);
   * ```
   */
  setReceiveShadow(enabled: boolean): void {
    if (!this.isMaterialized) {
      throw new ModelNotMaterializedError('setReceiveShadow');
    }

    // 设置普通网格的接收阴影
    for (const mesh of this._meshes) {
      mesh.receiveShadow = enabled;
    }

    // 设置蒙皮网格的接收阴影
    for (const mesh of this._skinnedMeshes) {
      mesh.receiveShadow = enabled;
    }
  }

  // ===== 包围盒接口 =====

  /**
   * 获取模型的包围盒
   *
   * 计算并返回包含整个模型的轴对齐包围盒（AABB）。
   * 包围盒会考虑所有网格和蒙皮网格。
   *
   * @returns 模型的包围盒
   *
   * @验证需求: 1.5.8 - 包围盒计算接口
   *
   * @example
   * ```typescript
   * const box = model.getBoundingBox();
   * console.log(`包围盒最小点: (${box.min.x}, ${box.min.y}, ${box.min.z})`);
   * console.log(`包围盒最大点: (${box.max.x}, ${box.max.y}, ${box.max.z})`);
   * ```
   */
  getBoundingBox(): THREE.Box3 {
    const box = new THREE.Box3();

    // 使用 Three.js 的 setFromObject 方法计算包围盒
    // 这会递归遍历所有子对象
    box.setFromObject(this);

    return box;
  }

  /**
   * 获取模型的包围球
   *
   * 计算并返回包含整个模型的包围球。
   * 包围球基于包围盒计算。
   *
   * @returns 模型的包围球
   *
   * @验证需求: 1.5.8 - 包围盒计算接口
   *
   * @example
   * ```typescript
   * const sphere = model.getBoundingSphere();
   * console.log(`包围球中心: (${sphere.center.x}, ${sphere.center.y}, ${sphere.center.z})`);
   * console.log(`包围球半径: ${sphere.radius}`);
   * ```
   */
  getBoundingSphere(): THREE.Sphere {
    const sphere = new THREE.Sphere();
    const box = this.getBoundingBox();

    // 从包围盒计算包围球
    box.getBoundingSphere(sphere);

    return sphere;
  }

  /**
   * 获取模型的中心点
   *
   * 计算并返回模型包围盒的中心点坐标。
   *
   * @returns 模型的中心点
   *
   * @验证需求: 1.5.8 - 包围盒计算接口
   *
   * @example
   * ```typescript
   * const center = model.getCenter();
   * console.log(`模型中心: (${center.x}, ${center.y}, ${center.z})`);
   *
   * // 将相机对准模型中心
   * camera.lookAt(center);
   * ```
   */
  getCenter(): THREE.Vector3 {
    const center = new THREE.Vector3();
    const box = this.getBoundingBox();

    // 获取包围盒的中心点
    box.getCenter(center);

    return center;
  }

  /**
   * 获取模型的尺寸
   *
   * 计算并返回模型包围盒的尺寸（宽度、高度、深度）。
   *
   * @returns 模型的尺寸向量
   *
   * @验证需求: 1.5.8 - 包围盒计算接口
   *
   * @example
   * ```typescript
   * const size = model.getSize();
   * console.log(`模型尺寸: 宽=${size.x}, 高=${size.y}, 深=${size.z}`);
   *
   * // 根据模型大小调整相机距离
   * const maxDimension = Math.max(size.x, size.y, size.z);
   * camera.position.z = maxDimension * 2;
   * ```
   */
  getSize(): THREE.Vector3 {
    const size = new THREE.Vector3();
    const box = this.getBoundingBox();

    // 获取包围盒的尺寸
    box.getSize(size);

    return size;
  }

  // ===== 更新和销毁 =====

  /**
   * 更新模型
   *
   * 每帧调用此方法来更新动画和骨骼变换。
   * 此方法会：
   * 1. 调用动画混合器的 update 方法更新动画
   * 2. 更新骨骼的世界矩阵
   *
   * @param deltaTime - 距离上一帧的时间间隔（秒）
   *
   * @验证需求: 1.5.9 - update 方法用于更新动画
   *
   * @example
   * ```typescript
   * // 在渲染循环中更新模型
   * const clock = new THREE.Clock();
   *
   * function animate() {
   *   const deltaTime = clock.getDelta();
   *   model.update(deltaTime);
   *   renderer.render(scene, camera);
   *   requestAnimationFrame(animate);
   * }
   * ```
   */
  update(deltaTime: number): void {
    // 更新动画混合器（会自动更新骨骼变换和网格可见性）
    this._animationMixer.update(deltaTime);

    // 如果有骨骼系统，确保世界矩阵是最新的
    // 注意：AnimationMixer.update() 已经调用了 skeleton.updateWorldMatrices()
    // 但如果没有动画在播放，我们仍然需要确保骨骼矩阵是正确的
    if (this._skeleton && !this._animationMixer.getIsPlaying()) {
      this._skeleton.updateWorldMatrices();
    }
  }

  /**
   * 释放模型的所有资源
   *
   * 此方法会释放：
   * - 所有 GPU 资源（通过 dematerialize）
   * - 动画混合器
   * - 动画片段映射
   * - 骨骼系统引用
   * - 从父对象中移除自身
   *
   * 调用此方法后，模型对象不应再被使用，状态将变为 Disposed。
   *
   * @验证需求: 7.1, 7.2, 7.4 - dispose 释放所有资源并设置状态为 Disposed
   *
   * @example
   * ```typescript
   * // 当不再需要模型时释放资源
   * model.dispose();
   * model = null;
   * ```
   */
  dispose(): void {
    // 1. 如果已实例化，先调用 dematerialize 释放 GPU 资源
    if (this._state === ModelState.Materialized) {
      this.dematerialize();
    }

    // 2. 清理动画混合器
    this._animationMixer.dispose();

    // 3. 清理动画片段映射
    this._animationClips.clear();

    // 4. 清除 _skeleton 引用
    this._skeleton = null;

    // 5. 从父对象中移除自身
    if (this.parent) {
      this.parent.remove(this);
    }

    // 6. 设置状态为 Disposed
    this._state = ModelState.Disposed;
  }

  /**
   * 释放单个材质及其关联的纹理
   *
   * @param material - 要释放的材质
   * @private
   */
  private disposeMaterial(material: THREE.Material): void {
    // 释放材质
    material.dispose();

    // 检查并释放材质上的纹理
    // 遍历材质的所有属性，查找纹理
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 需要动态访问材质的纹理属性
    const materialAny = material as any;

    // 常见的纹理属性名称
    const textureProperties = [
      'map',
      'normalMap',
      'roughnessMap',
      'metalnessMap',
      'aoMap',
      'emissiveMap',
      'alphaMap',
      'envMap',
      'lightMap',
      'bumpMap',
      'displacementMap',
      'specularMap',
      'gradientMap',
    ];

    for (const prop of textureProperties) {
      if (materialAny[prop] && materialAny[prop] instanceof THREE.Texture) {
        materialAny[prop].dispose();
      }
    }

    // 检查 userData 中可能存储的自定义纹理
    if (material.userData) {
      for (const key in material.userData) {
        const value = material.userData[key];
        if (value instanceof THREE.Texture) {
          value.dispose();
        }
      }
    }
  }

  // ===== 静态工厂方法 =====

  /**
   * 材质是否已注册的标志
   * @private
   */
  private static _materialsRegistered = false;

  /**
   * 确保材质已注册
   *
   * 在创建模型之前调用，确保所有材质创建器都已注册到 MaterialFactory。
   *
   * @private
   */
  private static ensureMaterialsRegistered(): void {
    if (!Model._materialsRegistered) {
      registerAllMaterials();
      Model._materialsRegistered = true;
    }
  }
}
