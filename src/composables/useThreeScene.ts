/**
 * useThreeScene.ts - Three.js 场景逻辑 composable
 * 
 * 封装 Three.js 场景的初始化和管理逻辑
 * 
 * Requirements: 2.1, 2.5, 4.3, 4.4, 3.1, 3.2, 3.3, 3.4, 3.5
 * - 初始化 Scene、Camera、Renderer
 * - 配置 renderer antialias
 * - 设置场景背景颜色
 * - 集成 OrbitControls 实现摄像机控制
 * - 响应窗口调整，更新 canvas 尺寸和摄像机宽高比
 */
import { type Ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/**
 * useThreeScene 选项接口
 */
export interface UseThreeSceneOptions {
  container: Ref<HTMLElement | null>
}

/**
 * useThreeScene 返回值接口
 */
export interface UseThreeSceneReturn {
  init: () => void
  dispose: () => void
}

/**
 * 场景状态接口
 */
interface SceneState {
  scene: THREE.Scene | null
  camera: THREE.PerspectiveCamera | null
  renderer: THREE.WebGLRenderer | null
  controls: OrbitControls | null
  cube: THREE.Mesh | null
  gridHelper: THREE.GridHelper | null
  ambientLight: THREE.AmbientLight | null
  directionalLight: THREE.DirectionalLight | null
  animationId: number | null
}

/**
 * 配置常量（来自设计文档）
 */
const CONFIG = {
  // 场景配置
  scene: {
    backgroundColor: 0x1a1a2e
  },
  // 摄像机配置
  camera: {
    fov: 75,
    near: 0.1,
    far: 1000,
    position: { x: 0, y: 0, z: 5 }
  },
  // 渲染器配置
  renderer: {
    antialias: true
  },
  // 控制器配置
  // Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
  controls: {
    enableDamping: true,      // 启用阻尼，默认 true
    dampingFactor: 0.05,      // 阻尼系数，默认 0.05
    minDistance: 2,           // 最小距离，默认 2
    maxDistance: 20,          // 最大距离，默认 20
    enablePan: true           // 启用平移，默认 true
  },
  // 立方体配置
  cube: {
    size: 1,
    color: 0x00d4ff
  },
  // 网格辅助线配置
  grid: {
    size: 10,           // 网格大小
    divisions: 10,      // 网格分割数
    colorCenterLine: 0x444444,  // 中心线颜色
    colorGrid: 0x333333         // 网格线颜色
  },
  // 光照配置
  // Requirements: 4.1 - 场景应有适当的光照来照亮立方体
  lighting: {
    ambient: {
      color: 0xffffff,
      intensity: 0.5
    },
    directional: {
      color: 0xffffff,
      intensity: 1,
      position: { x: 5, y: 5, z: 5 }
    }
  }
} as const

/**
 * Three.js 场景管理 composable
 * 
 * @param options - 配置选项，包含容器元素引用
 * @returns init 和 dispose 方法
 */
export function useThreeScene(options: UseThreeSceneOptions): UseThreeSceneReturn {
  const { container } = options

  // 场景状态
  const state: SceneState = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    cube: null,
    gridHelper: null,
    ambientLight: null,
    directionalLight: null,
    animationId: null
  }

  /**
   * 初始化 Three.js 场景
   */
  function init(): void {
    // 检查容器是否存在
    if (!container.value) {
      console.warn('useThreeScene: 容器元素不存在，无法初始化场景')
      return
    }

    const containerElement = container.value

    // 获取容器尺寸
    const width = containerElement.clientWidth
    const height = containerElement.clientHeight

    // 1. 创建场景
    state.scene = new THREE.Scene()
    state.scene.background = new THREE.Color(CONFIG.scene.backgroundColor)

    // 2. 创建摄像机
    const aspect = width / height
    state.camera = new THREE.PerspectiveCamera(
      CONFIG.camera.fov,
      aspect,
      CONFIG.camera.near,
      CONFIG.camera.far
    )
    state.camera.position.set(
      CONFIG.camera.position.x,
      CONFIG.camera.position.y,
      CONFIG.camera.position.z
    )

    // 3. 创建渲染器
    state.renderer = new THREE.WebGLRenderer({
      antialias: CONFIG.renderer.antialias
    })
    state.renderer.setSize(width, height)
    state.renderer.setPixelRatio(window.devicePixelRatio)

    // 将 canvas 添加到容器
    containerElement.appendChild(state.renderer.domElement)

    // 4. 创建立方体
    // Requirements: 2.2, 2.3, 4.2
    // - 创建 BoxGeometry
    // - 创建支持光照的材质 (MeshStandardMaterial)
    // - 将 Mesh 添加到场景
    const geometry = new THREE.BoxGeometry(
      CONFIG.cube.size,
      CONFIG.cube.size,
      CONFIG.cube.size
    )
    const material = new THREE.MeshStandardMaterial({
      color: CONFIG.cube.color
    })
    state.cube = new THREE.Mesh(geometry, material)
    state.scene.add(state.cube)

    // 4.5 添加网格辅助线
    // 帮助显示模型空间和方向
    state.gridHelper = new THREE.GridHelper(
      CONFIG.grid.size,
      CONFIG.grid.divisions,
      CONFIG.grid.colorCenterLine,
      CONFIG.grid.colorGrid
    )
    state.scene.add(state.gridHelper)

    // 5. 添加光照系统
    // Requirements: 4.1 - 场景应有适当的光照来照亮立方体
    // 环境光 - 提供基础的均匀照明，使立方体各面都有基本亮度
    state.ambientLight = new THREE.AmbientLight(
      CONFIG.lighting.ambient.color,
      CONFIG.lighting.ambient.intensity
    )
    state.scene.add(state.ambientLight)

    // 方向光 - 提供定向照明，使立方体有明暗面，增强立体感
    state.directionalLight = new THREE.DirectionalLight(
      CONFIG.lighting.directional.color,
      CONFIG.lighting.directional.intensity
    )
    state.directionalLight.position.set(
      CONFIG.lighting.directional.position.x,
      CONFIG.lighting.directional.position.y,
      CONFIG.lighting.directional.position.z
    )
    state.scene.add(state.directionalLight)

    // 6. 初始化 OrbitControls
    // Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
    // - 左键拖拽旋转摄像机
    // - 滚轮缩放
    // - 右键拖拽平移
    // - 平滑阻尼效果
    // - 缩放范围限制
    state.controls = new OrbitControls(state.camera, state.renderer.domElement)
    
    // 配置阻尼效果 (Requirements: 3.4)
    state.controls.enableDamping = CONFIG.controls.enableDamping
    state.controls.dampingFactor = CONFIG.controls.dampingFactor
    
    // 配置缩放范围限制 (Requirements: 3.5)
    state.controls.minDistance = CONFIG.controls.minDistance
    state.controls.maxDistance = CONFIG.controls.maxDistance
    
    // 配置平移 (Requirements: 3.3)
    state.controls.enablePan = CONFIG.controls.enablePan

    // 7. 添加窗口调整事件监听器
    // Requirements: 2.5 - 当浏览器窗口调整大小时，渲染器应调整 canvas 尺寸和摄像机宽高比
    window.addEventListener('resize', handleResize)

    // 8. 启动渲染循环
    // Requirements: 2.4 - 渲染器应以浏览器刷新率持续渲染场景
    animate()

    console.log('useThreeScene: 场景初始化完成')
  }

  /**
   * 处理窗口调整事件
   * Requirements: 2.5 - 当浏览器窗口调整大小时，渲染器应调整 canvas 尺寸和摄像机宽高比
   */
  function handleResize(): void {
    // 检查容器和必要对象是否存在
    if (!container.value || !state.camera || !state.renderer) {
      return
    }

    // 获取容器的新尺寸
    const width = container.value.clientWidth
    const height = container.value.clientHeight

    // 更新摄像机宽高比
    state.camera.aspect = width / height
    // 更新摄像机投影矩阵（宽高比改变后必须调用）
    state.camera.updateProjectionMatrix()

    // 更新渲染器尺寸
    state.renderer.setSize(width, height)
  }

  /**
   * 渲染循环
   * 使用 requestAnimationFrame 实现持续渲染
   * Requirements: 2.4, 3.4
   */
  function animate(): void {
    state.animationId = requestAnimationFrame(animate)
    
    // 更新控制器（阻尼效果需要在每帧调用）
    // Requirements: 3.4 - 平滑阻尼效果
    if (state.controls) {
      state.controls.update()
    }
    
    // 渲染场景
    if (state.renderer && state.scene && state.camera) {
      state.renderer.render(state.scene, state.camera)
    }
  }

  /**
   * 清理 Three.js 资源
   */
  function dispose(): void {
    // 1. 首先取消动画循环
    // Requirements: 2.4 - 组件卸载时清理资源
    if (state.animationId !== null) {
      cancelAnimationFrame(state.animationId)
      state.animationId = null
    }

    // 2. 移除窗口调整事件监听器
    // Requirements: 2.5 - 组件卸载时移除监听器
    window.removeEventListener('resize', handleResize)

    // 3. 销毁 OrbitControls
    // Requirements: 3.1-3.5 - 清理控制器资源
    if (state.controls) {
      state.controls.dispose()
      state.controls = null
    }

    // 4. 清理渲染器
    if (state.renderer) {
      state.renderer.dispose()
      // 从 DOM 中移除 canvas
      if (state.renderer.domElement.parentElement) {
        state.renderer.domElement.parentElement.removeChild(state.renderer.domElement)
      }
      state.renderer = null
    }

    // 5. 清理场景
    if (state.scene) {
      // 遍历并清理场景中的所有对象
      state.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose())
          } else {
            object.material.dispose()
          }
        }
      })
      state.scene = null
    }

    // 6. 清理摄像机引用
    state.camera = null

    // 清理光照引用
    state.ambientLight = null
    state.directionalLight = null

    // 清理网格辅助线引用
    state.gridHelper = null

    console.log('useThreeScene: 资源已清理')
  }

  return {
    init,
    dispose
  }
}
