@echo off
setlocal EnableDelayedExpansion

REM BNSH to GLSL 转换工具 (直接调用)
REM 用法: convert.bat <input.bnsh> <output_dir>

if "%~1"=="" (
    echo ============================================================
    echo BNSH to GLSL 转换器
    echo ============================================================
    echo.
    echo 用法:
    echo   convert.bat ^<input.bnsh^> ^<output_dir^>
    echo.
    echo 示例:
    echo   convert.bat ..\gfx2\shader\NX64\env_titan\material\standard.bnsh demo
    echo   convert.bat shader.bnsh glsl_output
    echo.
    exit /b 1
)

if "%~2"=="" (
    echo 错误: 缺少输出目录参数
    echo.
    echo 用法: convert.bat ^<input.bnsh^> ^<output_dir^>
    exit /b 1
)

set "BNSH_TOOL=%~dp0BnshToGlsl.exe"

if not exist "%BNSH_TOOL%" (
    echo 错误: 找不到 BnshToGlsl.exe
    echo 路径: %BNSH_TOOL%
    exit /b 1
)

echo ============================================================
echo BNSH to GLSL 转换
echo ============================================================
echo.
echo 输入: %~1
echo 输出: %~2
echo.

"%BNSH_TOOL%" "%~f1" "%~f2"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================================
    echo ✓ 转换成功
    echo ============================================================
) else (
    echo.
    echo ============================================================
    echo ✗ 转换失败
    echo ============================================================
)

exit /b %ERRORLEVEL%
