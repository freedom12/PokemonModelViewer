/**
 * usePokemonList.ts - 宝可梦列表 composable
 * 
 * 封装宝可梦列表加载和管理的业务逻辑，提供响应式状态管理
 * 
 * @module composables/usePokemonList
 * 
 * @validates 需求 6.1: 应用启动时扫描 public/pokemon 目录获取可用宝可梦列表
 * @validates 需求 6.4: 宝可梦有多个形态时显示形态选择器
 */

import { ref, type Ref } from 'vue'
import { getThumbnailPath } from '../utils/pokemonPath'

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
  /** 宝可梦列表 */
  pokemons: Array<{
    id: string
    number: number
    forms: Array<{
      id: string
      formIndex: number
      variantIndex: number
    }>
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
   * 从 public/pokemon/index.json 加载预生成的宝可梦列表数据
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
 * @validates 需求 6.1: 应用启动时扫描 public/pokemon 目录获取可用宝可梦列表
 * @validates 需求 6.4: 宝可梦有多个形态时显示形态选择器
 */
export function usePokemonList(): UsePokemonListReturn {
  // 响应式状态
  const pokemons = ref<PokemonEntry[]>([])
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)
  
  /**
   * 加载宝可梦列表
   * 
   * 从 public/pokemon/index.json 加载预生成的宝可梦列表数据
   * 由于浏览器无法直接扫描目录，需要依赖预生成的索引文件
   * 
   * @validates 需求 6.1: 应用启动时扫描 public/pokemon 目录获取可用宝可梦列表
   */
  async function loadPokemonList(): Promise<void> {
    // 如果正在加载，忽略重复请求
    if (loading.value) {
      console.warn('usePokemonList: 列表正在加载中，忽略重复请求')
      return
    }
    
    // 重置状态
    loading.value = true
    error.value = null
    
    try {
      // 从 index.json 加载宝可梦列表数据
      const response = await fetch('/pokemon/index.json')
      
      if (!response.ok) {
        throw new Error(`加载宝可梦列表失败: HTTP ${response.status}`)
      }
      
      const data: PokemonIndexData = await response.json()
      
      // 转换数据格式，添加缩略图路径
      const pokemonList: PokemonEntry[] = data.pokemons.map((pokemon) => {
        // 为每个形态添加缩略图路径
        const forms: FormEntry[] = pokemon.forms.map((form) => ({
          id: form.id,
          formIndex: form.formIndex,
          variantIndex: form.variantIndex,
          thumbnail: getThumbnailPath(form.id)
        }))
        
        // 使用第一个形态的缩略图作为宝可梦的缩略图
        const thumbnail = forms.length > 0 ? forms[0].thumbnail : ''
        
        return {
          id: pokemon.id,
          number: pokemon.number,
          forms,
          thumbnail
        }
      })
      
      // 按图鉴编号排序
      pokemonList.sort((a, b) => a.number - b.number)
      
      pokemons.value = pokemonList
      
      console.log(`usePokemonList: 加载了 ${pokemonList.length} 个宝可梦`)
      
    } catch (err) {
      const errorMessage = formatError(err)
      error.value = errorMessage
      console.error('usePokemonList: 加载宝可梦列表失败:', err)
      
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
