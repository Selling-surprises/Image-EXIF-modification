@echo off & pushd "%~dp0" & color F0

net session >nul 2>&1 
if %errorlevel% equ 0 goto :Setup-1

where powershell >nul 2>&1 && ( 
    powershell -Command "Start-Process '%~sdpnx0' -Verb RunAs" >nul 2>&1 
) || ( 
    mshta vbscript:CreateObject("Shell.Application").ShellExecute("%~s0","","","runas",1)(window.close) >nul 2>&1 
) 
exit /b 

:Setup-1
setlocal enabledelayedexpansion
cls
title 图片EXIF编辑器 一键部署

REM 设置端口号
set "allowed=1 2 3 5 6 8 9"

set index=0
for %%d in (%allowed%) do (
    set "allowed[!index!]=%%d"
    set /a index+=1
)
set /a maxIndex=index-1

set /a firstIndex=!random! %% !index!
set "number=!allowed[%firstIndex%]!"

for /l %%i in (1,1,3) do (
    set /a digit=!random! %% 10
    set "number=!number!!digit!"
)

for /f "tokens=16" %%i in ('ipconfig ^|find /i "ipv4"') do set myip=%%i

reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall" /s | findstr /i /c:"Node.js" >nul
if %errorlevel% equ 0 goto Setup-2

reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall" /s | findstr /i /c:"Node.js" >nul
if %errorlevel% equ 0 goto Setup-2

echo.
echo 您的系统没有安装Node.js，按任意键跳转Node.js官网
echo.
pasue>nul
start https://nodejs.org/zh-cn/download
goto Setup-2

:Setup-2

if not exist "%cd%\.npmi" (goto npmi-config) else (goto Setup-3)

:npmi-config

call npm install -g cnpm --registry=https://registry.npmmirror.com

call npm config set registry https://registry.npmmirror.com

call cnpm install

goto size

:size
cls
set "limit=104857600"

:: 取当前目录（含子目录）总字节数
for /f "tokens=3" %%s in ('dir /s /-c ^| findstr /c:"个文件"') do set "size=%%s"

:: 小于限制直接退出
if %size% LSS %limit% exit /b

:: 到这里说明 ≥100 MB，生成标记文件
echo. >".npmi"

:Setup-3
cls
color F0
title 图片EXIF编辑器 启动服务

echo.
echo   请选择：
echo.
echo 1、本机启动服务
echo.
echo 2、局域网启动服务
echo.
echo 3、退出/停止服务
echo.
choice /C 123 /N >nul

if errorlevel 3 goto stopSrv
if errorlevel 2 goto lanSrv
if errorlevel 1 goto localSrv

:localSrv
cls
title 本机启动
start "" npx vite --host 127.0.0.1 --port %number%
timeout /t 2 /nobreak >nul
start http://127.0.0.1:%number%/
echo.
echo 已打开网页，按任意键返回...
pause >nul
goto Setup-3

:lanSrv
cls
title 局域网启动
start "" npx vite --host %myip% --port %number%
timeout /t 2 /nobreak >nul
start http://%myip%:%number%/
echo.
echo 已打开网页，按任意键返回...
pause >nul
goto Setup-3

:stopSrv
cls
title 杀掉 vite/node 进程（兼容 Win10/11）
echo 正在停止服务...
taskkill /F /IM node.exe      >nul 2>&1
taskkill /F /IM vite.exe      >nul 2>&1
taskkill /F /IM cmd.exe /FI "WindowTitle eq *vite*" >nul 2>&1
echo.
echo 服务已停止，按任意键返回...
pause >nul
goto Setup-3