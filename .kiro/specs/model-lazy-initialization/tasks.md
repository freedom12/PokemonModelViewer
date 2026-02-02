# 实现计划：Model 延迟初始化重构

## 概述

本计划将 Model 类重构为延迟初始化模式，分离数据层和渲染层。实现采用增量方式，确保每个步骤都可验证。

## 任务

- [x] 1. 创建基础类型和错误类
  - [x] 1.1 创建 ModelState 枚举
    - 在 `web/src/core/model/` 目录下创建 `ModelState.ts`
    - 定义 Unmaterialized、Materializing、Materialized、Disposed 四个状态
    - _需求: 8.1, 8.2, 8.3_
  
  - [x] 1.2 创建错误类
    - 在 `web/src/core/model/` 目录下创建 `ModelErrors.ts`
    - 实现 ModelNotMaterializedError 和 ModelDisposedError
    - _需求: 9.4_

- [x] 2. 重构 Model 类构造函数
  - [x] 2.1 修改构造函数实现延迟初始化
    - 移除构造函数中的 GPU 资源创建代码
    - 添加 _state 私有属性，初始化为 Unmaterialized
    - 保留 Skeleton 的创建（逻辑层）
    - 初始化 _materials、_meshes、_skinnedMeshes 为空数组
    - 初始化 _threeSkeleton 为 null
    - _需求: 1.1, 3.1, 4.1, 5.1_
  
  - [ ]* 2.2 编写属性测试：构造时不创建 GPU 资源
    - **Property 1: 构造时不创建 GPU 资源**
    - **验证需求: 1.1, 3.1, 4.1, 5.1**

- [x] 3. 实现状态查询属性
  - [x] 3.1 添加状态查询属性
    - 实现 isMaterialized getter
    - 实现 isDisposed getter
    - 实现 canMaterialize getter
    - _需求: 1.2, 8.1, 8.2, 8.3_
  
  - [ ]* 3.2 编写属性测试：状态查询属性正确性
    - **Property 10: 状态查询属性正确性**
    - **验证需求: 1.2, 8.1, 8.2, 8.3**

- [x] 4. 实现数据层访问属性
  - [x] 4.1 添加数据层访问属性
    - 实现 skeletonData getter（返回 data.skeleton）
    - 实现 materialDataList getter（返回 data.materials）
    - 实现 meshDataList getter（返回 data.meshes）
    - _需求: 3.4, 4.4, 5.4_
  
  - [ ]* 4.2 编写属性测试：未实例化时数据层可访问
    - **Property 2: 未实例化时数据层可访问**
    - **验证需求: 1.3, 3.3, 4.3, 5.3**

- [x] 5. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 6. 实现 materialize 方法
  - [x] 6.1 实现 materialize 核心逻辑
    - 检查状态，已实例化则直接返回，已销毁则抛出错误
    - 设置状态为 Materializing
    - 创建 THREE.Skeleton（从 Skeleton.toThreeSkeleton）
    - 使用 MaterialFactory 创建材质
    - 创建网格和蒙皮网格
    - 绑定 AnimationMixer
    - 设置状态为 Materialized
    - _需求: 2.1, 2.2, 3.2, 4.2, 5.2_
  
  - [x] 6.2 实现 materialize 错误处理
    - 捕获创建过程中的错误
    - 清理已创建的部分资源
    - 恢复状态为 Unmaterialized
    - 重新抛出错误
    - _需求: 2.4_
  
  - [ ]* 6.3 编写属性测试：materialize 创建所有 GPU 资源
    - **Property 4: materialize 创建所有 GPU 资源**
    - **验证需求: 2.1, 2.2, 3.2, 4.2, 5.2**
  
  - [ ]* 6.4 编写属性测试：materialize 幂等性
    - **Property 5: materialize 幂等性**
    - **验证需求: 2.3**

