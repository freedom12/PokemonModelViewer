/**
 * World.ts - 世界类
 *
 * 整合 Scene、CameraController、LightingManager、RenderLoop
 * 提供场景辅助对象（网格、坐标轴）和射线检测功能
 *
 * 需求: 5.1, 5.2, 5.6, 5.7, 5.8, 5.9
 */
import * as THREE from 'three'
import { CameraController } from './CameraController'
import { LightingManager } from './LightingManager'
import { RenderLoop } from './RenderLoop'

/**
 * 场景辅助对象配置常量
 */
const HELPERS_CONFIG = {
  // 网格辅助线配置
  grid: {
    size: 10, // 网格大小
    divisions: 10, // 网格分割数
    colorCenterLine: 0x444444, // 中心线颜色
    colorGrid: 0x888888, // 网格线颜色
  },
  // 坐标轴辅助线配置
  axes: {
    size: 1, // 坐标轴长度
  },
} as const

/**
 * 场景背景配置
 */
const SCENE_CONFIG = {
  // 背景颜色（浅灰色）
  backgroundColor: 0x2a2a2a,
} as const

/**
 * World 类
 *
 * 整合管理 Three.js 场景的所有核心组件：
 * - Scene：场景对象
 * - CameraController：相机控制器
 * - LightingManager：光照管理器
 * - RenderLoop：渲染循环
 *
 * 提供：
 * - 场景对象的添加和移除
 * - 场景辅助对象（网格、坐标轴）的显示控制
 * - 射线检测功能（用于对象选择）
 * - 窗口大小调整处理
 * - 资源释放
 */
export class World {
  /** Three.js 场景对象 */
  readonly scene: THREE.Scene

  /** 相机控制器 */
  readonly camera: CameraController

  /** 光照管理器 */
  readonly lighting: LightingManager

  /** 渲染循环 */
  readonly renderLoop: RenderLoop

  /** 场景辅助对象组（网格、坐标轴） */
  private helpers: THREE.Group

  /** 射线检测器 */
  private raycaster: THREE.Raycaster

  /** 容器元素引用 */
  private container: HTMLElement

  /**
   * 创建 World 实例
   *
   * @param container - 渲染容器元素
   */
  constructor(container: HTMLElement) {
    this.container = container

    // 创建场景
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(SCENE_CONFIG.backgroundColor)

    // 创建相机控制器
    this.camera = new CameraController(container)

    // 创建光照管理器
    this.lighting = new LightingManager(this.scene)

    // 创建渲染循环
    this.renderLoop = new RenderLoop(
      container,
      this.scene,
      this.camera.camera
    )

    // 创建场景辅助对象
    this.helpers = this.createHelpers()
    this.scene.add(this.helpers)

    // 创建射线检测器
    this.raycaster = new THREE.Raycaster()

    // 注册相机控制器更新回调
    this.renderLoop.addCallback(() => {
      this.camera.update()
    })

    // 更新 OrbitControls 的 DOM 元素为渲染器的 canvas
    // 这样可以确保鼠标事件正确绑定
    this.camera.controls.dispose()
    const newControls = new (
      this.camera.controls.constructor as new (
        camera: THREE.Camera,
        domElement: HTMLElement
      ) => typeof this.camera.controls
    )(this.camera.camera, this.renderLoop.getDomElement())

    // 复制控制器配置
    newControls.enableDamping = this.camera.controls.enableDamping
    newControls.dampingFactor = this.camera.controls.dampingFactor
    newControls.minDistance = this.camera.controls.minDistance
    newControls.maxDistance = this.camera.controls.maxDistance
    newControls.enablePan = this.camera.controls.enablePan
    newControls.target.copy(this.camera.controls.target);

    // 替换控制器
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 需要访问 CameraController 的内部 controls 属性
    (this.camera as any).controls = newControls
  }

  /**
   * 创建场景辅助对象
   *
   * 包括网格辅助线和坐标轴辅助线
   *
   * @returns 包含辅助对象的 Group
   */
  private createHelpers(): THREE.Group {
    const group = new THREE.Group()
    group.name = 'SceneHelpers'

    // 创建网格辅助线
    const gridHelper = new THREE.GridHelper(
      HELPERS_CONFIG.grid.size,
      HELPERS_CONFIG.grid.divisions,
      HELPERS_CONFIG.grid.colorCenterLine,
      HELPERS_CONFIG.grid.colorGrid
    )
    gridHelper.name = 'GridHelper'
    group.add(gridHelper)

    // 创建坐标轴辅助线
    const axesHelper = new THREE.AxesHelper(HELPERS_CONFIG.axes.size)
    axesHelper.name = 'AxesHelper'
    // 设置渲染顺序，确保坐标轴在网格之上
    axesHelper.renderOrder = 1
    // 禁用深度测试，彻底解决 Z-fighting 问题
    axesHelper.traverse((child) => {
      if (child instanceof THREE.Line) {
        const material = child.material as THREE.LineBasicMaterial
        material.depthTest = false
      }
    })
    group.add(axesHelper)

    return group
  }

  /**
   * 向场景添加对象
   *
   * @param object - 要添加的 3D 对象
   */
  add(object: THREE.Object3D): void {
    this.scene.add(object)
  }

