# Shader变体映射规则文档

## 概述

本文档说明如何根据材质文件（`.trmtr.json`）中的shader参数，定位到对应的shader变体编译结果文件。

## 文件结构

### 1. Shader配置文件
- **位置**: `web/tools/json_output/shader/{shader_name}.json`
- **内容**: 包含shader的所有参数定义、变体配置信息
- **示例**: `eye_clear_coat.json`

### 2. 材质文件
- **位置**: `web/tools/json_output/SCVI/{pokemon}/{form}/{material}.trmtr.json`
- **内容**: 包含具体材质使用的shader及其参数值
- **示例**: `pm0001_00_00.trmtr.json`

### 3. Shader变体编译结果
- **位置**: `web/tools/bnsh/output/{shader_name}/`
- **命名格式**: `{shader_name}_var{index}_{frag|vert}.glsl`
- **示例**: `eye_clear_coat_var36_frag.glsl`

## 变体索引计算方法

### 核心公式

```
变体索引 = Σ(参数的uintValue × 参数的offset)
```

### 参数配置结构

在shader配置文件（如`eye_clear_coat.json`）中，每个参数包含：

```json
{
  "slotName": "EyelidType",          // 参数名称
  "offset": 3,                       // 偏移量（用于计算变体索引）
  "slotValues": [                    // 可选值列表
    {
      "stringValue": "None",         // 字符串值
      "uintValue": 0                 // 对应的整数值
    },
    {
      "stringValue": "Upper",
      "uintValue": 1
    },
    {
      "stringValue": "Lower",
      "uintValue": 2
    },
    {
      "stringValue": "All",
      "uintValue": 3
    }
  ]
}
```

### 材质参数值

在材质文件中，参数值的表示：

```json
{
  "shader_name": "EyeClearCoat",
  "shader_values": [
    {
      "string_name": "EnableHighlight",    // 对应shader配置中的slotName
      "string_value": "True"               // 对应slotValues中的stringValue
    },
    {
      "string_name": "EyelidType",
      "string_value": "None"
    }
  ]
}
```

## 计算示例

### 示例1: EyeClearCoat shader

**材质参数**（来自`pm0001_00_00.trmtr.json`）:
```json
{
  "shader_name": "EyeClearCoat",
  "shader_values": [
    { "string_name": "EyelidType", "string_value": "None" },
    { "string_name": "EnableHighlight", "string_value": "True" },
    { "string_name": "EnableBaseColorMap1", "string_value": "False" },
    { "string_name": "EnableNormalMap1", "string_value": "True" }
  ]
}
```

**计算过程**:

| 参数名 | 材质值 | uintValue | offset | 贡献值 |
|--------|--------|-----------|--------|--------|
| EyelidType | None | 0 | 3 | 0 × 3 = 0 |
| EnableHighlight | True | 1 | 4 | 1 × 4 = 4 |
| EnableBaseColorMap1 | False | 0 | 16 | 0 × 16 = 0 |
| EnableNormalMap1 | True | 1 | 32 | 1 × 32 = 32 |

**变体索引** = 0 + 4 + 0 + 32 = **36**

**对应文件**:
- `web/tools/bnsh/output/eye_clear_coat/eye_clear_coat_var36_frag.glsl`
- `web/tools/bnsh/output/eye_clear_coat/eye_clear_coat_var36_vert.glsl`

### 示例2: 不同的参数组合

**材质参数**:
```json
{
  "shader_values": [
    { "string_name": "EyelidType", "string_value": "Upper" },  // uintValue=1
    { "string_name": "EnableHighlight", "string_value": "False" },
    { "string_name": "EnableBaseColorMap1", "string_value": "True" },
    { "string_name": "EnableNormalMap1", "string_value": "False" }
  ]
}
```

**计算**:
- EyelidType=Upper: 1 × 3 = 3
- EnableHighlight=False: 0 × 4 = 0
- EnableBaseColorMap1=True: 1 × 16 = 16
- EnableNormalMap1=False: 0 × 32 = 0

**变体索引** = 3 + 0 + 16 + 0 = **19**

**对应文件**: `eye_clear_coat_var19_*.glsl`

## 实现代码

### TypeScript实现

