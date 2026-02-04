<script setup lang="ts">
/**
 * ThreeViewer.vue - 3D 查看器组件
 *
 * 负责：
 * - 创建和管理 canvas 容器
 * - 使用 World 类管理 Three.js 场景
 * - 使用 Model 类加载和显示宝可梦模型
 * - 整合子组件（ControlPanel、AnimationController、SelectionInfoPanel、LoadingOverlay）
 * - 处理组件生命周期
 * - 显示模型加载错误并提供重试功能
 *
 * @validates 需求 6.1: ThreeViewer组件拆分为场景容器组件和控制面板组件
 * @validates 需求 6.7: 组件间通信使用props和emits进行数据传递
 */
import { ref, watch, onMounted, onUnmounted, computed } from 'vue';
import * as THREE from 'three';

// 导入渲染层类
import { World } from '../rendering';

// 导入 Model 整合类
import { Model } from '../core/model';

// 导入宝可梦模型加载
import { usePokemonModel } from '../composables/usePokemonModel';

// 导入子组件
import ControlPanel from './ControlPanel.vue';
import AnimationController from './AnimationController.vue';
import SelectionInfoPanel from './SelectionInfoPanel.vue';
import LoadingOverlay from './LoadingOverlay.vue';
import ErrorDisplay from './ErrorDisplay.vue';

// 导入类型
import { PokemonModel } from '../models';
import { Game } from '../types';
import { AnimationState } from '../core/data/types';

// ===== Props 定义 =====
const props = defineProps<{
  /** 宝可梦 */
  pokemon?: PokemonModel | null;
  /** 形态 ID，如 [0, 0] */
  form?: [number, number] | null;
  /** 游戏类型 */
  game: Game;
}>();

// ===== Emits 定义 =====
const emit = defineEmits<{
  /** 加载状态变化事件 */
  (e: 'loading-change', loading: boolean): void;
  /** 加载进度变化事件 */
  (e: 'progress-change', progress: number): void;
  /** 错误事件 */
  (e: 'error', error: string | null): void;
  /** 模型加载完成事件 */
  (e: 'model-loaded', formId: string): void;
}>();

// ===== 响应式状态 =====

// 使用宝可梦模型加载 Composable
const { load: loadModel } = usePokemonModel();

// Canvas 容器元素引用
const containerRef = ref<HTMLDivElement | null>(null);

// World 实例
let world: World | null = null;

// 当前加载的 Model 实例
const currentModel = ref<Model | null>(null);

// 当前形态 ID
const currentFormId = ref<string>('');

// 加载状态
const loading = ref(false);
const progress = ref(0);
const progressInfo = ref({ message: '加载中...' });
const error = ref<string | null>(null);

// 场景是否已初始化
const sceneInitialized = ref(false);

// 是否为开发模式
const isDevelopment = import.meta.env.DEV;

// ===== 控制面板状态 =====

// 是否显示顶点法线
const showVertexNormals = ref(false);

// 是否显示网格线框
const showWireframe = ref(false);

// 是否显示骨骼
const showSkeleton = ref(false);

// 是否显示网格辅助线
const showGridHelper = ref(true);

// 是否显示阴影（默认启用）
const showShadow = ref(true);

// 选择模式：'none' | 'mesh' | 'bone'
const selectionMode = ref<'none' | 'mesh' | 'bone'>('none');

// ===== 动画相关状态 =====

// 可用的动画列表
const availableAnimations = ref<Record<string, string[]>>({});

// 当前选中的动画名称
const selectedAnimation = ref<string>('');

// 是否正在播放动画
const isAnimationPlaying = ref(false);

// 是否循环播放
const animationLoop = ref(true);

// 动画状态
const animationState = ref<AnimationState | null>(null);

// ===== 选择信息状态 =====

// 选中的三角形信息
const selectedTriangle = ref<{
  mesh: THREE.Mesh | null;
  faceIndex: number | null;
  vertices: Array<{
    position: THREE.Vector3;
    normal: THREE.Vector3;
    uv?: THREE.Vector2;
  }> | null;
} | null>(null);

// 选中的骨骼信息
const selectedBone = ref<{
  boneIndex: number;
  boneName: string;
  worldPosition: THREE.Vector3;
  localPosition: THREE.Vector3;
} | null>(null);

// 顶点法线可视化组
let vertexNormalsGroup: THREE.Group | null = null;

// 骨骼可视化组
let skeletonGroup: THREE.Group | null = null;

// 选中三角形高亮 Mesh
let selectedTriangleHighlight: THREE.Mesh | null = null;

// 选中骨骼高亮 Mesh
let selectedBoneHighlight: THREE.Mesh | null = null;

// ===== 计算属性 =====

/**
 * 是否有有效的模型路径
 */
const hasValidModelPath = computed(() => {
  return props.pokemon && props.form;
});

/**
 * 是否有动画可用
 */
const hasAnimations = computed(() => {
  return Object.keys(availableAnimations.value).length > 0;
});

/**
 * 动画选项列表
 */
const animationOptions = computed(() => {
  return Object.keys(availableAnimations.value);
});

// ===== 核心方法 =====

/**
 * 初始化 World
 */
