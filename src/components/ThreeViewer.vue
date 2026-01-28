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
import * as THREE from 'three'
import { useThreeScene } from '../composables/useThreeScene'
import { useModelLoader } from '../composables/useModelLoader'
import { fitCameraToModel } from '../utils/cameraUtils'
import ErrorDisplay from './ErrorDisplay.vue'
import { AnimationPlayer } from '../services/animationPlayer'
import { VisibilityAnimationPlayer } from '../services/visibilityAnimationPlayer'

// Props 定义
const props = defineProps<{
  /** 宝可梦 ID，如 "pm0001" */
  pokemonId?: string | null
  /** 形态 ID，如 "pm0001_00_00" */
  formId?: string | null
  /** 可用的动画数据 */
  animations?: Record<string, string[]> | null
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
  setVertexNormalsVisible,
  setWireframeMode,
  handleMouseClick,
  highlightSelectedTriangle,
  highlightSelectedBone,
  createSkeletonVisualization,
  setSkeletonVisible,
  getSkeletonGroup,
  setSelectionMode
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
  currentParsedData,
  loadModel,
  disposeModel
} = useModelLoader()

// 场景是否已初始化
const sceneInitialized = ref(false)

// 是否显示顶点法线
const showVertexNormals = ref(false)

// 是否显示网格线框
const showWireframe = ref(false)

// 是否显示骨骼
const showSkeleton = ref(false)

// 选择模式：'mesh' 或 'bone'
const selectionMode = ref<'mesh' | 'bone'>('mesh')

// 动画相关状态
const availableAnimations = ref<Record<string, string[]>>({})
const selectedAnimation = ref<string>('')
const isAnimationPlaying = ref(false)
const animationLoop = ref(true)

// 动画播放器实例
const animationPlayer = new AnimationPlayer()

// 可见性动画播放器实例
const visibilityAnimationPlayer = new VisibilityAnimationPlayer()

// 选中的三角形信息
const selectedTriangle = ref<{
  mesh: THREE.Mesh | null
  faceIndex: number | null
  vertices: Array<{
    position: THREE.Vector3
    normal: THREE.Vector3
    uv?: THREE.Vector2
  }> | null
} | null>(null)

// 选中的骨骼信息
const selectedBone = ref<{
  boneIndex: number
  boneName: string
  worldPosition: THREE.Vector3
  localPosition: THREE.Vector3
} | null>(null)

// 计算属性：是否有有效的模型路径
const hasValidModelPath = computed(() => {
  return props.pokemonId && props.formId
})

// 计算属性：是否有动画可用
const hasAnimations = computed(() => {
  return Object.keys(availableAnimations.value).length > 0
})

// 计算属性：动画选项列表
const animationOptions = computed(() => {
  return Object.keys(availableAnimations.value)
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

  // 切换模型时清空当前选择的mesh、骨骼和动画数据
  selectedTriangle.value = null
  selectedBone.value = null
  selectedAnimation.value = ''
  isAnimationPlaying.value = false
  animationPlayer.stop()

  // 清除视觉高亮显示
  highlightSelectedTriangle(null, null)
  highlightSelectedBone(null)

  // 移除之前的模型
  if (currentModel.value) {
    removeFromScene(currentModel.value)
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

      // 如果有骨骼数据，创建骨骼可视化
      if (currentParsedData.value?.trskl) {
        createSkeletonVisualization(currentParsedData.value.trskl)
        // 根据当前设置设置骨骼可见性
        setSkeletonVisible(showSkeleton.value)
        console.log(`[ThreeViewer] 骨骼可视化创建完成`)

        // 设置骨骼给动画播放器
        const skeletonGroup = getCurrentSkeletonGroup()
        if (skeletonGroup) {
          animationPlayer.setSkeleton(skeletonGroup)
          console.log(`[ThreeViewer] 可视化骨骼已设置给动画播放器`)
        }

        // 设置THREE.Skeleton给动画播放器（用于蒙皮动画）
        currentModel.value?.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh && child.skeleton) {
            animationPlayer.setThreeSkeleton(child.skeleton)
            console.log(`[ThreeViewer] THREE.Skeleton已设置给动画播放器`)
          }
        })
      }

      // 设置模型组给可见性动画播放器
      visibilityAnimationPlayer.setModelGroup(currentModel.value)
      console.log(`[ThreeViewer] 模型已设置给可见性动画播放器`)

      // 根据当前设置显示顶点法线用于调试
      setVertexNormalsVisible(showVertexNormals.value, currentModel.value || undefined)

      // 根据当前设置应用线框模式
      setWireframeMode(showWireframe.value, currentModel.value || undefined)
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

