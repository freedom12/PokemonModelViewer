/**
 * useModelLoader.ts - 模型加载器 composable
 * 
 * 封装宝可梦模型加载的业务逻辑，提供响应式状态管理
 * 
 * @module composables/useModelLoader
 * 
 * @validates 需求 2.1: 用户选择宝可梦时从对应目录加载模型
 * @validates 需求 6.6: 模型加载中显示加载进度指示器
 */

import { ref, shallowRef, type Ref, type ShallowRef } from 'vue'
import * as THREE from 'three'
import {
  loadModelFiles,
  parseModelData,
  ModelLoadError,
  type ParsedModelData
} from '../services/modelLoader'
import {
  createGeometry,
  type GeometryGroup
} from '../services/meshConverter'
import {
  createAllMaterials,
  createDefaultMaterial,
  disposeAllMaterials
} from '../services/textureLoader'

/**
 * 加载进度阶段
 */
export enum LoadingStage {
  /** 空闲状态 */
  IDLE = 'idle',
  /** 加载文件中 */
  LOADING_FILES = 'loading_files',
  /** 解析数据中 */
  PARSING_DATA = 'parsing_data',
  /** 创建几何体中 */
  CREATING_GEOMETRY = 'creating_geometry',
  /** 加载纹理中 */
  LOADING_TEXTURES = 'loading_textures',
  /** 创建网格中 */
  CREATING_MESH = 'creating_mesh',
  /** 完成 */
  COMPLETE = 'complete'
}

/**
 * 加载进度信息
 */
export interface LoadingProgress {
  /** 当前阶段 */
  stage: LoadingStage
  /** 进度百分比 (0-100) */
  percent: number
  /** 阶段描述 */
  message: string
}

/**
 * useModelLoader 返回值接口
 */
export interface UseModelLoaderReturn {
  /** 是否正在加载 */
  loading: Ref<boolean>
  /** 加载进度 (0-100) */
  progress: Ref<number>
  /** 详细进度信息 */
  progressInfo: Ref<LoadingProgress>
  /** 错误信息 */
  error: Ref<string | null>
  /** 当前加载的模型 */
  currentModel: ShallowRef<THREE.Group | null>
  /** 当前模型的形态 ID */
  currentFormId: Ref<string | null>
  
  /**
   * 加载模型
   * @param pokemonId - 宝可梦 ID，如 "pm0001"
   * @param formId - 形态 ID，如 "pm0001_00_00"
   */
  loadModel: (pokemonId: string, formId: string) => Promise<void>
  
  /**
   * 清理当前模型资源
   */
  disposeModel: () => void
}

/**
 * 阶段进度映射
 * 定义每个阶段的起始和结束进度百分比
 */
const STAGE_PROGRESS: Record<LoadingStage, { start: number; end: number; message: string }> = {
  [LoadingStage.IDLE]: { start: 0, end: 0, message: '准备中...' },
  [LoadingStage.LOADING_FILES]: { start: 0, end: 30, message: '加载模型文件...' },
  [LoadingStage.PARSING_DATA]: { start: 30, end: 45, message: '解析模型数据...' },
  [LoadingStage.CREATING_GEOMETRY]: { start: 45, end: 60, message: '创建几何体...' },
  [LoadingStage.LOADING_TEXTURES]: { start: 60, end: 90, message: '加载纹理贴图...' },
  [LoadingStage.CREATING_MESH]: { start: 90, end: 100, message: '创建网格对象...' },
  [LoadingStage.COMPLETE]: { start: 100, end: 100, message: '加载完成' }
}

/**
 * 模型加载器 composable
 * 
 * 提供模型加载的响应式状态管理和加载流程协调
 * 
 * @returns UseModelLoaderReturn 包含状态和方法的对象
 * 
 * @example
 * ```vue
 * <script setup>
 * import { useModelLoader } from '@/composables/useModelLoader'
 * 
 * const { loading, progress, error, currentModel, loadModel, disposeModel } = useModelLoader()
 * 
 * // 加载模型
 * await loadModel('pm0001', 'pm0001_00_00')
 * 
 * // 清理资源
 * onUnmounted(() => {
 *   disposeModel()
 * })
 * </script>
 * ```
 */