function initWorld(): void {
  if (!containerRef.value) {
    console.warn('[ThreeViewer] 容器元素不存在，无法初始化 World');
    return;
  }

  // 创建 World 实例
  world = new World(containerRef.value);

  // 启动渲染循环
  world.start();

  // 添加模型更新回调
  world.addRenderCallback((deltaTime) => {
    if (currentModel.value) {
      currentModel.value.update(deltaTime);
      // 更新动画状态
      if (isAnimationPlaying.value) {
        animationState.value = currentModel.value.getAnimationState();
      }
    }
  });

  sceneInitialized.value = true;
}

/**
 * 加载并显示模型
 *
 * @param pokemon - 宝可梦数据
 * @param form - 形态数据 [formIndex, subFormIndex]
 */
async function loadAndDisplayModel(
  pokemon: PokemonModel,
  form: [number, number]
): Promise<void> {
  // 确保场景已初始化
  if (!sceneInitialized.value || !world) {
    console.warn('[ThreeViewer] 场景未初始化，无法加载模型');
    return;
  }

  // 开始加载时先设置为无选择模式
  selectionMode.value = 'none';

  // 切换模型时清空当前选择的mesh、骨骼和动画数据
  selectedTriangle.value = null;
  selectedBone.value = null;
  selectedAnimation.value = '';
  isAnimationPlaying.value = false;
  animationState.value = null;

  // 移除之前的模型
  if (currentModel.value) {
    world.remove(currentModel.value);
    currentModel.value.dispose();
    currentModel.value = null;
  }

  // 清理顶点法线可视化
  if (vertexNormalsGroup) {
    world.remove(vertexNormalsGroup);
    vertexNormalsGroup = null;
  }

  // 清理骨骼可视化
  if (skeletonUpdateCallback) {
    world.removeRenderCallback(skeletonUpdateCallback);
    skeletonUpdateCallback = null;
  }
  if (skeletonGroup) {
    world.remove(skeletonGroup);
    if (skeletonJointsInstanced) {
      skeletonJointsInstanced.geometry.dispose();
      if (skeletonJointsInstanced.material instanceof THREE.Material) {
        skeletonJointsInstanced.material.dispose();
      }
    }
    if (skeletonLinesSegments) {
      skeletonLinesSegments.geometry.dispose();
      if (skeletonLinesSegments.material instanceof THREE.Material) {
        skeletonLinesSegments.material.dispose();
      }
    }
    skeletonGroup = null;
  }
  skeletonJointsInstanced = null;
  skeletonLinesSegments = null;
  skeletonBoneIndexMap = null;
  skeletonLineData = null;

  // 清理选择高亮
  if (selectedTriangleHighlight) {
    world.remove(selectedTriangleHighlight);
    selectedTriangleHighlight.geometry.dispose();
    if (selectedTriangleHighlight.material instanceof THREE.Material) {
      selectedTriangleHighlight.material.dispose();
    }
    selectedTriangleHighlight = null;
  }
  if (selectedBoneHighlight) {
    world.remove(selectedBoneHighlight);
    selectedBoneHighlight.geometry.dispose();
    if (selectedBoneHighlight.material instanceof THREE.Material) {
      selectedBoneHighlight.material.dispose();
    }
    selectedBoneHighlight = null;
  }

  // 构建 formId
  const pokemonId = `pm${pokemon.resourceId}`;
  const formId = `${pokemonId}_${form[0].toString().padStart(2, '0')}_${form[1].toString().padStart(2, '0')}`;

  // 设置加载状态
  loading.value = true;
  progress.value = 0;
  error.value = null;
  progressInfo.value = { message: `正在加载 ${formId}...` };

  try {
    // 使用 Model.load 加载模型
    progressInfo.value = { message: '正在加载模型文件...' };
    progress.value = 20;

    const model = await loadModel(formId, props.game);

    // 检查加载是否成功
    if (!model) {
      throw new Error('模型加载失败');
    }

    progressInfo.value = { message: '正在创建网格...' };
    progress.value = 60;

    // 将模型添加到场景
    world.add(model);
    currentModel.value = model;
    currentFormId.value = formId;

    progressInfo.value = { message: '正在设置相机...' };
    progress.value = 80;

    // 设置固定的摄像机位置 - 正面偏上视角
    world.camera.setPosition(0, 0.7, 5);
    world.camera.setTarget(0, 1, 0);

    // 应用当前的显示设置
    applyDisplaySettings();

    progressInfo.value = { message: '加载完成' };
    progress.value = 100;

    // 触发模型加载完成事件
    emit('model-loaded', formId);

    // 获取可用动画列表
    const formResourceData = pokemon.getFormResourceData(props.game, form);
    availableAnimations.value = formResourceData?.animations || {};

    // 如果有可用动画，选择第一个
    if (Object.keys(availableAnimations.value).length > 0) {
      selectedAnimation.value = Object.keys(availableAnimations.value)[0];
    }
  } catch (err) {
    // 加载失败时设置为无选择模式
    selectionMode.value = 'none';

    // 设置错误信息
    const errorMessage = err instanceof Error ? err.message : String(err);
    error.value = errorMessage;

    console.error('[ThreeViewer] 模型加载失败:', {
      pokemonId,
      formId,
      error: err,
      errorMessage,
      timestamp: new Date().toISOString(),
    });
  } finally {
    loading.value = false;
  }
}

/**
 * 应用显示设置到当前模型
 */
