# 实现计划: 宝可梦模型渲染项目重构

## 概述

本计划将宝可梦模型渲染项目重构为分层架构，实现独立的核心数据类、Model整合类、动画系统、材质系统和渲染层。采用增量实现方式，每个阶段都保持代码可运行。

## 任务

- [x] 1. 创建核心数据模型类
  - [x] 1.1 创建目录结构和基础类型定义
    - 创建 `core/data/` 目录
    - 定义基础接口和类型（IMeshData、IMaterialData等）
    - _需求: 1.1-1.5_
  
  - [x] 1.2 实现 MeshData 类
    - 实现顶点数据存储（positions、normals、uvs、tangents、skinIndices、skinWeights）
    - 实现 `toBufferGeometry()` 方法转换为 Three.js BufferGeometry
    - 从现有 meshConverter.ts 迁移顶点解析逻辑
    - _需求: 1.2_
  
  - [x] 1.3 实现 MaterialData 类
    - 实现材质属性存储（shaderName、textures、floatParams、colorParams）
    - 实现纹理引用和采样器数据结构
    - _需求: 1.3_
  
  - [x] 1.4 实现 SkeletonData 类
    - 实现骨骼数据存储（BoneData数组）
    - 实现 `getBoneByName()` 和 `getBoneByIndex()` 方法
    - _需求: 1.4_
  
  - [x] 1.5 实现 AnimationData 类
    - 实现动画轨道数据存储
    - 定义 BoneTrackData 和 VisibilityTrackData 接口
    - _需求: 1.5_
  
  - [x] 1.6 实现 ModelData 类和 FlatBuffers 转换
    - 实现 `ModelData.fromFlatBuffers()` 静态方法
    - 整合 TRMDL、TRMSH、TRMBF、TRMTR、TRSKL 解析
    - 从现有 modelLoader.ts 迁移解析逻辑
    - _需求: 1.6, 1.7_
  
  - [ ]* 1.7 编写数据模型单元测试
    - 测试各数据类的实例化
    - 测试 FlatBuffers 转换
    - _需求: 1.6_

- [x] 2. 实现骨骼系统
  - [x] 2.1 实现 Bone 类
    - 实现局部变换存储和设置（position、rotation、scale）
    - 实现 `updateLocalMatrix()` 方法
    - 实现 `updateWorldMatrix()` 方法（考虑父骨骼）
    - 实现 `computeInverseBindMatrix()` 方法
    - _需求: 2.1, 2.3, 2.4, 2.5_
  
  - [x] 2.2 实现 Skeleton 类
    - 实现骨骼层次结构管理
    - 实现 `getBoneByName()` 和 `getBoneByIndex()` 方法
    - 实现 `traverse()` 遍历方法
    - 实现 `updateWorldMatrices()` 批量更新
    - 实现 `toThreeSkeleton()` 转换方法
    - _需求: 2.2, 2.6, 2.7, 2.8_
  
  - [ ]* 2.3 编写骨骼系统属性测试
    - **Property 2: 骨骼局部变换存储正确性**
    - **Property 3: 骨骼世界矩阵计算正确性**
    - **Property 4: 逆绑定矩阵正确性**
    - **Property 5: 骨骼查找一致性**
    - **Property 6: 骨骼遍历完整性**
    - **验证: 需求 2.3, 2.4, 2.5, 2.6, 2.7**

