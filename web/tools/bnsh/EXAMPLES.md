# BNSH 转 GLSL 工具使用示例

## 快速开始

进入 bnsh 目录：
```bash
cd tools/bnsh
```

## 命令格式

```bash
python bnsh2glsl.py <输入文件.bnsh> <输出目录>
```

或使用批处理文件：
```cmd
bnsh2glsl.bat <输入文件.bnsh> <输出目录>
```

## 示例

### 示例 1: 转换角色着色器

```bash
python bnsh2glsl.py ../gfx2/shader/NX64/ik_character.bnsh output/ik_character
```

### 示例 2: 转换材质着色器

```bash
python bnsh2glsl.py ../gfx2/shader/NX64/env_titan/material/standard.bnsh output/standard
```

### 示例 3: 使用批处理文件

```cmd
bnsh2glsl.bat ..\gfx2\shader\NX64\env_titan\material\hair.bnsh output\hair
```

## 输出文件格式

生成的文件命名格式：
- `{shader_name}_var{N}_vert.glsl` - 顶点着色器
- `{shader_name}_var{N}_frag.glsl` - 片段着色器

其中 `N` 是着色器变体编号（0, 1, 2...）

## 完整示例输出

```
============================================================
BNSH to GLSL 转换器 (Ryujinx 反编译)
============================================================

输入: C:\...\gfx2\shader\NX64\ik_character.bnsh
输出: C:\...\output\ik_character

=============================================================
BNSH to GLSL 转换器
=============================================================

输入文件: ik_character.bnsh
输出目录: output\ik_character

加载 BNSH 文件...
✓ 加载成功
  着色器变体数量: 128

[1] ik_character_var0_vert.glsl ... ✓
[2] ik_character_var0_frag.glsl ... ✓
...

=============================================================
转换完成
=============================================================
成功: 256
失败: 0
总计: 256
变体数: 128

============================================================
✅ 转换成功！生成了 256 个 GLSL 文件
============================================================
```

## 故障排除

### 错误: 找不到 BnshToGlsl.exe

如果看到此错误，需要先编译 C# 工具：

```bash
cd C:\Users\Administrator\Desktop\pokemon\ShaderLibrary
dotnet build BnshToGlsl/BnshToGlsl.csproj -c Release
```

### 错误: 输入文件不存在

确保文件路径正确，使用相对或绝对路径。

相对路径示例：
```bash
python bnsh2glsl.py ../test/shader.bnsh output/
```

绝对路径示例：
```bash
python bnsh2glsl.py C:\path\to\shader.bnsh C:\path\to\output\
```
