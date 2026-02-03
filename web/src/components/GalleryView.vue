<template>
  <div class="gallery-view">
    <!-- 返回按钮 -->
    <button class="back-button" @click="handleBack">
      返回浏览器
    </button>

    <!-- 控制面板 -->
    <div class="controls">
      <div class="game-info">
        当前游戏: {{ game }}
      </div>
      <button @click="toggleAutoPlay" :class="{ active: isAutoPlaying }">
        {{ isAutoPlaying ? '暂停' : '自动播放' }}
      </button>
      <div class="speed-control">
        <label>速度:</label>
        <input
          type="range"
          min="0.1"
          max="3"
          step="0.1"
          v-model.number="cameraSpeed"
        />
        <span>{{ cameraSpeed.toFixed(1) }}x</span>
      </div>
      <div class="info">
        已加载: {{ loadedModelsCount }} / 总计: {{ totalPokemonCount }}
      </div>
    </div>

    <!-- Three.js 渲染容器 -->
    <div ref="containerRef" class="render-container"></div>

    <!-- 进度条 -->
    <div class="progress-bar-container">
      <input
        type="range"
        class="progress-bar"
        min="0"
        :max="maxProgress"
        v-model.number="progressValue"
        @input="handleProgressChange"
      />
      <div class="progress-info">
        <span>{{ currentModelIndex + 1 }} / {{ totalPokemonCount }}</span>
      </div>
    </div>

    <!-- 加载提示 -->
    <div v-if="isInitializing" class="loading-overlay">
      <div class="loading-content">
        <div class="spinner"></div>
        <p>正在初始化画廊...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, shallowRef, computed } from 'vue';
import * as THREE from 'three';
import { Model } from '../core/model/Model';
import { ModelData } from '../core/data';
import { flatbuffers, TRMDL, TRMSH, TRMBF, TRMTR, TRSKL } from '../parsers';
import { loadBinaryResource } from '../services/resourceLoader';
import { getPokemonIdFromFormId } from '../utils/pokemonPath';
import { Game } from '../types';

// Props
const props = defineProps<{
  game: Game;
}>();

const emit = defineEmits<{
  back: [];
}>();

// 状态
const containerRef = ref<HTMLDivElement | null>(null);
const isInitializing = ref(true);
const isAutoPlaying = ref(true);
const cameraSpeed = ref(0.25); // 默认速度再减半
const loadedModelsCount = ref(0);
const totalPokemonCount = ref(0);
const progressValue = ref(0); // 进度条当前值
const currentModelIndex = ref(0); // 当前模型索引

// Three.js 相关
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let animationFrameId: number | null = null;
let directionalLight: THREE.DirectionalLight | null = null; // 存储平行光引用

// 模型管理
interface ModelSlot {
  position: number; // x坐标位置
  pokemonId: string;
  formId: string;
  model: Model | null;
  isLoading: boolean;
  group: THREE.Group; // 用于放置模型的组
}

const modelSlots = shallowRef<ModelSlot[]>([]);
const MODEL_SPACING = 3; // 模型之间的间距
const MAX_LOADED_MODELS = 5; // 最多同时加载的模型数量
const LOAD_DISTANCE = 15; // 摄像机距离多远开始加载模型

let cameraPosition = 0; // 摄像机当前位置

// 存储所有形态信息
interface FormInfo {
  pokemonId: string;
  formId: string;
}
let allForms: FormInfo[] = [];

/**
 * 初始化场景
 */
