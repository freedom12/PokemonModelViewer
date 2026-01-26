# 设计文档

## 概述

本设计文档描述宝可梦模型浏览器的技术架构和实现方案。系统采用 Vue 3 + TypeScript + Three.js 技术栈，通过 FlatBuffers 解析宝可梦模型文件，并在 WebGL 中渲染 3D 模型。

## 架构

系统采用分层架构，分为以下几个主要层次：

```
┌─────────────────────────────────────────────────────────┐
│                    UI 层 (Vue Components)                │
│  ┌─────────────────┐  ┌─────────────────────────────┐   │
│  │ PokemonBrowser  │  │      ModelViewer            │   │
│  │ - 宝可梦列表     │  │  - 3D 渲染画布              │   │
│  │ - 形态选择器     │  │  - 交互控制                 │   │
│  └─────────────────┘  └─────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│                  业务逻辑层 (Composables)                │
│  ┌─────────────────┐  ┌─────────────────────────────┐   │
│  │ usePokemonList  │  │    useModelLoader           │   │
│  │ - 目录扫描       │  │  - 模型加载协调             │   │
│  │ - 形态管理       │  │  - 加载状态管理             │   │
│  └─────────────────┘  └─────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│                    数据处理层 (Services)                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │ FlatBuffers  │ │ MeshConverter│ │TextureLoader │    │
│  │   Parser     │ │              │ │              │    │
│  └──────────────┘ └──────────────┘ └──────────────┘    │
├─────────────────────────────────────────────────────────┤
│                    渲染层 (Three.js)                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Scene / Camera / Renderer / OrbitControls      │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 组件和接口

### 1. FlatBuffers 解析器 (src/parsers/)

使用 flatc 工具从 schema 生成的 TypeScript 代码，负责解析二进制模型文件。


```typescript
// src/parsers/index.ts - 解析器统一导出
export { TRMDL } from './generated/trmdl'
export { TRMSH } from './generated/trmsh'
export { TRMBF } from './generated/trmbf'
export { TRMTR } from './generated/trmtr'
export { TRMMT } from './generated/trmmt'

// 解析函数接口
interface ParseResult<T> {
  success: boolean
  data?: T
  error?: string
}

function parseModelFile<T>(buffer: ArrayBuffer, parser: (bb: ByteBuffer) => T): ParseResult<T>
```

### 2. 模型数据类型

模型数据类型分为两部分：

#### 2.1 FlatBuffers 生成类型 (src/parsers/generated/)

使用 `flatc --ts` 命令从 schema 文件自动生成 TypeScript 类型和解析代码：

```bash
# 生成命令示例
flatc --ts -o src/parsers/generated tools/scheme/model/trmdl.fbs
flatc --ts -o src/parsers/generated tools/scheme/model/trmsh.fbs
flatc --ts -o src/parsers/generated tools/scheme/model/trmbf.fbs
flatc --ts -o src/parsers/generated tools/scheme/model/trmtr.fbs
flatc --ts -o src/parsers/generated tools/scheme/model/trmmt.fbs
```

生成的类型将直接映射 schema 定义，包括：
- `TRMDL`, `trmeshes`, `trskeleton`, `Lod`, `Bounds` 等
- `TRMSH`, `MeshShape`, `VertexAccessor`, `MaterialInfo` 等
- `TRMBF`, `Buffer`, `Vertices`, `Indexes` 等
- `TRMTR`, `Material`, `Texture`, `Shader` 等
- `TRMMT`, `MMT`, `MaterialMapper` 等

#### 2.2 应用层类型 (src/types/model.ts)

用于 Three.js 渲染的转换后数据结构：

```typescript
// Three.js 渲染用的几何数据
interface ThreeGeometryData {
  positions: Float32Array       // 顶点位置
  normals: Float32Array         // 法线
  uvs: Float32Array             // UV 坐标
  indices: Uint16Array | Uint32Array  // 索引
}

// 纹理引用
interface TextureReference {
  type: 'albedo' | 'normal' | 'emission' | 'ao' | 'mask'
  filename: string
}

// 宝可梦条目（用于列表显示）
interface PokemonEntry {
  id: string              // 如 "pm0001"
  number: number          // 图鉴编号
  forms: FormEntry[]      // 形态列表
  thumbnail: string       // 缩略图路径
}

interface FormEntry {
  id: string              // 如 "pm0001_00_00"
  formIndex: number       // 形态索引
  variantIndex: number    // 变体索引
  thumbnail: string       // 缩略图路径
}
```

```

### 3. 网格转换器 (src/services/meshConverter.ts)

