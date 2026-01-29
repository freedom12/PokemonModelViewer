# 需求文档

## 简介

本文档定义了宝可梦模型浏览器的功能需求。该系统将现有的 Vue/Three.js 项目改造为一个能够解析 FlatBuffers 格式模型文件、渲染宝可梦 3D 模型并支持浏览不同宝可梦及其形态的网页应用。

## 术语表

- **Model_Parser**: 负责解析 FlatBuffers 格式模型文件的模块
- **Mesh_Converter**: 将解析后的模型数据转换为 Three.js 可渲染格式的模块
- **Texture_Loader**: 负责加载和应用纹理贴图的模块
- **Model_Viewer**: 3D 模型渲染和展示组件
- **Pokemon_Browser**: 宝可梦列表浏览和选择界面
- **TRMDL**: 模型定义文件格式，包含网格、骨骼、材质引用等信息
- **TRMSH**: 网格文件格式，包含顶点属性、材质信息、多边形类型等
- **TRMBF**: 模型缓冲区文件格式，包含顶点和索引数据
- **TRMTR**: 材质属性文件格式，包含着色器、纹理、颜色参数等
- **TRMMT**: 材质映射文件格式，包含材质开关和映射关系

## 需求

### 需求 1：FlatBuffers 解析器生成

**用户故事：** 作为开发者，我想要生成 TypeScript 解析文件，以便能够在浏览器中解析 FlatBuffers 格式的模型数据。

#### 验收标准

1. THE Model_Parser SHALL 使用 flatc 工具从 schema 文件生成 TypeScript 解析代码
2. THE Model_Parser SHALL 支持解析 TRMDL（模型定义）文件格式
3. THE Model_Parser SHALL 支持解析 TRMSH（网格）文件格式
4. THE Model_Parser SHALL 支持解析 TRMBF（缓冲区）文件格式
5. THE Model_Parser SHALL 支持解析 TRMTR（材质属性）文件格式
6. THE Model_Parser SHALL 支持解析 TRMMT（材质映射）文件格式


### 需求 2：模型数据加载

**用户故事：** 作为用户，我想要系统能够加载宝可梦模型文件，以便查看 3D 模型。

#### 验收标准

1. WHEN 用户选择一个宝可梦 THEN THE Model_Parser SHALL 从对应目录加载 .trmdl 文件并解析模型定义
2. WHEN 模型定义加载完成 THEN THE Model_Parser SHALL 根据 TRMDL 中的引用加载对应的 .trmsh 网格文件
3. WHEN 网格文件加载完成 THEN THE Model_Parser SHALL 加载对应的 .trmbf 缓冲区文件获取顶点和索引数据
4. WHEN 模型需要材质 THEN THE Model_Parser SHALL 加载 .trmtr 和 .trmmt 文件获取材质信息
5. IF 模型文件不存在或格式错误 THEN THE Model_Parser SHALL 返回描述性错误信息

### 需求 3：网格数据转换

**用户故事：** 作为开发者，我想要将解析后的模型数据转换为 Three.js 格式，以便在 WebGL 中渲染。

#### 验收标准

1. WHEN 缓冲区数据加载完成 THEN THE Mesh_Converter SHALL 根据 TRMSH 中的顶点属性描述解析顶点位置数据
2. WHEN 缓冲区数据加载完成 THEN THE Mesh_Converter SHALL 根据 TRMSH 中的顶点属性描述解析法线数据
3. WHEN 缓冲区数据加载完成 THEN THE Mesh_Converter SHALL 根据 TRMSH 中的顶点属性描述解析 UV 坐标数据
4. WHEN 顶点数据解析完成 THEN THE Mesh_Converter SHALL 创建 Three.js BufferGeometry 对象
5. WHEN 索引数据存在 THEN THE Mesh_Converter SHALL 设置 BufferGeometry 的索引属性
6. WHEN 模型包含多个子网格 THEN THE Mesh_Converter SHALL 为每个子网格创建独立的几何体组


### 需求 4：纹理加载与应用

**用户故事：** 作为用户，我想要看到带有纹理贴图的宝可梦模型，以便获得真实的视觉效果。

#### 验收标准

