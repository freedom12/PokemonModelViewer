#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BNSH to GLSL 转换器
使用 Ryujinx 反编译 Nintendo Switch 着色器

用法：
    python bnsh2glsl.py <input.bnsh> <output_dir>

示例：
    python bnsh2glsl.py ../test/eye_clear_coat.bnsh output/eye_clear_coat
    python bnsh2glsl.py shader.bnsh glsl_output
"""

import subprocess
import sys
from pathlib import Path


# BnshToGlsl.exe 路径（与脚本在同一目录）
BNSH_TO_GLSL_EXE = Path(__file__).parent / "BnshToGlsl.exe"


def convert_bnsh(input_file: str, output_dir: str) -> bool:
    """
    转换 BNSH 文件到 GLSL
    
    Args:
        input_file: BNSH 输入文件路径
        output_dir: GLSL 输出目录路径
        
    Returns:
        bool: 转换是否成功
    """
    input_path = Path(input_file).absolute()
    output_path = Path(output_dir).absolute()
    
    # 验证输入文件
    if not input_path.exists():
        print(f"❌ 错误: 输入文件不存在: {input_path}")
        return False
    
    if not input_path.suffix.lower() == '.bnsh':
        print(f"⚠️ 警告: 文件扩展名不是 .bnsh: {input_path}")
    
    # 验证工具
    if not BNSH_TO_GLSL_EXE.exists():
        print(f"❌ 错误: 找不到 BnshToGlsl.exe")
        print(f"路径: {BNSH_TO_GLSL_EXE}")
        print()
        print("请先编译 BnshToGlsl 项目:")
        print("  cd C:\\Users\\Administrator\\Desktop\\pokemon\\ShaderLibrary")
        print("  dotnet build BnshToGlsl/BnshToGlsl.csproj -c Release")
        return False
    
    # 调用转换工具
    print("=" * 60)
    print("BNSH to GLSL 转换器 (Ryujinx 反编译)")
    print("=" * 60)
    print()
    print(f"输入: {input_path}")
    print(f"输出: {output_path}")
    print()
    
    try:
        cmd = [str(BNSH_TO_GLSL_EXE), str(input_path), str(output_path)]
        result = subprocess.run(cmd, check=True)
        
        # 统计生成的文件
        if output_path.exists():
            glsl_files = list(output_path.glob("*.glsl"))
            print()
            print("=" * 60)
            print(f"✅ 转换成功！生成了 {len(glsl_files)} 个 GLSL 文件")
            print("=" * 60)
        
        return True
        
    except subprocess.CalledProcessError as e:
        print()
        print("=" * 60)
        print(f"❌ 转换失败")
        print("=" * 60)
        return False
    except Exception as e:
        print()
        print("=" * 60)
        print(f"❌ 错误: {e}")
        print("=" * 60)
        return False


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_dir = sys.argv[2]
    
    success = convert_bnsh(input_file, output_dir)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
