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
import { ref, watch, Ref } from "vue";
import { Loading } from '@element-plus/icons-vue';
import ErrorDisplay from "./ErrorDisplay.vue";
import { PokemonModel } from "../models";
import { usePokemonDatas } from "../composables/usePokemonDatas";
import { Game } from "../types";
import { RecycleScroller } from 'vue-virtual-scroller';

/**
 * Props 定义
 */
interface Props {
  /** 当前选中的宝可梦 */
  selectedPokemon?: PokemonModel;
  /** 当前选中的形态 ID */
  selectedForm?: [number, number];
  /** 当前选择的目录 */
  selectedGame?: Game;
}

const props = withDefaults(defineProps<Props>(), {
  selectedPokemon: undefined,
  selectedForm: undefined,
  selectedGame: "SCVI",
});

const { loadPokemonListInGame, formNames } = usePokemonDatas();
let pokemons: Ref<PokemonModel[]> = ref([]);
/**
 * Emits 定义
 */
const emit = defineEmits<{
  /** 选择宝可梦和形态时触发 */
  selectPokemon: [pokemon: PokemonModel, formId: [number, number]];
  /** 目录切换时触发 */
  selectGame: [game: Game];
}>();

// 当前选择的目录
const currentGame = ref<Game>(props.selectedGame);

// 当前选中的宝可梦（用于显示形态选择器）
const currentPokemon = ref<PokemonModel | null>(null);

// 当前选中的形态 ID
const currentForm = ref<[number, number] | null>(null);

const error = ref<string | null>(null);

/**
 * 格式化形态名称显示
 * @param form - 形态条目
 * @param pokemonNumber - 宝可梦编号
 * @returns 格式化后的形态名称
 */
function formatFormName(pokemon: PokemonModel, form: [number, number]): string {
  return pokemon.getFormResourceName(form);
}

/**
 * 处理宝可梦点击事件
 * @param pokemon - 被点击的宝可梦
 * @validates 需求 6.3: 用户点击宝可梦时加载并显示该宝可梦的 3D 模型
 */
async function handlePokemonClick(pokemon: PokemonModel): Promise<void> {
  if (currentPokemon.value?.index === pokemon.index) {
    return; // 已选中，忽略
  }
  await pokemon.loadResourceData(currentGame.value);
  currentPokemon.value = pokemon;

  // 默认选择第一个形态
  const defaultForm = pokemon.getFromResourceIds(currentGame.value)[0];
  if (defaultForm) {
    currentForm.value = defaultForm;
    emit("selectPokemon", pokemon, defaultForm);
  }
}

/**
 * 处理形态选择变化（针对每个条目的选择器）
 * @param value - 选中的值
 * @param pokemon - 对应的宝可梦
 * @validates 需求 6.5: 用户选择不同形态时切换显示对应形态的模型
 */
function handleFormChangeForItem(value: [number, number], pokemon: PokemonModel): void {
  currentPokemon.value = pokemon;
  currentForm.value = value;
  emit("selectPokemon", pokemon, value);
}

// 监听 props 变化，同步内部状态
watch(
  () => props.selectedPokemon,
  (newPokemon) => {
    if (newPokemon) {
      const pokemon = pokemons.value.find((p) => p.index === newPokemon.index);
      if (pokemon) {
        currentPokemon.value = pokemon;
      }
    }
  },
  { immediate: true },
);

watch(
  () => props.selectedForm,
  (newForm) => {
    if (newForm) {
      currentForm.value = newForm;
    }
  },
  { immediate: true },
);

/**
 * 处理重试按钮点击
 * @validates 需求 8.4: 网络请求失败时显示重试选项
 * @validates 需求 8.5: 发生错误时在控制台记录详细错误信息用于调试
 */