- [x] 3. 检查点 - 核心数据层完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 4. 实现动画系统
  - [x] 4.1 实现动画轨道基类和子类
    - 实现 `AnimationTrack` 抽象基类
    - 实现 `VectorTrack` 类型（Fixed、Dynamic、Framed16、Framed8）
    - 实现 `RotationTrack` 类型（含48位四元数解包）
    - 实现 `BoolTrack` 类型
    - 从现有 animationPlayer.ts 迁移插值逻辑
    - _需求: 3.2, 3.10_
  
  - [x] 4.2 实现 BoneAnimationTrack 类
    - 整合位置、旋转、缩放轨道
    - 实现 `getTransformAtFrame()` 方法
    - _需求: 3.3_
  
  - [x] 4.3 实现 VisibilityAnimationTrack 类
    - 实现 `getVisibilityAtFrame()` 方法
    - 从现有 visibilityAnimationPlayer.ts 迁移逻辑
    - _需求: 3.4, 3.11_
  
  - [x] 4.4 实现 AnimationClip 类
    - 实现 `fromTRANM()` 静态方法
    - 实现 `fromTRACM()` 静态方法
    - 实现 `merge()` 静态方法
    - _需求: 3.1, 3.9_
  
  - [x] 4.5 实现 AnimationMixer 类
    - 实现播放控制（play、pause、stop）
    - 实现 `update(deltaTime)` 核心方法
    - 实现骨骼变换应用
    - 实现网格可见性应用
    - _需求: 3.6, 3.7, 3.8_
  
  - [ ]* 4.6 编写动画系统属性测试
    - **Property 8: 动画状态机正确性**
    - **Property 9: 动画帧插值正确性**
    - **Property 10: 四元数打包解包往返一致性**
    - **验证: 需求 3.7, 3.8, 3.10**

- [x] 5. 实现材质系统
  - [x] 5.1 实现 MaterialFactory 类
    - 实现策略模式注册机制
    - 实现 `register()` 和 `create()` 方法
    - 实现默认材质创建
    - _需求: 4.1, 4.2, 4.3, 4.4_
  
  - [x] 5.2 迁移具体材质实现
    - 迁移 EyeClearCoat 材质（使用 onBeforeCompile）
    - 迁移 Fire/Unlit 材质
    - 迁移 NonDirectional 材质
    - 迁移 IkCharacter 材质
    - _需求: 4.5, 4.6, 4.7, 4.8, 4.9_
  
  - [x] 5.3 实现材质参数工具函数
    - 实现 `getFloatParameter()` 函数
    - 实现 `getColorParameter()` 函数
    - 实现 UV 缩放偏移应用
    - _需求: 4.10, 4.11_
  
  - [ ]* 5.4 编写材质系统属性测试
    - **Property 11: 材质工厂策略正确性**
    - **Property 12: 材质参数读取正确性**
    - **Property 13: UV变换应用正确性**
    - **验证: 需求 4.3, 4.4, 4.10, 4.11**

- [x] 6. 检查点 - 动画和材质系统完成
  - 确保所有测试通过，如有问题请询问用户

- [x] 7. 实现 Model 整合类
  - [x] 7.1 实现 Model 类基础结构
    - 继承 THREE.Group
    - 整合 Skeleton、AnimationMixer、Materials、Meshes
    - 实现构造函数和基础属性
    - _需求: 1.5.1, 1.5.2_
  
  - [x] 7.2 实现骨骼相关接口
    - 实现 `getBoneByName()` 和 `getBoneByIndex()`
    - 实现 `getBoneWorldPosition()` 和 `getBoneWorldMatrix()`
    - _需求: 1.5.3_
  
  - [x] 7.3 实现动画相关接口
    - 实现 `loadAnimation()` 和 `loadAnimationFromUrl()`
    - 实现 `playAnimation()`、`pauseAnimation()`、`stopAnimation()`
    - 实现 `setAnimationLoop()` 和 `setAnimationTime()`
    - _需求: 1.5.4_
  
  - [x] 7.4 实现材质和网格接口
    - 实现 `getMaterialByName()` 和 `setMaterialVisible()`
    - 实现 `getMeshByName()` 和 `setMeshVisible()`
    - _需求: 1.5.5, 1.5.6_
  
  - [x] 7.5 实现渲染控制和包围盒接口
    - 实现 `setWireframe()`、`setCastShadow()`、`setReceiveShadow()`
    - 实现 `getBoundingBox()`、`getCenter()`、`getSize()`
    - _需求: 1.5.7, 1.5.8_
  
  - [x] 7.6 实现 update 和 dispose 方法
    - 实现 `update(deltaTime)` 更新动画
    - 实现 `dispose()` 释放所有资源
    - _需求: 1.5.9, 1.5.10_
  
  - [x] 7.7 实现静态工厂方法
    - 实现 `Model.fromModelData()` 方法
    - 实现 `Model.load(formId, game)` 方法
    - _需求: 1.5.11_