export function useModelLoader(): UseModelLoaderReturn {
  // 响应式状态
  const loading = ref<boolean>(false)
  const progress = ref<number>(0)
  const progressInfo = ref<LoadingProgress>({
    stage: LoadingStage.IDLE,
    percent: 0,
    message: ''
  })
  const error = ref<string | null>(null)
  
  // 使用 shallowRef 存储 Three.js 对象，避免深度响应式带来的性能问题
  const currentModel = shallowRef<THREE.Group | null>(null)
  const currentFormId = ref<string | null>(null)
  
  // 存储当前模型的材质引用，用于清理
  let currentMaterials: THREE.MeshStandardMaterial[] = []
  
  /**
   * 更新加载进度
   * 
   * @param stage - 当前阶段
   * @param stageProgress - 阶段内进度 (0-1)
   */
  function updateProgress(stage: LoadingStage, stageProgress: number = 0): void {
    const stageInfo = STAGE_PROGRESS[stage]
    const totalProgress = stageInfo.start + (stageInfo.end - stageInfo.start) * Math.min(stageProgress, 1)
    
    progress.value = Math.round(totalProgress)
    progressInfo.value = {
      stage,
      percent: progress.value,
      message: stageInfo.message
    }
  }
  
  /**
   * 清理当前模型的 Three.js 资源
   * 
   * 释放几何体、材质和纹理资源，防止内存泄漏
   */
  function disposeModel(): void {
    if (currentModel.value) {
      // 遍历模型组中的所有对象
      currentModel.value.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          // 释放几何体
          if (object.geometry) {
            object.geometry.dispose()
          }
          
          // 释放材质（如果不在 currentMaterials 中）
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((mat) => {
                if (!currentMaterials.includes(mat as THREE.MeshStandardMaterial)) {
                  mat.dispose()
                }
              })
            } else if (!currentMaterials.includes(object.material as THREE.MeshStandardMaterial)) {
              object.material.dispose()
            }
          }
        }
      })
      
      // 从父对象中移除
      if (currentModel.value.parent) {
        currentModel.value.parent.remove(currentModel.value)
      }
      
      currentModel.value = null
    }
    
    // 释放材质和纹理
    if (currentMaterials.length > 0) {
      disposeAllMaterials(currentMaterials)
      currentMaterials = []
    }
    
    currentFormId.value = null
  }
  
  /**
   * 加载宝可梦模型
   * 
   * 协调整个模型加载流程：
   * 1. 加载模型文件 (trmdl, trmsh, trmbf, trmtr, trmmt)
   * 2. 解析 FlatBuffers 数据
   * 3. 创建 Three.js 几何体
   * 4. 加载纹理并创建材质
   * 5. 创建最终的 Mesh 对象
   * 
   * @param _pokemonId - 宝可梦 ID，如 "pm0001"（保留用于 API 一致性，实际路径从 formId 推导）
   * @param formId - 形态 ID，如 "pm0001_00_00"
   * 
   * @validates 需求 2.1: 用户选择宝可梦时从对应目录加载模型
   * @validates 需求 6.6: 模型加载中显示加载进度指示器
   */
  async function loadModel(_pokemonId: string, formId: string): Promise<void> {
    // 如果正在加载，忽略新的加载请求
    if (loading.value) {
      console.warn('useModelLoader: 模型正在加载中，忽略新的加载请求')
      return
    }
    
    // 清理之前的模型
    disposeModel()
    
    // 重置状态
    loading.value = true
    error.value = null
    progress.value = 0
    
    try {
      // 阶段 1: 加载模型文件
      updateProgress(LoadingStage.LOADING_FILES, 0)
      
      const files = await loadModelFiles(formId)
      
      updateProgress(LoadingStage.LOADING_FILES, 1)
      
      // 阶段 2: 解析模型数据
      updateProgress(LoadingStage.PARSING_DATA, 0)
      
      const modelData: ParsedModelData = parseModelData(files, formId)
      
      updateProgress(LoadingStage.PARSING_DATA, 1)
      
      // 阶段 3: 创建几何体
      updateProgress(LoadingStage.CREATING_GEOMETRY, 0)
      
      const { geometry, groups } = createGeometry(
        modelData.trmsh,
        modelData.trmbf,
        0 // 使用第一个网格
      )
      
      updateProgress(LoadingStage.CREATING_GEOMETRY, 1)
      
      // 阶段 4: 加载纹理并创建材质
      updateProgress(LoadingStage.LOADING_TEXTURES, 0)
      
      let materials: THREE.MeshStandardMaterial[] = []
      
      if (modelData.trmtr) {
        try {
          materials = await createAllMaterials(modelData.trmtr, modelData.basePath)
        } catch (materialError) {
          console.warn('材质创建失败，使用默认材质:', materialError)
          // 为每个几何体组创建默认材质
          materials = groups.map(() => createDefaultMaterial())
        }
      } else {
        // 没有材质数据，使用默认材质
        materials = groups.map(() => createDefaultMaterial())
      }
      
      // 保存材质引用用于后续清理
      currentMaterials = materials
      
      updateProgress(LoadingStage.LOADING_TEXTURES, 1)
      
      // 阶段 5: 创建网格对象
      updateProgress(LoadingStage.CREATING_MESH, 0)
      
      // 创建模型组
      const modelGroup = new THREE.Group()
      modelGroup.name = formId
      
      // 创建网格
      const mesh = createMeshWithMaterials(geometry, groups, materials)
      mesh.name = `${formId}_mesh`
      
      modelGroup.add(mesh)
      
      // 更新状态
      currentModel.value = modelGroup
      currentFormId.value = formId
      
      updateProgress(LoadingStage.CREATING_MESH, 1)
      updateProgress(LoadingStage.COMPLETE)
      
      console.log(`useModelLoader: 模型 ${formId} 加载完成`)
      
    } catch (err) {
      // 处理错误
      const errorMessage = formatError(err)
      error.value = errorMessage
      console.error('useModelLoader: 模型加载失败:', err)
      
      // 清理可能已创建的资源
      disposeModel()
      
    } finally {
      loading.value = false
    }
  }
  
  return {
    loading,
    progress,
    progressInfo,
    error,
    currentModel,
    currentFormId,
    loadModel,
    disposeModel
  }
}

