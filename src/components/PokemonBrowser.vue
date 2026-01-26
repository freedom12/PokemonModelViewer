<script setup lang="ts">
/**
 * PokemonBrowser.vue - 宝可梦浏览器组件
 * 
 * 负责：
 * - 显示宝可梦网格列表，包含缩略图和编号
 * - 实现形态选择下拉框
 * - 显示加载进度指示器
 * - 触发 select 事件通知父组件
 * - 显示列表加载错误并提供重试功能
 * 
 * @validates 需求 6.2: 宝可梦列表加载完成后显示宝可梦缩略图和编号
 * @validates 需求 6.3: 用户点击宝可梦时加载并显示该宝可梦的 3D 模型
 * @validates 需求 6.4: 宝可梦有多个形态时显示形态选择器
 * @validates 需求 6.5: 用户选择不同形态时切换显示对应形态的模型
 * @validates 需求 6.6: 模型加载中显示加载进度指示器
 * @validates 需求 8.4: 网络请求失败时显示重试选项
 * @validates 需求 8.5: 发生错误时在控制台记录详细错误信息用于调试
 */
import { ref, computed, onMounted, watch } from 'vue'
import { usePokemonList, type PokemonEntry, type FormEntry } from '../composables/usePokemonList'
import ErrorDisplay from './ErrorDisplay.vue'

/**
 * Props 定义
 */
interface Props {
  /** 当前选中的宝可梦 ID */
  selectedPokemon?: string | null
  /** 当前选中的形态 ID */
  selectedForm?: string | null
  /** 模型加载进度 (0-100) */
  loadingProgress?: number
  /** 是否正在加载模型 */
  isModelLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectedPokemon: null,
  selectedForm: null,
  loadingProgress: 0,
  isModelLoading: false
})

/**
 * Emits 定义
 */
const emit = defineEmits<{
  /** 选择宝可梦和形态时触发 */
  select: [pokemonId: string, formId: string]
}>()

// 使用宝可梦列表 composable
const { pokemons, loading, error, loadPokemonList } = usePokemonList()

// 当前选中的宝可梦（用于显示形态选择器）
const currentPokemon = ref<PokemonEntry | null>(null)

// 当前选中的形态 ID
const currentFormId = ref<string | null>(null)

/**
 * 获取当前宝可梦的形态列表
 */
const currentForms = computed<FormEntry[]>(() => {
  if (!currentPokemon.value) return []
  return currentPokemon.value.forms
})

/**
 * 是否显示形态选择器
 * 只有当宝可梦有多个形态时才显示
 * @validates 需求 6.4: 宝可梦有多个形态时显示形态选择器
 */
const showFormSelector = computed<boolean>(() => {
  return currentForms.value.length > 1
})

/**
 * 格式化宝可梦编号显示
 * @param number - 图鉴编号
 * @returns 格式化后的编号字符串，如 "#0001"
 */
function formatPokemonNumber(number: number): string {
  return `#${number.toString().padStart(4, '0')}`
}

/**
 * 格式化形态名称显示
 * @param form - 形态条目
 * @returns 格式化后的形态名称
 */
function formatFormName(form: FormEntry): string {
  if (form.formIndex === 0 && form.variantIndex === 0) {
    return '默认形态'
  }
  return `形态 ${form.formIndex}-${form.variantIndex}`
}

/**
 * 处理宝可梦点击事件
 * @param pokemon - 被点击的宝可梦
 * @validates 需求 6.3: 用户点击宝可梦时加载并显示该宝可梦的 3D 模型
 */
function handlePokemonClick(pokemon: PokemonEntry): void {
  currentPokemon.value = pokemon
  
  // 默认选择第一个形态
  const defaultForm = pokemon.forms[0]
  if (defaultForm) {
    currentFormId.value = defaultForm.id
    emit('select', pokemon.id, defaultForm.id)
  }
}

