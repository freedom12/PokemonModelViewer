# 需求文档

## 简介

本文档定义了 Model 类延迟初始化重构的需求。目标是将数据层和渲染层完全解耦，实现延迟初始化模式：在初始化时仅持有各种 XXXData（如 MaterialData、SkeletonData），等到需要渲染时再统一转换成 Three.js 对象。

## 术语表

- **Model**: 模型整合类，继承自 THREE.Group，管理骨骼、动画、材质和网格
- **ModelData**: 纯数据类，存储解析后的模型数据（网格、材质引用、骨骼引用）
- **MeshData**: 纯数据类，存储单个网格的顶点数据
- **MaterialData**: 纯数据类，存储材质属性（纹理引用、shader参数）
- **SkeletonData**: 纯数据类，存储骨骼层次结构和绑定姿势
- **AnimationData**: 纯数据类，存储动画轨道数据
- **GPU_Resource**: Three.js 运行时对象（如 THREE.Mesh、THREE.Material、THREE.Skeleton）
- **Lazy_Initialization**: 延迟初始化模式，仅在首次需要时才创建资源
- **Materialization**: 将纯数据对象转换为 Three.js 渲染对象的过程

## 需求

### 需求 1：数据层与渲染层分离

**用户故事：** 作为开发者，我希望数据层和渲染层完全解耦，以便可以单独测试数据逻辑而不依赖 Three.js。

#### 验收标准

1. THE Model SHALL 在构造时仅存储 ModelData 引用，不创建任何 GPU_Resource（但可以创建逻辑层对象如 Skeleton）
2. THE Model SHALL 提供 `isMaterialized` 属性，返回当前是否已创建 GPU_Resource
3. WHEN Model 未实例化时，THE Model SHALL 允许访问所有数据层属性（如 modelName、data）
4. WHEN Model 未实例化时，THE Model SHALL 在访问渲染层属性时返回空数组或 null

### 需求 2：显式实例化接口

**用户故事：** 作为开发者，我希望能够显式控制何时创建 GPU 资源，以便实现预加载和按需渲染。

#### 验收标准

1. THE Model SHALL 提供 `materialize(basePath: string): Promise<void>` 方法用于创建所有 GPU_Resource
2. WHEN `materialize` 被调用时，THE Model SHALL 创建 THREE.Skeleton、THREE.Material 数组和 THREE.Mesh 数组
3. WHEN `materialize` 被多次调用时，THE Model SHALL 仅在首次调用时创建资源，后续调用直接返回
4. IF `materialize` 过程中发生错误，THEN THE Model SHALL 清理已创建的部分资源并抛出错误
5. THE Model SHALL 提供 `dematerialize(): void` 方法用于释放所有 GPU_Resource 并恢复到未实例化状态

### 需求 3：骨骼系统延迟初始化

**用户故事：** 作为开发者，我希望骨骼系统的 GPU 资源支持延迟初始化，以便在不需要渲染时节省内存。

#### 验收标准

1. THE Model SHALL 在构造时从 SkeletonData 创建 Skeleton（逻辑层），但不创建 THREE.Skeleton（GPU 资源）
2. WHEN `materialize` 被调用时，THE Model SHALL 从 Skeleton 创建 THREE.Skeleton
3. WHEN Model 未实例化时，THE Model SHALL 允许通过 Skeleton 查询骨骼信息（如 getBoneByName）
4. THE Model SHALL 提供 `skeletonData` 属性用于访问原始骨骼数据

### 需求 4：材质系统延迟初始化

**用户故事：** 作为开发者，我希望材质系统支持延迟初始化，以便在预加载阶段不占用 GPU 内存。

#### 验收标准

1. THE Model SHALL 在构造时仅存储 MaterialData 数组，不创建 THREE.Material
2. WHEN `materialize` 被调用时，THE Model SHALL 使用 MaterialFactory 从 MaterialData 创建 THREE.Material 数组
3. WHEN Model 未实例化时，THE Model SHALL 允许通过 MaterialData 查询材质信息
4. THE Model SHALL 提供 `materialDataList` 属性用于访问原始材质数据数组

### 需求 5：网格系统延迟初始化

**用户故事：** 作为开发者，我希望网格系统支持延迟初始化，以便在预加载阶段不创建几何体。

#### 验收标准

1. THE Model SHALL 在构造时仅存储 MeshData 数组，不创建 THREE.BufferGeometry 或 THREE.Mesh
2. WHEN `materialize` 被调用时，THE Model SHALL 从 MeshData 创建 THREE.BufferGeometry 和 THREE.Mesh
3. WHEN Model 未实例化时，THE Model SHALL 允许通过 MeshData 查询网格信息
4. THE Model SHALL 提供 `meshDataList` 属性用于访问原始网格数据数组

### 需求 6：动画系统兼容性

**用户故事：** 作为开发者，我希望动画系统能够与延迟初始化模式兼容。

#### 验收标准

1. THE AnimationMixer SHALL 在 Model 未实例化时仍可加载 AnimationClip
2. WHEN Model 实例化后，THE AnimationMixer SHALL 自动绑定到新创建的 Skeleton 和 THREE.Skeleton
3. WHEN 动画播放时 Model 未实例化，THE Model SHALL 抛出明确的错误信息
4. THE Model SHALL 在 `materialize` 完成后自动设置 AnimationMixer 的目标对象

### 需求 7：资源管理

**用户故事：** 作为开发者，我希望能够方便地管理模型的生命周期和资源释放。

#### 验收标准

1. THE Model SHALL 在 `dispose` 方法中释放所有 GPU_Resource
2. WHEN `dispose` 被调用时，THE Model SHALL 将状态重置为未实例化
3. THE Model SHALL 在 `dematerialize` 后保留 ModelData，允许重新实例化
4. THE Model SHALL 在 `dispose` 后清除所有引用，不允许重新使用

### 需求 8：状态查询接口

**用户故事：** 作为开发者，我希望能够查询模型的当前状态，以便做出正确的操作决策。

#### 验收标准

1. THE Model SHALL 提供 `isMaterialized: boolean` 属性表示是否已实例化
2. THE Model SHALL 提供 `isDisposed: boolean` 属性表示是否已销毁
3. THE Model SHALL 提供 `canMaterialize: boolean` 属性表示是否可以实例化
4. WHEN 访问需要实例化的方法时，IF Model 未实例化，THEN THE Model SHALL 抛出 `ModelNotMaterializedError`
