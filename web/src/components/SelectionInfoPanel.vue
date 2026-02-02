<script setup lang="ts">
/**
 * SelectionInfoPanel.vue - 选择信息面板组件
 *
 * 负责：
 * - 显示选中的三角形信息（面片索引、材质名称、顶点坐标等）
 * - 显示选中的骨骼信息（骨骼名称、索引、父骨骼等）
 * - 根据选择模式显示不同的信息面板
 *
 * @validates 需求 6.4: 选择信息面板作为独立组件，显示选中的三角形或骨骼信息
 */
import { computed } from "vue";
import * as THREE from "three";

// 三角形顶点信息接口
interface VertexInfo {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  uv?: THREE.Vector2;
}

// 三角形选择信息接口
interface TriangleInfo {
  mesh: THREE.Mesh | null;
  faceIndex: number | null;
  vertices: VertexInfo[] | null;
}

// 骨骼选择信息接口
interface BoneInfo {
  boneIndex: number;
  boneName: string;
  worldPosition: THREE.Vector3;
  localPosition: THREE.Vector3;
}

// Props 定义
const props = defineProps<{
  /** 选中的三角形信息 */
  triangleInfo?: TriangleInfo | null;
  /** 选中的骨骼信息 */
  boneInfo?: BoneInfo | null;
}>();

// 计算属性：是否显示三角形面板
const showTrianglePanel = computed(() => {
  return props.triangleInfo !== null && props.triangleInfo !== undefined;
});

// 计算属性：是否显示骨骼面板
const showBonePanel = computed(() => {
  return props.boneInfo !== null && props.boneInfo !== undefined;
});

// 计算属性：获取 Mesh 名称
const meshName = computed(() => {
  return props.triangleInfo?.mesh?.name || "Unnamed";
});

/**
 * 格式化数字为固定小数位
 * @param value 数值
 * @param digits 小数位数
 */
function formatNumber(value: number, digits: number = 3): string {
  return value.toFixed(digits);
}

/**
 * 格式化 Vector3 为字符串
 * @param vec Vector3 对象
 */
function formatVector3(vec: THREE.Vector3): string {
  return `(${formatNumber(vec.x)}, ${formatNumber(vec.y)}, ${formatNumber(vec.z)})`;
}

/**
 * 格式化 Vector2 为字符串
 * @param vec Vector2 对象
 */
function formatVector2(vec: THREE.Vector2): string {
  return `(${formatNumber(vec.x)}, ${formatNumber(vec.y)})`;
}
</script>

<template>
  <!-- 三角形信息面板 -->
  <div
    v-if="showTrianglePanel"
    class="selection-info-panel"
  >
    <h4 class="selection-info-title">
      选中三角形信息
    </h4>
    <div class="selection-info-content">
      <!-- Mesh 名称 -->
      <div class="selection-info-item">
        <strong>Mesh:</strong> {{ meshName }}
      </div>
      <!-- 面片索引 -->
      <div class="selection-info-item">
        <strong>Face Index:</strong> {{ triangleInfo?.faceIndex }}
      </div>
      <!-- 顶点信息列表 -->
      <div class="triangle-vertices">
        <div
          v-for="(vertex, index) in triangleInfo?.vertices"
          :key="index"
          class="vertex-info"
        >
          <h5>顶点 {{ index + 1 }}</h5>
          <div class="vertex-detail">
            <!-- 顶点位置 -->
            <div>
              <strong>位置:</strong> {{ formatVector3(vertex.position) }}
            </div>
            <!-- 顶点法线 -->
            <div><strong>法线:</strong> {{ formatVector3(vertex.normal) }}</div>
            <!-- 顶点 UV（如果存在） -->
            <div v-if="vertex.uv">
              <strong>UV:</strong> {{ formatVector2(vertex.uv) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 骨骼信息面板 -->
  <div
    v-if="showBonePanel"
    class="selection-info-panel"
  >
    <h4 class="selection-info-title">
      选中骨骼信息
    </h4>
    <div class="selection-info-content">
      <!-- 骨骼名称 -->
      <div class="selection-info-item bone-info-mono">
        <strong>骨骼名称:</strong> {{ boneInfo?.boneName }}
      </div>
      <!-- 骨骼索引 -->
      <div class="selection-info-item bone-info-mono">
        <strong>骨骼索引:</strong> {{ boneInfo?.boneIndex }}
      </div>
      <!-- 世界坐标 -->
      <div class="bone-info-item">
        <strong>世界坐标:</strong>
        {{ boneInfo ? formatVector3(boneInfo.worldPosition) : "" }}
      </div>
      <!-- 本地坐标 -->
      <div class="bone-info-item">
        <strong>本地坐标:</strong>
        {{ boneInfo ? formatVector3(boneInfo.localPosition) : "" }}
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 选中信息面板 */
.selection-info-panel {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background-color: rgba(0, 0, 0, 0.8);
  padding: 15px;
  border-radius: 5px;
  width: 250px;
  max-height: 400px;
  overflow-y: auto;
  z-index: 50;
  color: #ffffff;
  font-size: 12px;
}

/* 面板标题 */
.selection-info-title {
  margin: 0 0 10px 0;
  font-size: 14px;
  font-weight: bold;
  color: #00d4ff;
}

/* 面板内容容器 */
.selection-info-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 信息项 */
.selection-info-item {
  margin-bottom: 5px;
}

/* 骨骼信息等宽字体 */
.bone-info-mono {
  font-family: monospace;
}

/* 骨骼信息项 */
.bone-info-item {
  margin-bottom: 5px;
}

/* 三角形顶点容器 */
.triangle-vertices {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}

/* 单个顶点信息 */
.vertex-info {
  background-color: rgba(255, 255, 255, 0.05);
  padding: 8px;
  border-radius: 4px;
}

/* 顶点标题 */
.vertex-info h5 {
  margin: 0 0 6px 0;
  font-size: 12px;
  font-weight: bold;
  color: #00d4ff;
}

/* 顶点详细信息 */
.vertex-detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.vertex-detail div {
  font-family: monospace;
  font-size: 11px;
}
</style>
