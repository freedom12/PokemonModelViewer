# BNSH to GLSL 转换器

使用 Ryujinx 着色器反编译器将 Nintendo Switch BNSH 着色器文件转换为 GLSL 代码。

## 功能

- ✅ 真正反编译 NVN Binary 着色器（不是占位符）
- ✅ 支持顶点、片段、几何等多种着色器类型
- ✅ 自动处理所有着色器变体
- ✅ 生成标准 GLSL 450 代码

## 使用方法

### Python 命令

```bash
python bnsh2glsl.py <input.bnsh> <output_dir>
```

### 批处理文件

```cmd
bnsh2glsl.bat <input.bnsh> <output_dir>
```

## 示例

```bash
# 转换单个文件
python bnsh2glsl.py ../test/eye_clear_coat.bnsh output/eye_clear_coat

# 转换到指定目录
python bnsh2glsl.py shader.bnsh glsl_output
```

```cmd
# Windows 批处理
bnsh2glsl.bat ..\test\sss.bnsh output\sss
```

## 输出

每个 BNSH 文件会生成多个 GLSL 文件：
- `{name}_var{N}_vert.glsl` - 顶点着色器
- `{name}_var{N}_frag.glsl` - 片段着色器
- `{name}_var{N}_geom.glsl` - 几何着色器（如果有）
- 等等

其中 `N` 是着色器变体索引。

## 要求

- Python 3.7+
- .NET 8.0 Runtime
- BnshToGlsl.exe（已编译）

## 技术细节

此工具使用：
- **ShaderLibrary**: BNSH 文件解析
- **Ryujinx.Graphics.Shader**: NVN Binary 反编译
- Nintendo Tegra GPU 着色器转换为标准 GLSL

## 故障排除

如果提示找不到 BnshToGlsl.exe，需要先编译：

```bash
cd C:\Users\Administrator\Desktop\pokemon\ShaderLibrary
dotnet build BnshToGlsl/BnshToGlsl.csproj -c Release
```

## 示例输出

```
============================================================
BNSH to GLSL 转换器
============================================================

输入文件: eye_clear_coat.bnsh
输出目录: output/eye_clear_coat

加载 BNSH 文件...
✓ 加载成功
  着色器变体数量: 72

[1] eye_clear_coat_var0_vert.glsl ... ✓
[2] eye_clear_coat_var0_frag.glsl ... ✓
...

============================================================
转换完成
============================================================
成功: 144
失败: 0
总计: 144
变体数: 72
```
