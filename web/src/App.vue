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
import { ref, defineAsyncComponent, Ref } from 'vue';
import { setResourceLoaderConfig } from './services/resourceLoader';
import { Game } from './types';
import { PokemonModel } from './models';

// 异步加载组件以优化初始加载性能
const PokemonBrowser = defineAsyncComponent(
  () => import('./components/PokemonBrowser.vue')
);
const ThreeViewer = defineAsyncComponent(() => import('./components/ThreeViewer.vue'));
const GalleryView = defineAsyncComponent(() => import('./components/GalleryView.vue'));

// 当前选中的宝可梦 ID
const selectedPokemon: Ref<PokemonModel | null> = ref(null);

// 当前选中的形态 ID
const selectedForm = ref<[number, number] | null>(null);

// 模型加载进度 (0-100)
const loadingProgress = ref(0);

// 是否正在加载模型
const isModelLoading = ref(false);

// 模型加载错误信息
const modelError = ref<string | null>(null);

// 当前选择的目录
const selectedGame = ref<Game>('SCVI');

// 当前宝可梦的动画数据
const currentAnimations = ref<Record<string, string[]> | null>(null);

// 资源加载模式：本地或远程
const useRemoteAssets = ref(import.meta.env.VITE_USE_REMOTE_COS === 'true');

// 视图模式：'browser' 或 'gallery'
const viewMode = ref<'browser' | 'gallery'>('browser');

// 移动端相关状态
const isMobileView = ref(false);
const showMobileMenu = ref(false);

// 是否为开发模式
let isDevelopment = import.meta.env.DEV;
// isDevelopment = false;
// 组件挂载时不需要额外加载数据，PokemonBrowser 会处理

/**
 * 检查是否为移动端视图
 */
function checkMobileView(): void {
  isMobileView.value = window.innerWidth <= 768;
  if (!isMobileView.value) {
    showMobileMenu.value = false;
  }
}

/**
 * 切换移动端菜单
 */
function toggleMobileMenu(): void {
  showMobileMenu.value = !showMobileMenu.value;
}

/**
 * 关闭移动端菜单
 */
function closeMobileMenu(): void {
  showMobileMenu.value = false;
}

// 监听窗口大小变化
if (typeof window !== 'undefined') {
  checkMobileView();
  window.addEventListener('resize', checkMobileView);
}

/**
 * 处理宝可梦选择事件
 * 当用户在 PokemonBrowser 中选择宝可梦或形态时触发
 *
 * @param pokemonId - 宝可梦 ID，如 "pm0001"
 * @param formId - 形态 ID，如 "pm0001_00_00"
 * @validates 需求 6.3: 用户点击宝可梦时加载并显示该宝可梦的 3D 模型
 * @validates 需求 6.5: 用户选择不同形态时切换显示对应形态的模型
 */