  /**
   * 从场景移除对象
   *
   * @param object - 要移除的 3D 对象
   */
  remove(object: THREE.Object3D): void {
    this.scene.remove(object)
  }

  /**
   * 设置场景辅助对象的可见性
   *
   * @param visible - 是否可见
   */
  setHelpersVisible(visible: boolean): void {
    this.helpers.visible = visible
  }

  /**
   * 获取场景辅助对象的可见性
   *
   * @returns 是否可见
   */
  getHelpersVisible(): boolean {
    return this.helpers.visible
  }

  /**
   * 设置网格辅助线的可见性
   *
   * @param visible - 是否可见
   */
  setGridVisible(visible: boolean): void {
    const gridHelper = this.helpers.getObjectByName('GridHelper')
    if (gridHelper) {
      gridHelper.visible = visible
    }
  }

  /**
   * 设置坐标轴辅助线的可见性
   *
   * @param visible - 是否可见
   */
  setAxesVisible(visible: boolean): void {
    const axesHelper = this.helpers.getObjectByName('AxesHelper')
    if (axesHelper) {
      axesHelper.visible = visible
    }
  }

  /**
   * 射线检测
   *
   * 根据鼠标位置进行射线检测，返回与指定对象的交点信息
   *
   * @param mouse - 归一化的鼠标坐标（-1 到 1 范围）
   * @param objects - 要检测的对象数组
   * @returns 交点信息数组，按距离排序
   */
  raycast(
    mouse: THREE.Vector2,
    objects: THREE.Object3D[]
  ): THREE.Intersection[] {
    // 设置射线
    this.raycaster.setFromCamera(mouse, this.camera.camera)

    // 执行射线检测
    return this.raycaster.intersectObjects(objects, true)
  }

  /**
   * 从屏幕坐标进行射线检测
   *
   * 将屏幕像素坐标转换为归一化坐标后进行射线检测
   *
   * @param screenX - 屏幕 X 坐标（像素）
   * @param screenY - 屏幕 Y 坐标（像素）
   * @param objects - 要检测的对象数组
   * @returns 交点信息数组，按距离排序
   */
  raycastFromScreen(
    screenX: number,
    screenY: number,
    objects: THREE.Object3D[]
  ): THREE.Intersection[] {
    // 获取容器尺寸
    const rect = this.container.getBoundingClientRect()

    // 将屏幕坐标转换为归一化设备坐标（-1 到 1）
    const mouse = new THREE.Vector2(
      ((screenX - rect.left) / rect.width) * 2 - 1,
      -((screenY - rect.top) / rect.height) * 2 + 1
    )

    return this.raycast(mouse, objects)
  }

  /**
   * 调整相机以适配模型
   *
   * @param model - 要适配的 3D 对象
   */
  fitToModel(model: THREE.Object3D): void {
    this.camera.fitToModel(model)
  }

  /**
   * 处理窗口大小变化
   *
   * 更新相机和渲染器的尺寸
   */
  resize(): void {
    const width = this.container.clientWidth
    const height = this.container.clientHeight

    if (width > 0 && height > 0) {
      // 更新相机
      this.camera.resize()

      // 更新渲染器
      this.renderLoop.resize(width, height)
    }
  }

  /**
   * 启动渲染循环
   */
  start(): void {
    this.renderLoop.start()
  }

  /**
   * 停止渲染循环
   */
  stop(): void {
    this.renderLoop.stop()
  }

  /**
   * 检查渲染循环是否正在运行
   *
   * @returns 是否正在运行
   */
  isRunning(): boolean {
    return this.renderLoop.isRunning()
  }

  /**
   * 添加渲染回调
   *
   * @param callback - 每帧调用的回调函数
   */
  addRenderCallback(callback: (deltaTime: number) => void): void {
    this.renderLoop.addCallback(callback)
  }

  /**
   * 移除渲染回调
   *
   * @param callback - 要移除的回调函数
   */
  removeRenderCallback(callback: (deltaTime: number) => void): void {
    this.renderLoop.removeCallback(callback)
  }

  /**
   * 设置场景背景颜色
   *
   * @param color - 背景颜色
   */
  setBackgroundColor(color: THREE.ColorRepresentation): void {
    this.scene.background = new THREE.Color(color)
  }

  /**
   * 获取渲染器的 DOM 元素
   *
   * @returns Canvas 元素
   */
  getDomElement(): HTMLCanvasElement {
    return this.renderLoop.getDomElement()
  }

  /**
   * 获取渲染器实例
   *
   * @returns WebGLRenderer 实例
   */
  getRenderer(): THREE.WebGLRenderer {
    return this.renderLoop.getRenderer()
  }

  /**
   * 释放资源
   *
   * 停止渲染循环，释放所有组件资源
   */
  dispose(): void {
    // 停止渲染循环
    this.renderLoop.stop()

    // 移除辅助对象
    this.scene.remove(this.helpers)

    // 释放各组件资源
    this.camera.dispose()
    this.lighting.dispose()
    this.renderLoop.dispose()

    // 清理场景
    this.scene.clear()
  }
}
