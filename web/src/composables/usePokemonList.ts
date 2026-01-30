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

import { ref, type Ref } from "vue";
import { loadJsonResource } from "../services/resourceLoader";
import { resolveResourcePath } from "../services/resourceLoader";

/**
 * 形态条目
 */
export interface FormEntry {
  /** 完整的形态 ID，如 "pm0001_00_00" */
  id: string;
  /** 形态索引 */
  formIndex: number;
  /** 变体索引 */
  variantIndex: number;
  /** 缩略图路径 */
  thumbnail: string;
}

/**
 * 宝可梦条目
 */
export interface PokemonEntry {
  /** 宝可梦 ID，如 "pm0001" */
  id: string;
  /** 图鉴编号 */
  number: number;
  /** 形态列表 */
  forms: FormEntry[];
  /** 缩略图路径（使用第一个形态的缩略图） */
  thumbnail: string;
  /** 是否已加载详细信息 */
  loaded: boolean;
}

/**
 * index.json 文件中的原始数据格式
 */
interface PokemonIndexData {
  /** 宝可梦 ID 列表 */
  pokemonIds: string[];
}

/**
 * 创建宝可梦列表 composable
 * @param directory - 数据目录名，如 'SCVI' 或 'LZA'
 */

/**
 * 单个宝可梦的 index.json 数据格式
 */
interface PokemonDetailData {
  id: string;
  number: number;
  forms: Array<{
    id: string;
    formIndex: number;
    variantIndex: number;
    icon: string;
    animations: Record<string, string[]>;
  }>;
}

/**
 * usePokemonList 返回值接口
 */
export interface UsePokemonListReturn {
  /** 宝可梦列表 */
  pokemons: Ref<PokemonEntry[]>;
  /** 是否正在加载 */
  loading: Ref<boolean>;
  /** 错误信息 */
  error: Ref<string | null>;

  /**
   * 加载宝可梦列表
   * 从 public/SCVI/index.json 加载预生成的宝可梦列表数据
   */
  loadPokemonList: () => Promise<void>;

  /**
   * 加载单个宝可梦的详细信息
   * @param pokemonId - 宝可梦 ID，如 "pm0001"
   */
  loadPokemonDetails: (pokemonId: string) => Promise<void>;

