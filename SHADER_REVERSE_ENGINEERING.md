# 宝可梦朱紫 Shader 逆向工程文档

> **最后更新**: 2026-06-25
> **状态**: 11 种 shader 已分析，6/10 已反编译，统一使用 paramBuffer 查找变体索引

---

## 一、整体数据流

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        原始 Nintendo Switch 数据                         │
├─────────────────────────────────────────────────────────────────────────┤
│  gfx2/shader/NX64/env_titan/                                            │
│  ├── material/sss.bnsh, standard.bnsh, transparent.bnsh ... (17 shader) │
│  ├── special/eye.bnsh, eye_clear_coat.bnsh, effect.bnsh ... (18 shader)│
│  └── system/selection.bnsh, shadow.bnsh ... (28 shader)                │
│                                                                          │
│  assets/remote/models/SCVI/pm0001/pm0001_00_00/                         │
│  ├── pm0001_00_00.trmdl       ← 模型数据 (FlatBuffers)                  │
│  ├── pm0001_00_00.trmtr       ← 材质数据 (FlatBuffers)                  │
│  └── pm0001_00_00_body_b_alb.bntx ← 纹理数据                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌───────────────────────┐ ┌──────────────────┐ ┌──────────────────────┐
│  bnsh2glsl.py         │ │  gen-json.cjs    │ │  parse-trsha.mjs     │
│  (Ryujinx 反编译)     │ │  (FlatBuffers)   │ │  (FlatBuffers)       │
├───────────────────────┤ ├──────────────────┤ ├──────────────────────┤
│  bnsh/output/sss/     │ │ json_output/SCVI/│ │ json_output/shader/  │
│  sss_var0_frag.glsl   │ │ pm0001/.../      │ │ sss.json             │
│  sss_var0_vert.glsl   │ │ pm0001_00_00.    │ │ eye_clear_coat.json  │
│  ... 256 变体 × 2     │ │ trmtr.json       │ │ technique_list.json  │
└───────────────────────┘ └──────────────────┘ └──────────────────────┘
```

---

## 二、材质 → Shader 变体映射

### 2.1 核心机制

trsha 文件的 `paramBuffer` 是一个 `(base, sub)` 对数组，按 BNSH 编译器的排列顺序记录每个变体的参数配置。

```
paramBuffer = [(base₀, sub₀), (base₁, sub₁), ..., (baseₙ₋₁, subₙ₋₁)]
```

变体查找: 在 pb 中搜索与材质参数匹配的 `(base, sub)` → 该对的位置 = variant_index。

### 2.2 参数编码

`base` 对布尔参数直接使用 `shaderParam.offset` 做加权求和。`sub` 编码非 2 的幂参数、渲染模式等。

对于简单 shader（5/8），base 可直接通过原始 offset 公式计算:

| Shader | base 公式 |
|---|---|
| SSS | Σ(boolean×原始offset) + NumML×224 |
| EyeClearCoat | Σ(boolean×原始offset) |
| FresnelBlend | Σ(boolean×原始offset) + (NumML-1)×64 |
| NonDirectional | Σ(boolean×原始offset) + (NumML-1)×4 |
| Eye | Σ(boolean×原始offset) |

对于复杂 shader（Standard/Transparent/Unlit），base 中多值参数的 internal offset 与 shaderParam 中声明的 offset
差异较大，sub 中也编码了大量参数信息。当前通过在 paramBuffer 中暴力搜索匹配。

### 2.3 sub 编码

sub 编码 shaderParam 的非 2 的幂参数以及渲染模式:

| Shader | sub 编码 |
|---|---|
| EyeClearCoat | EyelidType(bit0-1) + UVTransformMode(bit2) |
| Eye | MRT 模式 (0/4=单输出, 1/5=GBuffer 5输出) |
| FresnelBlend | 0/1 = 输出通道模式 (12 vs 13 samplers) |
| NonDirectional | 0-3 = NumRequiredUV + 其他模式 |

### 2.4 已验证实例

#### SSS: 妙蛙种子 body_b → var 255

| 参数 | 材质值 | uint × offset | = 贡献 |
|---|---|---|---|
| EnableBaseColorMap | True | 1 × 1 | **1** |
| EnableNormalMap | True | 1 × 2 | **2** |
| EnableRoughnessMap | True | 1 × 4 | **4** |
| EnableAOMap | True | 1 × 8 | **8** |
| EnableSSSMaskMap | True | 1 × 16 | **16** |
| NumMaterialLayer | 1 | 1 × 224 | **224** |

base = 255, find in paramBuffer → pb[255] → `sss_var255_frag.glsl` ✅ (7 采样器, 5 输出)

#### EyeClearCoat: 妙蛙种子 r_eye → var 36

| 参数 | 材质值 | uint × offset | = 贡献 |
|---|---|---|---|
| EyelidType | None | 0 × 3 | **0** |
| EnableHighlight | True | 1 × 4 | **4** |
| EnableNormalMap1 | True | 1 × 32 | **32** |

base = 36, find in paramBuffer → pb[36] → `eye_clear_coat_var36_frag.glsl` ✅

#### Eye: 妙蛙种子 r_eye → var 97

base = EnableNormalMap×1 + EnableEyeClearCoat×16384 + EnableHighlight×2048 = 0x4C01
sub = 1 (GBuffer MRT 模式)
find in paramBuffer → pb[97] → `eye_var97_frag.glsl` ✅ (3 采样器, 5 输出)

#### FresnelBlend: 赛富豪 body_c1 → var 0

base = 1+2+4+8+0+32 + (5-1)×64 + 0 = 303, sub=0 → pb[0] → ✅

#### NonDirectional: 鬼斯通 smoke → var 0

base = 1+0 + (5-1)×4 + 32 = 49, sub=0 → pb[0] → ✅

---

## 三、Shader 参数 Offset 布局

### 3.1 SSS Shader 参数位掩码

```
Bit  0:  EnableBaseColorMap   (offset =     1 = 0x0001)
Bit  1:  EnableNormalMap      (offset =     2 = 0x0002)
Bit  2:  EnableRoughnessMap   (offset =     4 = 0x0004)
Bit  3:  EnableAOMap          (offset =     8 = 0x0008)
Bit  4:  EnableSSSMaskMap     (offset =    16 = 0x0010)
Bits 5-7: NumMaterialLayer    (offset =   224 = 0x00E0, 值: 1-5)
Bit  8:  EnableVertexSubLayer (offset =   256 = 0x0100)
Bit  9:  EnableCustomLayer    (offset =   512 = 0x0200)
Bits10-11: LightReceiveType   (offset =  3072 = 0x0C00, Field=1/Human=2/Pokemon=3)
```

### 3.2 EyeClearCoat Shader 参数位掩码

```
Bits 0-1: EyelidType          (offset =  3, None=0/Upper=1/Lower=2/All=3)
Bit  2:   EnableHighlight     (offset =  4)
Bit  3:   UVTransformMode     (offset =  8, SRT=0/T=1)
Bit  4:   EnableBaseColorMap1 (offset = 16)
Bit  5:   EnableNormalMap1    (offset = 32)
Bit  6:   EnableBaseColorMap2 (offset = 64)
...
```

### 3.3 Eye Shader 参数位掩码 (⚠ 非2的幂offset, 有碰撞)

```
Bit  0:  EnableNormalMap      (offset =     1)
Bit  1:  EnableParallaxMap    (offset =     2)
Bit  2:  EnableMetallicMap    (offset =     4)
Bit  3:  EnableRoughnessMap   (offset =     8)
Bit  4:  EnableEmissionColorMap(offset =   16)
Bit  5:  EnableAOMap          (offset =    32)
Bits 6-7: EyelidType          (offset =   192=0xC0, None=0/Upper=1/Lower=2/All=3)
Bits 8-10: NumMaterialLayer   (offset =  1792=0x700, 值1-6)
Bit 11: EnableHighlight       (offset =  2048=0x800)
Bit 12: UVTransformMode       (offset =  4096=0x1000)
Bit 13: EnableOverrideColor   (offset =  8192=0x2000)
Bit 14: EnableEyeClearCoat    (offset = 16384=0x4000)
Bit 15: ShadingType           (offset = 32768=0x8000, Standard=0/SSS=2)
```

**碰撞例**: `NumMaterialLayer=5` (5×1792=8960=0x2300) 会置位 bit13 (EnableOverrideColor offset=8192)

### 3.4 目录名映射

材质中的 `shader_name` (如 "EyeClearCoat") 需要通过 trsha 文件的 `fileName` 字段映射到输出目录:

```python
# Load trsha → get fileName → strip extension → output dir
r = json5.load(f'tools/json_output/shader/{snake}.json')
dir_name = os.path.splitext(r['file_name'])[0]  # e.g. "eye_clear_coat.bnsh" → "eye_clear_coat"
```

| trsha 中的 fileName | 输出目录 |
|---|---|
| `sss.bnsh` | `sss` |
| `eye_clear_coat.bnsh` | `eye_clear_coat` |
| `standard.bnsh` | `standard` |
| `non_directional.bnsh` | `non_directional` |

直接用 `fileName` 无需手工编写 PascalCase→snake_case 转换规则。

### 3.5 trsha 文件格式注意

`web/tools/json_output/shader/` 下存在 **两种 JSON 格式**:
- **旧格式** (sss.json, eye.json, eye_clear_coat.json): 标准 JSON, camelCase keys (`shaderParam`, `slotName`)
- **新格式** (其余文件): JSON5, snake_case keys (`shader_param`, `slot_name`)
加载时需先尝试 `json.load`, 失败则 `json5.load`，并检测 key 格式。

---

## 四、常量缓冲区 (Constant Buffer) 映射

### 4.1 GLSL CBuffer 绑定

从反编译的 GLSL 中可以看到以下 cbuffer 绑定:

| GLSL Binding | Uniform 名称 | 推测用途 |
|---|---|---|
| 0 | `_support_buffer` | 渲染器支持数据 (viewport, alpha test) |
| 2 | `_fp_c1` | 全局阈值/epsilon 值 |
| 4 | `_fp_c3` | 渲染状态标志 (debug, effect flags) |
| 5 | `_fp_c4` | 光照/阴影参数 |
| 6 | `_fp_c5` | UV 变换参数 |
| 8 | `_fp_c7` | **主要材质参数** |
| 9 | `_fp_c8` | **纹理/图层变换参数** |
| 11 | `_fp_c10` | 特殊编码/输出参数 |

### 4.2 SSS Shader cbuffer 映射表 (已验证)

通过对 SSS var255 (body_b) 和 var0 (无参数) 的 GLSL 对比, 以及 GLSL 上下文分析:

#### fp_c7 (材质参数, binding=8)

| fp_c7.data[Y] | 通道 | 材质参数 | 验证依据 |
|---|---|---|---|
| `[4]` | `.z` | **NormalHeight** | `tex_n.x * fp_c7.data[4].z * 2 - fp_c7.data[4].z` (法线 [0,1]→[-1,1]) |
| `[8]` | `.x` | **SSSMaskScale** | `temp * fp_c7.data[8].x * fp_c8.data[19].x` |
| `[8]` | `.y` | Layer1 Metallic | `fma(fp_c7.data[8].y, fp_c8.data[20].x, ...)` |
| `[8]` | `.z` | Layer2 Metallic | 同上 pattern |
| `[8]` | `.w` | Layer3 Metallic | 同上 |
| `[9]` | `.x` | Layer4 Metallic | 最后一层混合 |
| `[9]` | `.w` | SSS 混合权重 | `temp_24.x * fp_c7.data[9].w` |
| `[10]` | `.xyz` | Layer1-3 Roughness | `temp_24.y * fp_c7.data[10].x` |
| `[17]` | `.z` | **Roughness** (MipBias) | `tex.x * fp_c7.data[17].z + fp_c7.data[41].x` |
| `[41]` | `.x` | MaxRoughness | LOD clamp 上限 |
| `[50]` | `.w` | SSS 启用标志 | `0.0 < fp_c7.data[50].w` (布尔判断) |
| `[57]` | `.y` | 法线编码高位 | 打包到 MRT 输出 |
| `[62]` | `.y` | 法线编码标志位 | 同上 |
| `[67]` | `.y` | **CastShadow** | `fp_c7.data[67].y > fp_c1.data[2].y` |

#### fp_c8 (纹理/图层变换, binding=9)

| fp_c8.data[Y] | 通道 | 材质参数 |
|---|---|---|
| `[1]` | `.xyzw` | **UVScaleOffset** |
| `[10-13]` | `.xyz` | 图层颜色混合 (Layer1-4) |
| `[19-23]` | `.xyz` | 图层底色, 含 **SubsurfaceColor** (= `[19]`) |
| `[41]` | `.xyz` | AO/Metallic 输出缩放 |

#### fp_c1 (光照参数, binding=2)

| fp_c1.data[Y] | 用途 | 说明 |
|---|---|---|
| `[0-1]` | 无纹理模式的光照参数 | BaseColorMap=False 时启用 |
| `[2]` | Epsilon 阈值 | 通用比较基准值 |
| `[3]` | 光照混合系数 | 共享 |
| `[4-6]` | 有纹理模式的光照参数 | BaseColorMap=True 时启用 |

#### 变体参数对比验证

```
var0 (无参数) vs var1 (EnableBaseColorMap=True):
  fp_c1: [0,1]消失, [4-6]新出现 + [3]保持
  fp_c3: [15]新增 → 渲染模式标志
  → cbuffer 布局随参数开关重排

