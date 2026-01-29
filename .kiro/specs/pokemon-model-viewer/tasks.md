# 实现计划: 宝可梦模型浏览器

## 概述

本计划将宝可梦模型浏览器的设计分解为可执行的编码任务。采用增量开发方式，每个任务都建立在前一个任务的基础上，确保代码始终可运行。

## 任务

- [x] 1. 生成 FlatBuffers TypeScript 解析代码
  - 使用 flatc.exe 从 tools/scheme/model 目录的 schema 文件生成 TypeScript 代码
  - 生成目标目录: src/parsers/generated/
  - 需要生成: trmdl, trmsh, trmbf, trmtr, trmmt
  - 创建 src/parsers/index.ts 统一导出
  - _需求: 1.2, 1.3, 1.4, 1.5, 1.6_

- [~] 2. 实现目录结构解析
  - [x] 2.1 创建 src/utils/pokemonPath.ts 工具模块
    - 实现 parsePokemonId(dirName: string) 函数解析 pm{XXXX} 格式
    - 实现 parseFormId(dirName: string) 函数解析 pm{XXXX}_{YY}_{ZZ} 格式
    - 实现 getThumbnailPath(formId: string) 函数生成缩略图路径
    - _需求: 7.1, 7.2, 7.3, 7.4_
  
  - [ ]* 2.2 编写目录解析属性测试
    - **Property 8: 目录名解析正确性**
    - **Property 9: 缩略图路径生成**
    - **验证: 需求 7.1, 7.2, 7.3, 7.4**


- [~] 3. 实现纹理类型映射
  - [x] 3.1 创建 src/utils/textureMapping.ts 工具模块
    - 实现 getTextureType(filename: string) 函数根据后缀返回纹理类型
    - 实现 mapToMaterialProperty(textureType: string) 函数映射到 Three.js 属性名
    - _需求: 4.3, 4.4, 4.5_
  
  - [ ]* 3.2 编写纹理映射属性测试
    - **Property 6: 纹理类型映射正确性**
    - **验证: 需求 4.3, 4.4, 4.5**

- [x] 4. 检查点 - 确保所有测试通过
  - 运行 `npm run test` 确保工具函数测试通过
  - 如有问题请询问用户

- [~] 5. 实现顶点数据解析器
  - [x] 5.1 创建 src/services/vertexParser.ts
    - 实现 parseVertexAttribute() 函数根据 Type 枚举解析不同数据类型
    - 支持 RGB_32_FLOAT (位置/法线), RG_32_FLOAT (UV), RGBA_16_UNORM (UV) 等类型
    - 实现 parseIndices() 函数根据 PolygonType 解析索引数据
    - _需求: 3.1, 3.2, 3.3, 3.5_
  
  - [ ]* 5.2 编写顶点解析属性测试
    - **Property 2: 顶点数据解析正确性**
    - **Property 3: 法线向量归一化**
    - **Property 4: 索引数据有效性**
    - **验证: 需求 3.1, 3.2, 3.3, 3.5**

- [~] 6. 实现网格转换器
  - [x] 6.1 创建 src/services/meshConverter.ts
    - 实现 createGeometry() 函数从 TRMSH + TRMBF 数据创建 BufferGeometry
    - 实现 createGeometryGroups() 函数为多子网格创建几何体组
    - _需求: 3.4, 3.6_
  
  - [ ]* 6.2 编写网格转换属性测试
    - **Property 5: 子网格数量一致性**
    - **验证: 需求 3.6**


- [x] 7. 实现纹理加载器
  - [x] 7.1 创建 src/services/textureLoader.ts
    - 实现 loadTexture() 异步函数加载单个 PNG 纹理
    - 实现 createMaterial() 函数根据 TRMTR 数据创建 MeshStandardMaterial
    - 实现错误处理：纹理加载失败时使用默认材质
    - _需求: 4.1, 4.2, 4.6, 4.7_

- [x] 8. 实现模型加载器
  - [x] 8.1 创建 src/services/modelLoader.ts
    - 实现 loadModelFiles() 异步函数加载 trmdl, trmsh, trmbf, trmtr, trmmt 文件
    - 实现 parseModelData() 函数使用 FlatBuffers 解析器解析二进制数据
    - 实现错误处理：文件不存在或格式错误时返回描述性错误
    - _需求: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [x] 8.2 创建 src/composables/useModelLoader.ts
    - 实现 loading, progress, error, currentModel 响应式状态
    - 实现 loadModel(pokemonId, formId) 方法协调加载流程
    - 实现 disposeModel() 方法清理 Three.js 资源
    - _需求: 2.1, 6.6_

- [x] 9. 检查点 - 确保模型加载功能正常
  - 运行测试确保解析和转换逻辑正确
  - 如有问题请询问用户

- [x] 10. 实现摄像机自动定位
  - [x] 10.1 创建 src/utils/cameraUtils.ts
    - 实现 calculateCameraDistance() 函数根据包围盒计算合适的摄像机距离
    - 实现 fitCameraToModel() 函数自动调整摄像机位置
    - _需求: 5.2_
  
  - [ ]* 10.2 编写摄像机计算属性测试
    - **Property 7: 摄像机距离计算**
    - **验证: 需求 5.2**


- [x] 11. 实现宝可梦列表功能
  - [x] 11.1 创建 src/composables/usePokemonList.ts
    - 实现 loadPokemonList() 方法扫描 pokemon 目录获取宝可梦列表
    - 实现 getPokemonForms() 方法获取指定宝可梦的所有形态
    - 管理 pokemons, loading, error 响应式状态
    - _需求: 6.1, 6.4_
  
  - [x] 11.2 创建宝可梦列表数据文件 public/SCVI/index.json
    - 预生成宝可梦列表数据避免运行时目录扫描
    - 包含所有宝可梦 ID、形态和缩略图路径
    - _需求: 6.1, 6.2_

- [x] 12. 实现 UI 组件
  - [x] 12.1 创建 src/components/PokemonBrowser.vue
    - 显示宝可梦网格列表，包含缩略图和编号
    - 实现形态选择下拉框
    - 显示加载进度指示器
    - 触发 select 事件通知父组件
    - _需求: 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [x] 12.2 更新 src/components/ThreeViewer.vue
    - 集成 useModelLoader composable
    - 接收 modelPath prop 并加载对应模型
    - 实现模型添加到场景和摄像机自动定位
    - _需求: 5.1, 5.2, 5.3_
  
  - [x] 12.3 更新 src/App.vue
    - 集成 PokemonBrowser 和 ThreeViewer 组件
    - 管理选中的宝可梦和形态状态
    - 实现组件间通信
    - _需求: 6.3, 6.5_

- [x] 13. 实现错误处理 UI
  - [x] 13.1 创建 src/components/ErrorDisplay.vue
    - 显示友好的错误提示信息
    - 提供重试按钮
    - _需求: 8.1, 8.2, 8.4_
  
  - [x] 13.2 集成错误处理到各组件
    - 在 ThreeViewer 中显示模型加载错误
    - 在 PokemonBrowser 中显示列表加载错误
    - 控制台记录详细错误信息
    - _需求: 8.3, 8.5_

- [x] 14. 最终检查点 - 确保所有功能正常
  - 运行所有测试确保通过
  - 手动测试模型加载和浏览功能
  - 如有问题请询问用户

## 备注

- 标记 `*` 的任务为可选任务，可跳过以加快 MVP 开发
- 每个任务都引用了具体的需求以确保可追溯性
- 检查点任务用于确保增量验证
- 属性测试验证通用正确性属性