- [x] 7. 实现 dematerialize 方法
  - [x] 7.1 实现 dematerialize 核心逻辑
    - 检查状态，未实例化则直接返回
    - 释放所有 GPU 资源（材质、几何体、纹理）
    - 清空 _materials、_meshes、_skinnedMeshes 数组
    - 释放 _threeSkeleton
    - 从 Group 中移除所有子对象
    - 设置状态为 Unmaterialized
    - _需求: 2.5, 7.3_
  
  - [ ]* 7.2 编写属性测试：dematerialize 释放资源并保留数据
    - **Property 6: dematerialize 释放资源并保留数据**
    - **验证需求: 2.5, 7.3**

- [x] 8. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 9. 更新现有方法添加状态检查
  - [x] 9.1 更新渲染相关方法
    - 在 setWireframe、setCastShadow、setReceiveShadow 等方法中添加状态检查
    - 未实例化时抛出 ModelNotMaterializedError
    - _需求: 8.4_
  
  - [x] 9.2 更新动画相关方法
    - 在 playAnimation 中添加状态检查
    - 未实例化时抛出 ModelNotMaterializedError
    - loadAnimation 保持可用（不需要实例化）
    - _需求: 6.1, 6.3_
  
  - [x] 9.3 更新骨骼世界变换方法
    - 在 getBoneWorldPosition、getBoneWorldMatrix 中添加状态检查
    - 未实例化时抛出 ModelNotMaterializedError
    - getBoneByName、getBoneByIndex 保持可用（通过 Skeleton）
    - _需求: 8.4_
  
  - [ ]* 9.4 编写属性测试：未实例化时访问渲染方法抛出错误
    - **Property 11: 未实例化时访问渲染方法抛出错误**
    - **验证需求: 8.4**
  
  - [ ]* 9.5 编写属性测试：未实例化时播放动画抛出错误
    - **Property 8: 未实例化时播放动画抛出错误**
    - **验证需求: 6.3**

- [x] 10. 更新 dispose 方法
  - [x] 10.1 重构 dispose 方法
    - 如果已实例化，先调用 dematerialize 释放 GPU 资源
    - 清除 _data 引用
    - 清除 _skeleton 引用
    - 设置状态为 Disposed
    - _需求: 7.1, 7.2, 7.4_
  
  - [ ]* 10.2 编写属性测试：dispose 释放所有资源
    - **Property 9: dispose 释放所有资源**
    - **验证需求: 7.1, 7.2, 7.4**

- [x] 11. 更新 AnimationMixer 集成
  - [x] 11.1 更新 AnimationMixer 绑定逻辑
    - 在 materialize 中绑定 AnimationMixer 到 THREE.Skeleton
    - 确保已加载的动画在实例化后可以播放
    - _需求: 6.2, 6.4_
  
  - [ ]* 11.2 编写属性测试：动画系统兼容性
    - **Property 7: 动画系统兼容性**
    - **验证需求: 6.1, 6.2, 6.4**

- [x] 12. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 13. 删除 fromModelData 静态方法
  - [x] 13.1 删除 fromModelData 方法
    - 从 Model 类中移除 fromModelData 静态方法
    - 移除 createMeshesForModel 私有静态方法
    - 保留 ensureMaterialsRegistered 私有静态方法（materialize 方法使用）
    - 保留 _materialsRegistered 静态属性（ensureMaterialsRegistered 使用）
    - _需求: 无（移除向后兼容代码）_

- [x] 15. 更新导出和文档
  - [x] 15.1 更新模块导出
    - 在 `web/src/core/model/index.ts` 中导出 ModelState、ModelNotMaterializedError、ModelDisposedError
    - _需求: 无_
  
  - [x] 15.2 更新 Model 类文档注释
    - 更新类文档说明延迟初始化模式
    - 添加使用示例
    - _需求: 无_

- [x] 16. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加快 MVP 开发
- 每个任务都引用了具体的需求以便追溯
- 检查点用于确保增量验证
- 属性测试验证普遍正确性属性
