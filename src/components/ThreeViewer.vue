<script setup lang="ts">
/**
 * ThreeViewer.vue - 3D 查看器组件
 * 
 * 负责：
 * - 创建和管理 canvas 容器
 * - 初始化 Three.js 场景
 * - 加载和显示宝可梦模型
 * - 自动调整摄像机位置
 * - 处理组件生命周期
 * - 显示模型加载错误并提供重试功能
 * 
 * @validates 需求 5.1: 几何体和材质准备完成后创建 Three.js Mesh 对象并添加到场景
 * @validates 需求 5.2: 模型添加到场景后自动调整摄像机位置以完整显示模型
 * @validates 需求 5.3: 模型渲染时提供适当的光照使模型清晰可见
 * @validates 需求 8.3: 纹理加载失败时继续渲染模型但使用默认材质
 * @validates 需求 8.5: 发生错误时在控制台记录详细错误信息用于调试
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import { useThreeScene } from '../composables/useThreeScene'
import { useModelLoader } from '../composables/useModelLoader'
import { fitCameraToModel } from '../utils/cameraUtils'
import ErrorDisplay from './ErrorDisplay.vue'

// Props 定义
const props = defineProps<{
  /** 宝可梦 ID，如 "pm0001" */
  pokemonId?: string | null
  /** 形态 ID，如 "pm0001_00_00" */
  formId?: string | null
}>()

// Emits 定义
const emit = defineEmits<{
  /** 加载状态变化事件 */
  (e: 'loading-change', loading: boolean): void
  /** 加载进度变化事件 */
  (e: 'progress-change', progress: number): void
  /** 错误事件 */
  (e: 'error', error: string | null): void
  /** 模型加载完成事件 */
  (e: 'model-loaded', formId: string): void
}>()

// Canvas 容器元素引用
const containerRef = ref<HTMLDivElement | null>(null)

// 使用 Three.js 场景 composable
const { 
  init, 
  dispose, 
  getCamera, 
  getControls,
  addToScene, 
  removeFromScene,
  removeTestObjects 
} = useThreeScene({
  container: containerRef
})

// 使用模型加载器 composable
const {
  loading,
  progress,
  progressInfo,
  error,
  currentModel,
  currentFormId,
  loadModel,
  disposeModel
} = useModelLoader()

// 场景是否已初始化
const sceneInitialized = ref(false)

// 是否已移除测试对象
const testObjectsRemoved = ref(false)

// 计算属性：是否有有效的模型路径
const hasValidModelPath = computed(() => {
  return props.pokemonId && props.formId
})

/**
 * 加载并显示模型
 * 
 * @validates 需求 5.1: 创建 Three.js Mesh 对象并添加到场景
 * @validates 需求 5.2: 自动调整摄像机位置以完整显示模型
 * @validates 需求 8.5: 发生错误时在控制台记录详细错误信息用于调试
 */
