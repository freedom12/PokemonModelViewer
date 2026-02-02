# 需求文档

## 简介

本文档定义了宝可梦模型渲染项目（Vue + TypeScript + Three.js + Element Plus）的重构需求。重构目标是建立更清晰的架构分层，实现独立的核心对象类（Model、Material、Animation、Skeleton等），提供更好的可扩展性和代码可维护性。

## 术语表

- **Model_System**: 模型系统，负责加载和管理3D模型数据
- **Material_System**: 材质系统，负责创建和管理Three.js材质
- **Animation_System**: 动画系统，负责管理骨骼动画和可见性动画
- **Skeleton_System**: 骨骼系统，负责骨骼层次结构和变换计算
- **World_System**: 世界系统，负责Three.js场景、相机、渲染器管理
- **FlatBuffers_Parser**: FlatBuffers解析器，负责解析二进制模型文件
- **Default_Material**: 默认材质，当具体材质未实现时使用的基础材质
- **Specific_Material**: 具体材质，针对特定shader类型实现的材质（如EyeClearCoat、Fire等）

## 需求

### 需求 1: 核心数据模型类

**用户故事:** 作为开发者，我希望有独立的核心数据模型类，以便将原始FlatBuffers数据转换为通用格式，方便后续扩展支持其他格式。

#### 验收标准

1. THE Model_System SHALL 提供 `ModelData` 类，用于存储解析后的模型数据（网格、材质引用、骨骼引用）
2. THE Model_System SHALL 提供 `MeshData` 类，用于存储单个网格的顶点数据（位置、法线、UV、切线、蒙皮权重等）
3. THE Model_System SHALL 提供 `MaterialData` 类，用于存储材质属性（纹理引用、shader参数、渲染状态）
4. THE Model_System SHALL 提供 `SkeletonData` 类，用于存储骨骼层次结构和绑定姿势
5. THE Model_System SHALL 提供 `AnimationData` 类，用于存储动画轨道数据
6. WHEN 从FlatBuffers加载数据时 THE Model_System SHALL 将原始数据转换为上述通用数据类
7. THE Model_System SHALL 提供工厂方法从不同数据源创建数据对象（当前支持FlatBuffers，预留扩展接口）

### 需求 1.5: Model整合类

**用户故事:** 作为开发者，我希望有一个Model类整合管理模型的Animation、Material、Skeleton等组件，以便作为一个整体方便地添加到场景中并提供统一的操作接口。

#### 验收标准

1. THE Model_System SHALL 提供 `Model` 类，继承自 `THREE.Group`
2. THE Model 类 SHALL 整合管理 Skeleton、AnimationMixer、Materials、Meshes
3. THE Model 类 SHALL 提供骨骼相关接口（getBoneByName、getBoneWorldPosition等）
4. THE Model 类 SHALL 提供动画相关接口（playAnimation、pauseAnimation、stopAnimation等）
5. THE Model 类 SHALL 提供材质相关接口（getMaterialByName、setMaterialVisible等）
6. THE Model 类 SHALL 提供网格相关接口（getMeshByName、setMeshVisible等）
7. THE Model 类 SHALL 提供渲染控制接口（setWireframe、setCastShadow等）
8. THE Model 类 SHALL 提供包围盒计算接口（getBoundingBox、getCenter、getSize等）
9. THE Model 类 SHALL 提供 update 方法用于更新动画
10. THE Model 类 SHALL 提供 dispose 方法用于释放所有资源
11. THE Model 类 SHALL 提供静态工厂方法 `load(formId, game)` 用于加载模型

### 需求 2: 骨骼系统

**用户故事:** 作为开发者，我希望有独立的骨骼系统类，以便封装骨骼的各种变换计算和层次结构管理。

#### 验收标准

1. THE Skeleton_System SHALL 提供 `Bone` 类，用于表示单个骨骼节点
2. THE Skeleton_System SHALL 提供 `Skeleton` 类，用于管理骨骼层次结构
3. WHEN 创建骨骼时 THE Skeleton_System SHALL 支持设置局部变换（位置、旋转、缩放）
4. THE Skeleton_System SHALL 提供计算骨骼世界变换矩阵的方法
5. THE Skeleton_System SHALL 提供计算骨骼逆绑定矩阵的方法
6. THE Skeleton_System SHALL 提供根据名称或索引查找骨骼的方法
7. THE Skeleton_System SHALL 提供遍历骨骼层次结构的方法
8. THE Skeleton_System SHALL 支持从 `SkeletonData` 创建 Three.js `Skeleton` 对象

### 需求 3: 动画系统整合

**用户故事:** 作为开发者，我希望有统一的动画系统，以便整合管理蒙皮动画、可见性动画，并预留材质属性动画扩展。

#### 验收标准

