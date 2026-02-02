/**
 * 资源加载器模块
 *
 * 封装资源加载逻辑，支持本地和远程资源切换
 *
 * @module services/resourceLoader
 */

/**
 * 资源加载配置
 */
interface ResourceLoaderConfig {
  /** 是否使用远程资源 */
  useRemote: boolean;
  modelRemotePath: string;
  modelLocalPath: string;
}

/**
 * 默认配置
 */
const env = import.meta.env
const DEFAULT_CONFIG: ResourceLoaderConfig = {
  useRemote: env.VITE_USE_REMOTE_ASSETS === 'true',
  modelRemotePath: env.VITE_MODEL_REMOTE_PATH,
  modelLocalPath: env.VITE_MODEL_LOCAL_PATH,
}

/**
 * 当前配置
 */
let currentConfig: ResourceLoaderConfig = { ...DEFAULT_CONFIG }

/**
 * 设置资源加载配置
 *
 * @param config - 新的配置
 */
export function setResourceLoaderConfig(config: Partial<ResourceLoaderConfig>): void {
  currentConfig = { ...currentConfig, ...config }
}

/**
 * 获取资源加载配置
 *
 * @returns 当前配置
 */
export function getResourceLoaderConfig(): ResourceLoaderConfig {
  return { ...currentConfig }
}

/**
 * 转换资源路径
 *
 * @param path - 原始路径
 * @returns 转换后的路径
 */
export function resolveResourcePath(path: string): string {
  // 移除开头的斜杠
  const cleanPath = path.startsWith('/') ? path.slice(1) : path

  // JSON文件始终从本地加载
  if (cleanPath.endsWith('.json')) {
    return `configs/${cleanPath}`
  }

  if (currentConfig.useRemote) {
    return `${currentConfig.modelRemotePath}/${cleanPath}`
  } else {
    return `${currentConfig.modelLocalPath}/${cleanPath}`
  }
}

/**
 * 加载文本资源
 *
 * @param path - 资源路径
 * @returns Promise<string> 文本内容
 */
export async function loadTextResource(path: string): Promise<string> {
  const resolvedPath = path

  const response = await fetch(resolvedPath)
  if (!response.ok) {
    throw new Error(
      `Failed to load text resource: ${resolvedPath} (HTTP ${response.status})`,
    )
  }

  return response.text()
}

/**
 * 加载二进制资源
 *
 * @param path - 资源路径
 * @returns Promise<ArrayBuffer> 二进制数据
 */
export async function loadBinaryResource(path: string): Promise<ArrayBuffer> {
  const resolvedPath = resolveResourcePath(path)

  const response = await fetch(resolvedPath)
  if (!response.ok) {
    throw new Error(
      `Failed to load binary resource: ${resolvedPath} (HTTP ${response.status})`,
    )
  }

  return response.arrayBuffer()
}

/**
 * 加载JSON资源
 *
 * @param path - 资源路径
 * @returns Promise<any> 解析后的JSON对象
 */
export async function loadJsonResource(path: string): Promise<any> {
  const resolvedPath = resolveResourcePath(path)
  const text = await loadTextResource(resolvedPath)
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`Failed to parse JSON resource: ${path} - ${error}`)
  }
}

/**
 * 检查资源是否存在
 *
 * @param path - 资源路径
 * @returns Promise<boolean> 是否存在
 */
export async function checkResourceExists(path: string): Promise<boolean> {
  const resolvedPath = resolveResourcePath(path)

  try {
    const response = await fetch(resolvedPath, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}