function applyDisplaySettings(): void {
  if (!currentModel.value) return;

  // 应用线框模式
  currentModel.value.setWireframe(showWireframe.value);

  // 应用网格辅助线可见性
  if (world) {
    world.setGridVisible(showGridHelper.value);
  }

  // 应用阴影设置
  if (world) {
    world.setShadowEnabled(showShadow.value);
  }

  // 设置模型投射和接收阴影
  if (currentModel.value) {
    currentModel.value.setCastShadow(showShadow.value);
    currentModel.value.setReceiveShadow(showShadow.value);
  }

  // 应用顶点法线显示
  if (showVertexNormals.value) {
    updateVertexNormalsVisualization(true);
  }

  // 应用骨骼显示
  if (showSkeleton.value) {
    updateSkeletonVisualization(true);
  }
}

/**
 * 处理重试按钮点击
 */
function handleRetry(): void {
  if (props.pokemon && props.form) {
    loadAndDisplayModel(props.pokemon, props.form);
  }
}

// ===== 控制面板事件处理 =====

/**
 * 处理顶点法线显示切换
 */
function handleVertexNormalsChange(value: boolean): void {
  showVertexNormals.value = value;
  updateVertexNormalsVisualization(value);
}

/**
 * 更新顶点法线可视化
 */
function updateVertexNormalsVisualization(visible: boolean): void {
  // 移除现有的法线组
  if (vertexNormalsGroup && world) {
    world.remove(vertexNormalsGroup);
    vertexNormalsGroup.traverse((child) => {
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    });
    vertexNormalsGroup = null;
  }

  if (!visible || !currentModel.value || !world) {
    return;
  }

  // 创建新的法线组
  vertexNormalsGroup = new THREE.Group();
  vertexNormalsGroup.name = 'VertexNormals';

  // 遍历模型中的所有 Mesh
  currentModel.value.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geometry = child.geometry;
      const positions = geometry.attributes.position;
      const normals = geometry.attributes.normal;

      if (!positions || !normals) {
        return;
      }

      // 创建材质用于绘制法线
      const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });

      // 为每个顶点创建法线线条
      for (let i = 0; i < positions.count; i++) {
        const position = new THREE.Vector3().fromBufferAttribute(positions, i);
        const normal = new THREE.Vector3().fromBufferAttribute(normals, i);

        // 将顶点位置转换到世界坐标
        const worldPosition = child.localToWorld(position.clone());

        // 计算法线终点
        const normalLength = 0.05;
        const endPosition = worldPosition
          .clone()
          .add(normal.clone().multiplyScalar(normalLength));

        // 创建线条几何体
        const lineGeometry = new THREE.BufferGeometry().setFromPoints([
          worldPosition,
          endPosition,
        ]);
        const line = new THREE.Line(lineGeometry, material);

        vertexNormalsGroup!.add(line);
      }
    }
  });

  // 添加到场景
  world.add(vertexNormalsGroup);
}

/**
 * 处理网格线框显示切换
 */
function handleWireframeChange(value: boolean): void {
  showWireframe.value = value;
  if (currentModel.value) {
    currentModel.value.setWireframe(value);
  }
}

/**
 * 处理骨骼显示切换
 */
function handleSkeletonChange(value: boolean): void {
  showSkeleton.value = value;
  updateSkeletonVisualization(value);
}

// 骨骼可视化的缓存数据（使用 InstancedMesh 和 LineSegments 优化性能）
let skeletonJointsInstanced: THREE.InstancedMesh | null = null;
let skeletonLinesSegments: THREE.LineSegments | null = null;
let skeletonBoneIndexMap: Map<string, number> | null = null; // boneName -> instanceIndex
let skeletonLineData: Array<{
  parentIndex: number;
  childIndex: number;
}> | null = null;
let skeletonUpdateCallback: ((deltaTime: number) => void) | null = null;

// 复用的临时对象，避免每帧创建新对象
const _tempWorldPos = new THREE.Vector3();
const _tempMatrix = new THREE.Matrix4();

/**
 * 更新骨骼可视化
 * 使用 InstancedMesh 渲染所有关节球体（1个 draw call）
 * 使用 LineSegments 渲染所有骨骼连接线（1个 draw call）
 */