```typescript
import type { MeshShape, VertexAccessor, Buffer } from '@/parsers/generated/trmsh'
import type { PolygonType } from '@/parsers/generated/trmsh'

// 将 FlatBuffers 解析后的数据转换为 Three.js 格式
interface MeshConverterService {
  // 从 TRMSH 和 TRMBF 数据创建几何体
  createGeometry(
    meshShape: MeshShape,
    buffer: Buffer
  ): THREE.BufferGeometry

  // 解析顶点属性
  parseVertexAttribute(
    buffer: Uint8Array,
    accessor: VertexAccessor,
    vertexCount: number
  ): Float32Array

  // 解析索引数据
  parseIndices(
    buffer: Uint8Array,
    polygonType: PolygonType,
    count: number
  ): Uint16Array | Uint32Array
}
```


### 4. 纹理加载器 (src/services/textureLoader.ts)

```typescript
interface TextureLoaderService {
  // 加载单个纹理
  loadTexture(path: string): Promise<THREE.Texture>

  // 从材质数据创建 Three.js 材质
  createMaterial(
    materialData: MaterialData,
    basePath: string
  ): Promise<THREE.MeshStandardMaterial>

  // 批量加载纹理
  loadTextures(
    textures: TextureReference[],
    basePath: string
  ): Promise<Map<string, THREE.Texture>>
}
```

### 5. 模型加载器 Composable (src/composables/useModelLoader.ts)

```typescript
interface UseModelLoaderReturn {
  // 状态
  loading: Ref<boolean>
  progress: Ref<number>
  error: Ref<string | null>
  currentModel: Ref<THREE.Group | null>

  // 方法
  loadModel(pokemonId: string, formId: string): Promise<void>
  disposeModel(): void
}

function useModelLoader(): UseModelLoaderReturn
```

### 6. 宝可梦列表 Composable (src/composables/usePokemonList.ts)

```typescript
interface PokemonEntry {
  id: string              // 如 "pm0001"
  number: number          // 图鉴编号
  forms: FormEntry[]      // 形态列表
  thumbnail: string       // 缩略图路径
}

interface FormEntry {
  id: string              // 如 "pm0001_00_00"
  formIndex: number       // 形态索引
  variantIndex: number    // 变体索引
  thumbnail: string       // 缩略图路径
}

interface UsePokemonListReturn {
  pokemons: Ref<PokemonEntry[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  
  loadPokemonList(): Promise<void>
  getPokemonForms(pokemonId: string): FormEntry[]
}

function usePokemonList(): UsePokemonListReturn
```


### 7. Vue 组件

#### PokemonBrowser.vue
```vue
<script setup lang="ts">
// 宝可梦浏览器组件
// - 显示宝可梦网格列表
// - 形态选择下拉框
// - 加载状态指示

const props = defineProps<{
  selectedPokemon: string | null
}>()

const emit = defineEmits<{
  select: [pokemonId: string, formId: string]
}>()
</script>
```

#### ModelViewer.vue (更新现有组件)
```vue
<script setup lang="ts">
// 3D 模型查看器组件
// - 接收模型数据并渲染
// - 管理 Three.js 场景
// - 处理用户交互

const props = defineProps<{
  modelPath: string | null
}>()
</script>
```

## 数据模型

### 顶点属性类型映射

根据 TRMSH schema 中的 Type 枚举，定义顶点数据类型映射：

| Type 枚举值 | 字节大小 | TypedArray | 用途 |
|------------|---------|------------|------|
| RGBA_8_UNORM (20) | 4 | Uint8Array | 顶点颜色 |
| RGBA_8_UNSIGNED (22) | 4 | Uint8Array | 骨骼索引 |
| RGBA_16_UNORM (39) | 8 | Uint16Array | UV 坐标 |
| RGBA_16_FLOAT (43) | 8 | Float16Array | 切线/副法线 |
| RG_32_FLOAT (48) | 8 | Float32Array | UV 坐标 |
| RGB_32_FLOAT (51) | 12 | Float32Array | 位置/法线 |
| RGBA_32_FLOAT (54) | 16 | Float32Array | 切线 |

### 纹理类型映射

根据文件名后缀识别纹理类型：

| 后缀 | 纹理类型 | Three.js 属性 |
|-----|---------|--------------|
| _alb | Albedo/Diffuse | map |
| _nrm | Normal | normalMap |
| _lym | Emission/Luminance | emissiveMap |
| _ao | Ambient Occlusion | aoMap |
| _msk | Mask | alphaMap |
| _rgn | Region | 自定义 |


### 目录结构解析规则

```
public/pokemon/
├── pm{XXXX}/                    # 宝可梦类型目录 (XXXX = 4位编号)
│   ├── pm{XXXX}_{YY}_{ZZ}/      # 形态目录 (YY=形态, ZZ=变体)
│   │   ├── pm{XXXX}_{YY}_{ZZ}.trmdl    # 模型定义
│   │   ├── pm{XXXX}_{YY}_{ZZ}.trmsh    # 网格数据
│   │   ├── pm{XXXX}_{YY}_{ZZ}.trmbf    # 缓冲区数据
│   │   ├── pm{XXXX}_{YY}_{ZZ}.trmtr    # 材质属性
│   │   ├── pm{XXXX}_{YY}_{ZZ}.trmmt    # 材质映射
│   │   ├── pm{XXXX}_{YY}_{ZZ}_00.png   # 缩略图
│   │   └── pm{XXXX}_{YY}_{ZZ}_*.png    # 纹理贴图
```

