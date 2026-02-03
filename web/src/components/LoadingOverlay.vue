<script setup lang="ts">
/**
 * LoadingOverlay.vue - 加载遮罩层组件
 *
 * 负责：
 * - 显示加载中遮罩层
 * - 显示加载进度条
 * - 显示加载提示文字
 *
 * @validates 需求 6.5: 模型加载中显示加载进度指示器
 */
import { computed } from 'vue';

/**
 * Props 定义
 */
interface Props {
  /** 是否显示加载遮罩层 */
  visible: boolean;
  /** 加载进度 (0-100) */
  progress?: number;
  /** 加载提示文字 */
  message?: string;
  /** 是否显示进度条，默认为 true */
  showProgress?: boolean;
  /** 是否显示百分比，默认为 true */
  showPercent?: boolean;
  /** 遮罩层背景颜色 */
  backgroundColor?: string;
  /** 进度条颜色 */
  progressColor?: string;
}

const props = withDefaults(defineProps<Props>(), {
  progress: 0,
  message: '加载中...',
  showProgress: true,
  showPercent: true,
  backgroundColor: 'rgba(26, 26, 46, 0.9)',
  progressColor: '#00d4ff',
});

/**
 * 计算属性：格式化的进度百分比
 */
const formattedProgress = computed(() => {
  // 确保进度值在 0-100 范围内
  const clampedProgress = Math.max(0, Math.min(100, props.progress));
  return Math.round(clampedProgress);
});

/**
 * 计算属性：进度条宽度样式
 */
const progressBarStyle = computed(() => ({
  width: `${formattedProgress.value}%`,
  backgroundColor: props.progressColor,
}));

/**
 * 计算属性：遮罩层背景样式
 */
const overlayStyle = computed(() => ({
  backgroundColor: props.backgroundColor,
}));

/**
 * 计算属性：百分比文字颜色样式
 */
const percentStyle = computed(() => ({
  color: props.progressColor,
}));
</script>

<template>
  <!-- 加载遮罩层 - 使用 Teleport 确保在最顶层显示 -->
  <Transition name="fade">
    <div v-if="visible" class="loading-overlay" :style="overlayStyle">
      <div class="loading-content">
        <!-- 加载动画旋转器 -->
        <div class="loading-spinner" :style="{ borderTopColor: progressColor }" />

        <!-- 加载提示文字 -->
        <div class="loading-text">
          {{ message }}
        </div>

        <!-- 进度条 -->
        <div v-if="showProgress" class="loading-progress">
          <div class="progress-bar" :style="progressBarStyle" />
        </div>

        <!-- 百分比显示 -->
        <div v-if="showPercent" class="loading-percent" :style="percentStyle">
          {{ formattedProgress }}%
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* 加载进度遮罩层 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

/* 加载内容容器 */
.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: #ffffff;
  padding: 24px;
}

/* 加载旋转动画 */
.loading-spinner {
  width: 50px;
  height: 50px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #00d4ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

/* 旋转动画关键帧 */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 加载提示文字 */
.loading-text {
  font-size: 14px;
  margin-bottom: 12px;
  color: #a0a0a0;
  max-width: 300px;
  word-wrap: break-word;
}

/* 进度条容器 */
.loading-progress {
  width: 200px;
  height: 4px;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
}

/* 进度条填充 */
.progress-bar {
  height: 100%;
  background-color: #00d4ff;
  transition: width 0.3s ease;
  border-radius: 2px;
}

/* 百分比显示 */
.loading-percent {
  font-size: 12px;
  color: #00d4ff;
  font-weight: 500;
}

/* 淡入淡出过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