async function initScene() {
  if (!containerRef.value) return;

  // 创建场景
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2a2a); // 深灰色背景，与ThreeViewer一致

  // 创建相机
  const aspect = containerRef.value.clientWidth / containerRef.value.clientHeight;
  camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
  camera.position.set(0, 1.5, 5);
  camera.lookAt(0, 1, 0);

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 柔和阴影
  containerRef.value.appendChild(renderer.domElement);

  // 添加光照（与ThreeViewer一致）
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 7);
  directionalLight.castShadow = true;
  // 配置阴影
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.bias = -0.0001;
  directionalLight.shadow.normalBias = 0.02;
  directionalLight.shadow.camera.near = 0.1;
  directionalLight.shadow.camera.far = 50;
  directionalLight.shadow.camera.left = -10;
  directionalLight.shadow.camera.right = 10;
  directionalLight.shadow.camera.top = 10;
  directionalLight.shadow.camera.bottom = -10;
  scene.add(directionalLight);

  // 创建环境贴图（用于PBR材质反射）
  const envMapSize = 512;
  const canvas = document.createElement('canvas');
  canvas.width = envMapSize;
  canvas.height = envMapSize;
  const context = canvas.getContext('2d')!;
  const gradient = context.createLinearGradient(0, 0, 0, envMapSize);
  gradient.addColorStop(0, '#cccccc');
  gradient.addColorStop(0.33, '#a0d0e0');
  gradient.addColorStop(0.66, '#5a9bb8');
  gradient.addColorStop(1, '#2f5a7a');
  context.fillStyle = gradient;
  context.fillRect(0, 0, envMapSize, envMapSize);
  
  // 创建立方体贴图的6个面（都使用同一个渐变）
  const cubeTexture = new THREE.CubeTexture([
    canvas, canvas, canvas, canvas, canvas, canvas
  ]);
  cubeTexture.needsUpdate = true;
  scene.environment = cubeTexture;

  // 添加地面
  const groundGeometry = new THREE.PlaneGeometry(10000, 10);
  const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x707070 }); // 稍浅的灰色
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);

  // 监听窗口大小变化
  window.addEventListener('resize', handleResize);

  // 加载宝可梦列表
  await loadPokemonList();

  // 创建模型槽位
  createModelSlots();

  // 开始渲染循环
  animate();

  isInitializing.value = false;
}

/**
 * 加载宝可梦列表及其所有形态
 */
async function loadPokemonList() {
  try {
    const response = await fetch(`local/configs/${props.game}/index.json`);
    const data = await response.json();
    const pokemonIds = data.pokemonIds || [];
    
    // 加载每个宝可梦的配置以获取所有形态
    const formsPromises = pokemonIds.map(async (pokemonId: string) => {
      try {
        const configResponse = await fetch(`local/configs/${props.game}/${pokemonId}.json`);
        if (!configResponse.ok) {
          // 如果配置不存在，使用默认形态
          return [{ pokemonId, formId: `${pokemonId}_00_00` }];
        }
        const config = await configResponse.json();
        const forms = config.forms || [];
        
        // 为每个形态创建FormInfo，排除 pmXXXX_01_00 格式的形态
        return forms
          .filter((form: any) => {
            const formId = form.id || `${pokemonId}_00_00`;
            // 排除格式为 pmXXXX_01_00 的形态
            return !formId.match(/_01_00$/);
          })
          .map((form: any) => ({
            pokemonId,
            formId: form.id || `${pokemonId}_00_00`
          }));
      } catch (error) {
        console.warn(`[Gallery] 加载 ${pokemonId} 配置失败, 使用默认形态:`, error);
        return [{ pokemonId, formId: `${pokemonId}_00_00` }];
      }
    });
    
    const formsArrays = await Promise.all(formsPromises);
    allForms = formsArrays.flat();
    
    totalPokemonCount.value = allForms.length;
    console.log(`[Gallery] 加载了 ${pokemonIds.length} 个宝可梦, 共 ${allForms.length} 个形态`);
  } catch (error) {
    console.error('[Gallery] 加载宝可梦列表失败:', error);
    allForms = [];
  }
}

/**
 * 创建所有模型槽位（为每个形态创建一个槽位）
 */
function createModelSlots() {
  if (!scene) return;

  modelSlots.value = allForms.map((formInfo, index) => {
    const group = new THREE.Group();
    group.position.x = index * MODEL_SPACING;
    group.position.y = 0;
    group.position.z = 0;
    scene!.add(group);

    // 添加占位符（简单的方块）
    const placeholderGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const placeholderMaterial = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0.3,
    });
    const placeholder = new THREE.Mesh(placeholderGeometry, placeholderMaterial);
    placeholder.position.y = 0.25;
    group.add(placeholder);

    return {
      position: index * MODEL_SPACING,
      pokemonId: formInfo.pokemonId,
      formId: formInfo.formId,
      model: null,
      isLoading: false,
      group,
    };
  });

  console.log(`[Gallery] 创建了 ${modelSlots.value.length} 个槽位`);
}

/**
 * 更新模型加载（懒加载逻辑）
 */