## 正确性属性

*正确性属性是一种应该在系统所有有效执行中保持为真的特征或行为——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*


### Property 1: FlatBuffers 解析往返一致性

*对于任意*有效的 FlatBuffers 模型数据（TRMDL、TRMSH、TRMBF、TRMTR、TRMMT），解析后重新序列化应产生等价的数据结构。

**验证: 需求 1.2, 1.3, 1.4, 1.5, 1.6**

### Property 2: 顶点数据解析正确性

*对于任意*有效的顶点缓冲区数据和顶点属性描述，解析后的顶点数组长度应等于 `顶点数 × 分量数`（位置为3，UV为2），且数据类型应与属性描述匹配。

**验证: 需求 3.1, 3.2, 3.3**

### Property 3: 法线向量归一化

*对于任意*解析后的法线数据，每个法线向量的长度应接近 1.0（允许浮点误差 ±0.001）。

**验证: 需求 3.2**

### Property 4: 索引数据有效性

*对于任意*有效的索引缓冲区数据，所有索引值应小于对应的顶点数量。

**验证: 需求 3.5**

### Property 5: 子网格数量一致性

*对于任意*包含 N 个子网格定义的模型数据，转换后应创建恰好 N 个几何体组。

**验证: 需求 3.6**

### Property 6: 纹理类型映射正确性

*对于任意*纹理文件名，根据后缀（_alb、_nrm、_lym、_ao、_msk）应正确映射到对应的 Three.js 材质属性（map、normalMap、emissiveMap、aoMap、alphaMap）。

**验证: 需求 4.3, 4.4, 4.5**

### Property 7: 摄像机距离计算

*对于任意*模型包围盒，计算的摄像机距离应使整个模型在视锥体内可见，即 `distance >= max(width, height, depth) / (2 * tan(fov/2))`。

**验证: 需求 5.2**

### Property 8: 目录名解析正确性

*对于任意*符合 `pm{XXXX}_{YY}_{ZZ}` 格式的目录名，解析函数应正确提取宝可梦编号（XXXX）、形态编号（YY）和变体编号（ZZ）。

**验证: 需求 7.1, 7.2, 7.3**

### Property 9: 缩略图路径生成

*对于任意*宝可梦形态 ID，生成的缩略图路径应符合 `pokemon/{pokemonId}/{formId}/{formId}_00.png` 格式。

**验证: 需求 7.4**


## 错误处理

### 解析错误

| 错误类型 | 处理方式 | 用户提示 |
|---------|---------|---------|
| 文件不存在 | 抛出 FileNotFoundError | "模型文件未找到: {path}" |
| FlatBuffers 格式错误 | 抛出 ParseError | "模型文件格式错误: {details}" |
| 数据类型不匹配 | 抛出 TypeError | "数据类型不匹配: 期望 {expected}, 实际 {actual}" |

### 加载错误

| 错误类型 | 处理方式 | 用户提示 |
|---------|---------|---------|
| 网络请求失败 | 重试3次后显示错误 | "加载失败，请检查网络连接" |
| 纹理加载失败 | 使用默认材质继续 | 控制台警告 |
| 内存不足 | 释放旧模型后重试 | "内存不足，请刷新页面" |

### 错误恢复策略

```typescript
interface ErrorRecovery {
  // 纹理加载失败时的降级策略
  onTextureLoadFailed(texturePath: string): THREE.Material

  // 模型加载失败时的重试策略
  onModelLoadFailed(error: Error, retryCount: number): Promise<void>

  // 解析错误时的用户提示
  onParseError(error: Error): void
}
```

## 测试策略

### 单元测试

使用 Vitest 进行单元测试，覆盖以下模块：

1. **目录名解析器** - 测试各种格式的目录名解析
2. **纹理类型映射** - 测试文件名后缀到材质属性的映射
3. **顶点数据解析** - 测试不同数据类型的解析
4. **摄像机距离计算** - 测试包围盒到摄像机距离的计算

### 属性测试

使用 fast-check 进行属性测试，每个属性测试运行至少 100 次迭代：

1. **Property 1**: FlatBuffers 往返测试 - 生成随机模型数据结构
2. **Property 2-4**: 顶点数据测试 - 生成随机顶点缓冲区
3. **Property 5**: 子网格测试 - 生成随机数量的子网格
4. **Property 6**: 纹理映射测试 - 生成随机纹理文件名
5. **Property 7**: 摄像机测试 - 生成随机包围盒
6. **Property 8-9**: 目录解析测试 - 生成随机目录名

### 集成测试

1. **模型加载流程** - 测试完整的模型加载和渲染流程
2. **宝可梦列表加载** - 测试目录扫描和列表生成
3. **形态切换** - 测试不同形态之间的切换

### 测试配置

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['src/parsers/generated/**']
    }
  }
})
```
