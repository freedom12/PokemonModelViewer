# 设计文档

## 概述

本设计文档描述了 Pokemon Model Viewer 项目中 `services/` 目录代码重构的技术方案。重构的核心目标是将分散的代码迁移到更具体的模块中，提高代码的可维护性和一致性。

## 架构

### 当前架构

```
web/src/
├── services/
│   ├── textureLoader.ts      # 纹理加载 + 材质创建（混合职责）
│   ├── meshConverter.ts      # 网格转换 + 骨骼创建（混合职责）
│   ├── modelLoader.ts        # 模型加载
│   ├── vertexParser.ts       # 顶点解析
│   └── resourceLoader.ts     # 资源路径解析
├── materials/
│   ├── MaterialFactory.ts    # 材质工厂（策略模式）
│   ├── EyeClearCoatMaterial.ts
│   ├── FireMaterial.ts
│   ├── NonDirectionalMaterial.ts
│   ├── IkCharacterMaterial.ts
│   └── registerMaterials.ts
└── core/
    ├── skeleton/
    │   ├── Skeleton.ts       # 骨骼系统类
    │   └── Bone.ts           # 骨骼节点类
    └── model/
        └── Model.ts          # 模型整合类
```

### 目标架构

```
web/src/
├── services/
│   ├── textureLoader.ts      # 仅纹理加载（职责单一）
│   ├── meshConverter.ts      # 仅网格转换（职责单一）
│   ├── modelLoader.ts        # 模型加载（不变）
│   ├── vertexParser.ts       # 顶点解析（不变）
│   └── resourceLoader.ts     # 资源路径解析（不变）
├── materials/
│   ├── MaterialFactory.ts    # 材质工厂（增强：包含 dispose 方法）
│   ├── EyeClearCoatMaterial.ts
│   ├── FireMaterial.ts
│   ├── NonDirectionalMaterial.ts
│   ├── IkCharacterMaterial.ts
│   └── registerMaterials.ts
└── core/
    ├── skeleton/
    │   ├── Skeleton.ts
    │   ├── Bone.ts
    │   └── SkeletonFactory.ts  # 新增：骨骼创建工厂
    └── model/
        └── Model.ts          # 更新导入路径
```

## 组件和接口

### 1. textureLoader.ts 重构

**保留的函数：**
- `loadTexture(path: string): Promise<THREE.Texture>` - 加载单个纹理
- `loadTextures(textures: TextureReference[], basePath: string, material?: TRMTRMaterial): Promise<Map<string, THREE.Texture>>` - 批量加载纹理
- `extractTextureReferences(material: TRMTRMaterial): TextureReference[]` - 提取纹理引用

**移除的函数：**
- `createMaterial()` - 迁移到 MaterialFactory
- `createAllMaterials()` - 迁移到 MaterialFactory
- `createDefaultMaterial()` - 迁移到 MaterialFactory
- `createEyeClearCoatMaterial()` - 已存在于 materials/EyeClearCoatMaterial.ts
- `createFireMaterial()` - 已存在于 materials/FireMaterial.ts
- `createNonDirectionalMaterial()` - 已存在于 materials/NonDirectionalMaterial.ts
- `createIkCharacterMaterial()` - 已存在于 materials/IkCharacterMaterial.ts
- `disposeMaterial()` - 迁移到 MaterialFactory
- `disposeAllMaterials()` - 迁移到 MaterialFactory
- `findMaterialByName()` - 移除（未被使用或迁移到需要的地方）

**保留的辅助函数（内部使用）：**
- `getThreeWrapMode()` - UV 包裹模式转换
- `isMapEnabled()` - 检查贴图是否启用
- `getFloatParameter()` - 读取浮点参数
- `getColorParameter()` - 读取颜色参数
- `getMaterialShaderName()` - 获取 shader 名称
- `findTextureByName()` - 根据名称查找纹理
- `convertBntxToPng()` - 文件名转换
- `applyTextureToMaterial()` - 应用纹理到材质

### 2. MaterialFactory.ts 增强

**现有方法（保持不变）：**
- `register(shaderName: string, creator: MaterialCreator): void`
- `unregister(shaderName: string): boolean`
- `isRegistered(shaderName: string): boolean`
- `getRegisteredShaders(): string[]`
- `setTextureLoader(loader: TextureLoader): void`
- `create(data: MaterialData, basePath: string): Promise<THREE.Material>`
- `createDefault(options?: MaterialOptions): THREE.MeshStandardMaterial`
- `createAll(materials: MaterialData[], basePath: string): Promise<THREE.Material[]>`
- `dispose(material: THREE.Material): void`
- `disposeAll(materials: THREE.Material[]): void`

