<script setup lang="ts">
/**
 * App.vue - 宝可梦模型浏览器根组件
 *
 * 负责：
 * - 集成 PokemonBrowser 和 ThreeViewer 组件
 * - 管理选中的宝可梦和形态状态
 * - 实现组件间通信
 *
 * @validates 需求 6.3: 用户点击宝可梦时加载并显示该宝可梦的 3D 模型
 * @validates 需求 6.5: 用户选择不同形态时切换显示对应形态的模型
 */
import { ref, defineAsyncComponent } from "vue";
import {
  loadJsonResource,
  setResourceLoaderConfig,
} from "./services/resourceLoader";

// 异步加载组件以优化初始加载性能
const PokemonBrowser = defineAsyncComponent(
  () => import("./components/PokemonBrowser.vue"),
);
const ThreeViewer = defineAsyncComponent(
  () => import("./components/ThreeViewer.vue"),
);

// 当前选中的宝可梦 ID
const selectedPokemon = ref<string | null>(null);

// 当前选中的形态 ID
const selectedForm = ref<string | null>(null);

// 模型加载进度 (0-100)
const loadingProgress = ref(0);

// 是否正在加载模型
const isModelLoading = ref(false);

// 模型加载错误信息
const modelError = ref<string | null>(null);

// 当前选择的目录
const selectedDirectory = ref<string>("SCVI");

// 当前宝可梦的动画数据
const currentAnimations = ref<Record<string, string[]> | null>(null);

// 资源加载模式：本地或远程
const useRemoteAssets = ref(import.meta.env.VITE_USE_REMOTE_ASSETS === "true");

// 组件挂载时不需要额外加载数据，PokemonBrowser 会处理

/**
 * 处理宝可梦选择事件
 * 当用户在 PokemonBrowser 中选择宝可梦或形态时触发
 *
 * @param pokemonId - 宝可梦 ID，如 "pm0001"
 * @param formId - 形态 ID，如 "pm0001_00_00"
 * @validates 需求 6.3: 用户点击宝可梦时加载并显示该宝可梦的 3D 模型
 * @validates 需求 6.5: 用户选择不同形态时切换显示对应形态的模型
 */
async function handlePokemonSelect(
  pokemonId: string,
  formId: string,
): Promise<void> {
  console.log(`App: 选择宝可梦 ${pokemonId}, 形态 ${formId}`);
  selectedPokemon.value = pokemonId;
  selectedForm.value = formId;
  // 清除之前的错误
  modelError.value = null;

  // 获取当前形态的动画数据
  try {
    const pokemonData = await loadJsonResource(
      `${selectedDirectory.value}/${pokemonId}.json`,
    );
    const form = pokemonData.forms.find((f: any) => f.id === formId);
    if (form && form.animations) {
      currentAnimations.value = form.animations;
    } else {
      currentAnimations.value = null;
    }
  } catch (error) {
    console.error("App: 加载宝可梦详细信息失败:", error);
    currentAnimations.value = null;
  }
}

/**
 * 处理模型加载状态变化
 * @param loading - 是否正在加载
 */
function handleLoadingChange(loading: boolean): void {
  isModelLoading.value = loading;
}

/**
 * 处理模型加载进度变化
 * @param progress - 加载进度 (0-100)
 */
function handleProgressChange(progress: number): void {
  loadingProgress.value = progress;
}

/**
 * 处理目录切换事件
 * @param directory - 新的目录名
 */
function handleDirectoryChange(directory: string): void {
  selectedDirectory.value = directory;

  // 清空当前选择的宝可梦和形态
  selectedPokemon.value = null;
  selectedForm.value = null;
  currentAnimations.value = null;
  modelError.value = null;
}

/**
 * 处理资源模式切换
 * @param useRemote - 是否使用远程资源
 */
function handleResourceModeChange(useRemote: boolean): void {
  useRemoteAssets.value = useRemote;
  setResourceLoaderConfig({ useRemote });
}

/**
 * 处理模型加载完成
 * @param formId - 加载完成的形态 ID
 */
function handleModelLoaded(formId: string): void {
  console.log(`App: 模型加载完成 - ${formId}`);
}

/**
 * 处理模型加载错误
 * @param error - 错误信息
 */
function handleError(error: string | null): void {
  console.error(`App: 模型加载错误 - ${error}`);
  modelError.value = error;
}
</script>

<template>
  <div class="app-container">
    <!-- 左侧：宝可梦浏览器 -->
    <aside class="browser-panel">
      <!-- 资源模式切换开关 -->
      <div class="resource-mode-toggle">
        <label class="toggle-label">
          <input
            type="checkbox"
            :checked="useRemoteAssets"
            @change="
              handleResourceModeChange(
                ($event.target as HTMLInputElement).checked,
              )
            "
          />
          使用远程资源
        </label>
      </div>

      <PokemonBrowser
        :selected-pokemon="selectedPokemon"
        :selected-form="selectedForm"
        :directory="selectedDirectory"
        @select="handlePokemonSelect"
        @directory-change="handleDirectoryChange"
      />
    </aside>

    <!-- 右侧：3D 查看器 -->
    <main class="viewer-panel">
      <ThreeViewer
        :pokemon-id="selectedPokemon"
        :form-id="selectedForm"
        :animations="currentAnimations"
        :directory="selectedDirectory"
        @loading-change="handleLoadingChange"
        @progress-change="handleProgressChange"
        @error="handleError"
        @model-loaded="handleModelLoaded"
      />
    </main>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #1a1a2e;
}

/* 左侧浏览器面板 - 固定宽度 280px */
.browser-panel {
  width: 280px;
  min-width: 280px;
  height: 100%;
  flex-shrink: 0;
  border-right: 1px solid #0f3460;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 资源模式切换开关 */
.resource-mode-toggle {
  padding: 10px;
  border-bottom: 1px solid #0f3460;
  background-color: #16213e;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #e94560;
  font-size: 14px;
  cursor: pointer;
}

.toggle-label input[type="checkbox"] {
  margin: 0;
}

/* 右侧查看器面板 - 填充剩余空间 */
.viewer-panel {
  flex: 1;
  height: 100%;
  overflow: hidden;
  position: relative;
}
</style>
