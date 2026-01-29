/**
 * usePokemonList.ts - 宝可梦列表 composable
 * 
 * 封装宝可梦列表加载和管理的业务逻辑，提供响应式状态管理
 * 
 * @module composables/usePokemonList
 * 
 * @validates 需求 6.1: 应用启动时扫描 public/[directory] 目录获取可用宝可梦列表
 * @validates 需求 6.4: 宝可梦有多个形态时显示形态选择器
 */

import { ref, type Ref } from 'vue'

/**
 * 形态条目
 */
export interface FormEntry {
  /** 完整的形态 ID，如 "pm0001_00_00" */
  id: string
  /** 形态索引 */
  formIndex: number
  /** 变体索引 */
  variantIndex: number
  /** 缩略图路径 */
  thumbnail: string
}

/**
 * 宝可梦条目
 */
export interface PokemonEntry {
  /** 宝可梦 ID，如 "pm0001" */
  id: string
  /** 图鉴编号 */
  number: number
  /** 形态列表 */
  forms: FormEntry[]
  /** 缩略图路径（使用第一个形态的缩略图） */
  thumbnail: string
}

/**
 * index.json 文件中的原始数据格式
 */
interface PokemonIndexData {
  /** 宝可梦 ID 列表 */
  pokemonIds: string[]
}

/**
 * 创建宝可梦列表 composable
 * @param directory - 数据目录名，如 'SCVI' 或 'LZA'
 */

/**
 * 单个宝可梦的 index.json 数据格式
 */
interface PokemonDetailData {
  id: string
  number: number
  forms: Array<{
    id: string
    formIndex: number
    variantIndex: number
    icon: string
    animations: Record<string, string[]>
  }>
}

/**
 * usePokemonList 返回值接口
 */
export interface UsePokemonListReturn {
  /** 宝可梦列表 */
  pokemons: Ref<PokemonEntry[]>
  /** 是否正在加载 */
  loading: Ref<boolean>
  /** 错误信息 */
  error: Ref<string | null>
  
  /**
   * 加载宝可梦列表
   * 从 public/SCVI/index.json 加载预生成的宝可梦列表数据
   */
  loadPokemonList: () => Promise<void>
  
  /**
   * 获取指定宝可梦的所有形态
   * @param pokemonId - 宝可梦 ID，如 "pm0001"
   * @returns 形态列表，如果宝可梦不存在则返回空数组
   */
  getPokemonForms: (pokemonId: string) => FormEntry[]
}

/**
 * 宝可梦列表 composable
 * 
 * 提供宝可梦列表的加载和管理功能
 * 
 * @param directory - 数据目录名，默认为 'SCVI'
 * @returns UsePokemonListReturn 包含状态和方法的对象
 * 
 * @example
 * ```vue
 * <script setup>
 * import { usePokemonList } from '@/composables/usePokemonList'
 * import { onMounted } from 'vue'
 * 
 * const { pokemons, loading, error, loadPokemonList, getPokemonForms } = usePokemonList()
 * 
 * onMounted(async () => {
 *   await loadPokemonList()
 * })
 * 
 * // 获取某个宝可梦的所有形态
 * const forms = getPokemonForms('pm0001')
 * </script>
 * ```
 * 
 * @validates 需求 6.1: 应用启动时扫描 public/SCVI 目录获取可用宝可梦列表
 * @validates 需求 6.4: 宝可梦有多个形态时显示形态选择器
 */
