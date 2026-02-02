/**
 * RenderLoop.ts - 渲染循环类
 *
 * 封装 Three.js WebGLRenderer 和渲染循环
 * 提供回调注册机制，支持在每帧渲染时执行自定义逻辑
 *
 * 需求: 5.5
 */
import * as THREE from 'three'

/**
 * 渲染器配置常量
 */
const RENDERER_CONFIG = {
  // 抗锯齿
  antialias: true,
  // 透明背景
  alpha: true,
  // 保留绘制缓冲区（用于截图等功能）
  preserveDrawingBuffer: false,
  // 色调映射
  toneMapping: THREE.ACESFilmicToneMapping,
  // 色调映射曝光度
  toneMappingExposure: 1.0,
  // 输出颜色空间
  outputColorSpace: THREE.SRGBColorSpace,
  // 像素比例（限制最大值以提高性能）
  maxPixelRatio: 2,
  // 阴影配置
  shadow: {
    enabled: true,
    type: THREE.PCFSoftShadowMap,
  },
} as const

/**
 * 渲染循环类
 *
 * 管理 WebGL 渲染器和动画循环，提供：
 * - WebGLRenderer 的创建和配置
 * - 基于 requestAnimationFrame 的渲染循环
 * - 回调函数注册机制（用于动画更新等）
 * - deltaTime 计算（使用 THREE.Clock）
 * - 窗口大小调整处理
 */
export class RenderLoop {
  /** WebGL 渲染器 */
  private renderer: THREE.WebGLRenderer

  /** 场景引用 */
  private scene: THREE.Scene

  /** 相机引用 */
  private camera: THREE.PerspectiveCamera

  /** 动画帧 ID（用于取消动画） */
  private animationId: number | null

  /** 回调函数集合（每帧调用） */
  private callbacks: Set<(deltaTime: number) => void>

  /** 时钟（用于计算 deltaTime） */
  private clock: THREE.Clock

  /** 容器元素引用 */
  private container: HTMLElement

  /**
   * 创建渲染循环
   *
   * @param container - 渲染容器元素
   * @param scene - Three.js 场景对象
   * @param camera - Three.js 透视相机
   */
  constructor(
    container: HTMLElement,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera
  ) {
    this.container = container
    this.scene = scene
    this.camera = camera
    this.animationId = null
    this.callbacks = new Set()
    this.clock = new THREE.Clock()

    // 创建 WebGL 渲染器
    this.renderer = this.createRenderer()

    // 将渲染器的 canvas 添加到容器
    container.appendChild(this.renderer.domElement)

    // 初始化尺寸
    this.resize(container.clientWidth, container.clientHeight)
  }

  /**
   * 创建并配置 WebGL 渲染器
   *
   * @returns 配置好的 WebGLRenderer 实例
   */
  private createRenderer(): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      antialias: RENDERER_CONFIG.antialias,
      alpha: RENDERER_CONFIG.alpha,
      preserveDrawingBuffer: RENDERER_CONFIG.preserveDrawingBuffer,
    })

    // 配置色调映射
    renderer.toneMapping = RENDERER_CONFIG.toneMapping
    renderer.toneMappingExposure = RENDERER_CONFIG.toneMappingExposure

    // 配置输出颜色空间
    renderer.outputColorSpace = RENDERER_CONFIG.outputColorSpace

    // 设置像素比例（限制最大值以提高性能）
    const pixelRatio = Math.min(
      window.devicePixelRatio,
      RENDERER_CONFIG.maxPixelRatio
    )
    renderer.setPixelRatio(pixelRatio)

    // 配置阴影
    renderer.shadowMap.enabled = RENDERER_CONFIG.shadow.enabled
    renderer.shadowMap.type = RENDERER_CONFIG.shadow.type

    return renderer
  }

  /**
   * 设置阴影是否启用
   *
   * @param enabled - 是否启用阴影
   */
  setShadowEnabled(enabled: boolean): void {
    this.renderer.shadowMap.enabled = enabled
    // 需要更新所有材质以应用阴影变化
    this.renderer.shadowMap.needsUpdate = true
  }

  /**
   * 获取阴影是否启用
   *
   * @returns 是否启用阴影
   */
  isShadowEnabled(): boolean {
    return this.renderer.shadowMap.enabled
  }

  /**
   * 添加回调函数
   *
   * 注册一个在每帧渲染前调用的回调函数。
   * 回调函数接收 deltaTime 参数（自上一帧以来的时间，单位：秒）
   *
   * @param callback - 回调函数，接收 deltaTime 参数
   */
  addCallback(callback: (deltaTime: number) => void): void {
    this.callbacks.add(callback)
  }

  /**
   * 移除回调函数
   *
   * @param callback - 要移除的回调函数
   */
  removeCallback(callback: (deltaTime: number) => void): void {
    this.callbacks.delete(callback)
  }

  /**
   * 启动渲染循环
   *
   * 开始动画循环，每帧执行：
   * 1. 计算 deltaTime
   * 2. 调用所有注册的回调函数
   * 3. 渲染场景
   */
  start(): void {
    // 如果已经在运行，则不重复启动
    if (this.animationId !== null) {
      return
    }

    // 重置时钟
    this.clock.start()

    // 定义动画循环函数
    const animate = (): void => {
      // 请求下一帧
      this.animationId = requestAnimationFrame(animate)

      // 计算 deltaTime
      const deltaTime = this.clock.getDelta()

      // 调用所有回调函数
      for (const callback of this.callbacks) {
        try {
          callback(deltaTime)
        } catch (error) {
          console.error('[RenderLoop] 回调函数执行错误:', error)
        }
      }

      // 渲染场景
      this.renderer.render(this.scene, this.camera)
    }

    // 启动动画循环
    animate()
  }

  /**
   * 停止渲染循环
   *
   * 取消动画帧请求，停止渲染
   */
  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
      this.clock.stop()
    }
  }

  /**
   * 调整渲染器尺寸
   *
   * @param width - 新的宽度（像素）
   * @param height - 新的高度（像素）
   */
  resize(width: number, height: number): void {
    // 确保尺寸有效
    if (width <= 0 || height <= 0) {
      return
    }

    // 更新渲染器尺寸
    this.renderer.setSize(width, height)

    // 更新相机宽高比
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  /**
   * 获取渲染器实例
   *
   * @returns WebGLRenderer 实例
   */
  getRenderer(): THREE.WebGLRenderer {
    return this.renderer
  }

  /**
   * 获取渲染器的 DOM 元素
   *
   * @returns Canvas 元素
   */
  getDomElement(): HTMLCanvasElement {
    return this.renderer.domElement
  }

  /**
   * 检查渲染循环是否正在运行
   *
   * @returns 是否正在运行
   */
  isRunning(): boolean {
    return this.animationId !== null
  }

  /**
   * 手动渲染一帧
   *
   * 在渲染循环停止时，可以使用此方法手动渲染单帧
   */
  renderOnce(): void {
    this.renderer.render(this.scene, this.camera)
  }

  /**
   * 释放资源
   *
   * 停止渲染循环，释放渲染器资源，从 DOM 中移除 canvas
   */
  dispose(): void {
    // 停止渲染循环
    this.stop()

    // 清空回调函数
    this.callbacks.clear()

    // 从容器中移除 canvas
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement)
    }

    // 释放渲染器资源
    this.renderer.dispose()
  }
}