async function handleSelectPokemon(
  pokemon: PokemonModel,
  form: [number, number]
): Promise<void> {
  console.log(`App: 选择宝可梦 ${pokemon.index}, 形态 ${form}`);
  selectedPokemon.value = pokemon;
  selectedForm.value = form;
  // 清除之前的错误
  modelError.value = null;
  
  // 移动端选择后自动关闭菜单
  if (isMobileView.value) {
    closeMobileMenu();
  }

  const resourceData = await pokemon.loadResourceData(selectedGame.value);
  if (!resourceData) {
    currentAnimations.value = null;
    return;
  }
  currentAnimations.value =
    resourceData.forms.find((f) => f.formIndex === form[0] && f.variantIndex === form[1])
      ?.animations || null;
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
 * @param game - 新的目录名
 */
function handleSelectGame(game: Game): void {
  selectedGame.value = game;

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
  setResourceLoaderConfig({ useRemoteCos: useRemote });
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

/**
 * 切换到画廊视图
 */
function switchToGallery(): void {
  viewMode.value = 'gallery';
}

/**
 * 返回浏览器视图
 */
function switchToBrowser(): void {
  viewMode.value = 'browser';
}
</script>

<template>
  <div class="app-container">
    <!-- 画廊视图 -->
    <GalleryView v-if="viewMode === 'gallery'" :game="selectedGame" @back="switchToBrowser" />

    <!-- 浏览器视图 -->
    <template v-else>
      <!-- 移动端菜单按钮 -->
      <button class="mobile-menu-button" @click="toggleMobileMenu" v-if="isMobileView">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>

      <!-- 移动端遮罩 -->
      <div class="mobile-overlay" :class="{ active: showMobileMenu }" @click="closeMobileMenu"></div>

      <!-- 左侧：宝可梦浏览器 -->
      <aside class="browser-panel" :class="{ 'mobile-open': showMobileMenu }">
        <!-- 资源模式切换开关（仅在开发模式显示） -->
        <div class="resource-mode-toggle" v-if="isDevelopment">
          <el-switch
            v-model="useRemoteAssets"
            active-text="使用远程资源"
            @change="handleResourceModeChange"
          />
          <button class="gallery-button-compact" @click="switchToGallery" title="进入SCVI模型画廊">
            画廊
          </button>
        </div>

        <PokemonBrowser
          :selected-pokemon="selectedPokemon || undefined"
          :selected-form="selectedForm || undefined"
          :selected-game="selectedGame"
          @select-pokemon="handleSelectPokemon"
          @select-game="handleSelectGame"
        />
      </aside>

      <!-- 右侧：3D 查看器 -->
      <main class="viewer-panel">
        <ThreeViewer
          :pokemon="selectedPokemon"
          :form="selectedForm"
          :game="selectedGame"
          @loading-change="handleLoadingChange"
          @progress-change="handleProgressChange"
          @error="handleError"
          @model-loaded="handleModelLoaded"
        />
      </main>
    </template>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #1a1a2e;
  position: relative;
}

/* 移动端菜单按钮 */
.mobile-menu-button {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 1001;
  width: 44px;
  height: 44px;
  background-color: rgba(22, 33, 62, 0.95);
  border: 1px solid #0f3460;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #e94560;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

.mobile-menu-button:hover {
  background-color: rgba(15, 52, 96, 0.95);
  transform: scale(1.05);
}

.mobile-menu-button:active {
  transform: scale(0.95);
}

/* 移动端遮罩 */
.mobile-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 999;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.mobile-overlay.active {
  display: block;
  opacity: 1;
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
  transition: transform 0.3s ease;
}

/* 资源模式切换开关 */
.resource-mode-toggle {
  padding: 10px;
  border-bottom: 1px solid #0f3460;
  background-color: #16213e;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.resource-mode-toggle :deep(.el-switch__label) {
  color: #e94560;
}

.resource-mode-toggle :deep(.el-switch__label.is-active) {
  color: #e94560;
}

/* 紧凑画廊按钮 */
.gallery-button-compact {
  padding: 6px 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.gallery-button-compact:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.gallery-button-compact:active {
  transform: translateY(0);
}

/* 右侧查看器面板 - 填充剩余空间 */
.viewer-panel {
  flex: 1;
  height: 100%;
  overflow: hidden;
  position: relative;
}

/* ===== 移动端响应式 ===== */
@media (max-width: 768px) {
  .browser-panel {
    position: fixed;
    top: 0;
    left: 0;
    width: 85vw;
    max-width: 320px;
    height: 100vh;
    z-index: 1000;
    transform: translateX(-100%);
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
  }

  .browser-panel.mobile-open {
    transform: translateX(0);
  }

  .viewer-panel {
    width: 100%;
  }

  .resource-mode-toggle {
    padding: 8px;
    flex-direction: column;
    align-items: stretch;
  }

  .gallery-button-compact {
    width: 100%;
  }
}

/* 小屏手机进一步优化 */
@media (max-width: 480px) {
  .mobile-menu-button {
    top: 8px;
    left: 8px;
    width: 40px;
    height: 40px;
  }

  .browser-panel {
    width: 90vw;
  }
}

/* 横屏模式优化 */
@media (max-width: 896px) and (orientation: landscape) {
  .browser-panel {
    width: 50vw;
    max-width: 360px;
  }
}
</style>