async function handleRetry(): Promise<void> {
  try {
    await loadPokemonListInGame(currentGame.value);
  } catch (err) {
    // @validates 需求 8.5: 在控制台记录详细错误信息用于调试
    console.error("[PokemonBrowser] 数据重新加载失败:", {
      error: err,
      errorMessage: err instanceof Error ? err.message : String(err),
      errorStack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * 处理缩略图加载错误
 * @param event - 错误事件
 * @validates 需求 8.5: 发生错误时在控制台记录详细错误信息用于调试
 */
function handleThumbnailError(event: Event): void {
  const img = event.target as HTMLImageElement;
  const originalSrc = img.src;

  // @validates 需求 8.5: 在控制台记录详细错误信息用于调试
  console.warn("[PokemonBrowser] 缩略图加载失败:", {
    originalSrc,
    timestamp: new Date().toISOString(),
  });

  // 使用占位图片
  img.src =
    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect fill="%23333" width="96" height="96"/><text fill="%23666" font-size="12" x="50%" y="50%" text-anchor="middle" dy=".3em">?</text></svg>';
}

// 监听 props.selectedGame 变化
watch(
  () => props.selectedGame,
  (newGame) => {
    if (newGame && newGame !== currentGame.value) {
      currentGame.value = newGame;
    }
  },
);

// 监听 currentGame 变化，重新加载列表
watch(currentGame, async (newGame, oldGame) => {
  if (newGame !== oldGame) {
    // 切换游戏时清除选中状态
    currentPokemon.value = null;
    currentForm.value = null;
    emit("selectGame", newGame);
    try {
      pokemons.value = await loadPokemonListInGame(newGame);
    } catch (err) {
      console.error(`[PokemonBrowser] ${newGame} 列表加载失败:`, err);
    }
  }
}, { immediate: true });

</script>

<template>
  <div class="pokemon-browser">
    <!-- 头部区域 -->
    <div class="browser-header">
      <h2 class="browser-title">宝可梦图鉴</h2>
      <el-select v-model="currentGame" class="directory-selector" size="small">
        <el-option value="SCVI" label="SCVI" />
        <el-option value="LZA" label="LZA" />
      </el-select>
    </div>

    <!-- 列表加载状态 -->
    <div v-if="pokemons.length === 0" class="list-loading">
      <el-icon class="is-loading">
        <Loading />
      </el-icon>
      <span>加载宝可梦列表...</span>
    </div>

    <!-- 错误提示 - 使用 ErrorDisplay 组件 -->
    <!-- @validates 需求 8.4: 网络请求失败时显示重试选项 -->
    <div v-else-if="error" class="error-wrapper">
      <ErrorDisplay :error="error" title="列表加载失败" @retry="handleRetry" />
    </div>

    <!-- 宝可梦列表 -->
    <RecycleScroller
      class="pokemon-list"
      :items="pokemons"
      :item-size="80"
      key-field="index"
    >
      <template #default="{ item: pokemon }">
        <div
          class="pokemon-item"
          :class="{ selected: pokemon.index === currentPokemon?.index }"
          @click="handlePokemonClick(pokemon)"
        >
          <!-- 左侧图标 -->
          <div class="pokemon-icon">
            <img
              :src="`/icons/icon${pokemon.index.toString().padStart(4, '0')}_f00_s0.png`"
              :alt="`Pokemon ${pokemon.index} Icon`"
              loading="lazy"
              @error="handleThumbnailError"
            />
          </div>

          <!-- 右侧信息 -->
          <div class="pokemon-info">
            <!-- 中间名字 -->
            <div class="pokemon-name">
              {{ pokemon.name }} ({{ pokemon.resourceId }})
            </div>

            <!-- 形态选择器 -->
            <div
              v-if="pokemon.getFromResourceIds(currentGame).length > 1"
              class="pokemon-form-selector"
            >
              <el-select
                :model-value="
                  currentPokemon?.index === pokemon.index
                    ? currentForm
                    : pokemon.getFromResourceIds(currentGame)[0]
                "
                class="form-select"
                size="small"
                @change="handleFormChangeForItem($event, pokemon)"
                @click.stop
              >
                <el-option
                  v-for="form in pokemon.getFromResourceIds(currentGame)"
                  :key="`${form[0]}-${form[1]}`"
                  :value="form"
                  :label="formatFormName(pokemon, form)"
                />
              </el-select>
            </div>
          </div>
        </div>
      </template>
    </RecycleScroller>
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

.directory-selector {
  width: 100px;
}

.directory-selector :deep(.el-input__wrapper) {
  background-color: #1a1a2e;
  box-shadow: 0 0 0 1px #333 inset;
}

.directory-selector :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #e94560 inset;
}

.directory-selector :deep(.el-input__inner) {
  color: #fff;
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
  font-size: 16px;
}

.list-loading .el-icon {
  font-size: 32px;
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
  align-items: flex-start;
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

/* 右侧信息 */
.pokemon-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 中间名字 */
.pokemon-name {
  font-size: 1rem;
  font-weight: 500;
  color: #fff;
}

.pokemon-item.selected .pokemon-name {
  color: #e94560;
}

/* 形态选择器 */
.pokemon-form-selector {
  flex-shrink: 0;
}

.pokemon-form-selector .form-select {
  width: 100%;
}

.pokemon-form-selector :deep(.el-input__wrapper) {
  background-color: #0f3460;
  box-shadow: 0 0 0 1px #1a1a2e inset;
  padding: 0 8px;
}

.pokemon-form-selector :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #e94560 inset;
}

.pokemon-form-selector :deep(.el-input__inner) {
  color: #fff;
  font-size: 12px;
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