function updateSkeletonVisualization(visible: boolean): void {
  // 移除更新回调
  if (skeletonUpdateCallback && world) {
    world.removeRenderCallback(skeletonUpdateCallback);
    skeletonUpdateCallback = null;
  }

  // 移除现有的骨骼可视化
  if (skeletonGroup && world) {
    world.remove(skeletonGroup);
    // 释放资源
    if (skeletonJointsInstanced) {
      skeletonJointsInstanced.geometry.dispose();
      if (skeletonJointsInstanced.material instanceof THREE.Material) {
        skeletonJointsInstanced.material.dispose();
      }
    }
    if (skeletonLinesSegments) {
      skeletonLinesSegments.geometry.dispose();
      if (skeletonLinesSegments.material instanceof THREE.Material) {
        skeletonLinesSegments.material.dispose();
      }
    }
    skeletonGroup = null;
    skeletonJointsInstanced = null;
    skeletonLinesSegments = null;
    skeletonBoneIndexMap = null;
    skeletonLineData = null;
  }

  if (!visible || !currentModel.value || !world) {
    return;
  }

  const threeSkeleton = currentModel.value.threeSkeleton;
  if (!threeSkeleton || threeSkeleton.bones.length === 0) {
    return;
  }

  const boneCount = threeSkeleton.bones.length;

  // 创建新的骨骼组
  skeletonGroup = new THREE.Group();
  skeletonGroup.name = 'SkeletonVisualization';

  // 创建骨骼名称到索引的映射
  skeletonBoneIndexMap = new Map<string, number>();
  for (let i = 0; i < boneCount; i++) {
    skeletonBoneIndexMap.set(threeSkeleton.bones[i].name, i);
  }

  // 创建共享的球体几何体（所有关节使用同一个几何体）
  const jointGeometry = new THREE.SphereGeometry(0.02, 6, 6);
  const jointMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    depthTest: false,
  });

  // 创建 InstancedMesh（1个 draw call 渲染所有关节）
  skeletonJointsInstanced = new THREE.InstancedMesh(
    jointGeometry,
    jointMaterial,
    boneCount
  );
  skeletonJointsInstanced.name = 'SkeletonJoints';
  skeletonJointsInstanced.renderOrder = 1;

  // 初始化每个实例的变换矩阵
  for (let i = 0; i < boneCount; i++) {
    const bone = threeSkeleton.bones[i];
    bone.getWorldPosition(_tempWorldPos);
    _tempMatrix.makeTranslation(_tempWorldPos.x, _tempWorldPos.y, _tempWorldPos.z);
    skeletonJointsInstanced.setMatrixAt(i, _tempMatrix);
  }
  skeletonJointsInstanced.instanceMatrix.needsUpdate = true;

  skeletonGroup.add(skeletonJointsInstanced);

  // 统计有父骨骼的骨骼数量（用于创建连接线）
  skeletonLineData = [];
  for (let i = 0; i < boneCount; i++) {
    const bone = threeSkeleton.bones[i];
    if (bone.parent instanceof THREE.Bone) {
      const parentIndex = skeletonBoneIndexMap.get(bone.parent.name);
      if (parentIndex !== undefined) {
        skeletonLineData.push({ parentIndex, childIndex: i });
      }
    }
  }

  // 创建 LineSegments 几何体（每条线段需要2个顶点）
  const lineCount = skeletonLineData.length;
  if (lineCount > 0) {
    const linePositions = new Float32Array(lineCount * 2 * 3); // lineCount * 2 vertices * 3 components
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

    // 初始化线段位置
    for (let i = 0; i < lineCount; i++) {
      const { parentIndex, childIndex } = skeletonLineData[i];
      const parentBone = threeSkeleton.bones[parentIndex];
      const childBone = threeSkeleton.bones[childIndex];

      parentBone.getWorldPosition(_tempWorldPos);
      linePositions[i * 6 + 0] = _tempWorldPos.x;
      linePositions[i * 6 + 1] = _tempWorldPos.y;
      linePositions[i * 6 + 2] = _tempWorldPos.z;

      childBone.getWorldPosition(_tempWorldPos);
      linePositions[i * 6 + 3] = _tempWorldPos.x;
      linePositions[i * 6 + 4] = _tempWorldPos.y;
      linePositions[i * 6 + 5] = _tempWorldPos.z;
    }

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      depthTest: false,
    });

    skeletonLinesSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
    skeletonLinesSegments.name = 'SkeletonLines';
    skeletonLinesSegments.renderOrder = 1;

    skeletonGroup.add(skeletonLinesSegments);
  }

  // 添加到场景
  world.add(skeletonGroup);

  // 创建并添加骨骼更新回调
  skeletonUpdateCallback = updateSkeletonPositions;
  world.addRenderCallback(skeletonUpdateCallback);
}

/**
 * 更新骨骼可视化位置（动画时调用）
 * 优化版本：直接更新 InstancedMesh 和 LineSegments 的缓冲区
 */
function updateSkeletonPositions(): void {
  if (!currentModel.value?.threeSkeleton) {
    return;
  }

  const threeSkeleton = currentModel.value.threeSkeleton;
  const boneCount = threeSkeleton.bones.length;

  // 更新关节位置（InstancedMesh）
  if (skeletonJointsInstanced) {
    for (let i = 0; i < boneCount; i++) {
      const bone = threeSkeleton.bones[i];
      bone.getWorldPosition(_tempWorldPos);
      _tempMatrix.makeTranslation(_tempWorldPos.x, _tempWorldPos.y, _tempWorldPos.z);
      skeletonJointsInstanced.setMatrixAt(i, _tempMatrix);
    }
    skeletonJointsInstanced.instanceMatrix.needsUpdate = true;
  }

  // 更新连接线位置（LineSegments）
  if (skeletonLinesSegments && skeletonLineData) {
    const positionAttr = skeletonLinesSegments.geometry.attributes
      .position as THREE.BufferAttribute;
    const positions = positionAttr.array as Float32Array;

    for (let i = 0; i < skeletonLineData.length; i++) {
      const { parentIndex, childIndex } = skeletonLineData[i];
      const parentBone = threeSkeleton.bones[parentIndex];
      const childBone = threeSkeleton.bones[childIndex];

      parentBone.getWorldPosition(_tempWorldPos);
      positions[i * 6 + 0] = _tempWorldPos.x;
      positions[i * 6 + 1] = _tempWorldPos.y;
      positions[i * 6 + 2] = _tempWorldPos.z;

      childBone.getWorldPosition(_tempWorldPos);
      positions[i * 6 + 3] = _tempWorldPos.x;
      positions[i * 6 + 4] = _tempWorldPos.y;
      positions[i * 6 + 5] = _tempWorldPos.z;
    }

    positionAttr.needsUpdate = true;
  }
}