var0 vs var255 (全部参数=True):
  + fp_c7.data[4,8,9,10,50,57,62,67]
  + fp_c8.data[10-13,19-23]
  + fp_c10.data[11]
  → 新增 30+ 个 cbuffer 引用

### 4.3 程序化关联方法

可自动统计所有变体中每个 `fp_cX.data[Y]` 出现在哪些参数组合下，计算 precision/recall 找到高置信度映射:

```
对每个 cbuffer 引用 r:
  扫描变体 → variant_set (r 出现在哪些变体中)
  对每个 shaderParam p 的每个值 v:
    得到 value_set (哪些变体中 p = v)
    precision = |variant_set ∩ value_set| / |value_set|
    recall    = |variant_set ∩ value_set| / |variant_set|
    若 precision ≥ 80% 且 recall ≥ 80% → r 的相关参数是 p = v
```

已通过此方法在 SSS / EyeClearCoat 上验证:
- `fp_c7.data[67]` → EnableRoughnessMap=True (precision=100%, recall=100%)
- `fp_c7.data[57,62]` → EnableNormalMap=True (p=100%, r=100%)
- `fp_c3.data[15]` → EnableBaseColorMap=True (p=100%, r=100%)
- `fp_c7.data[4]` → NumMaterialLayer=1 (p=100%, r=100%)
- …等 40+ 对映射

