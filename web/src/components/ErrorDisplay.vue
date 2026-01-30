<script setup lang="ts">
/**
 * ErrorDisplay.vue - 错误显示组件
 *
 * 负责：
 * - 显示友好的错误提示信息
 * - 提供重试按钮
 * - 支持自定义标题
 *
 * @validates 需求 8.1: FlatBuffers 解析失败时显示具体的解析错误信息
 * @validates 需求 8.2: 模型文件缺失时显示文件未找到的提示
 * @validates 需求 8.4: 网络请求失败时显示重试选项
 */

/**
 * Props 定义
 */
interface Props {
  /** 错误信息 */
  error: string;
  /** 可选标题，默认为 "出错了" */
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: "出错了",
});

/**
 * Emits 定义
 */
const emit = defineEmits<{
  /** 重试按钮点击事件 */
  retry: [];
}>();

/**
 * 根据错误信息判断错误类型
 * @returns 错误类型图标
 */
function getErrorIcon(): string {
  const errorLower = props.error.toLowerCase();

  // 文件未找到错误
  if (
    errorLower.includes("not found") ||
    errorLower.includes("未找到") ||
    errorLower.includes("404") ||
    errorLower.includes("缺失")
  ) {
    return "📁";
  }

  // 网络错误
  if (
    errorLower.includes("network") ||
    errorLower.includes("网络") ||
    errorLower.includes("fetch") ||
    errorLower.includes("timeout") ||
    errorLower.includes("超时")
  ) {
    return "🌐";
  }

  // 解析错误
  if (
    errorLower.includes("parse") ||
    errorLower.includes("解析") ||
    errorLower.includes("flatbuffers") ||
    errorLower.includes("format") ||
    errorLower.includes("格式")
  ) {
    return "⚙️";
  }

  // 默认警告图标
  return "⚠️";
}

/**
 * 处理重试按钮点击
 * @validates 需求 8.4: 网络请求失败时显示重试选项
 */
function handleRetry(): void {
  emit("retry");
}
</script>

<template>
  <div class="error-display">
    <div class="error-container">
      <!-- 错误图标 -->
      <div class="error-icon">
        {{ getErrorIcon() }}
      </div>

      <!-- 错误标题 -->
      <h3 class="error-title">{{ title }}</h3>

      <!-- 错误信息 -->
      <p class="error-message">{{ error }}</p>

      <!-- 重试按钮 -->
      <button class="retry-button" type="button" @click="handleRetry">
        <span class="retry-icon">🔄</span>
        <span class="retry-text">重试</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.error-display {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 200px;
  padding: 24px;
  background-color: rgba(26, 26, 46, 0.95);
}

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 400px;
  padding: 32px;
  background-color: #16213e;
  border: 1px solid #0f3460;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

/* 错误图标 */
.error-icon {
  font-size: 3rem;
  margin-bottom: 16px;
  line-height: 1;
}

/* 错误标题 */
.error-title {
  margin: 0 0 12px 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #e94560;
}

/* 错误信息 */
.error-message {
  margin: 0 0 24px 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #a0a0a0;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* 重试按钮 */
.retry-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 24px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #fff;
  background-color: #e94560;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.retry-button:hover {
  background-color: #ff6b6b;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(233, 69, 96, 0.3);
}

.retry-button:active {
  transform: translateY(0);
  box-shadow: none;
}

.retry-button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(233, 69, 96, 0.3);
}

.retry-icon {
  font-size: 1rem;
  line-height: 1;
}

.retry-text {
  line-height: 1;
}
</style>