/**
 * 处理网格辅助线显示切换
 */
function handleGridHelperChange(value: boolean): void {
  showGridHelper.value = value;
  if (world) {
    world.setGridVisible(value);
  }
}

/**
 * 处理阴影显示切换
 */
function handleShadowChange(value: boolean): void {
  showShadow.value = value;
  if (world) {
    world.setShadowEnabled(value);
  }
  // 更新模型的阴影设置
  if (currentModel.value) {
    currentModel.value.setCastShadow(value);
    currentModel.value.setReceiveShadow(value);
  }
}

/**
 * 处理选择模式变更
 */
function handleSelectionModeChange(value: 'none' | 'mesh' | 'bone'): void {
  selectionMode.value = value;
  // 切换模式时清除当前的选择状态和高亮
  selectedTriangle.value = null;
  selectedBone.value = null;
  highlightSelectedTriangle(null, null);
  highlightSelectedBone(null);
}

/**
 * 高亮显示选中的三角形
 */
function highlightSelectedTriangle(
  mesh: THREE.Mesh | null,
  faceIndex: number | null
): void {
  // 移除现有的高亮
  if (selectedTriangleHighlight && world) {
    world.remove(selectedTriangleHighlight);
    selectedTriangleHighlight.geometry.dispose();
    if (Array.isArray(selectedTriangleHighlight.material)) {
      selectedTriangleHighlight.material.forEach((mat) => mat.dispose());
    } else {
      selectedTriangleHighlight.material.dispose();
    }
    selectedTriangleHighlight = null;
  }

  // 如果没有选中任何东西，返回
  if (!mesh || faceIndex === null || !mesh.geometry || !world) {
    return;
  }

  const geometry = mesh.geometry;
  const positionAttribute = geometry.attributes.position;
  const indexAttribute = geometry.index;

  if (!positionAttribute) {
    return;
  }

  // 获取三角形的三个顶点索引
  let a: number, b: number, c: number;
  if (indexAttribute) {
    // 使用索引缓冲区
    a = indexAttribute.getX(faceIndex * 3);
    b = indexAttribute.getX(faceIndex * 3 + 1);
    c = indexAttribute.getX(faceIndex * 3 + 2);
  } else {
    // 不使用索引缓冲区
    a = faceIndex * 3;
    b = faceIndex * 3 + 1;
    c = faceIndex * 3 + 2;
  }

  // 创建三角形的几何体
  const triangleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(9); // 3 vertices * 3 coordinates

  // 获取顶点位置
  const posA = new THREE.Vector3().fromBufferAttribute(positionAttribute, a);
  const posB = new THREE.Vector3().fromBufferAttribute(positionAttribute, b);
  const posC = new THREE.Vector3().fromBufferAttribute(positionAttribute, c);

  // 设置位置数组
  positions[0] = posA.x;
  positions[1] = posA.y;
  positions[2] = posA.z;
  positions[3] = posB.x;
  positions[4] = posB.y;
  positions[5] = posB.z;
  positions[6] = posC.x;
  positions[7] = posC.y;
  positions[8] = posC.z;

  triangleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  // 创建材质（绿色半透明）
  const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.7,
    depthTest: false,
  });

  // 创建高亮 mesh
  const highlightMesh = new THREE.Mesh(triangleGeometry, material);
  highlightMesh.name = 'SelectedTriangleHighlight';
  highlightMesh.renderOrder = 999;

  // 设置变换矩阵与原 mesh 相同
  highlightMesh.matrixAutoUpdate = false;
  highlightMesh.matrix.copy(mesh.matrixWorld);

  // 添加到场景
  world.add(highlightMesh);
  selectedTriangleHighlight = highlightMesh;
}

/**
 * 高亮显示选中的骨骼
 */
function highlightSelectedBone(boneIndex: number | null): void {
  // 移除现有的骨骼高亮
  if (selectedBoneHighlight && world) {
    world.remove(selectedBoneHighlight);
    selectedBoneHighlight.geometry.dispose();
    if (Array.isArray(selectedBoneHighlight.material)) {
      selectedBoneHighlight.material.forEach((mat) => mat.dispose());
    } else {
      selectedBoneHighlight.material.dispose();
    }
    selectedBoneHighlight = null;
  }

  // 如果没有选中任何骨骼，返回
  if (boneIndex === null || !currentModel.value?.threeSkeleton || !world) {
    return;
  }

  const threeSkeleton = currentModel.value.threeSkeleton;

  // 检查索引是否有效
  if (boneIndex < 0 || boneIndex >= threeSkeleton.bones.length) {
    return;
  }

  const bone = threeSkeleton.bones[boneIndex];

  // 获取骨骼的世界位置
  const worldPosition = new THREE.Vector3();
  bone.getWorldPosition(worldPosition);

  // 创建高亮球体（比原球体稍大）
  const highlightGeometry = new THREE.SphereGeometry(0.035, 16, 16);
  const highlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00, // 黄色高亮
    transparent: true,
    opacity: 0.8,
    depthTest: false,
  });

  // 创建高亮 mesh
  const highlightMesh = new THREE.Mesh(highlightGeometry, highlightMaterial);
  highlightMesh.position.copy(worldPosition);
  highlightMesh.name = 'SelectedBoneHighlight';
  highlightMesh.renderOrder = 999;

  // 添加到场景
  world.add(highlightMesh);
  selectedBoneHighlight = highlightMesh;
}