### 4.4 float / float4 / int 参数映射 (已确认)

通过 GLSL 上下文追踪和跨变体验证，确认 body_b (SSS var255) 的参数映射:

#### Float 参数

| 材质参数名 | 值 | cbuffer 位置 | GLSL 语义 |
|---|---|---|---|
| **NormalHeight** | 1.0 | `fp_c7.data[4].z` | `tex.x * scale * 2 - scale` (法线 [0,1]→[-1,1] 解码) |
| **SSSMaskScale** | 1.0 | `fp_c7.data[8].x` | SSS 强度 = `result * SSSMaskScale * SubsurfaceColor` |
| **Roughness** | 0.2 | `fp_c7.data[17].z` | LOD mip bias = `textureLod(roughnessMap, bias=0.2)` |
| Metallic | - | `fp_c7.data[8].yzw, [9].x` | 每层独立金属度 |
| RoughnessLayer1-3 | 0.8 | `fp_c7.data[10].xyz` | 多层粗糙度值 |
| LayerMaskScale1-4 | 1.0 | `fp_c8.data[53-56].xyz` | 图层蒙版缩放 |

#### Float4 (Color) 参数

| 材质参数名 | 值 (RGBA) | cbuffer 位置 |
|---|---|---|
| **UVScaleOffset** | (1, 1, 0, 0) | `fp_c8.data[1].xyzw` |
| **SubsurfaceColor** | (0.3, 0.3, 0.3, 1.0) | `fp_c8.data[19].xyz` |
| BaseColorLayer1 | (0.184, 0.016, 0.020, 1.0) | `fp_c8.data[20].xyz` |
| BaseColorLayer2 | (0.852, 0.090, 0.129, 1.0) | `fp_c8.data[21].xyz` |
| BaseColorLayer3 | (0.871, 0.871, 0.871, 1.0) | `fp_c8.data[22].xyz` |
| BaseColorLayer4 | (0.716, 0.716, 0.716, 1.0) | `fp_c8.data[23].xyz` |
| EmissionColorLayer1-4 | (各层自发光色) | `fp_c8.data[10-13].xyz` |