MaterialFactory 已经具备完整的功能，无需额外增强。

### 3. SkeletonFactory.ts（新增）

**位置：** `web/src/core/skeleton/SkeletonFactory.ts`

**接口：**
```typescript
/**
 * 从 TRSKL 数据创建 Three.js Skeleton
 * 
 * @param trskl - TRSKL 骨骼数据
 * @returns THREE.Skeleton 对象
 */
export function createSkeletonFromTRSKL(trskl: TRSKL): THREE.Skeleton
```

**实现：** 将 `meshConverter.ts` 中的 `createSkeleton()` 函数迁移到此文件。

### 4. meshConverter.ts 清理

**保留的函数：**
- `createGeometry(trmsh: TRMSH, trmbf: TRMBF, meshIndex?: number): CreateGeometryResult`
- `createGeometryFromMeshShape(meshShape: MeshShape, buffer: TRMBFBuffer): CreateGeometryResult`
- `createAllGeometries(trmsh: TRMSH, trmbf: TRMBF): CreateGeometryResult[]`
- `createGeometryGroups(meshShape: MeshShape): GeometryGroup[]`
- `getSubmeshCount(meshShape: MeshShape): number`
- `validateGroupCount(meshShape: MeshShape, groups: GeometryGroup[]): boolean`

**移除的函数：**
- `createSkeleton()` - 迁移到 core/skeleton/SkeletonFactory.ts

**代码清理：**
- 移除未使用的变量 `expectedLength3`

### 5. Model.ts 更新

**导入变更：**
```typescript
// 移除
import { createSkeleton } from '../../services/meshConverter'
import { createMaterial, createDefaultMaterial } from '../../services/textureLoader'

// 添加
import { createSkeletonFromTRSKL } from '../skeleton/SkeletonFactory'
// MaterialFactory 已经导入，无需变更
```

## 数据模型

本次重构不涉及数据模型的变更。现有的数据模型保持不变：
- `MaterialData` - 材质数据类
- `SkeletonData` - 骨骼数据类
- `TextureReference` - 纹理引用接口



## 正确性属性

*正确性属性是一种特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### Property 1: MaterialFactory 创建材质行为一致性

*对于任意* 有效的 MaterialData 和已注册的 shader 类型，MaterialFactory.create() 应该返回与原 textureLoader.createMaterial() 相同类型和结构的材质对象。

**验证: 需求 1.1, 1.4**

### Property 2: createSkeletonFromTRSKL 行为一致性

*对于任意* 有效的 TRSKL 数据，createSkeletonFromTRSKL() 应该返回与原 meshConverter.createSkeleton() 相同结构的 THREE.Skeleton 对象，包括相同数量的骨骼、相同的骨骼名称和相同的层次结构。

**验证: 需求 3.2**

## 错误处理

### 材质创建错误

1. **纹理加载失败**: 当纹理加载失败时，MaterialFactory 应该记录警告并使用默认材质
2. **未注册的 shader 类型**: 当 shader 类型未注册时，MaterialFactory 应该记录警告并使用默认材质
3. **材质创建器执行失败**: 当材质创建器抛出异常时，MaterialFactory 应该捕获异常并回退到默认材质

### 骨骼创建错误

1. **无效的 TRSKL 数据**: 当 TRSKL 数据无效时，createSkeletonFromTRSKL 应该抛出描述性错误
2. **骨骼索引越界**: 当父骨骼索引越界时，应该跳过该骨骼的父子关系建立

## 测试策略

### 单元测试

由于本次重构主要是代码组织的变更，单元测试应该关注：

1. **MaterialFactory 测试**（已存在）
   - 验证 create() 方法能正确调用已注册的创建器
   - 验证 createDefault() 方法返回正确的默认材质
   - 验证 dispose() 方法正确释放资源

2. **SkeletonFactory 测试**（新增）
   - 验证 createSkeletonFromTRSKL() 返回正确的骨骼结构
   - 验证骨骼层次关系正确建立
   - 验证骨骼变换矩阵正确计算

3. **textureLoader 测试**
   - 验证 loadTexture() 正确加载纹理
   - 验证 extractTextureReferences() 正确提取纹理引用

### 集成测试

1. **模型加载测试**
   - 验证完整的模型加载流程仍然正常工作
   - 验证材质正确应用到网格
   - 验证骨骼动画正常播放

### 代码质量检查

1. **ESLint 检查**: 运行 `npm run lint` 确保无错误
2. **TypeScript 类型检查**: 运行 `npm run type-check` 确保无类型错误
3. **未使用代码检查**: 确保移除所有未使用的导入和变量