function updateModelLoading() {
  if (!camera) return;

  const cameraX = camera.position.x;
  const slots = modelSlots.value;

  // 计算视野范围（基于距离的简化检测）
  const viewDistance = 8; // 视野距离，超出此距离的模型将被卸载

  // 找出应该加载的槽位（摄像机附近的）和应该卸载的槽位（不可见的）
  const slotsToLoad: ModelSlot[] = [];
  const slotsToUnload: ModelSlot[] = [];

  for (const slot of slots) {
    const distance = Math.abs(slot.position - cameraX);

    if (distance < LOAD_DISTANCE) {
      // 在加载范围内
      if (!slot.model && !slot.isLoading) {
        slotsToLoad.push(slot);
      } else if (slot.model && distance > viewDistance) {
        // 已加载但超出视野距离，卸载
        slotsToUnload.push(slot);
      }
    } else {
      // 超出加载范围，立即卸载
      if (slot.model) {
        slotsToUnload.push(slot);
      }
    }
  }

  // 卸载不可见的模型
  for (const slot of slotsToUnload) {
    unloadModel(slot);
  }

  // 按距离排序，优先加载最近的
  slotsToLoad.sort((a, b) => {
    const distA = Math.abs(a.position - cameraX);
    const distB = Math.abs(b.position - cameraX);
    return distA - distB;
  });

  // 限制同时加载的模型数量
  const currentLoadedCount = slots.filter((s) => s.model !== null || s.isLoading).length;
  const canLoadCount = Math.max(0, MAX_LOADED_MODELS - currentLoadedCount);

  for (let i = 0; i < Math.min(canLoadCount, slotsToLoad.length); i++) {
    loadModel(slotsToLoad[i]);
  }
}

/**
 * 加载单个模型
 */
async function loadModel(slot: ModelSlot) {
  if (slot.isLoading || slot.model) return;

  slot.isLoading = true;
  console.log(`[Gallery] 开始加载 ${slot.pokemonId}`);

  try {
    const model = await loadPokemonModel(slot.formId);
    if (model && slot.group) {
      // 移除占位符
      while (slot.group.children.length > 0) {
        slot.group.remove(slot.group.children[0]);
      }

      // 添加模型到场景组
      slot.group.add(model);
      slot.model = model;

      // 启用模型阴影
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // 让模型站在地面上（按原始比例显示）
      model.position.y = 0;
      
      // 绕y轴旋转-30度
      model.rotation.y = -Math.PI / 6;

      loadedModelsCount.value++;
      console.log(`[Gallery] 加载完成 ${slot.pokemonId}`);
    }
  } catch (error) {
    console.error(`[Gallery] 加载模型失败 ${slot.pokemonId}:`, error);
  } finally {
    slot.isLoading = false;
  }
}

/**
 * 卸载单个模型
 */
function unloadModel(slot: ModelSlot) {
  if (!slot.model) return;

  console.log(`[Gallery] 卸载 ${slot.pokemonId}`);

  // 从场景中移除
  if (slot.group) {
    slot.group.remove(slot.model);
  }

  // 释放资源
  slot.model.dispose();
  slot.model = null;

  // 恢复占位符
  if (slot.group) {
    const placeholderGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const placeholderMaterial = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0.3,
    });
    const placeholder = new THREE.Mesh(placeholderGeometry, placeholderMaterial);
    placeholder.position.y = 0.25;
    slot.group.add(placeholder);
  }

  loadedModelsCount.value--;
}

/**
 * 加载宝可梦模型（简化版本）
 */