/**
 * 根据几何体组和材质创建网格
 * 
 * @param geometry - BufferGeometry
 * @param groups - 几何体组信息
 * @param materials - 材质数组
 * @returns Three.js Mesh
 */
function createMeshWithMaterials(
  geometry: THREE.BufferGeometry,
  groups: GeometryGroup[],
  materials: THREE.MeshStandardMaterial[]
): THREE.Mesh {
  // 如果只有一个材质或没有组，直接创建简单网格
  if (materials.length === 1 || groups.length <= 1) {
    return new THREE.Mesh(geometry, materials[0] || createDefaultMaterial())
  }
  
  // 多材质网格
  return new THREE.Mesh(geometry, materials)
}

/**
 * 格式化错误信息
 * 
 * @param err - 错误对象
 * @returns 用户友好的错误信息
 */
function formatError(err: unknown): string {
  if (err instanceof ModelLoadError) {
    switch (err.type) {
      case 'file_not_found':
        return `模型文件未找到: ${err.filePath || '未知文件'}`
      case 'parse_error':
        return `模型文件格式错误: ${err.message}`
      case 'network_error':
        return `网络请求失败，请检查网络连接`
      case 'invalid_format':
        return `模型文件格式无效: ${err.message}`
      default:
        return err.message
    }
  }
  
  if (err instanceof Error) {
    return err.message
  }
  
  return String(err)
}

export default useModelLoader