/**
 * 处理调整摄像机按钮点击
 */
function handleFitCamera(): void {
  if (currentModel.value && world) {
    world.fitToModel(currentModel.value);
  }
}

// ===== 动画控制事件处理 =====

/**
 * 处理动画选择变更
 */
function handleAnimationChange(value: string): void {
  selectedAnimation.value = value;

  // 如果当前正在播放，切换到新动画
  if (isAnimationPlaying.value && currentModel.value) {
    loadAndPlayAnimation(value);
  }
}

/**
 * 处理播放/暂停切换
 */
function handleTogglePlay(): void {
  if (!currentModel.value) return;

  if (isAnimationPlaying.value) {
    // 暂停动画
    currentModel.value.pauseAnimation();
    isAnimationPlaying.value = false;
  } else {
    // 播放动画
    if (!selectedAnimation.value || !availableAnimations.value[selectedAnimation.value]) {
      console.warn('[ThreeViewer] 没有选中的动画或动画文件不存在');
      return;
    }
    loadAndPlayAnimation(selectedAnimation.value);
  }
}

/**
 * 处理停止动画
 */
function handleStopAnimation(): void {
  if (currentModel.value) {
    currentModel.value.stopAnimation();
    isAnimationPlaying.value = false;
    animationState.value = null;
  }
}

/**
 * 处理循环模式变更
 */
function handleLoopChange(value: boolean): void {
  animationLoop.value = value;
  if (currentModel.value) {
    currentModel.value.setAnimationLoop(value);
  }
}

/**
 * 加载并播放动画
 */
async function loadAndPlayAnimation(animationName: string): Promise<void> {
  if (!currentModel.value || !props.pokemon || !props.form) return;

  try {
    const animationFiles = availableAnimations.value[animationName];
    if (!animationFiles || animationFiles.length === 0) {
      throw new Error(`No animation files found for ${animationName}`);
    }

    // 选择第一个 .tranm 文件（骨骼动画）
    const tranmFile = animationFiles.find((file) => file.endsWith('.tranm'));
    if (!tranmFile) {
      throw new Error(`No .tranm file found for animation ${animationName}`);
    }

    // 查找对应的 .tracm 文件（可见性动画）
    const tracmFile = animationFiles.find((file) => file.endsWith('.tracm'));

    // 构建动画文件 URL
    const pokemonId = `pm${props.pokemon.resourceId}`;
    const formId = `${pokemonId}_${props.form[0].toString().padStart(2, '0')}_${props.form[1].toString().padStart(2, '0')}`;
    const tranmUrl = `models/${props.game}/${pokemonId}/${formId}/${tranmFile}`;

    // 加载骨骼动画
    await currentModel.value.loadAnimationFromUrl(tranmUrl);

    // 如果有可见性动画文件，也加载它
    if (tracmFile) {
      const tracmUrl = `models/${props.game}/${pokemonId}/${formId}/${tracmFile}`;
      await currentModel.value.loadAnimationFromUrl(tracmUrl);
    }

    // 设置循环模式
    currentModel.value.setAnimationLoop(animationLoop.value);

    // 开始播放
    currentModel.value.playAnimation();
    isAnimationPlaying.value = true;
  } catch (err) {
    console.error('[ThreeViewer] 加载动画失败:', err);
    isAnimationPlaying.value = false;
  }
}

// ===== 鼠标点击处理 =====

/**
 * 处理容器点击事件
 */