// 监听动画数据变化
watch(() => props.animations, (newAnimations) => {
  availableAnimations.value = newAnimations || {}
  // 如果当前没有选中动画且有可用动画，选择第一个
  if (!selectedAnimation.value && Object.keys(availableAnimations.value).length > 0) {
    selectedAnimation.value = Object.keys(availableAnimations.value)[0]
  }
}, { immediate: true })

/**
 * 切换播放/暂停状态
 */
function togglePlayPause(): void {
  if (isAnimationPlaying.value) {
    // 暂停动画
    console.log(`[ThreeViewer] 暂停动画播放`)
    isAnimationPlaying.value = false
    animationPlayer.pause()
  } else {
    // 播放动画
    if (!selectedAnimation.value || !availableAnimations.value[selectedAnimation.value]) {
      console.warn('[ThreeViewer] 没有选中的动画或动画文件不存在')
      return
    }

    console.log(`[ThreeViewer] 开始播放动画: ${selectedAnimation.value}`)
    isAnimationPlaying.value = true

    // 加载并播放动画
    loadAndPlayAnimation(selectedAnimation.value)
  }
}

/**
 * 停止动画播放
 */
function stopAnimation(): void {
  console.log(`[ThreeViewer] 停止动画播放`)
  isAnimationPlaying.value = false
  animationPlayer.stop()
  visibilityAnimationPlayer.stop()
}

/**
 * 加载并播放动画
 */
async function loadAndPlayAnimation(animationName: string): Promise<void> {
  try {
    const animationFiles = availableAnimations.value[animationName]
    if (!animationFiles || animationFiles.length === 0) {
      throw new Error(`No animation files found for ${animationName}`)
    }

    // 选择第一个.tranm文件（骨骼动画）
    const tranmFile = animationFiles.find(file => file.endsWith('.tranm'))
    if (!tranmFile) {
      throw new Error(`No .tranm file found for animation ${animationName}`)
    }

    // 构建动画文件URL
    // formId 格式为 "pmXXXX_XX_XX"，需要从中提取 pokemonId "pmXXXX"
    const pokemonId = props.formId ? props.formId.split('_')[0] : 'pm0004' // 从 "pm0004_00_00" 提取 "pm0004"
    const animationUrl = `/pokemon/${pokemonId}/${props.formId}/${tranmFile}`

    // 加载骨骼动画数据
    await animationPlayer.loadAnimation(animationUrl)

    // 设置循环模式
    animationPlayer.setLoop(animationLoop.value)

    // 设置骨骼（如果有骨骼可视化）
    const skeletonGroup = getCurrentSkeletonGroup()
    if (skeletonGroup) {
      animationPlayer.setSkeleton(skeletonGroup)
    }

    // 开始播放骨骼动画
    animationPlayer.play()

    // 尝试加载对应的 tracm 文件（可见性动画）
    const tracmFile = animationFiles.find(file => file.endsWith('.tracm'))
    if (tracmFile) {
      try {
        const tracmUrl = `/pokemon/${pokemonId}/${props.formId}/${tracmFile}`
        await visibilityAnimationPlayer.loadAnimation(tracmUrl)
        visibilityAnimationPlayer.setLoop(animationLoop.value)
        visibilityAnimationPlayer.play()
        console.log(`[ThreeViewer] 可见性动画已加载并开始播放: ${tracmFile}`)
      } catch (tracmError) {
        console.warn('[ThreeViewer] Failed to load visibility animation:', tracmError)
        // 可见性动画失败不影响骨骼动画继续播放
      }
    }

  } catch (error) {
    console.error('[ThreeViewer] Failed to load animation:', error)
    isAnimationPlaying.value = false
    // 可以在这里显示错误提示给用户
  }
}

/**
 * 获取骨骼组
 */
function getCurrentSkeletonGroup(): THREE.Group | null {
  return getSkeletonGroup()
}

/**
 * 切换动画循环模式
 */
function toggleAnimationLoop(): void {
  animationLoop.value = !animationLoop.value
  animationPlayer.setLoop(animationLoop.value)
  visibilityAnimationPlayer.setLoop(animationLoop.value)
  console.log(`[ThreeViewer] 动画循环模式: ${animationLoop.value ? '开启' : '关闭'}`)
}

// 监听法线显示状态变化
watch(showVertexNormals, (newShow) => {
  setVertexNormalsVisible(newShow, currentModel.value || undefined)
})

