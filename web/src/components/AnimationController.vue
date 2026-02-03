<script setup lang="ts">
/**
 * AnimationController.vue - 动画控制器组件
 *
 * 负责：
 * - 动画选择下拉框
 * - 播放/暂停按钮
 * - 停止按钮
 * - 循环开关
 * - 当前帧/总帧数显示
 *
 * @validates 需求 6.3: 动画控制器作为独立组件，包含动画选择和播放控制
 */
import { computed } from 'vue';
import { VideoPlay, VideoPause } from '@element-plus/icons-vue';

/**
 * 动画状态接口
 * 用于显示当前动画的播放状态
 */
interface AnimationState {
  /** 当前播放时间（秒） */
  currentTime: number;
  /** 动画总时长（秒） */
  duration: number;
  /** 当前帧索引 */
  currentFrame: number;
  /** 总帧数 */
  frameCount: number;
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 是否循环播放 */
  loop: boolean;
}

// Props 定义 - 接收动画列表和当前状态
const props = defineProps<{
  /** 可用的动画列表（动画名称数组） */
  animations: string[];
  /** 当前选中的动画名称 */
  selectedAnimation: string;
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 是否循环播放 */
  loop: boolean;
  /** 动画状态（可选，用于显示帧信息） */
  animationState?: AnimationState | null;
}>();

// Emits 定义 - 发送控制事件
const emit = defineEmits<{
  /** 选中的动画变更 */
  (e: 'update:selectedAnimation', value: string): void;
  /** 播放/暂停切换 */
  (e: 'toggle-play'): void;
  /** 停止播放 */
  (e: 'stop'): void;
  /** 循环模式变更 */
  (e: 'update:loop', value: boolean): void;
}>();

// ===== 计算属性 =====

/**
 * 是否有可用的动画
 */
const hasAnimations = computed(() => {
  return props.animations.length > 0;
});

/**
 * 当前帧显示文本
 * 格式：当前帧 / 总帧数
 */
const frameDisplay = computed(() => {
  if (!props.animationState) {
    return '-- / --';
  }
  return `${props.animationState.currentFrame} / ${props.animationState.frameCount}`;
});

/**
 * 当前时间显示文本
 * 格式：当前时间 / 总时长（秒）
 */
const timeDisplay = computed(() => {
  if (!props.animationState) {
    return '0.00s / 0.00s';
  }
  const current = props.animationState.currentTime.toFixed(2);
  const total = props.animationState.duration.toFixed(2);
  return `${current}s / ${total}s`;
});

// ===== 事件处理函数 =====

/**
 * 处理动画选择变更
 */
function handleAnimationChange(value: string): void {
  emit('update:selectedAnimation', value);
}

/**
 * 处理播放/暂停按钮点击
 */
function handleTogglePlay(): void {
  emit('toggle-play');
}

/**
 * 处理停止按钮点击
 */
function handleStop(): void {
  emit('stop');
}

/**
 * 处理循环模式变更
 */
function handleLoopChange(value: boolean): void {
  emit('update:loop', value);
}
</script>

<template>
  <div v-if="hasAnimations" class="animation-controller">
    <!-- 动画选择区域 -->
    <div class="control-section">
      <div class="control-item">
        <span class="control-label">动画:</span>
        <el-select
          :model-value="selectedAnimation"
          size="small"
          class="animation-select"
          placeholder="选择动画"
          @update:model-value="handleAnimationChange"
        >
          <el-option
            v-for="animation in animations"
            :key="animation"
            :value="animation"
            :label="animation"
          />
        </el-select>
      </div>
    </div>

    <!-- 播放控制按钮区域 -->
    <div class="control-section">
      <div class="animation-buttons">
        <el-button
          size="small"
          :type="isPlaying ? 'warning' : 'success'"
          :disabled="!selectedAnimation"
          @click="handleTogglePlay"
        >
          <el-icon v-if="isPlaying">
            <VideoPause />
          </el-icon>
          <el-icon v-else>
            <VideoPlay />
          </el-icon>
          {{ isPlaying ? '暂停' : '播放' }}
        </el-button>
        <el-button
          size="small"
          type="danger"
          :disabled="!selectedAnimation"
          @click="handleStop"
        >
          停止
        </el-button>
      </div>
    </div>

    <!-- 循环控制区域 -->
    <div class="control-section">
      <div class="control-item">
        <el-checkbox :model-value="loop" @update:model-value="handleLoopChange">
          循环播放
        </el-checkbox>
      </div>
    </div>

    <!-- 帧信息显示区域 -->
    <div class="control-section frame-info">
      <div class="info-item">
        <span class="info-label">帧:</span>
        <span class="info-value">{{ frameDisplay }}</span>
      </div>
      <div class="info-item">
        <span class="info-label">时间:</span>
        <span class="info-value">{{ timeDisplay }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 动画控制器容器 */
.animation-controller {
  background-color: rgba(0, 0, 0, 0.8);
  padding: 15px;
  border-radius: 5px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 280px;
  color: #ffffff;
  font-size: 12px;
}

/* 控制区域分组 */
.control-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 单个控制项 */
.control-item {
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
}

/* 控制标签 */
.control-label {
  white-space: nowrap;
  min-width: 40px;
}

/* 动画选择下拉框 */
.animation-select {
  flex: 1;
  min-width: 180px;
}

/* 播放控制按钮组 */
.animation-buttons {
  display: flex;
  gap: 8px;
}

/* 帧信息区域 */
.frame-info {
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  padding-top: 10px;
  margin-top: 5px;
}

/* 信息项 */
.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: monospace;
}

/* 信息标签 */
.info-label {
  color: #a0a0a0;
  min-width: 40px;
}

/* 信息值 */
.info-value {
  color: #00d4ff;
}

/* Element Plus 复选框样式覆盖 */
.animation-controller :deep(.el-checkbox__label) {
  color: #ffffff;
}

.animation-controller :deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
  color: #ffffff;
}
</style>