```typescript
interface ShaderParameter {
  slotName: string;
  offset: number;
  slotValues: Array<{
    stringValue: string;
    uintValue: number;
  }>;
}

interface ShaderConfig {
  name: string;
  fileName: string;
  shaderParam: ShaderParameter[];
}

interface MaterialShaderValue {
  string_name: string;
  string_value: string;
}

/**
 * 计算shader变体索引
 * @param shaderConfig - shader配置对象（从shader/*.json读取）
 * @param materialShaderValues - 材质中的shader参数值数组
 * @returns 变体索引
 */
function calculateShaderVariantIndex(
  shaderConfig: ShaderConfig,
  materialShaderValues: MaterialShaderValue[]
): number {
  let variantIndex = 0;
  
  for (const param of shaderConfig.shaderParam) {
    // 查找材质中对应的参数值
    const materialValue = materialShaderValues.find(
      v => v.string_name === param.slotName
    );
    
    if (materialValue) {
      // 查找对应的uint值
      const slotValue = param.slotValues.find(
        v => v.stringValue === materialValue.string_value
      );
      
      if (slotValue) {
        // 累加贡献值
        variantIndex += slotValue.uintValue * param.offset;
      }
    }
  }
  
  return variantIndex;
}

/**
 * 获取shader变体文件路径
 * @param shaderName - shader名称（如"EyeClearCoat"）
 * @param variantIndex - 变体索引
 * @param shaderType - 'frag' 或 'vert'
 * @returns shader文件路径
 */
function getShaderVariantPath(
  shaderName: string,
  variantIndex: number,
  shaderType: 'frag' | 'vert'
): string {
  const shaderFileName = shaderName
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .substring(1); // 转换为snake_case
  
  return `web/tools/bnsh/output/${shaderFileName}/${shaderFileName}_var${variantIndex}_${shaderType}.glsl`;
}

/**
 * 完整示例：从材质获取shader文件
 */
async function getShaderFilesForMaterial(
  materialShader: {
    shader_name: string;
    shader_values: MaterialShaderValue[];
  }
) {
  // 1. 加载shader配置
  const shaderConfigPath = `web/tools/json_output/shader/${materialShader.shader_name.toLowerCase()}.json`;
  const shaderConfig: ShaderConfig = await loadJSON(shaderConfigPath);
  
  // 2. 计算变体索引
  const variantIndex = calculateShaderVariantIndex(
    shaderConfig,
    materialShader.shader_values
  );
  
  // 3. 获取文件路径
  const fragPath = getShaderVariantPath(materialShader.shader_name, variantIndex, 'frag');
  const vertPath = getShaderVariantPath(materialShader.shader_name, variantIndex, 'vert');
  
  console.log(`Variant index: ${variantIndex}`);
  console.log(`Fragment shader: ${fragPath}`);
  console.log(`Vertex shader: ${vertPath}`);
  
  return { variantIndex, fragPath, vertPath };
}
```

### Python实现

```python
def calculate_shader_variant_index(shader_config, material_shader_values):
    """
    计算shader变体索引
    
    Args:
        shader_config: shader配置字典
        material_shader_values: 材质shader参数值列表
    
    Returns:
        int: 变体索引
    """
    variant_index = 0
    
    for param in shader_config.get('shaderParam', []):
        slot_name = param['slotName']
        offset = param['offset']
        
        # 查找材质中对应的参数值
        material_value = next(
            (v for v in material_shader_values if v['string_name'] == slot_name),
            None
        )
        
        if material_value:
            # 查找对应的uint值
            slot_value = next(
                (v for v in param['slotValues'] 
                 if v['stringValue'] == material_value['string_value']),
                None
            )
            
            if slot_value:
                variant_index += slot_value['uintValue'] * offset
    
    return variant_index
```

## 注意事项

### 1. 参数缺失处理
如果材质文件中没有指定某个参数，通常使用默认值（一般是第一个slotValue，uintValue为0）。

### 2. 命名转换
shader名称通常需要从PascalCase转换为snake_case：
- `EyeClearCoat` → `eye_clear_coat`
- `SSS` → `sss`
- `StandardMaterial` → `standard_material`

### 3. Global参数
部分shader配置中还有`globalParam`字段，这些参数的处理方式与`shaderParam`相同，但可能有不同的优先级或作用域。

### 4. 验证
计算出的变体索引必须在有效范围内。可以通过检查`output/{shader_name}/`目录中实际存在的变体文件来验证。

## 相关文件

- **Shader配置**: `web/tools/json_output/shader/*.json`
- **材质文件**: `web/tools/json_output/SCVI/**/*.trmtr.json`
- **编译输出**: `web/tools/bnsh/output/*/`
- **转换工具**: `web/tools/bnsh/bnsh2glsl.py`

## 更新日志

- 2026-02-04: 初始版本，基于EyeClearCoat shader分析
