<script setup lang="ts">
/**
 * ControlPanel.vue - 控制面板组件
 *
 * 负责：
 * - 显示选项控制（法线、线框、骨骼、网格辅助线）
 * - 选择模式切换（无/三角形/骨骼）
 * - 摄像机调整按钮
 *
 * @validates 需求 6.2: 控制面板作为独立组件，包含显示选项（法线、线框、骨骼）
 */
import { Camera } from '@element-plus/icons-vue';

// 选择模式类型定义
type SelectionMode = 'none' | 'mesh' | 'bone';

// Props 定义 - 接收当前状态
defineProps<{
  /** 是否显示顶点法线 */
  showVertexNormals: boolean;
  /** 是否显示网格线框 */
  showWireframe: boolean;
  /** 是否显示骨骼 */
  showSkeleton: boolean;
  /** 是否显示网格辅助线 */
  showGridHelper?: boolean;
  /** 是否显示阴影 */
  showShadow?: boolean;
  /** 当前选择模式 */
  selectionMode: SelectionMode;
  /** 是否有模型加载（用于控制摄像机按钮状态） */
  hasModel?: boolean;
}>();

// Emits 定义 - 发送状态变更事件
const emit = defineEmits<{
  /** 顶点法线显示状态变更 */
  (e: 'update:showVertexNormals', value: boolean): void;
  /** 网格线框显示状态变更 */
  (e: 'update:showWireframe', value: boolean): void;
  /** 骨骼显示状态变更 */
  (e: 'update:showSkeleton', value: boolean): void;
  /** 网格辅助线显示状态变更 */
  (e: 'update:showGridHelper', value: boolean): void;
  /** 阴影显示状态变更 */
  (e: 'update:showShadow', value: boolean): void;
  /** 选择模式变更 */
  (e: 'update:selectionMode', value: SelectionMode): void;
  /** 调整摄像机按钮点击 */
  (e: 'fit-camera'): void;
}>();

/**
 * 处理顶点法线显示切换
 */
function handleVertexNormalsChange(value: boolean): void {
  emit('update:showVertexNormals', value);
}

/**
 * 处理网格线框显示切换
 */
function handleWireframeChange(value: boolean): void {
  emit('update:showWireframe', value);
}

/**
 * 处理骨骼显示切换
 */
function handleSkeletonChange(value: boolean): void {
  emit('update:showSkeleton', value);
}

/**
 * 处理网格辅助线显示切换
 */
function handleGridHelperChange(value: boolean): void {
  emit('update:showGridHelper', value);
}

/**
 * 处理阴影显示切换
 */
function handleShadowChange(value: boolean): void {
  emit('update:showShadow', value);
}

/**
 * 处理选择模式变更
 */
function handleSelectionModeChange(value: SelectionMode): void {
  emit('update:selectionMode', value);
}

/**
 * 处理调整摄像机按钮点击
 */
function handleFitCamera(): void {
  emit('fit-camera');
}
</script>