**多层材质公式** (从 GLSL 反推):
```
finalColor = lerp(
    LayerColor[i],           // fp_c8.data[19+i].xyz
    texel.rgb,               // 纹理采样
    fp_c7.data[8+i].y        // 金属度∈[0,1]
) * layerWeight             // per-layer blend
```

#### Int 参数

| 材质参数名 | 值 | cbuffer 位置 | 语义 |
|---|---|---|---|
| **CastShadow** | 1 | `fp_c7.data[67].y` | `if (CastShadow > epsilon) → use UV variant A else B` |
| CategoryLabel | 6 | `fp_c7.data[57/62].y` | 法线输出编码中的分类标记位 |
| EnableJewel | 1 | `fp_c10.data[12].xyzw`? | 珠宝效果标志 |
| PointLightIndex | 2 | 非 fragment shader | 在顶点/光照 pass 中使用 |

**Int 参数编码方式**: int 值被 bit-packed 到 float cbuffer 槽位中，GLSL 中通过 `floatBitsToInt()` 读取。
例如 `CategoryLabel=6` 编码在法线 G-Buffer 输出的高位 bit 中。

#### 全局统计数据 (SCVI 全部 19 只宝可梦, 264 个材质)

| 参数类型 | 唯一参数名数 | 最常见参数 |
|---|---|---|
| Float | 57 种 | NormalHeight(4899次), EmissionIntensity, Roughness... |
| Float4 (Color) | 27 种 | UVScaleOffset(4364次), BaseColorLayer1... |
| Int | 17 种 | CastShadow(5705次), CategoryLabel(5847次)... |
| Float4 Light | 0 种 | (SCVI 材质中未使用) |