function handleContainerClick(event: MouseEvent): void {
  if (!currentModel.value || !world || selectionMode.value === 'none') {
    return;
  }

  if (selectionMode.value === 'mesh') {
    // 面片选择模式：对模型进行射线检测
    const intersections = world.raycastFromScreen(event.clientX, event.clientY, [
      currentModel.value,
    ]);

    if (intersections.length > 0) {
      const intersection = intersections[0];

      if (intersection.face) {
        // 选择三角形
        const mesh = intersection.object as THREE.Mesh;
        const geometry = mesh.geometry;
        const face = intersection.face;

        // 获取三角形的三个顶点索引
        const a = face.a;
        const b = face.b;
        const c = face.c;

        // 获取顶点属性
        const positionAttr = geometry.getAttribute('position');
        const normalAttr = geometry.getAttribute('normal');
        const uvAttr = geometry.getAttribute('uv');

        // 辅助函数：安全地从 buffer attribute 获取向量数据
        const getVector3FromAttribute = (
          attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
          index: number
        ): THREE.Vector3 => {
          const vector = new THREE.Vector3();
          if (attribute instanceof THREE.BufferAttribute) {
            vector.fromBufferAttribute(attribute, index);
          } else {
            vector.set(
              attribute.getX(index),
              attribute.getY(index),
              attribute.getZ(index)
            );
          }
          return vector;
        };

        const getVector2FromAttribute = (
          attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
          index: number
        ): THREE.Vector2 => {
          const vector = new THREE.Vector2();
          if (attribute instanceof THREE.BufferAttribute) {
            vector.fromBufferAttribute(attribute, index);
          } else {
            vector.set(attribute.getX(index), attribute.getY(index));
          }
          return vector;
        };

        const vertices: Array<{
          position: THREE.Vector3;
          normal: THREE.Vector3;
          uv?: THREE.Vector2;
        }> = [
          {
            position: getVector3FromAttribute(positionAttr, a),
            normal: normalAttr
              ? getVector3FromAttribute(normalAttr, a)
              : new THREE.Vector3(0, 1, 0),
            uv: uvAttr ? getVector2FromAttribute(uvAttr, a) : undefined,
          },
          {
            position: getVector3FromAttribute(positionAttr, b),
            normal: normalAttr
              ? getVector3FromAttribute(normalAttr, b)
              : new THREE.Vector3(0, 1, 0),
            uv: uvAttr ? getVector2FromAttribute(uvAttr, b) : undefined,
          },
          {
            position: getVector3FromAttribute(positionAttr, c),
            normal: normalAttr
              ? getVector3FromAttribute(normalAttr, c)
              : new THREE.Vector3(0, 1, 0),
            uv: uvAttr ? getVector2FromAttribute(uvAttr, c) : undefined,
          },
        ];

        selectedTriangle.value = {
          mesh,
          faceIndex: intersection.faceIndex!,
          vertices,
        };
        selectedBone.value = null;

        // 高亮选中的三角形
        highlightSelectedTriangle(mesh, intersection.faceIndex!);
        highlightSelectedBone(null);
      }
    }
  } else if (selectionMode.value === 'bone') {
    // 骨骼选择模式：对骨骼关节 InstancedMesh 进行射线检测
    if (!skeletonJointsInstanced || !currentModel.value.threeSkeleton) {
      return;
    }

    // 对 InstancedMesh 进行射线检测
    const intersections = world.raycastFromScreen(event.clientX, event.clientY, [
      skeletonJointsInstanced,
    ]);

    if (intersections.length > 0) {
      const intersection = intersections[0];
      const instanceId = intersection.instanceId;

      if (instanceId !== undefined && instanceId >= 0) {
        const threeSkeleton = currentModel.value.threeSkeleton;

        // instanceId 就是骨骼索引
        const boneIndex = instanceId;
        if (boneIndex < threeSkeleton.bones.length) {
          const bone = threeSkeleton.bones[boneIndex];

          // 获取世界坐标
          const worldPosition = new THREE.Vector3();
          bone.getWorldPosition(worldPosition);

          // 获取本地坐标
          const localPosition = bone.position.clone();

          selectedBone.value = {
            boneIndex,
            boneName: bone.name,
            worldPosition,
            localPosition,
          };
          selectedTriangle.value = null;

          // 高亮选中的骨骼
          highlightSelectedBone(boneIndex);
          highlightSelectedTriangle(null, null);
        }
      }
    }
  }
}

// ===== 监听器 =====

// 监听宝可梦和形态变化
watch(
  [() => props.pokemon, () => props.form],
  ([newPokemon, newForm], [oldPokemon, oldForm]) => {
    if (newPokemon && newForm) {
      // 检查是否真的发生了变化
      if (
        newPokemon.resourceId !== oldPokemon?.resourceId ||
        newForm[0] !== oldForm?.[0] ||
        newForm[1] !== oldForm?.[1]
      ) {
        loadAndDisplayModel(newPokemon, newForm);
      }
    } else if (!newPokemon || !newForm) {
      // 宝可梦或形态被清空，移除当前模型
      if (currentModel.value && world) {
        world.remove(currentModel.value);
        currentModel.value.dispose();
        currentModel.value = null;
      }
      // 清空状态
      selectedTriangle.value = null;
      selectedBone.value = null;
      selectedAnimation.value = '';
      isAnimationPlaying.value = false;
      animationState.value = null;
      availableAnimations.value = {};
    }
  },
  { immediate: true }
);

// 监听加载状态变化，触发事件
watch(loading, (newLoading) => {
  emit('loading-change', newLoading);
});

// 监听进度变化，触发事件
watch(progress, (newProgress) => {
  emit('progress-change', newProgress);
});

// 监听错误变化，触发事件
watch(error, (newError) => {
  emit('error', newError);
});

// ===== 生命周期 =====

/** 处理窗口大小变化 */
const handleResize = (): void => {
  if (world) {
    world.resize();
  }
};

onMounted(() => {
  // 初始化 World
  initWorld();

  // 添加鼠标点击事件监听器
  const container = containerRef.value;
  if (container) {
    container.addEventListener('click', handleContainerClick);
  }

  // 添加窗口大小变化监听器
  window.addEventListener('resize', handleResize);

  // 如果已有有效的模型路径，立即加载
  if (hasValidModelPath.value && props.pokemon && props.form) {
    loadAndDisplayModel(props.pokemon, props.form);
  }
});