<template>
  <div class="control-panel">
    <!-- 显示选项区域 -->
    <div class="control-section">
      <div class="control-item">
        <el-checkbox
          :model-value="showVertexNormals"
          @update:model-value="handleVertexNormalsChange"
        >
          显示顶点法线
        </el-checkbox>
      </div>
      <div class="control-item">
        <el-checkbox
          :model-value="showWireframe"
          @update:model-value="handleWireframeChange"
        >
          显示网格线框
        </el-checkbox>
      </div>
      <div class="control-item">
        <el-checkbox
          :model-value="showSkeleton"
          @update:model-value="handleSkeletonChange"
        >
          显示骨骼
        </el-checkbox>
      </div>
      <div v-if="showGridHelper !== undefined" class="control-item">
        <el-checkbox
          :model-value="showGridHelper"
          @update:model-value="handleGridHelperChange"
        >
          显示网格辅助线
        </el-checkbox>
      </div>
      <div v-if="showShadow !== undefined" class="control-item">
        <el-checkbox :model-value="showShadow" @update:model-value="handleShadowChange">
          显示阴影
        </el-checkbox>
      </div>
    </div>

    <!-- 选择模式区域 -->
    <div class="control-section">
      <div class="control-item">
        <span class="control-label">选择模式:</span>
        <el-select
          :model-value="selectionMode"
          size="small"
          class="control-select"
          @update:model-value="handleSelectionModeChange"
        >
          <el-option value="none" label="--" />
          <el-option value="mesh" label="面片" />
          <el-option value="bone" label="骨骼" />
        </el-select>
      </div>
    </div>

    <!-- 摄像机控制区域 -->
    <div class="control-section">
      <div class="control-item">
        <el-button :disabled="!hasModel" size="small" @click="handleFitCamera">
          <el-icon><Camera /></el-icon>
          调整摄像机
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 控制面板容器 */
.control-panel {
  background-color: rgba(0, 0, 0, 0.7);
  padding: 10px;
  border-radius: 5px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  backdrop-filter: blur(5px);
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
  color: #ffffff;
  font-size: 14px;
  user-select: none;
}

/* 控制标签 */
.control-label {
  margin-right: 8px;
  white-space: nowrap;
}

/* 下拉选择框 */
.control-select {
  width: 140px;
}

/* Element Plus 复选框样式覆盖 */
.control-panel :deep(.el-checkbox__label) {
  color: #ffffff;
}

.control-panel :deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
  color: #ffffff;
}

/* ===== 移动端响应式优化 ===== */
@media (max-width: 768px) {
  .control-panel {
    padding: 8px;
    gap: 6px;
    font-size: 13px;
  }

  .control-section {
    gap: 4px;
  }

  .control-item {
    gap: 6px;
    font-size: 13px;
  }

  .control-label {
    font-size: 13px;
  }

  .control-select {
    width: 120px;
  }

  /* 移动端按钮优化 */
  .control-panel :deep(.el-button) {
    font-size: 13px;
    padding: 6px 12px;
  }

  /* 移动端复选框优化 */
  .control-panel :deep(.el-checkbox__label) {
    font-size: 13px;
  }
}

/* 小屏手机进一步优化 */
@media (max-width: 480px) {
  .control-panel {
    padding: 6px;
    gap: 4px;
    font-size: 12px;
    max-width: 100%;
  }

  .control-section {
    gap: 3px;
  }

  .control-item {
    gap: 4px;
    font-size: 12px;
    flex-wrap: wrap;
  }

  .control-label {
    font-size: 12px;
    margin-right: 4px;
  }

  .control-select {
    width: 100px;
    font-size: 12px;
  }

  .control-select :deep(.el-input__inner) {
    font-size: 12px;
    padding: 4px 8px;
  }

  /* 小屏按钮进一步缩小 */
  .control-panel :deep(.el-button) {
    font-size: 12px;
    padding: 5px 10px;
  }

  .control-panel :deep(.el-button .el-icon) {
    font-size: 14px;
  }

  /* 小屏复选框优化 */
  .control-panel :deep(.el-checkbox__label) {
    font-size: 12px;
    padding-left: 6px;
  }

  .control-panel :deep(.el-checkbox__inner) {
    width: 14px;
    height: 14px;
  }
}

/* 触摸设备优化 - 增大触摸区域 */
@media (hover: none) and (pointer: coarse) {
  .control-item {
    min-height: 44px;
    padding: 4px 0;
  }

  .control-panel :deep(.el-checkbox) {
    min-height: 44px;
    display: flex;
    align-items: center;
  }

  .control-panel :deep(.el-button) {
    min-height: 44px;
  }
}

/* 横屏模式优化 */
@media (max-width: 896px) and (orientation: landscape) {
  .control-panel {
    padding: 6px;
    gap: 4px;
  }

  .control-section {
    gap: 3px;
  }

  .control-item {
    font-size: 12px;
    gap: 4px;
  }

  .control-panel :deep(.el-button) {
    font-size: 12px;
    padding: 4px 8px;
  }
}
</style>