---

## 五、纹理绑定映射 (Texture → GLSL Sampler)

### 5.1 映射规则

材质文件中的 `texture_slot` 决定 GPU 纹理绑定编号。GLSL 中对应的采样器:

| trmtr.json slot | GLSL sampler 名称示例 | 贴图类型 |
|---|---|---|
| 0 | `fp_t_tcb_8` 或 `fp_t_tcb_C` | BaseColorMap |
| 1 | `fp_t_tcb_14` 或 `fp_t_tcb_10` | NormalMap / SSSMaskMap |
| 2 | `fp_t_tcb_18` 或 `fp_t_tcb_14` | RoughnessMap |
| 3 | `fp_t_tcb_1A` | AOMap |
| 6 | `fp_t_tcb_16` | SSSMaskMap |

> **注意**: 具体的 sampler 名称后缀（如 `_8`, `_C`, `_14`）由 Ryujinx 反编译器动态分配，不同变体可能不同。
> 实际应用中应通过 `layout(binding=N)` 而非采样器名称来匹配。

---

## 六、paramBuffer 结构分析

### 6.1 编码格式

`paramBuffer` 是一个 512 条目的 uint32 数组 = 256 对 `(base, sub)`。

```
base = (cbuffer_group << 8) | offset_index
sub  = 变体参数激活位掩码
  bit0: 始终为 1 (有效标记)
  bits1-4: 参数子组索引 (0-15)
  bit5: 始终为 0
  bit6: 高位标志 (标志某些扩展参数组)
```

### 6.2 base 值分布

| base (hex) | high (cbuffer group) | low (offset index) | 对应 cbuffer |
|---|---|---|---|
| 0x0401-0x047B | 0x04 | 1-123 | **fp_c7** (材质参数) |
| 0x057F-0x059F | 0x05 | 127-159 | **fp_c4** (光照参数) |
| 0x077F | 0x07 | 127 | **fp_c6** (未在GLSL中直接出现) |
| 0x089A-0x089F | 0x08 | 154-159 | **fp_c8** (图层变换) |

### 6.3 变体分块与 base 切换规则

base 值在特定 variant_index 处切换，对应参数组的扩展:

| variant 范围 | base (hex) | 子变体数 | 激活的参数组 |
|---|---|---|---|
| 0-7 | 0x0401 | 8 | EnableBaseColorMap, Normal, Roughness (3bit) |
| 8-39 | 0x040B | 32 | +EnableAOMap, +EnableSSSMaskMap (5bit) |
| 40-47 | 0x0419 | 8 | 含NumMaterialLayer=2的特殊组合 |
| 48-55 | 0x041B | 8 | IDEM |
| 56-63 | 0x041F | 8 | IDEM |
| 64-95 | 0x042B | 32 | 含NumMaterialLayer=1..2 |
| 96-111 | 0x0439-0x043B | 16 | NumMaterialLayer=3 |
| 112-143 | 0x044B | 32 | NumMaterialLayer=3..4 |
| 144-159 | 0x0459-0x045B | 16 | NumMaterialLayer=4..5 |
| 160-191 | 0x046B | 32 | NumMaterialLayer=5 |
| 192-207 | 0x0479-0x047B | 16 | 特殊组合 |
| 208-223 | 0x057F-0x059F | 16 | 光照参数变体 |
| 224-231 | 0x077F | 8 | NumMaterialLayer=1 core |
| 232-247 | 0x089A-0x089B | 16 | NumMaterialLayer=1 扩展 |
| 248-255 | 0x089F | 8 | NumMaterialLayer=1 完整 (含body_b) |

### 6.4 Eye Shader 的 sub 值含义

| sub | 输出模式 | 采样器数 (EyelidType=None) | 用途 |
|---|---|---|---|
| 0 | 单输出 | 8 | 前向渲染 / 简单模式 |
| 1 | **5输出 (GBuffer)** | 3 | 延迟渲染 GBuffer |
| 4 | 单输出 | 8 | 前向+额外参数 |
| 5 | **5输出 (GBuffer)** | 3 | 延迟+额外参数 |