  /**
   * 获取指定宝可梦的所有形态
   * @param pokemonId - 宝可梦 ID，如 "pm0001"
   * @returns 形态列表，如果宝可梦不存在则返回空数组
   */
  getPokemonForms: (pokemonId: string) => FormEntry[];
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
export function usePokemonList(
  directory: Ref<string> = ref("SCVI"),
): UsePokemonListReturn {
  // 响应式状态
  const pokemons = ref<PokemonEntry[]>([]);
  const loading = ref<boolean>(false);
  const error = ref<string | null>(null);

  /**
   * 加载宝可梦列表
   *
   * 只从 index.json 加载宝可梦 ID 列表并显示基本信息，
   * 详细信息在点击时按需加载
   *
   * @validates 需求 6.1: 应用启动时扫描 public/SCVI 目录获取可用宝可梦列表
   */
  async function loadPokemonList(): Promise<void> {
    // 如果正在加载，忽略重复请求
    if (loading.value) {
      console.warn("[usePokemonList] 列表正在加载中，忽略重复请求");
      return;
    }

    // 重置状态
    loading.value = true;
    error.value = null;
    pokemons.value = [];

    try {
      // 1. 先加载宝可梦 ID 列表
      const data: PokemonIndexData = await loadJsonResource(
        `${directory.value}/index.json`,
      );
      const pokemonIds = data.pokemonIds;

      // 2. 创建基本宝可梦条目（未加载详细信息）
      const basicPokemons: PokemonEntry[] = pokemonIds.map((pokemonId) => {
        const number = parseInt(pokemonId.replace("pm", ""), 10);
        return {
          id: pokemonId,
          number,
          forms: [],
          thumbnail: "",
          loaded: false,
        };
      });

      // 按图鉴编号排序
      basicPokemons.sort((a, b) => a.number - b.number);

      // 显示基本列表
      pokemons.value = basicPokemons;
    } catch (err) {
      const errorMessage = formatError(err);
      error.value = errorMessage;

      // @validates 需求 8.5: 发生错误时在控制台记录详细错误信息用于调试
      console.error("[usePokemonList] 加载宝可梦列表失败:", {
        errorMessage,
        originalError: err,
        errorStack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString(),
      });

      // 清空列表
      pokemons.value = [];
    } finally {
      loading.value = false;
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
    const pokemon = pokemons.value.find((p) => p.id === pokemonId);
    return pokemon ? pokemon.forms : [];
  }

  /**
   * 在后台加载宝可梦详细信息
   * @param pokemonIds - 宝可梦ID列表
   */
  async function loadPokemonDetailsInBackground(
    pokemonIds: string[],
  ): Promise<void> {
    const BATCH_SIZE = 5; // 每批加载 5 个宝可梦的详细信息

    for (let i = 0; i < pokemonIds.length; i += BATCH_SIZE) {
      const batch = pokemonIds.slice(i, i + BATCH_SIZE);
      // 并行加载这一批的宝可梦详细信息
      const batchPromises = batch.map(async (pokemonId) => {
        try {
          const pokemonData: PokemonDetailData = await loadJsonResource(
            `${directory.value}/${pokemonId}.json`,
          );

          // 转换形态数据
          const forms: FormEntry[] = pokemonData.forms.map((form) => ({
            id: form.id,
            formIndex: form.formIndex,
            variantIndex: form.variantIndex,
            thumbnail: resolveResourcePath(
              `${directory.value}/${pokemonData.id}/${form.id}/${form.icon}`,
            ),
          }));

          // 使用第一个形态的缩略图作为宝可梦的缩略图
          const thumbnail = forms.length > 0 ? forms[0].thumbnail : "";

          return {
            id: pokemonData.id,
            number: pokemonData.number,
            forms,
            thumbnail,
            loaded: true,
          } as PokemonEntry;
        } catch (err) {
          console.warn(
            `[usePokemonList] 加载 ${pokemonId} 详细信息时出错:`,
            err,
          );
          // 返回未加载的条目
          const number = parseInt(pokemonId.replace("pm", ""), 10);
          return {
            id: pokemonId,
            number,
            forms: [],
            thumbnail: "",
            loaded: false,
          } as PokemonEntry;
        }
      });

      // 等待这一批加载完成
      const batchResults = await Promise.all(batchPromises);

      // 更新已加载的宝可梦信息
      batchResults.forEach((updatedPokemon) => {
        const index = pokemons.value.findIndex(
          (p) => p.id === updatedPokemon.id,
        );
        if (index !== -1) {
          pokemons.value[index] = updatedPokemon;
        }
      });
    }
  }

  /**
   * 加载单个宝可梦的详细信息
   *
   * @param pokemonId - 宝可梦 ID，如 "pm0001"
   */
  async function loadPokemonDetails(pokemonId: string): Promise<void> {
    try {
      // 检查是否已经加载过
      const existingPokemon = pokemons.value.find(p => p.id === pokemonId);
      if (existingPokemon && existingPokemon.loaded) {
        return; // 已经加载过了
      }

      console.log(`[usePokemonList] 加载宝可梦详细信息: ${pokemonId}`);

      // 加载宝可梦详细信息
      const pokemonData: PokemonDetailData = await loadJsonResource(
        `${directory.value}/${pokemonId}.json`,
      );

      // 转换形态数据
      const forms: FormEntry[] = pokemonData.forms.map((form) => ({
        id: form.id,
        formIndex: form.formIndex,
        variantIndex: form.variantIndex,
        thumbnail: resolveResourcePath(
          `${directory.value}/${pokemonData.id}/${form.id}/${form.icon}`,
        ),
      }));

      // 使用第一个形态的缩略图作为宝可梦的缩略图
      const thumbnail = forms.length > 0 ? forms[0].thumbnail : "";

      // 更新宝可梦条目
      const updatedPokemon: PokemonEntry = {
        id: pokemonData.id,
        number: pokemonData.number,
        forms,
        thumbnail,
        loaded: true,
      };

      // 找到并更新对应的宝可梦
      const index = pokemons.value.findIndex(p => p.id === pokemonId);
      if (index !== -1) {
        pokemons.value[index] = updatedPokemon;
      }

      console.log(`[usePokemonList] 宝可梦 ${pokemonId} 详细信息加载完成`);
    } catch (err) {
      console.warn(`[usePokemonList] 加载宝可梦 ${pokemonId} 详细信息失败:`, err);
      // 不抛出错误，只是记录警告
    }
  }

  return {
    pokemons,
    loading,
    error,
    loadPokemonList,
    loadPokemonDetails,
    getPokemonForms,
  };
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
    if (err.message.includes("fetch") || err.message.includes("network")) {
      return "网络请求失败，请检查网络连接";
    }
    return err.message;
  }
  return String(err);
}

export default usePokemonList;