// 监听网格线框显示状态变化
watch(showWireframe, (newShow) => {
  setWireframeMode(newShow, currentModel.value || undefined)
})

// 监听骨骼显示状态变化
watch(showSkeleton, (newShow) => {
  setSkeletonVisible(newShow)
})

// 监听选择模式变化
watch(selectionMode, (newMode) => {
  setSelectionMode(newMode)
  // 切换模式时清除当前的选择状态
  selectedTriangle.value = null
  selectedBone.value = null
  // 清除视觉高亮显示
  highlightSelectedTriangle(null, null)
  highlightSelectedBone(null)
})

// 监听选中的动画变化，如果当前正在播放则立即切换到新动画
watch(selectedAnimation, (newAnimation, oldAnimation) => {
  // 只有当动画真正改变时才处理
  if (newAnimation !== oldAnimation && newAnimation) {
    if (isAnimationPlaying.value) {
      // 如果当前正在播放，停止当前动画并开始播放新动画
      console.log(`[ThreeViewer] 切换动画: ${oldAnimation} -> ${newAnimation}`)
      animationPlayer.stop()
      loadAndPlayAnimation(newAnimation)
    }
  }
})

onMounted(() => {
  // 初始化 Three.js 场景
  init()
  sceneInitialized.value = true
  console.log('[ThreeViewer] 组件已挂载，场景已初始化')

  // 添加鼠标点击事件监听器
  const container = containerRef.value
  if (container) {
    container.addEventListener('click', handleContainerClick)
  }

  // 如果已有有效的模型路径，立即加载
  if (hasValidModelPath.value && props.pokemonId && props.formId) {
    loadAndDisplayModel(props.pokemonId, props.formId)
  }
})

/**
 * 处理容器点击事件
 */
function handleContainerClick(event: MouseEvent): void {
  if (!currentModel.value) {
    return
  }

  const result = handleMouseClick(event, currentModel.value)
  if (result) {
    if (result.type === 'mesh') {
      selectedTriangle.value = {
        mesh: result.mesh,
        faceIndex: result.faceIndex,
        vertices: result.vertices
      }
      highlightSelectedTriangle(result.mesh, result.faceIndex)
    } else if (result.type === 'bone') {
      selectedBone.value = {
        boneIndex: result.boneIndex,
        boneName: result.boneName,
        worldPosition: result.worldPosition,
        localPosition: result.localPosition
      }
      highlightSelectedBone(result.boneIndex)
    }
  }
  // 注意：点击空白区域时不清除当前选中的信息
}