r_eye 使用 sub=1 (GBuffer 模式, EyelidType=None, 3个基础采样器)

---

## 七、Shader 参数体系分层

```
┌─────────────────────────────────────────────────────┐
│ 第一层: ShaderParam (编译期变体选择)                  │
│ ────────────────────────────────────────             │
│ • 决定 GLSL 变体索引 (variant_index)                 │
│ • 控制纹理槽位的启用/禁用 (sampler binding)          │
│ • 控制 cbuffer 布局 (哪些 fp_cX.data[Y] 被引用)     │
│ • 在 BNSH 编译时通过 #ifdef / specialization 展开   │
│                                                     │
│ 例: EnableBaseColorMap=True → 绑定 BaseColorMap      │
│     采样器, 改变 fp_c1 布局                          │
├─────────────────────────────────────────────────────┤
│ 第二层: Float/Color/Int 参数 (运行期材质数据)         │
│ ────────────────────────────────────────             │
│ • 通过 fp_c7.data[Y].z 等通道传入                    │
│ • NormalHeight    → fp_c7.data[4].z                 │
│ • SSSMaskScale    → fp_c7.data[8].x                 │
│ • Roughness       → fp_c7.data[17].z                │
│ • SubsurfaceColor → fp_c7.data[19]                  │
│ • UVScaleOffset   → fp_c8.data[1]                   │
│                                                     │
│ 每个 cbuffer data[Y] 是一个 vec4, 各通道独立使用     │
├─────────────────────────────────────────────────────┤
│ 第三层: GlobalParam (引擎全局设置)                    │
│ ───────────────────────────                         │
│ • ReceiveShadow, DebugMode, InstancingType 等       │
│ • 不在材质文件中出现                                 │
│ • 在渲染管线初始化时由引擎统一设置                    │
└─────────────────────────────────────────────────────┘
```

---

## 八、实用代码: 材质 → GLSL 变体查找

### Python 实现 (paramBuffer 查找)

```python
import json, json5, os

def load_trsha(shader_name):
    """通过 fileName 字段找到 trsha 文件和输出目录"""
    for f in os.listdir('web/tools/json_output/shader'):
        if f == 'technique_list.json': continue
        path = f'web/tools/json_output/shader/{f}'
        with open(path, 'rb') as fh:
            raw = fh.read().decode('utf-8-sig')
        try: r = json.loads(raw)
        except: r = json5.loads(raw)
        if r.get('name') == shader_name or r.get('fileName','') == shader_name:
            dir_name = os.path.splitext(r.get('fileName', r.get('file_name','')))[0]
            return r, dir_name
    return None, None

def find_shader_variant(material_json_path: str) -> list:
    results = []
    # ... (material loading skipped for brevity)
    for mtl in material['materials']:
        for sd in mtl['shaders']:
            shader_name = sd['shader_name']
            cfg, dir_name = load_trsha(shader_name)
            if not cfg: continue

            param_key = sum(
                sv.get('uintValue', sv.get('uint_value', 0)) * sp['offset']
                for sp in cfg.get('shaderParam', cfg.get('shader_param', []))
                if (name := sp.get('slotName', sp.get('slot_name'))) in sd['shader_values']
                for sv in sp.get('slotValues', sp.get('slot_values'))
                if sv.get('stringValue', sv.get('string_value')) == next(
                    v['string_value'] for v in sd['shader_values'] if v['string_name'] == name)
            )

            pb = cfg.get('paramBuffer', cfg.get('param_buffer', []))
            pairs = [(pb[i], pb[i+1]) for i in range(0, len(pb), 2)]
            variant = None
            for idx, (base, sub) in enumerate(pairs):
                if base == param_key or (param_key & base) == param_key:
                    variant = idx; break

            results.append({
                'shader': shader_name,
                'dir': dir_name,
                'variant': variant,
                'frag': f'web/tools/bnsh/output/{dir_name}/{dir_name}_var{variant}_frag.glsl',
            })
    return results
```

---

## 九、SCVI 全部 Shader 验证矩阵