1. WHEN 材质信息加载完成 THEN THE Texture_Loader SHALL 根据 TRMTR 中的纹理引用加载对应的 PNG 纹理文件
2. WHEN 纹理文件加载完成 THEN THE Texture_Loader SHALL 创建 Three.js Texture 对象
3. WHEN 材质包含 albedo（_alb）纹理 THEN THE Texture_Loader SHALL 将其应用为漫反射贴图
4. WHEN 材质包含 normal（_nrm）纹理 THEN THE Texture_Loader SHALL 将其应用为法线贴图
5. WHEN 材质包含 emission（_lym）纹理 THEN THE Texture_Loader SHALL 将其应用为自发光贴图
6. WHEN 所有纹理加载完成 THEN THE Texture_Loader SHALL 创建 Three.js MeshStandardMaterial 并应用纹理
7. IF 纹理文件加载失败 THEN THE Texture_Loader SHALL 使用默认材质并记录警告信息

### 需求 5：3D 模型渲染

**用户故事：** 作为用户，我想要在网页上看到渲染的宝可梦 3D 模型，以便欣赏模型细节。

#### 验收标准

1. WHEN 几何体和材质准备完成 THEN THE Model_Viewer SHALL 创建 Three.js Mesh 对象并添加到场景
2. WHEN 模型添加到场景 THEN THE Model_Viewer SHALL 自动调整摄像机位置以完整显示模型
3. WHEN 模型渲染时 THEN THE Model_Viewer SHALL 提供适当的光照使模型清晰可见
4. WHEN 用户与场景交互 THEN THE Model_Viewer SHALL 支持鼠标拖拽旋转视角
5. WHEN 用户与场景交互 THEN THE Model_Viewer SHALL 支持鼠标滚轮缩放
6. WHEN 用户与场景交互 THEN THE Model_Viewer SHALL 支持右键拖拽平移视角


### 需求 6：宝可梦浏览界面

**用户故事：** 作为用户，我想要浏览可用的宝可梦列表，以便选择想要查看的模型。

#### 验收标准

1. WHEN 应用启动 THEN THE Pokemon_Browser SHALL 扫描 public/SCVI 目录获取可用宝可梦列表
2. WHEN 宝可梦列表加载完成 THEN THE Pokemon_Browser SHALL 显示宝可梦缩略图和编号
3. WHEN 用户点击宝可梦 THEN THE Pokemon_Browser SHALL 加载并显示该宝可梦的 3D 模型
4. WHEN 宝可梦有多个形态 THEN THE Pokemon_Browser SHALL 显示形态选择器
5. WHEN 用户选择不同形态 THEN THE Pokemon_Browser SHALL 切换显示对应形态的模型
6. WHILE 模型加载中 THEN THE Pokemon_Browser SHALL 显示加载进度指示器

### 需求 7：目录结构解析

**用户故事：** 作为开发者，我想要系统能够正确解析宝可梦目录结构，以便定位模型文件。

#### 验收标准

1. THE Pokemon_Browser SHALL 识别 pm{XXXX} 格式的宝可梦类型目录（如 pm0001）
2. THE Pokemon_Browser SHALL 识别 pm{XXXX}_{YY}_{ZZ} 格式的形态目录（如 pm0001_00_00）
3. WHEN 解析形态目录 THEN THE Pokemon_Browser SHALL 提取宝可梦编号、形态编号和变体编号
4. THE Pokemon_Browser SHALL 使用目录中的缩略图（_00.png 或 _00_big.png）作为列表显示图片

### 需求 8：错误处理

**用户故事：** 作为用户，我想要在出现问题时看到友好的错误提示，以便了解发生了什么。

#### 验收标准

1. IF FlatBuffers 解析失败 THEN THE Model_Parser SHALL 显示具体的解析错误信息
2. IF 模型文件缺失 THEN THE Model_Viewer SHALL 显示文件未找到的提示
3. IF 纹理加载失败 THEN THE Model_Viewer SHALL 继续渲染模型但使用默认材质
4. IF 网络请求失败 THEN THE Pokemon_Browser SHALL 显示重试选项
5. WHEN 发生错误 THEN THE Model_Viewer SHALL 在控制台记录详细错误信息用于调试