async function loadAndDisplayModel(pokemonId: string, formId: string): Promise<void> {
  // 确保场景已初始化
  if (!sceneInitialized.value) {
    console.warn('[ThreeViewer] 场景未初始化，无法加载模型')
    return
  }

  // 移除之前的模型
  if (currentModel.value) {
    removeFromScene(currentModel.value)
  }

  // 首次加载模型时移除测试对象
  if (!testObjectsRemoved.value) {
    removeTestObjects()
    testObjectsRemoved.value = true
  }

  try {
    // 加载模型
    // @validates 需求 8.5: 记录加载开始信息
    console.log(`[ThreeViewer] 开始加载模型: pokemonId=${pokemonId}, formId=${formId}`)
    
    await loadModel(pokemonId, formId)

    // 如果加载成功，将模型添加到场景
    if (currentModel.value) {
      // 需求 5.1: 添加模型到场景
      addToScene(currentModel.value)

      // 需求 5.2: 自动调整摄像机位置
      const camera = getCamera()
      const controls = getControls()
      
      if (camera) {
        const result = fitCameraToModel(currentModel.value, camera, controls)
        console.log(`[ThreeViewer] 摄像机已定位，距离: ${result.distance.toFixed(2)}`)
      }

      // 触发模型加载完成事件
      emit('model-loaded', formId)
      console.log(`[ThreeViewer] 模型加载完成: ${formId}`)
    }
  } catch (err) {
    // @validates 需求 8.5: 在控制台记录详细错误信息用于调试
    console.error('[ThreeViewer] 模型加载失败:', {
      pokemonId,
      formId,
      error: err,
      errorMessage: err instanceof Error ? err.message : String(err),
      errorStack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * 处理重试按钮点击
 * 重新加载当前模型
 * 
 * @validates 需求 8.4: 网络请求失败时显示重试选项
 */
function handleRetry(): void {
  if (props.pokemonId && props.formId) {
    console.log(`[ThreeViewer] 用户点击重试，重新加载模型: ${props.formId}`)
    loadAndDisplayModel(props.pokemonId, props.formId)
  }
}

// 监听 props 变化，加载对应模型
watch(
  () => [props.pokemonId, props.formId] as const,
  ([newPokemonId, newFormId], [oldPokemonId, oldFormId]) => {
    // 只有当 pokemonId 和 formId 都有效且发生变化时才加载
    if (newPokemonId && newFormId) {
      // 检查是否真的发生了变化
      if (newPokemonId !== oldPokemonId || newFormId !== oldFormId) {
        loadAndDisplayModel(newPokemonId, newFormId)
      }
    }
  },
  { immediate: false }
)

// 监听加载状态变化，触发事件
watch(loading, (newLoading) => {
  emit('loading-change', newLoading)
})

// 监听进度变化，触发事件
watch(progress, (newProgress) => {
  emit('progress-change', newProgress)
})

// 监听错误变化，触发事件
watch(error, (newError) => {
  emit('error', newError)
})

onMounted(() => {
  // 初始化 Three.js 场景
  init()
  sceneInitialized.value = true
  console.log('[ThreeViewer] 组件已挂载，场景已初始化')

  // 如果已有有效的模型路径，立即加载
  if (hasValidModelPath.value && props.pokemonId && props.formId) {
    loadAndDisplayModel(props.pokemonId, props.formId)
  }
})

onUnmounted(() => {
  // 清理模型资源
  disposeModel()
  // 清理 Three.js 资源
  dispose()
  sceneInitialized.value = false
  console.log('[ThreeViewer] 组件已卸载，资源已清理')
})

// 暴露状态给父组件
defineExpose({
  /** 是否正在加载 */
  loading,
  /** 加载进度 (0-100) */
  progress,
  /** 详细进度信息 */
  progressInfo,
  /** 错误信息 */
  error,
  /** 当前模型的形态 ID */
  currentFormId,
  /** 重新加载当前模型 */
  reload: () => {
    if (props.pokemonId && props.formId) {
      loadAndDisplayModel(props.pokemonId, props.formId)
    }
  }
})
</script>

<template>
  <div ref="containerRef" class="three-viewer-container">
    <!-- Three.js 将在此容器中创建 canvas 元素 -->
    
    <!-- 加载进度指示器 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text">{{ progressInfo.message }}</div>
        <div class="loading-progress">
          <div class="progress-bar" :style="{ width: `${progress}%` }"></div>
        </div>
        <div class="loading-percent">{{ progress }}%</div>
      </div>
    </div>

    <!-- 错误提示 - 使用 ErrorDisplay 组件 -->
    <!-- @validates 需求 8.2: 模型文件缺失时显示文件未找到的提示 -->
    <!-- @validates 需求 8.4: 网络请求失败时显示重试选项 -->
    <div v-if="error && !loading" class="error-overlay">
      <ErrorDisplay
        :error="error"
        title="模型加载失败"
        @retry="handleRetry"
      />
    </div>
  </div>
</template>

<style scoped>
.three-viewer-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  background-color: #1a1a2e;
}

/* 确保 Three.js 创建的 canvas 填满容器 */
.three-viewer-container :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

/* 加载进度覆盖层 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(26, 26, 46, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.loading-content {
  text-align: center;
  color: #ffffff;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #00d4ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 14px;
  margin-bottom: 12px;
  color: #a0a0a0;
}

.loading-progress {
  width: 200px;
  height: 4px;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
  margin: 0 auto 8px;
}

.progress-bar {
  height: 100%;
  background-color: #00d4ff;
  transition: width 0.3s ease;
}

.loading-percent {
  font-size: 12px;
  color: #00d4ff;
}

/* 错误提示覆盖层 */
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
}
</style>
