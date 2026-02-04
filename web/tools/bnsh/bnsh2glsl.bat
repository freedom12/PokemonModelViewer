@echo off
setlocal EnableDelayedExpansion

REM BNSH to GLSL 转换工具
REM 用法: bnsh2glsl.bat <input.bnsh> <output_dir>

if "%~1"=="" (
    echo BNSH to GLSL 转换器
    echo.
    echo 用法:
    echo   bnsh2glsl.bat ^<input.bnsh^> ^<output_dir^>
    echo.
    echo 示例:
    echo   bnsh2glsl.bat ..\test\eye_clear_coat.bnsh output\eye_clear_coat
    echo   bnsh2glsl.bat shader.bnsh glsl_output
    exit /b 1
)

if "%~2"=="" (
    echo 错误: 缺少输出目录参数
    echo.
    echo 用法: bnsh2glsl.bat ^<input.bnsh^> ^<output_dir^>
    exit /b 1
)

REM 尝试查找 Python 3
where python3 >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    python3 "%~dp0bnsh2glsl.py" "%~1" "%~2"
) else (
    python "%~dp0bnsh2glsl.py" "%~1" "%~2"
)
exit /b %ERRORLEVEL%
