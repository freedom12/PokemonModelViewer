# 宝可梦模型查看器

一个用于查看宝可梦3D模型的Web应用程序。

## 功能特性

- 浏览和查看宝可梦的3D模型
- 支持多种形态切换
- 纹理和动画播放
- 本地/远程资源切换

## 资源加载

应用程序支持从本地或远程加载资源：

### 本地资源
默认情况下，资源从本地 `/assets` 目录加载。

### 远程资源
可以通过以下方式启用远程资源加载：

1. **环境变量**：设置 `VITE_USE_REMOTE_COS=true`
2. **运行时切换**：在应用程序界面中使用"使用远程资源"开关

远程资源存储在腾讯云COS：`https://pokemon-model-1400264169.cos.ap-beijing.myqcloud.com/`

### 资源路径映射

- 本地路径：`/assets/SCVI/pm0001/pm0001_00_00/pm0001_00_00_body_a_ao.png`
- 远程路径：`https://pokemon-model-1400264169.cos.ap-beijing.myqcloud.com/SCVI/pm0001/pm0001_00_00/pm0001_00_00_body_a_ao.png`

## 开发

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

## 项目结构

```
web/
├── src/
│   ├── services/
│   │   ├── resourceLoader.ts    # 资源加载器
│   │   ├── textureLoader.ts     # 纹理加载器
│   │   ├── modelLoader.ts       # 模型加载器
│   │   └── ...
│   ├── components/
│   └── ...
├── assets/                      # 本地资源目录
└── ...
```

## 资源加载器 API

```typescript
import { setResourceLoaderConfig, loadBinaryResource, loadJsonResource } from './services/resourceLoader';

// 设置配置
setResourceLoaderConfig({
  useRemote: true,  // 使用远程资源
  remoteBaseUrl: 'https://pokemon-model-1400264169.cos.ap-beijing.myqcloud.com',
  localBasePath: '/assets'
});

// 加载二进制资源
const buffer = await loadBinaryResource('SCVI/pm0001/model.bin');

// 加载JSON资源
const data = await loadJsonResource('SCVI/pm0001/index.json');
```
