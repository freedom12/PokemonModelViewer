# 需求文档

## 简介

本文档描述了 Pokemon Model Viewer 项目中 `services/` 目录代码重构的需求。目标是将分散在 `services/` 目录中的代码迁移到更具体的模块中，以提高代码的可维护性和一致性。

## 术语表

- **MaterialFactory**: 材质工厂类，使用策略模式根据 shader 类型创建对应的材质
- **MaterialCreator**: 材质创建器函数类型，用于创建特定 shader 类型的材质
- **textureLoader**: 纹理加载器模块，负责加载纹理和创建材质
- **meshConverter**: 网格转换器模块，负责将 FlatBuffers 数据转换为 Three.js 几何体
- **Skeleton**: 骨骼系统类，管理骨骼层次结构
- **TRSKL**: FlatBuffers 骨骼数据格式
- **TRMTR**: FlatBuffers 材质数据格式

## 需求

### 需求 1：迁移材质创建函数到 MaterialFactory

**用户故事：** 作为开发者，我希望所有材质创建逻辑都通过 MaterialFactory 统一管理，以便于维护和扩展。

#### 验收标准

1. WHEN 需要创建材质时 THEN THE MaterialFactory SHALL 使用已注册的策略创建对应材质
2. WHEN 需要批量创建材质时 THEN THE MaterialFactory SHALL 提供 `createAll()` 方法
3. WHEN 材质创建函数被迁移后 THEN THE `textureLoader.ts` SHALL 仅保留纹理加载相关的函数
4. THE MaterialFactory SHALL 保持与现有 `createMaterial()` 函数相同的行为和返回类型

### 需求 2：清理 textureLoader.ts 中的重复材质创建代码

**用户故事：** 作为开发者，我希望 `textureLoader.ts` 中的材质创建函数被移除或重定向，以消除代码重复。

#### 验收标准

1. WHEN `textureLoader.ts` 被重构后 THEN THE 文件 SHALL 仅包含纹理加载相关的函数（`loadTexture`, `loadTextures`, `extractTextureReferences`）
2. WHEN `textureLoader.ts` 中的 `createEyeClearCoatMaterial()` 被调用 THEN THE System SHALL 重定向到 `materials/EyeClearCoatMaterial.ts`
3. WHEN `textureLoader.ts` 中的 `createFireMaterial()` 被调用 THEN THE System SHALL 重定向到 `materials/FireMaterial.ts`
4. WHEN `textureLoader.ts` 中的 `createNonDirectionalMaterial()` 被调用 THEN THE System SHALL 重定向到 `materials/NonDirectionalMaterial.ts`
5. WHEN `textureLoader.ts` 中的 `createIkCharacterMaterial()` 被调用 THEN THE System SHALL 重定向到 `materials/IkCharacterMaterial.ts`
6. THE `disposeMaterial()` 和 `disposeAllMaterials()` 函数 SHALL 被迁移到 MaterialFactory 类中

### 需求 3：迁移 createSkeleton 函数到 core/skeleton

**用户故事：** 作为开发者，我希望骨骼创建逻辑位于 `core/skeleton/` 目录中，以保持代码组织的一致性。

#### 验收标准

1. THE `createSkeleton()` 函数 SHALL 被迁移到 `core/skeleton/SkeletonFactory.ts` 或类似文件中
2. THE 迁移后的 `createSkeleton()` 函数 SHALL 保持与现有实现相同的行为和返回类型
3. WHEN `meshConverter.ts` 中的 `createSkeleton()` 被移除后 THEN THE 调用方 SHALL 直接从 `core/skeleton/` 导入

### 需求 4：评估并整理 meshConverter.ts

**用户故事：** 作为开发者，我希望 `meshConverter.ts` 仅包含网格转换相关的核心逻辑。

#### 验收标准

1. THE `meshConverter.ts` SHALL 保留 `createGeometry()`, `createAllGeometries()`, `createGeometryGroups()` 函数
2. WHEN `createSkeleton()` 被迁移后 THEN THE `meshConverter.ts` SHALL 移除该函数
3. THE `meshConverter.ts` SHALL 移除未使用的变量（如 `expectedLength3`）

### 需求 5：更新调用方代码

**用户故事：** 作为开发者，我希望所有调用方代码都使用新的导入路径。

#### 验收标准

1. WHEN `Model.ts` 需要创建材质时 THEN THE 代码 SHALL 使用 `MaterialFactory`
2. WHEN `Model.ts` 需要创建骨骼时 THEN THE 代码 SHALL 从 `core/skeleton/` 导入 `createSkeleton`
3. THE 所有调用方 SHALL 更新导入路径以使用新的模块位置

### 需求 6：代码质量改进

**用户故事：** 作为开发者，我希望重构后的代码符合项目的代码规范。

#### 验收标准

1. THE 重构后的代码 SHALL 通过 ESLint 检查
2. THE 重构后的代码 SHALL 通过 TypeScript 类型检查
3. WHEN 存在未使用的导出 THEN THE System SHALL 移除或标记为废弃
4. THE 重构后的代码 SHALL 保持现有的注释和文档风格