/**
 * 处理形态选择变化
 * @param event - 选择事件
 * @validates 需求 6.5: 用户选择不同形态时切换显示对应形态的模型
 */
function handleFormChange(event: Event): void {
  const target = event.target as HTMLSelectElement
  const formId = target.value
  
  if (formId && currentPokemon.value) {
    currentFormId.value = formId
    emit('select', currentPokemon.value.id, formId)
  }
}

/**
 * 处理重试按钮点击
 * @validates 需求 8.4: 网络请求失败时显示重试选项
 * @validates 需求 8.5: 发生错误时在控制台记录详细错误信息用于调试
 */
async function handleRetry(): Promise<void> {
  console.log('[PokemonBrowser] 用户点击重试，重新加载宝可梦列表')
  try {
    await loadPokemonList()
    console.log('[PokemonBrowser] 宝可梦列表重新加载成功')
  } catch (err) {
    // @validates 需求 8.5: 在控制台记录详细错误信息用于调试
    console.error('[PokemonBrowser] 宝可梦列表重新加载失败:', {
      error: err,
      errorMessage: err instanceof Error ? err.message : String(err),
      errorStack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * 处理缩略图加载错误
 * @param event - 错误事件
 * @validates 需求 8.5: 发生错误时在控制台记录详细错误信息用于调试
 */
function handleThumbnailError(event: Event): void {
  const img = event.target as HTMLImageElement
  const originalSrc = img.src
  
  // @validates 需求 8.5: 在控制台记录详细错误信息用于调试
  console.warn('[PokemonBrowser] 缩略图加载失败:', {
    originalSrc,
    timestamp: new Date().toISOString()
  })
  
  // 使用占位图片
  img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect fill="%23333" width="96" height="96"/><text fill="%23666" font-size="12" x="50%" y="50%" text-anchor="middle" dy=".3em">?</text></svg>'
}

// 监听 props 变化，同步内部状态
watch(() => props.selectedPokemon, (newPokemonId) => {
  if (newPokemonId) {
    const pokemon = pokemons.value.find(p => p.id === newPokemonId)
    if (pokemon) {
      currentPokemon.value = pokemon
    }
  }
}, { immediate: true })

watch(() => props.selectedForm, (newFormId) => {
  if (newFormId) {
    currentFormId.value = newFormId
  }
}, { immediate: true })

// 组件挂载时加载宝可梦列表
onMounted(async () => {
  console.log('[PokemonBrowser] 组件已挂载，开始加载宝可梦列表')
  try {
    await loadPokemonList()
    console.log(`[PokemonBrowser] 宝可梦列表加载成功，共 ${pokemons.value.length} 个宝可梦`)
  } catch (err) {
    // @validates 需求 8.5: 在控制台记录详细错误信息用于调试
    console.error('[PokemonBrowser] 宝可梦列表加载失败:', {
      error: err,
      errorMessage: err instanceof Error ? err.message : String(err),
      errorStack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString()
    })
  }
})
</script>

<template>
  <div class="pokemon-browser">
    <!-- 头部区域 -->
    <div class="browser-header">
      <h2 class="browser-title">宝可梦图鉴</h2>
      
      <!-- 形态选择器 -->
      <div v-if="showFormSelector" class="form-selector">
        <label for="form-select" class="form-label">形态:</label>
        <select
          id="form-select"
          :value="currentFormId"
          class="form-select"
          @change="handleFormChange"
        >
          <option
            v-for="form in currentForms"
            :key="form.id"
            :value="form.id"
          >
            {{ formatFormName(form) }}
          </option>
        </select>
      </div>
    </div>
    
    <!-- 加载进度指示器 -->
    <div v-if="isModelLoading" class="loading-indicator">
      <div class="loading-bar">
        <div 
          class="loading-progress" 
          :style="{ width: `${loadingProgress}%` }"
        ></div>
      </div>
      <span class="loading-text">加载中... {{ loadingProgress }}%</span>
    </div>
    
    <!-- 列表加载状态 -->
    <div v-if="loading" class="list-loading">
      <div class="spinner"></div>
      <span>加载宝可梦列表...</span>
    </div>
    
    <!-- 错误提示 - 使用 ErrorDisplay 组件 -->
    <!-- @validates 需求 8.4: 网络请求失败时显示重试选项 -->
    <div v-else-if="error" class="error-wrapper">
      <ErrorDisplay
        :error="error"
        title="列表加载失败"
        @retry="handleRetry"
      />
    </div>
    
    <!-- 宝可梦网格列表 -->
    <div v-else class="pokemon-grid">
      <div
        v-for="pokemon in pokemons"
        :key="pokemon.id"
        class="pokemon-card"
        :class="{ 'selected': pokemon.id === currentPokemon?.id }"
        @click="handlePokemonClick(pokemon)"
      >
        <!-- 缩略图 -->
        <div class="pokemon-thumbnail">
          <img
            :src="pokemon.thumbnail"
            :alt="`Pokemon ${pokemon.number}`"
            loading="lazy"
            @error="handleThumbnailError"
          />
        </div>
        
        <!-- 编号 -->
        <div class="pokemon-number">
          {{ formatPokemonNumber(pokemon.number) }}
        </div>
        
        <!-- 形态数量标记 -->
        <div v-if="pokemon.forms.length > 1" class="form-badge">
          {{ pokemon.forms.length }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pokemon-browser {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #1a1a2e;
  color: #fff;
  overflow: hidden;
}

/* 头部区域 */
.browser-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background-color: #16213e;
  border-bottom: 1px solid #0f3460;
  flex-shrink: 0;
}

.browser-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: #e94560;
}

/* 形态选择器 */
.form-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-label {
  font-size: 0.875rem;
  color: #a0a0a0;
}

.form-select {
  padding: 6px 12px;
  font-size: 0.875rem;
  background-color: #0f3460;
  color: #fff;
  border: 1px solid #1a1a2e;
  border-radius: 4px;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;
}

.form-select:hover,
.form-select:focus {
  border-color: #e94560;
}

/* 加载进度指示器 */
.loading-indicator {
  padding: 12px 16px;
  background-color: #16213e;
  border-bottom: 1px solid #0f3460;
  flex-shrink: 0;
}

.loading-bar {
  height: 4px;
  background-color: #0f3460;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
}

.loading-progress {
  height: 100%;
  background: linear-gradient(90deg, #e94560, #ff6b6b);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.loading-text {
  font-size: 0.75rem;
  color: #a0a0a0;
}

/* 列表加载状态 */
.list-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  gap: 16px;
  color: #a0a0a0;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #0f3460;
  border-top-color: #e94560;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 错误提示包装器 */
.error-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

/* 宝可梦网格列表 */
.pokemon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}

/* 宝可梦卡片 */
.pokemon-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  background-color: #16213e;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pokemon-card:hover {
  background-color: #1f2b4a;
  border-color: #0f3460;
  transform: translateY(-2px);
}

.pokemon-card.selected {
  background-color: #0f3460;
  border-color: #e94560;
}

/* 缩略图 */
.pokemon-thumbnail {
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.pokemon-thumbnail img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}

/* 编号 */
.pokemon-number {
  font-size: 0.75rem;
  font-weight: 500;
  color: #a0a0a0;
}

.pokemon-card.selected .pokemon-number {
  color: #fff;
}

/* 形态数量标记 */
.form-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
  background-color: #e94560;
  color: #fff;
  border-radius: 9px;
}

/* 滚动条样式 */
.pokemon-grid::-webkit-scrollbar {
  width: 8px;
}

.pokemon-grid::-webkit-scrollbar-track {
  background: #16213e;
}

.pokemon-grid::-webkit-scrollbar-thumb {
  background: #0f3460;
  border-radius: 4px;
}

.pokemon-grid::-webkit-scrollbar-thumb:hover {
  background: #1a4a7a;
}
</style>
