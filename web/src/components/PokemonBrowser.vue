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
import { ref, onMounted, watch } from 'vue'
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
}

const props = withDefaults(defineProps<Props>(), {
  selectedPokemon: null,
  selectedForm: null
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

// 宝可梦名字映射
const pokemonNames = ref<Record<string, string>>({})

// 当前选中的宝可梦（用于显示形态选择器）
const currentPokemon = ref<PokemonEntry | null>(null)

// 当前选中的形态 ID
const currentFormId = ref<string | null>(null)

/**
 * 获取宝可梦名字
 * @param number - 图鉴编号
 * @returns 宝可梦名字
 */
function getPokemonName(number: number): string {
  const name = pokemonNames.value[number.toString()]
  return name ? `${number.toString().padStart(3, '0')} ${name}` : `宝可梦 ${number}`
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
 * 处理形态选择变化（针对每个条目的选择器）
 * @param event - 选择事件
 * @param pokemon - 对应的宝可梦
 * @validates 需求 6.5: 用户选择不同形态时切换显示对应形态的模型
 */
function handleFormChangeForItem(event: Event, pokemon: PokemonEntry): void {
  const target = event.target as HTMLSelectElement
  const formId = target.value
  
  if (formId) {
    currentPokemon.value = pokemon
    currentFormId.value = formId
    emit('select', pokemon.id, formId)
  }
}

/**
 * 加载宝可梦名字数据
 */
async function loadPokemonNames(): Promise<void> {
  try {
    const response = await fetch('/pokemon_name.json')
    if (!response.ok) {
      throw new Error(`加载宝可梦名字失败: HTTP ${response.status}`)
    }
    const data = await response.json()
    pokemonNames.value = data
    console.log('[PokemonBrowser] 宝可梦名字加载成功')
  } catch (err) {
    console.error('[PokemonBrowser] 宝可梦名字加载失败:', err)
  }
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

/**
 * 处理重试按钮点击
 * @validates 需求 8.4: 网络请求失败时显示重试选项
 * @validates 需求 8.5: 发生错误时在控制台记录详细错误信息用于调试
 */
async function handleRetry(): Promise<void> {
  console.log('[PokemonBrowser] 用户点击重试，重新加载数据')
  try {
    await Promise.all([
      loadPokemonList(),
      loadPokemonNames()
    ])
    console.log('[PokemonBrowser] 数据重新加载成功')
  } catch (err) {
    // @validates 需求 8.5: 在控制台记录详细错误信息用于调试
    console.error('[PokemonBrowser] 数据重新加载失败:', {
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

// 组件挂载时加载宝可梦列表和名字数据
onMounted(async () => {
  console.log('[PokemonBrowser] 组件已挂载，开始加载数据')
  try {
    await Promise.all([
      loadPokemonList(),
      loadPokemonNames()
    ])
    console.log(`[PokemonBrowser] 数据加载成功，共 ${pokemons.value.length} 个宝可梦`)
  } catch (err) {
    // @validates 需求 8.5: 在控制台记录详细错误信息用于调试
    console.error('[PokemonBrowser] 数据加载失败:', {
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
    
    <!-- 宝可梦列表 -->
    <div v-else class="pokemon-list">
      <div
        v-for="pokemon in pokemons"
        :key="pokemon.id"
        class="pokemon-item"
        :class="{ 'selected': pokemon.id === currentPokemon?.id }"
        @click="handlePokemonClick(pokemon)"
      >
        <!-- 左侧图标 -->
        <div class="pokemon-icon">
          <img
            :src="pokemon.thumbnail"
            :alt="`Pokemon ${pokemon.number}`"
            loading="lazy"
            @error="handleThumbnailError"
          />
        </div>
        
        <!-- 中间名字 -->
        <div class="pokemon-name">
          {{ getPokemonName(pokemon.number) }}
        </div>
        
        <!-- 右侧形态选择器 -->
        <div v-if="pokemon.forms.length > 1" class="pokemon-form-selector">
          <select
            :value="currentPokemon?.id === pokemon.id ? currentFormId : pokemon.forms[0].id"
            class="form-select"
            @change="handleFormChangeForItem($event, pokemon)"
            @click.stop
          >
            <option
              v-for="form in pokemon.forms"
              :key="form.id"
              :value="form.id"
            >
              {{ formatFormName(form) }}
            </option>
          </select>
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

/* 宝可梦列表 */
.pokemon-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}

/* 宝可梦条目 */
.pokemon-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background-color: #16213e;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pokemon-item:hover {
  background-color: #1f2b4a;
  border-color: #0f3460;
  transform: translateY(-1px);
}

.pokemon-item.selected {
  background-color: #0f3460;
  border-color: #e94560;
}

/* 左侧图标 */
.pokemon-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  flex-shrink: 0;
}

.pokemon-icon img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}

/* 中间名字 */
.pokemon-name {
  flex: 1;
  font-size: 1rem;
  font-weight: 500;
  color: #fff;
}

.pokemon-item.selected .pokemon-name {
  color: #e94560;
}

/* 右侧形态选择器 */
.pokemon-form-selector {
  margin-left: 12px;
  flex-shrink: 0;
}

.pokemon-form-selector .form-select {
  padding: 4px 8px;
  font-size: 0.75rem;
  background-color: #0f3460;
  color: #fff;
  border: 1px solid #1a1a2e;
  border-radius: 4px;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;
}

.pokemon-form-selector .form-select:hover,
.pokemon-form-selector .form-select:focus {
  border-color: #e94560;
}

/* 滚动条样式 */
.pokemon-list::-webkit-scrollbar {
  width: 8px;
}

.pokemon-list::-webkit-scrollbar-track {
  background: #16213e;
}

.pokemon-list::-webkit-scrollbar-thumb {
  background: #0f3460;
  border-radius: 4px;
}

.pokemon-list::-webkit-scrollbar-thumb:hover {
  background: #1a4a7a;
}
</style>
