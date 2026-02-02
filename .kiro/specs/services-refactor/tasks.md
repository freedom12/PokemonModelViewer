# 实现计划: Services 目录重构

## 概述

将 `services/` 目录中的代码迁移到更具体的模块中，提高代码的可维护性和一致性。

## 任务

- [x] 1. 创建 SkeletonFactory 并迁移 createSkeleton 函数
  - [x] 1.1 创建 `core/skeleton/SkeletonFactory.ts` 文件
    - 从 `meshConverter.ts` 复制 `createSkeleton()` 函数
    - 重命名为 `createSkeletonFromTRSKL()`
    - 添加必要的导入和类型定义
    - 添加 JSDoc 文档注释
    - _需求: 3.1, 3.2_
  
  - [x] 1.2 更新 `core/skeleton/index.ts` 导出
    - 添加 `SkeletonFactory` 的导出
    - _需求: 3.1_

- [x] 2. 清理 meshConverter.ts
  - [x] 2.1 移除 `createSkeleton()` 函数
    - 删除函数定义
    - _需求: 4.2_
  
  - [x] 2.2 移除未使用的变量
    - 删除 `expectedLength3` 变量
    - _需求: 4.3_

- [x] 3. 清理 textureLoader.ts
  - [x] 3.1 移除材质创建函数
    - 删除 `createMaterial()` 函数
    - 删除 `createAllMaterials()` 函数
    - 删除 `createDefaultMaterial()` 函数
    - 删除 `createEyeClearCoatMaterial()` 函数
    - 删除 `createFireMaterial()` 函数
    - 删除 `createNonDirectionalMaterial()` 函数
    - 删除 `createIkCharacterMaterial()` 函数
    - 删除 `findMaterialByName()` 函数
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [x] 3.2 移除材质释放函数
    - 删除 `disposeMaterial()` 函数
    - 删除 `disposeAllMaterials()` 函数
    - _需求: 2.6_
  
  - [x] 3.3 移除未使用的辅助函数
    - 删除 `applyTextureToMaterial()` 函数（仅被 createMaterial 使用）
    - 删除 `getMaterialShaderName()` 函数（仅被 createMaterial 使用）
    - 删除 `findTextureByName()` 函数（仅被材质创建函数使用）
    - 删除 `isMapEnabled()` 函数（仅被 createMaterial 使用）
    - 删除 `getFloatParameter()` 函数（仅被材质创建函数使用）
    - 删除 `getColorParameter()` 函数（仅被材质创建函数使用）
    - _需求: 2.1_
  
  - [x] 3.4 清理未使用的导入和类型
    - 移除不再需要的 THREE.js 类型导入
    - 移除不再需要的 MaterialOptions 接口
    - 移除 DEFAULT_MATERIAL_OPTIONS 常量
    - _需求: 6.3_

- [x] 4. 更新调用方代码
  - [x] 4.1 更新 `core/model/Model.ts`
    - 更新 `createSkeleton` 的导入路径
    - 移除 `createMaterial`, `createDefaultMaterial` 的导入
    - 确保使用 `MaterialFactory` 创建材质
    - _需求: 5.1, 5.2_
  
  - [x] 4.2 检查并更新其他调用方
    - 搜索所有使用 `createSkeleton` 的文件
    - 搜索所有使用 `createMaterial` 的文件
    - 更新导入路径
    - _需求: 5.3_

- [x] 5. 检查点 - 确保所有测试通过
  - 运行 `npm run lint` 确保无 ESLint 错误
  - 运行 `npm run type-check` 确保无 TypeScript 错误
  - 如有问题请询问用户
  - _需求: 6.1, 6.2_

- [x] 6. 更新 core/skeleton/index.ts 导出
  - [x] 6.1 确保所有公共 API 正确导出
    - 导出 `createSkeletonFromTRSKL`
    - _需求: 3.1_

## 注意事项

- 本次重构不需要保持向后兼容性
- 所有调用方代码都需要更新导入路径
- MaterialFactory 已经具备完整功能，无需修改