onUnmounted(() => {
  // 移除窗口大小变化监听器
  window.removeEventListener('resize', handleResize);

  // 移除鼠标点击事件监听器
  const container = containerRef.value;
  if (container) {
    container.removeEventListener('click', handleContainerClick);
  }

  // 清理顶点法线可视化
  if (vertexNormalsGroup && world) {
    world.remove(vertexNormalsGroup);
    vertexNormalsGroup = null;
  }

  // 清理骨骼可视化
  if (skeletonUpdateCallback && world) {
    world.removeRenderCallback(skeletonUpdateCallback);
    skeletonUpdateCallback = null;
  }
  if (skeletonGroup && world) {
    world.remove(skeletonGroup);
    if (skeletonJointsInstanced) {
      skeletonJointsInstanced.geometry.dispose();
      if (skeletonJointsInstanced.material instanceof THREE.Material) {
        skeletonJointsInstanced.material.dispose();
      }
    }
    if (skeletonLinesSegments) {
      skeletonLinesSegments.geometry.dispose();
      if (skeletonLinesSegments.material instanceof THREE.Material) {
        skeletonLinesSegments.material.dispose();
      }
    }
    skeletonGroup = null;
  }
  skeletonJointsInstanced = null;
  skeletonLinesSegments = null;
  skeletonBoneIndexMap = null;
  skeletonLineData = null;

  // 清理选择高亮
  if (selectedTriangleHighlight && world) {
    world.remove(selectedTriangleHighlight);
    selectedTriangleHighlight.geometry.dispose();
    if (selectedTriangleHighlight.material instanceof THREE.Material) {
      selectedTriangleHighlight.material.dispose();
    }
    selectedTriangleHighlight = null;
  }
  if (selectedBoneHighlight && world) {
    world.remove(selectedBoneHighlight);
    selectedBoneHighlight.geometry.dispose();
    if (selectedBoneHighlight.material instanceof THREE.Material) {
      selectedBoneHighlight.material.dispose();
    }
    selectedBoneHighlight = null;
  }

  // 清理模型资源
  if (currentModel.value) {
    currentModel.value.dispose();
    currentModel.value = null;
  }

  // 清理 World 资源
  if (world) {
    world.dispose();
    world = null;
  }

  sceneInitialized.value = false;
});

// ===== 暴露给父组件 =====
defineExpose({
  /** 是否正在加载 */
  loading,
  /** 加载进度 (0-100) */
  progress,
  /** 详细进度信息 */
  progressInfo,
  /** 错误信息 */
  error,
  /** 当前模型的形态 ID */
  currentFormId,
  /** 重新加载当前模型 */
  reload: () => {
    if (props.pokemon && props.form) {
      loadAndDisplayModel(props.pokemon, props.form);
    }
  },
});
</script>

<template>
  <div ref="containerRef" class="three-viewer-container">
    <!-- Three.js 将在此容器中创建 canvas 元素 -->

    <!-- 控制面板组件（仅在开发模式显示） -->
    <!-- @validates 需求 6.2: 控制面板作为独立组件 -->
    <!-- @validates 需求 6.7: 使用 props 和 emits 进行组件间通信 -->
    <div v-if="isDevelopment" class="control-panel-wrapper">
      <ControlPanel
        :show-vertex-normals="showVertexNormals"
        :show-wireframe="showWireframe"
        :show-skeleton="showSkeleton"
        :show-grid-helper="showGridHelper"
        :show-shadow="showShadow"
        :selection-mode="selectionMode"
        :has-model="!!currentModel"
        @update:show-vertex-normals="handleVertexNormalsChange"
        @update:show-wireframe="handleWireframeChange"
        @update:show-skeleton="handleSkeletonChange"
        @update:show-grid-helper="handleGridHelperChange"
        @update:show-shadow="handleShadowChange"
        @update:selection-mode="handleSelectionModeChange"
        @fit-camera="handleFitCamera"
      />
    </div>

    <!-- 动画控制器组件 -->
    <!-- @validates 需求 6.3: 动画控制器作为独立组件 -->
    <!-- @validates 需求 6.7: 使用 props 和 emits 进行组件间通信 -->
    <div v-if="hasAnimations" class="animation-controller-wrapper">
      <AnimationController
        :animations="animationOptions"
        :selected-animation="selectedAnimation"
        :is-playing="isAnimationPlaying"
        :loop="animationLoop"
        :animation-state="animationState"
        @update:selected-animation="handleAnimationChange"
        @toggle-play="handleTogglePlay"
        @stop="handleStopAnimation"
        @update:loop="handleLoopChange"
      />
    </div>

    <!-- 选择信息面板组件 -->
    <!-- @validates 需求 6.4: 选择信息面板作为独立组件 -->
    <!-- @validates 需求 6.7: 使用 props 和 emits 进行组件间通信 -->
    <SelectionInfoPanel :triangle-info="selectedTriangle" :bone-info="selectedBone" />

    <!-- 加载进度指示器组件 -->
    <!-- @validates 需求 6.5: 加载进度指示器作为独立组件 -->
    <LoadingOverlay
      :visible="loading"
      :progress="progress"
      :message="progressInfo.message"
    />

    <!-- 错误提示组件 -->
    <!-- @validates 需求 6.6: 错误显示作为独立组件 -->
    <div v-if="error && !loading" class="error-overlay">
      <ErrorDisplay :error="error" title="模型加载失败" @retry="handleRetry" />
    </div>
  </div>
</template>

<style scoped>
/* 主容器 */
.three-viewer-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  background-color: #1a1a2e;
}

/* 确保 Three.js 创建的 canvas 填满容器 */
.three-viewer-container :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

/* 控制面板包装器 */
.control-panel-wrapper {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 50;
}

/* 动画控制器包装器 */
.animation-controller-wrapper {
  position: absolute;
  bottom: 10px;
  left: 10px;
  z-index: 50;
}

/* 错误遮罩层 */
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(26, 26, 46, 0.9);
  z-index: 100;
}
</style>