async function loadPokemonModel(formId: string): Promise<Model | null> {
  const game = props.game;
  const pokemonId = getPokemonIdFromFormId(formId);
  const fileBasePath = `/${game}/${pokemonId}/${formId}/${formId}`;
  const basePath = `/${game}/${pokemonId}/${formId}/`;

  const loadFile = async (path: string): Promise<ArrayBuffer> => {
    try {
      return await loadBinaryResource(path);
    } catch (err) {
      throw new Error(`加载文件失败: ${path}`);
    }
  };

  const parse = <T>(
    buffer: ArrayBuffer,
    name: string,
    getRootFn: (bb: flatbuffers.ByteBuffer) => T
  ): T => {
    const bb = new flatbuffers.ByteBuffer(new Uint8Array(buffer));
    const result = getRootFn(bb);
    if (!result) {
      throw new Error(`${name} 文件格式错误`);
    }
    return result;
  };

  try {
    // 加载必需文件
    const [trmdlBuf, trmshBuf, trmbfBuf] = await Promise.all([
      loadFile(`models${fileBasePath}.trmdl`),
      loadFile(`models${fileBasePath}.trmsh`),  // SCVI使用 .trmsh 而不是 _lod0.trmsh
      loadFile(`models${fileBasePath}.trmbf`),
    ]);

    // 解析必需文件
    const trmdl = parse(trmdlBuf, 'TRMDL', (bb) => TRMDL.getRootAsTRMDL(bb));
    const trmsh = parse(trmshBuf, 'TRMSH', (bb) => TRMSH.getRootAsTRMSH(bb));
    const trmbf = parse(trmbfBuf, 'TRMBF', (bb) => TRMBF.getRootAsTRMBF(bb));

    // 加载并解析可选文件
    let trmtr: TRMTR | undefined = undefined;
    let trskl: TRSKL | undefined = undefined;

    try {
      const buf = await loadFile(`models${fileBasePath}.trmtr`);
      trmtr = parse(buf, 'TRMTR', (bb) => TRMTR.getRootAsTRMTR(bb));
    } catch {
      /* optional */
    }

    try {
      const buf = await loadFile(`models${fileBasePath}.trskl`);
      trskl = parse(buf, 'TRSKL', (bb) => TRSKL.getRootAsTRSKL(bb));
    } catch {
      /* optional */
    }

    // 创建 ModelData
    const modelData = ModelData.fromFlatBuffers(trmdl, trmsh, trmbf, trmtr, trskl);
    const model = new Model(modelData);

    // 实例化模型（创建 GPU 资源）
    await model.materialize(basePath);

    // 加载第一个动画
    try {
      // 获取宝可梦配置，找到第一个动画
      const configResponse = await fetch(`local/configs/${props.game}/${pokemonId}.json`);
      if (configResponse.ok) {
        const config = await configResponse.json();
        const form = config.forms?.find((f: any) => f.id === formId);
        if (form && form.animations) {
          const firstAnimKey = Object.keys(form.animations)[0];
          if (firstAnimKey) {
            const animFiles = form.animations[firstAnimKey];
            if (animFiles && animFiles.length >= 2) {
              // 加载动画文件（同时加载可见性和骨骼动画）
              const tracmFileName = animFiles[0]; // 可见性动画 .tracm
              const tranmFileName = animFiles[1]; // 骨骼动画 .tranm
              const tracmPath = `models${basePath}${tracmFileName}`;
              const tranmPath = `models${basePath}${tranmFileName}`;
              
              // 加载两个动画文件
              await Promise.all([
                model.loadAnimationFromUrl(tracmPath),
                model.loadAnimationFromUrl(tranmPath)
              ]);
              
              // 播放动画并循环（使用文件名作为动画名，去掉扩展名）
              const animName = tranmFileName.replace(/\.(tranm|tracm)$/i, '');
              model.playAnimation(animName);
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[Gallery] 加载动画失败 ${formId}:`, err);
      // 动画加载失败不影响模型显示
    }

    return model;
  } catch (error) {
    console.error(`[Gallery] 模型加载失败 ${formId}:`, error);
    return null;
  }
}

/**
 * 渲染循环
 */
function animate() {
  animationFrameId = requestAnimationFrame(animate);

  if (!scene || !camera || !renderer) return;

  // 自动移动摄像机
  if (isAutoPlaying.value && modelSlots.value.length > 0) {
    const maxPosition = (modelSlots.value.length - 1) * MODEL_SPACING;
    cameraPosition += 0.01 * cameraSpeed.value;

    // 循环
    if (cameraPosition > maxPosition + 10) {
      cameraPosition = -10;
    }

    camera.position.x = cameraPosition;
    camera.position.y = 1.5;
    camera.position.z = 5;
    camera.lookAt(cameraPosition, 1, 0);
  }

  // 更新平行光位置，使阴影相机跟随主相机
  if (directionalLight) {
    directionalLight.position.set(cameraPosition + 5, 10, 7);
    directionalLight.target.position.set(cameraPosition, 0, 0);
    directionalLight.target.updateMatrixWorld();
  }

  // 更新进度条和当前索引
  if (modelSlots.value.length > 0) {
    const index = Math.round(cameraPosition / MODEL_SPACING);
    currentModelIndex.value = Math.max(0, Math.min(index, modelSlots.value.length - 1));
    progressValue.value = currentModelIndex.value;
  }

  // 更新模型加载
  updateModelLoading();

  // 更新已加载的模型动画
  for (const slot of modelSlots.value) {
    if (slot.model) {
      slot.model.update(0.016); // 假设60fps
    }
  }

  renderer.render(scene, camera);
}

/**
 * 处理窗口大小变化
 */
function handleResize() {
  if (!containerRef.value || !camera || !renderer) return;

  const width = containerRef.value.clientWidth;
  const height = containerRef.value.clientHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
}

/**
 * 切换自动播放
 */
function toggleAutoPlay() {
  isAutoPlaying.value = !isAutoPlaying.value;
}

/**
 * 计算进度条最大值
 */
const maxProgress = computed(() => {
  return Math.max(0, modelSlots.value.length - 1);
});

/**
 * 处理进度条变更
 */
function handleProgressChange(event: Event) {
  const value = (event.target as HTMLInputElement).valueAsNumber;
  
  // 根据进度值计算摄像机位置
  if (modelSlots.value.length > 0) {
    const targetSlot = modelSlots.value[value];
    if (targetSlot) {
      cameraPosition = targetSlot.position;
      if (camera) {
        camera.position.x = cameraPosition;
        camera.lookAt(cameraPosition, 1, 0);
      }
    }
  }
}

/**
 * 返回主界面
 */
function handleBack() {
  emit('back');
}

/**
 * 清理资源
 */
function cleanup() {
  // 停止动画循环
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // 卸载所有模型
  for (const slot of modelSlots.value) {
    if (slot.model) {
      slot.model.dispose();
    }
  }

  // 清理Three.js资源
  if (renderer) {
    renderer.dispose();
    if (containerRef.value && renderer.domElement.parentNode === containerRef.value) {
      containerRef.value.removeChild(renderer.domElement);
    }
  }

  // 移除事件监听
  window.removeEventListener('resize', handleResize);

  scene = null;
  camera = null;
  renderer = null;
}

// 生命周期
onMounted(() => {
  initScene();
});

onBeforeUnmount(() => {
  cleanup();
});
</script>

<style scoped>
.gallery-view {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.render-container {
  width: 100%;
  height: 100%;
}

.back-button {
  position: absolute;
  top: 20px;
  left: 20px;
  padding: 12px 24px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  z-index: 100;
  transition: background-color 0.2s;
}

.back-button:hover {
  background-color: rgba(0, 0, 0, 0.9);
}

.controls {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 15px;
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  color: white;
  z-index: 100;
}

.controls button {
  padding: 8px 16px;
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.controls button:hover {
  background-color: rgba(255, 255, 255, 0.3);
}

.controls button.active {
  background-color: rgba(76, 175, 80, 0.8);
}

.game-info {
  font-size: 14px;
  font-weight: 600;
  padding: 8px 12px;
  background-color: rgba(33, 150, 243, 0.3);
  border-radius: 4px;
  border: 1px solid rgba(33, 150, 243, 0.5);
  text-align: center;
  color: #64b5f6;
}

.speed-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.speed-control label {
  font-size: 14px;
}

.speed-control input {
  flex: 1;
}

.speed-control span {
  font-size: 14px;
  min-width: 40px;
}

.info {
  font-size: 14px;
  padding-top: 5px;
  border-top: 1px solid rgba(255, 255, 255, 0.3);
}

.progress-bar-container {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  max-width: 800px;
  padding: 15px 20px;
  background-color: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-bar {
  width: 100%;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  outline: none;
  cursor: pointer;
}

.progress-bar::-webkit-slider-track {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.progress-bar::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #64b5f6;
  border-radius: 50%;
  cursor: pointer;
  transition: background-color 0.2s;
}

.progress-bar::-webkit-slider-thumb:hover {
  background: #42a5f5;
}

.progress-bar::-moz-range-track {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.progress-bar::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #64b5f6;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: background-color 0.2s;
}

.progress-bar::-moz-range-thumb:hover {
  background: #42a5f5;
}

.progress-info {
  text-align: center;
  color: white;
  font-size: 14px;
  font-weight: 500;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.loading-content {
  text-align: center;
  color: white;
}

.spinner {
  width: 50px;
  height: 50px;
  margin: 0 auto 20px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