- [ ] 8. 实现渲染层
  - [x] 8.1 实现 CameraController 类
    - 封装 PerspectiveCamera 和 OrbitControls
    - 实现 `fitToModel()` 方法
    - 从现有 useThreeScene.ts 迁移相机逻辑
    - _需求: 5.3_
  
  - [x] 8.2 实现 LightingManager 类
    - 封装环境光和方向光
    - 实现环境贴图创建
    - 从现有 useThreeScene.ts 迁移光照逻辑
    - _需求: 5.4_
  
  - [x] 8.3 实现 RenderLoop 类
    - 封装 WebGLRenderer 和渲染循环
    - 实现回调注册机制
    - _需求: 5.5_
  
  - [x] 8.4 实现 World 类
    - 整合 Scene、CameraController、LightingManager、RenderLoop
    - 实现场景辅助对象（网格、坐标轴）
    - 实现射线检测方法
    - _需求: 5.1, 5.2, 5.6, 5.7, 5.8, 5.9_

- [x] 9. 检查点 - Model 和渲染层完成
  - 确保所有测试通过，如有问题请询问用户

- [ ] 10. 重构 UI 组件
  - [x] 10.1 创建 ControlPanel 组件
    - 提取显示选项（法线、线框、骨骼）
    - 提取选择模式控制
    - _需求: 6.2_
  
  - [x] 10.2 创建 AnimationController 组件
    - 提取动画选择下拉框
    - 提取播放控制按钮
    - 提取循环控制
    - _需求: 6.3_
  
  - [x] 10.3 创建 SelectionInfoPanel 组件
    - 提取三角形信息显示
    - 提取骨骼信息显示
    - _需求: 6.4_
  
  - [x] 10.4 创建 LoadingOverlay 组件
    - 提取加载进度显示
    - _需求: 6.5_
  
  - [x] 10.5 重构 ThreeViewer 组件
    - 使用新的 World 类
    - 使用新的 Model 类
    - 整合子组件
    - _需求: 6.1, 6.7_

- [ ] 11. 代码清理和整合
  - [x] 11.1 清理旧代码
    - 移除旧的 services 目录中的冗余文件
    - 移除旧的 composables 中的冗余代码
    - _需求: 7.1, 7.4_
    - **状态说明 (2024):** 经分析，旧代码仍被 ThreeViewer.vue 使用，无法安全删除。
      - services/animationPlayer.ts - 被 ThreeViewer.vue 直接使用
      - services/visibilityAnimationPlayer.ts - 被 ThreeViewer.vue 直接使用
      - services/meshConverter.ts - 被 useModelLoader.ts 使用
      - services/modelLoader.ts - 被 useModelLoader.ts 和 Model.ts 使用
      - services/textureLoader.ts - 被 useModelLoader.ts 使用
      - services/resourceLoader.ts - 基础设施，需保留
      - composables/useThreeScene.ts - 被 ThreeViewer.vue 直接使用
      - composables/useModelLoader.ts - 被 ThreeViewer.vue 直接使用
    - **前置条件:** 需先完成任务 10.5（重构 ThreeViewer 组件使用新的 World 和 Model 类）
  
  - [~] 11.2 清理注释和日志
    - 移除过时的注释代码
    - 移除调试用的 console.log（保留错误和警告）
    - 更新 JSDoc 注释
    - _需求: 7.2, 7.5_
  
  - [~] 11.3 统一代码风格
    - 统一命名规范
    - 移除未使用的导入
    - _需求: 7.3_

- [~] 12. 最终检查点
  - 确保所有测试通过
  - 确保应用正常运行
  - 如有问题请询问用户

## 注意事项

- 任务标记 `*` 的为可选测试任务，可根据时间跳过
- 每个检查点确保代码可运行
- 迁移代码时保持功能不变，逐步重构
- 属性测试使用 fast-check 库，每个测试至少运行 100 次