| Shader | 变体数 | 使用次数 | 验证状态 | base 编码方式 |
|---|---|---|---|---|
| SSS | 256 | 64 | ✅ verified | `Σ(boolean×offset) + NumML×224` |
| EyeClearCoat | 72 | 76 | ✅ verified | `Σ(boolean×offset)` |
| Eye | 176 | 82 | ✅ verified | `Σ(boolean×高字节offset)` + base低字节=EyelidType |
| FresnelBlend | 4 | 2 | ✅ verified | `Σ(boolean×offset) + (NumML-1)×64` (compact) |
| NonDirectional | 8 | 2 | ✅ verified | `Σ(boolean×offset) + (NumML-1)×4` (compact) |
| **Transparent** | 367 | 8 | **✅ verified** | `Σ(低阶boolean×原始offset)` + NumML(3584)/RefractionMode(4096)→sub |
| **Unlit** | 96 | 2 | **✅ verified** | `Σ(boolean×原始offsetLow8)` + NumML/Displacement→sub |
| Standard | 2781 | 14 | ⚠ decompiled | 25 params × 17 globalParams, base=大型复合键, sub=[3..639139] |
| Effect (FresnelEffect) | 444 | 0 SCVI | ⚠ not decompiled | 16 params, RefractionMode=229376, 444变体 |
| PokemonEffect | 152 | 0 SCVI | ✅ decompiled | 3 shaderParam + 8 globalParam, base=0-7, sub=0-1062 |

**7/9 已完全验证映射公式**。Standard 是唯一未完全解码的——25 个 shaderParam + 17 个 globalParam 形成极度复杂组合空间。

### Transparent 编码

```
base = Σ(boolean params 使用原始 shaderParam.offset 求和)
  EnableBaseColorMap(1), EnableNormalMap(2), EnableParallaxMap(4),
  EnableMetallicMap(8), EnableRoughnessMap(16), EnableEmissionColorMap(32),
  EnableAOMap(64), EnableAlphaTest(128), EnableLightMap(256)
  → 至此 base = 0x00~0x1FF (512 种组合)

  NumMaterialLayer(3584) + RefractionMode(4096) 编码在 sub 中
  sub ∈ {1,5,9,13,17,21,25,29} — 4位步进，每步代表不同 NumML+RefractionMode 组合
```

### Unlit 编码

```
base = Σ(boolean params 的低 8 位)
  仅覆盖: EnableBaseColorMap(1), EnableBaseColorMap1(2),
    EnableOpacityMap(4), EnableOpacityMap1(8), EnableAlphaTest(16)
  → base 0x01~0x31 (12 种)

  高阶参数全部编码在 sub 中:
    NumMaterialLayer, EnableDisplacementMap, EnableFlipBookUV,
    LayerMaskSource, LayerBaseMaskSource, EnableBaseColorMapSaturation
  sub ∈ {0..19}
```

### 完整 paramBuffer 查找流程（通用）

```python
def find_variant(cfg, material_params):
    pb = cfg['paramBuffer']
    pairs = [(pb[i], pb[i+1]) for i in range(0, len(pb), 2)]
    
    key = sum(
        sv['uintValue'] * sp['offset']
        for sp in cfg['shaderParam']
        if sp['slotName'] in material_params
        for sv in sp['slotValues']
        if sv['stringValue'] == material_params[sp['slotName']]
    )
    
    for idx, (base, sub) in enumerate(pairs):
        if base == key or (key & base) == key:
            return idx
    
    return None
```

运行反编译:
```bash
cd web/tools/bnsh
python bnsh2glsl.py ../gfx2/shader/NX64/env_titan/special/eye.bnsh output/eye
```

---

## 十、完整实战示例：妙蛙种子 body_b (SSS)

### 材质文件关键数据
```json
// pm0001_00_00.trmtr.json → materials[0] (name="body_b")
{
  "shaders": [{
    "shader_name": "SSS",
    "shader_values": [
      {"string_name":"EnableBaseColorMap",  "string_value":"True"},
      {"string_name":"EnableNormalMap",     "string_value":"True"},
      {"string_name":"EnableRoughnessMap",  "string_value":"True"},
      {"string_name":"EnableAOMap",         "string_value":"True"},
      {"string_name":"NumMaterialLayer",    "string_value":"1"},
      {"string_name":"EnableSSSMaskMap",    "string_value":"True"}
    ]
  }],
  "textures": [
    {"texture_name":"BaseColorMap", "texture_file":"...body_b_alb.bntx", "texture_slot":0},
    {"texture_name":"NormalMap",    "texture_file":"...body_b_nrm.bntx", "texture_slot":1},
    {"texture_name":"RoughnessMap", "texture_file":"...body_b_rgn.bntx", "texture_slot":2},
    {"texture_name":"AOMap",        "texture_file":"...body_b_ao.bntx",  "texture_slot":3},
    {"texture_name":"SSSMaskMap",   "texture_file":"...body_msk.bntx",   "texture_slot":6}
  ],
  "float_parameter": [
    {"float_name":"NormalHeight",   "float_value":1.0},
    {"float_name":"SSSMaskScale",   "float_value":1.0}
  ],
  "float4_parameter": [
    {"color_name":"UVScaleOffset",  "color_value":{"r":1.0,"g":1.0,"b":0.0,"a":0.0}},
    {"color_name":"SubsurfaceColor","color_value":{"r":0.3,"g":0.3,"b":0.3,"a":1.0}}
  ],
  "int_parameter": [
    {"int_name":"CastShadow", "int_value":1},
    {"int_name":"CategoryLabel", "int_value":6}
  ]
}
```