1. THE Animation_System SHALL 提供 `AnimationClip` 类，用于表示单个动画片段
2. THE Animation_System SHALL 提供 `AnimationTrack` 基类，用于表示动画轨道
3. THE Animation_System SHALL 提供 `BoneAnimationTrack` 类，用于骨骼变换动画
4. THE Animation_System SHALL 提供 `VisibilityAnimationTrack` 类，用于网格可见性动画
5. THE Animation_System SHALL 预留 `MaterialAnimationTrack` 接口，用于材质属性动画扩展
6. THE Animation_System SHALL 提供 `AnimationMixer` 类，用于管理和播放多个动画
7. WHEN 播放动画时 THE Animation_System SHALL 支持播放、暂停、停止、循环控制
8. WHEN 播放动画时 THE Animation_System SHALL 支持动画时间控制和帧插值
9. THE Animation_System SHALL 支持同时播放骨骼动画和可见性动画
10. WHEN 解析TRANM文件时 THE Animation_System SHALL 正确解包48位四元数旋转数据
11. WHEN 解析TRACM文件时 THE Animation_System SHALL 正确解析可见性轨道数据

### 需求 4: 材质系统重构

**用户故事:** 作为开发者，我希望有更灵活的材质系统，以便支持默认材质和渐进式实现的具体材质。

#### 验收标准

1. THE Material_System SHALL 提供 `MaterialFactory` 类，用于根据shader类型创建材质
2. THE Material_System SHALL 默认使用 `MeshStandardMaterial` 作为 Default_Material
3. WHEN shader类型有对应的 Specific_Material 实现时 THE Material_System SHALL 使用具体材质
4. WHEN shader类型没有对应实现时 THE Material_System SHALL 回退到 Default_Material
5. THE Material_System SHALL 使用 `onBeforeCompile` 方式修改shader，保持默认顶点shader不变
6. THE Material_System SHALL 支持 EyeClearCoat 材质（多层蒙版混合）
7. THE Material_System SHALL 支持 Fire/Unlit 材质（自发光多层混合）
8. THE Material_System SHALL 支持 NonDirectional 材质（烟雾效果）
9. THE Material_System SHALL 支持 IkCharacter 材质（多层PBR）
10. THE Material_System SHALL 提供材质参数读取工具函数（浮点参数、颜色参数、纹理引用）
11. THE Material_System SHALL 支持UV缩放和偏移参数
12. WHEN 纹理加载失败时 THE Material_System SHALL 使用默认材质并记录警告

### 需求 5: Three.js场景管理拆分

**用户故事:** 作为开发者，我希望将Three.js场景管理拆分为独立的World和Camera对象，以便更好地组织代码。

#### 验收标准

1. THE World_System SHALL 提供 `World` 类，用于管理Three.js场景
2. THE World_System SHALL 提供 `SceneManager` 类，用于管理场景对象的添加和移除
3. THE World_System SHALL 提供 `CameraController` 类，用于管理相机和OrbitControls
4. THE World_System SHALL 提供 `LightingManager` 类，用于管理场景光照
5. THE World_System SHALL 提供 `RenderLoop` 类，用于管理渲染循环
6. WHEN 初始化场景时 THE World_System SHALL 创建网格辅助线和坐标轴
7. WHEN 初始化场景时 THE World_System SHALL 创建环境贴图用于PBR反射
8. THE World_System SHALL 提供调整相机以适应模型的方法
9. THE World_System SHALL 提供射线检测方法用于对象选择

### 需求 6: 显示组件拆分

**用户故事:** 作为开发者，我希望将显示组件拆分为更小的子组件，以便提高代码可维护性。

#### 验收标准

1. THE ThreeViewer组件 SHALL 拆分为场景容器组件和控制面板组件
2. THE 控制面板 SHALL 作为独立组件，包含显示选项（法线、线框、骨骼）
3. THE 动画控制器 SHALL 作为独立组件，包含动画选择和播放控制
4. THE 选择信息面板 SHALL 作为独立组件，显示选中的三角形或骨骼信息
5. THE 加载进度指示器 SHALL 作为独立组件
6. THE 错误显示 SHALL 作为独立组件
7. WHEN 组件间通信时 THE 组件 SHALL 使用props和emits进行数据传递

### 需求 7: 代码清理

**用户故事:** 作为开发者，我希望清理代码中的旧注释和冗余代码，以便保持代码库整洁。

#### 验收标准

1. THE 重构过程 SHALL 移除所有过时的注释代码
2. THE 重构过程 SHALL 移除所有调试用的console.log（保留错误和警告日志）
3. THE 重构过程 SHALL 统一代码风格和命名规范
4. THE 重构过程 SHALL 移除未使用的导入和变量
5. THE 重构过程 SHALL 更新或移除过时的JSDoc注释
6. THE 重构过程 MAY 删除 `.kiro` 目录中的旧规范文件

### 需求 8: 可扩展性设计

**用户故事:** 作为开发者，我希望新架构具有良好的可扩展性，以便未来支持其他模型格式和游戏。

#### 验收标准

1. THE Model_System SHALL 使用接口定义数据加载器，支持扩展新的数据源
2. THE Material_System SHALL 使用策略模式，支持注册新的材质类型
3. THE Animation_System SHALL 使用接口定义动画轨道，支持扩展新的动画类型
4. THE 目录结构 SHALL 支持按游戏分类（当前SCVI/LZA，预留扩展）
5. THE 配置系统 SHALL 支持不同游戏的特定配置