onUnmounted(() => {
  // 移除鼠标点击事件监听器
  const container = containerRef.value
  if (container) {
    container.removeEventListener('click', handleContainerClick)
  }

  // 清理模型资源
  disposeModel()
  // 清理动画播放器
  animationPlayer.dispose()
  visibilityAnimationPlayer.dispose()
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
    
    <!-- 控制面板 -->
    <div class="control-panel">
      <label class="control-item">
        <input 
          type="checkbox" 
          v-model="showVertexNormals"
          class="control-checkbox"
        />
        <span class="control-label">显示顶点法线</span>
      </label>
      <label class="control-item">
        <input 
          type="checkbox" 
          v-model="showWireframe"
          class="control-checkbox"
        />
        <span class="control-label">显示网格线框</span>
      </label>
      <label class="control-item">
        <input 
          type="checkbox" 
          v-model="showSkeleton"
          class="control-checkbox"
        />
        <span class="control-label">显示骨骼</span>
      </label>
      <div class="control-item">
        <span class="control-label">选择模式:</span>
        <select v-model="selectionMode" class="control-select">
          <option value="mesh">面片</option>
          <option value="bone">骨骼</option>
        </select>
      </div>
    </div>
    
    <!-- 动画控制器 -->
    <div v-if="hasAnimations" class="animation-controller">
      <div class="animation-controls">
        <div class="control-item">
          <span class="control-label">动画:</span>
          <select v-model="selectedAnimation" class="control-select">
            <option v-for="animation in animationOptions" :key="animation" :value="animation">
              {{ animation }}
            </option>
          </select>
        </div>
        
        <div class="animation-buttons">
          <button 
            @click="togglePlayPause" 
            class="animation-btn play-pause-btn"
            :class="{ playing: isAnimationPlaying }"
          >
            {{ isAnimationPlaying ? '⏸️ 暂停' : '▶️ 播放' }}
          </button>
          <button 
            @click="stopAnimation" 
            class="animation-btn stop-btn"
          >
            ⏹️ 停止
          </button>
        </div>
        
        <label class="control-item loop-control">
          <input 
            type="checkbox" 
            v-model="animationLoop"
            class="control-checkbox"
          />
          <span class="control-label">循环播放</span>
        </label>
      </div>
    </div>
    
    <!-- 三角形信息面板 -->
    <div v-if="selectedTriangle" class="selection-info-panel">
      <h4 class="selection-info-title">选中三角形信息</h4>
      <div class="selection-info-content">
        <div class="selection-info-item">
          <strong>Mesh:</strong> {{ selectedTriangle.mesh?.name || 'Unnamed' }}
        </div>
        <div class="selection-info-item">
          <strong>Face Index:</strong> {{ selectedTriangle.faceIndex }}
        </div>
        <div class="triangle-vertices">
          <div class="vertex-info" v-for="(vertex, index) in selectedTriangle.vertices" :key="index">
            <h5>顶点 {{ index + 1 }}</h5>
            <div class="vertex-detail">
              <div><strong>位置:</strong> ({{ vertex.position.x.toFixed(3) }}, {{ vertex.position.y.toFixed(3) }}, {{ vertex.position.z.toFixed(3) }})</div>
              <div><strong>法线:</strong> ({{ vertex.normal.x.toFixed(3) }}, {{ vertex.normal.y.toFixed(3) }}, {{ vertex.normal.z.toFixed(3) }})</div>
              <div v-if="vertex.uv"><strong>UV:</strong> ({{ vertex.uv.x.toFixed(3) }}, {{ vertex.uv.y.toFixed(3) }})</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 骨骼信息面板 -->
    <div v-if="selectedBone" class="selection-info-panel">
      <h4 class="selection-info-title">选中骨骼信息</h4>
      <div class="selection-info-content">
        <div class="selection-info-item bone-info-mono">
          <strong>骨骼名称:</strong> {{ selectedBone.boneName }}
        </div>
        <div class="selection-info-item bone-info-mono">
          <strong>骨骼索引:</strong> {{ selectedBone.boneIndex }}
        </div>
        <div class="bone-info-item">
          <strong>世界坐标:</strong> ({{ selectedBone.worldPosition.x.toFixed(3) }}, {{ selectedBone.worldPosition.y.toFixed(3) }}, {{ selectedBone.worldPosition.z.toFixed(3) }})
        </div>
        <div class="bone-info-item">
          <strong>本地坐标:</strong> ({{ selectedBone.localPosition.x.toFixed(3) }}, {{ selectedBone.localPosition.y.toFixed(3) }}, {{ selectedBone.localPosition.z.toFixed(3) }})
        </div>
      </div>
    </div>
    
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

/* 控制面板 */
.control-panel {
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  padding: 10px;
  border-radius: 5px;
  z-index: 50;
}

.control-item {
  display: flex;
  align-items: center;
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
  user-select: none;
}

.control-checkbox {
  margin-right: 8px;
  cursor: pointer;
}

.control-label {
  cursor: pointer;
}

.control-select {
  margin-left: 8px;
  padding: 2px 4px;
  background-color: rgba(0, 0, 0, 0.7);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 3px;
  font-size: 12px;
}

.control-select option {
  background-color: rgba(0, 0, 0, 0.9);
  color: #ffffff;
}

/* 选中信息面板 */
.selection-info-panel {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background-color: rgba(0, 0, 0, 0.8);
  padding: 15px;
  border-radius: 5px;
  width: 250px;
  max-height: 400px;
  overflow-y: auto;
  z-index: 50;
  color: #ffffff;
  font-size: 12px;
}

.selection-info-title {
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: bold;
  color: #00d4ff;
}

.selection-info-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.selection-info-item {
  margin-bottom: 5px;
}

.bone-info-mono {
  font-family: monospace;
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

/* 动画控制器 */
.animation-controller {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background-color: rgba(0, 0, 0, 0.8);
  padding: 15px;
  border-radius: 5px;
  z-index: 50;
  color: #ffffff;
  font-size: 12px;
  min-width: 300px;
}

.animation-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.animation-buttons {
  display: flex;
  gap: 8px;
}

.animation-btn {
  padding: 6px 12px;
  background-color: rgba(0, 0, 0, 0.7);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s ease;
}

.animation-btn:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.5);
}

.animation-btn.active {
  background-color: #00d4ff;
  border-color: #00d4ff;
}

.play-pause-btn.playing {
  background-color: #ff6b6b;
  border-color: #ff6b6b;
}

.loop-control {
  margin-top: 5px;
}
</style>