export function usePokemonList(directory: Ref<string> = ref('SCVI')): UsePokemonListReturn {
  // 响应式状态
  const pokemons = ref<PokemonEntry[]>([])
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)
  
  /**
   * 加载宝可梦列表
   * 
   * 先从 index.json 加载宝可梦 ID 列表，然后分批加载每个宝可梦的详细信息
   * 避免一次性加载大量数据，提高性能和用户体验
   * 
   * @validates 需求 6.1: 应用启动时扫描 public/SCVI 目录获取可用宝可梦列表
   */
  async function loadPokemonList(): Promise<void> {
    // 如果正在加载，忽略重复请求
    if (loading.value) {
      console.warn('[usePokemonList] 列表正在加载中，忽略重复请求')
      return
    }
    
    // 重置状态
    loading.value = true
    error.value = null
    pokemons.value = []
    
    try {
      // 1. 先加载宝可梦 ID 列表
      const response = await fetch(`/${directory.value}/index.json`)
      
      if (!response.ok) {
        throw new Error(`加载宝可梦列表失败: HTTP ${response.status}`)
      }
      
      const data: PokemonIndexData = await response.json()
      const pokemonIds = data.pokemonIds
      
      console.log(`[usePokemonList] 发现 ${pokemonIds.length} 个宝可梦，开始分批加载...`)
      
      // 2. 分批加载宝可梦详细信息
      const BATCH_SIZE = 5 // 每批加载 5 个宝可梦
      const pokemonList: PokemonEntry[] = []
      
      for (let i = 0; i < pokemonIds.length; i += BATCH_SIZE) {
        const batch = pokemonIds.slice(i, i + BATCH_SIZE)
        console.log(`[usePokemonList] 加载第 ${Math.floor(i / BATCH_SIZE) + 1} 批 (${batch.length} 个宝可梦)...`)
        
        // 并行加载这一批的宝可梦数据
        const batchPromises = batch.map(async (pokemonId) => {
          try {
            const pokemonResponse = await fetch(`/${directory.value}/${pokemonId}/index.json`)
            if (!pokemonResponse.ok) {
              console.warn(`[usePokemonList] 加载 ${pokemonId} 失败: HTTP ${pokemonResponse.status}`)
              return null
            }
            
            const pokemonData: PokemonDetailData = await pokemonResponse.json()
            
            // 转换形态数据
            const forms: FormEntry[] = pokemonData.forms.map((form) => ({
              id: form.id,
              formIndex: form.formIndex,
              variantIndex: form.variantIndex,
              thumbnail: `/${directory.value}/${pokemonData.id}/${form.id}/${form.icon}`
            }))
            
            // 使用第一个形态的缩略图作为宝可梦的缩略图
            const thumbnail = forms.length > 0 ? forms[0].thumbnail : ''
            
            return {
              id: pokemonData.id,
              number: pokemonData.number,
              forms,
              thumbnail
            } as PokemonEntry
          } catch (err) {
            console.warn(`[usePokemonList] 加载 ${pokemonId} 时出错:`, err)
            return null
          }
        })
        
        // 等待这一批加载完成
        const batchResults = await Promise.all(batchPromises)
        
        // 过滤掉加载失败的宝可梦
        const validPokemons = batchResults.filter((pokemon): pokemon is PokemonEntry => pokemon !== null)
        
        // 添加到总列表
        pokemonList.push(...validPokemons)
        
        // 更新响应式状态，让 UI 可以逐步显示
        pokemons.value = [...pokemonList]
        
        console.log(`[usePokemonList] 第 ${Math.floor(i / BATCH_SIZE) + 1} 批加载完成，当前共 ${pokemonList.length} 个宝可梦`)
      }
      
      // 最终按图鉴编号排序
      pokemonList.sort((a, b) => a.number - b.number)
      pokemons.value = pokemonList
      
      console.log(`[usePokemonList] 所有宝可梦加载完成，共 ${pokemonList.length} 个`)
      
    } catch (err) {
      const errorMessage = formatError(err)
      error.value = errorMessage
      
      // @validates 需求 8.5: 发生错误时在控制台记录详细错误信息用于调试
      console.error('[usePokemonList] 加载宝可梦列表失败:', {
        errorMessage,
        originalError: err,
        errorStack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString()
      })
      
      // 清空列表
      pokemons.value = []
      
    } finally {
      loading.value = false
    }
  }
  
  /**
   * 获取指定宝可梦的所有形态
   * 
   * @param pokemonId - 宝可梦 ID，如 "pm0001"
   * @returns 形态列表，如果宝可梦不存在则返回空数组
   * 
   * @validates 需求 6.4: 宝可梦有多个形态时显示形态选择器
   */
  function getPokemonForms(pokemonId: string): FormEntry[] {
    const pokemon = pokemons.value.find((p) => p.id === pokemonId)
    return pokemon ? pokemon.forms : []
  }
  
  return {
    pokemons,
    loading,
    error,
    loadPokemonList,
    getPokemonForms
  }
}

/**
 * 格式化错误信息
 * 
 * @param err - 错误对象
 * @returns 用户友好的错误信息
 */
function formatError(err: unknown): string {
  if (err instanceof Error) {
    // 检查是否为网络错误
    if (err.message.includes('fetch') || err.message.includes('network')) {
      return '网络请求失败，请检查网络连接'
    }
    return err.message
  }
  return String(err)
}

export default usePokemonList
