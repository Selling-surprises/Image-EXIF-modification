# 图片EXIF编辑器

## 介绍

一个可以修改图片EXFI信息的网页，可以批量读取修改GPS信息等等

## 目录结构

```
├── README.md # 说明文档
├── components.json # 组件库配置
├── index.html # 入口文件
├── package.json # 包管理
├── postcss.config.js # postcss 配置
├── public # 静态资源目录
│   ├── favicon.png # 图标
│   └── images # 图片资源
├── src # 源码目录
│   ├── App.tsx # 入口文件
│   ├── components # 组件目录
│   ├── contexts # 上下文目录
│   ├── db # 数据库配置目录
│   ├── hooks # 通用钩子函数目录
│   ├── index.css # 全局样式
│   ├── layout # 布局目录
│   ├── lib # 工具库目录
│   ├── main.tsx # 入口文件
│   ├── routes.tsx # 路由配置
│   ├── pages # 页面目录
│   ├── services  # 数据库交互目录
│   ├── types   # 类型定义目录
├── tsconfig.app.json  # ts 前端配置文件
├── tsconfig.json # ts 配置文件
├── tsconfig.node.json # ts node端配置文件
└── vite.config.ts # vite 配置文件
```

## 技术栈

Vite、TypeScript、React、Supabase

## 本地开发

### 如何在本地编辑代码？

您可以选择 [VSCode](https://code.visualstudio.com/Download) 或者您常用的任何 IDE 编辑器，唯一的要求是安装 Node.js 和 npm.

### 环境要求

```
# Node.js ≥ 20
# npm ≥ 10
例如：
# node -v   # v20.18.3
# npm -v    # 10.8.2
```

具体安装步骤如下：

### 在 Windows 上安装 Node.js

```
# Step 1: 访问Node.js官网：https://nodejs.org/，点击下载后，会根据你的系统自动选择合适的版本（32位或64位）。
# Step 2: 运行安装程序：下载完成后，双击运行安装程序。
# Step 3: 完成安装：按照安装向导完成安装过程。
# Step 4: 验证安装：在命令提示符（cmd）或IDE终端（terminal）中输入 node -v 和 npm -v 来检查 Node.js 和 npm 是否正确安装。
```

### 在 macOS 上安装 Node.js

```
# Step 1: 使用Homebrew安装（推荐方法）：打开终端。输入命令brew install node并回车。如果尚未安装Homebrew，需要先安装Homebrew，
可以通过在终端中运行如下命令来安装：
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
或者使用官网安装程序：访问Node.js官网。下载macOS的.pkg安装包。打开下载的.pkg文件，按照提示完成安装。
# Step 2: 验证安装：在命令提示符（cmd）或IDE终端（terminal）中输入 node -v 和 npm -v 来检查 Node.js 和 npm 是否正确安装。
```

### 安装完后按照如下步骤操作：

```
# Step 1: 下载代码包
# Step 2: 解压代码包
# Step 3: 用IDE打开代码包，进入代码目录
# Step 4: IDE终端输入命令行，安装依赖：npm i
# Step 5: IDE终端输入命令行，启动开发服务器：npm run dev -- --host 127.0.0.1
```

### 批处理一键操作

```
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
```

### 如何开发后端服务？

配置环境变量，安装相关依赖
如需使用数据库，请使用 supabase 官方版本或自行部署开源版本的 Supabase

### 如何配置应用中的三方 API？

具体三方 API 调用方法，请参考帮助文档：[源码导出](https://cloud.baidu.com/doc/MIAODA/s/Xmewgmsq7)，了解更多详细内容。

## 了解更多

您也可以查看帮助文档：[源码导出](https://cloud.baidu.com/doc/MIAODA/s/Xmewgmsq7)，了解更多详细内容。