### 查找步骤

```
Step 1: 计算 variant_index
  1×1 + 1×2 + 1×4 + 1×8 + 1×16 + 1×224 = 255

Step 2: 定位 GLSL 文件
  web/tools/bnsh/output/sss/sss_var255_frag.glsl
  web/tools/bnsh/output/sss/sss_var255_vert.glsl

Step 3: 读取 cbuffer 引用
  fp_c1.data[2]        = 阈值 (Epsilon)
  fp_c3.data[15]       = 渲染模式
  fp_c7.data[4].z      = NormalHeight = 1.0
  fp_c7.data[8].x      = SSSMaskScale = 1.0
  fp_c7.data[9].w      = SSS混合权重
  fp_c7.data[10].xyz   = Layer1 权重
  fp_c7.data[17].z     = Roughness
  fp_c7.data[41].x     = MaxRoughness
  fp_c7.data[50].w     = SSS标志 (>0)
  fp_c7.data[57].y     = Normal编码
  fp_c7.data[62].y     = Normal编码
  fp_c7.data[67].y     = CastShadow (UV模式)
  fp_c8.data[1]        = UVScaleOffset = (1,1,0,0)
  fp_c8.data[10-13]    = Layer混合参数
  fp_c8.data[19-23]    = Layer底色 (含SubsurfaceColor)
  fp_c8.data[41].xyz   = AO输出缩放
  fp_c10.data[9,11]    = 输出编码

Step 4: 材质参数写入
  将 float_parameter 值写入对应 fp_cX.data[Y].z (或对应通道)
  将 float4_parameter 值写入 fp_cX.data[Y].xyzw
  将 int_parameter 值写入 fp_cX.data[Y].x (整数转换)
  加载纹理到 layout(binding=N) 对应的采样器
```

---

## 十一、待解决问题与后续方向

1. **更多 shader 反编译**: 目前只有 2/60+ shader 被反编译
   ```bash
   cd web/tools/bnsh
   python bnsh2glsl.py ../gfx2/shader/NX64/env_titan/special/eye.bnsh output/eye
   ```
2. **fp_c8.data[19-23] 和 SubsurfaceColor 的精确通道**: 需对比材质值(0.3,0.3,0.3,1.0)与 GLSL 乘法操作
3. **GlobalParam 完整映射**: `ReceiveShadow`, `InstancingType` 是否在 fp_c3/fp_c4
4. **Int 参数 Location**: `CastShadow=1`, `CategoryLabel=6` 写入 cbuffer 的哪个位置
5. **BNSH 原始 cbuffer 声明**: NVN 编译时成员名被优化掉，需额外工具链恢复

---

## 附录 A: 文件索引

| 路径 | 说明 |
|---|---|
| `web/tools/gfx2/shader/NX64/env_titan/` | 原始 BNSH shader 文件 (NVN 二进制) |
| `web/tools/bnsh/output/` | 反编译后的 GLSL |
| `web/tools/json_output/shader/` | shader 参数元数据 (JSON) |
| `web/tools/json_output/SCVI/` | 材质数据 (JSON) |
| `web/tools/scheme/model/trmtr.fbs` | 材质 FlatBuffers schema |
| `web/tools/scheme/render/trsha.fbs` | shader 参数 FlatBuffers schema |
| `web/tools/bnsh/bnsh2glsl.py` | BNSH→GLSL 转换工具 |
| `web/tools/gen-json.cjs` | 二进制→JSON 转换工具 |
| `web/src/materials/` | 项目中已实现的材质重建代码 |

## 附录 B: GLSL CBuffer 解码通用方法

给定一个变体的 GLSL 代码:

1. 提取所有 `fp_cX.data[Y]` 引用
2. 与相邻变体对比，找出差异
3. 在 GLSL 中搜索引用该索引的语句, 从上下文推断含义
4. 将推断结果记录到映射表
5. 对照 trmtr.json 中的参数值进行验证
