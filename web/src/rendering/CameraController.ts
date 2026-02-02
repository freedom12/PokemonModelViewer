/**
 * CameraController.ts - 相机控制器类
 *
 * 封装 Three.js PerspectiveCamera 和 OrbitControls
 * 提供相机位置、目标设置和模型适配功能
 *
 * 需求: 5.3
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/**
 * 相机配置常量
 */
const CAMERA_CONFIG = {
  // 透视相机配置
  fov: 45,
  near: 0.01,
  far: 100,
  // 默认位置
  defaultPosition: { x: 2, y: 1.5, z: 3 },
  // 默认目标点
  defaultTarget: { x: 0, y: 0.5, z: 0 },
} as const

/**
 * 控制器配置常量
 */
const CONTROLS_CONFIG = {
  // 启用阻尼（惯性）
  enableDamping: true,
  // 阻尼系数
  dampingFactor: 0.05,
  // 最小缩放距离
  minDistance: 0.5,
  // 最大缩放距离
  maxDistance: 50,
  // 启用平移
  enablePan: true,
} as const

/**
 * 相机控制器类
 *
 * 封装 PerspectiveCamera 和 OrbitControls，提供：
 * - 相机位置和目标设置
 * - 自动适配模型大小
 * - 控制器更新和资源释放
 */
export class CameraController {
  /** 透视相机 */
  readonly camera: THREE.PerspectiveCamera

  /** 轨道控制器 */
  readonly controls: OrbitControls

  /** 容器元素引用 */
  private readonly container: HTMLElement

  /**
   * 创建相机控制器
   *
   * @param container - 渲染容器元素
   */
  constructor(container: HTMLElement) {
    this.container = container

    // 获取容器尺寸
    const width = container.clientWidth
    const height = container.clientHeight
    const aspect = width / height || 1

    // 创建透视相机
    this.camera = new THREE.PerspectiveCamera(
      CAMERA_CONFIG.fov,
      aspect,
      CAMERA_CONFIG.near,
      CAMERA_CONFIG.far
    )

    // 设置默认位置
    this.camera.position.set(
      CAMERA_CONFIG.defaultPosition.x,
      CAMERA_CONFIG.defaultPosition.y,
      CAMERA_CONFIG.defaultPosition.z
    )

    // 创建轨道控制器
    // 注意：OrbitControls 需要一个 DOM 元素来监听事件
    // 这里传入 container，实际使用时可能需要传入 renderer.domElement
    this.controls = new OrbitControls(this.camera, container)

    // 配置控制器
    this.controls.enableDamping = CONTROLS_CONFIG.enableDamping
    this.controls.dampingFactor = CONTROLS_CONFIG.dampingFactor
    this.controls.minDistance = CONTROLS_CONFIG.minDistance
    this.controls.maxDistance = CONTROLS_CONFIG.maxDistance
    this.controls.enablePan = CONTROLS_CONFIG.enablePan

    // 设置默认目标点
    this.controls.target.set(
      CAMERA_CONFIG.defaultTarget.x,
      CAMERA_CONFIG.defaultTarget.y,
      CAMERA_CONFIG.defaultTarget.z
    )

    // 初始更新
    this.controls.update()
  }

  /**
   * 调整相机以适配模型
   *
   * 计算模型的包围盒，自动调整相机位置和目标点，
   * 使模型完整显示在视野中
   *
   * @param model - 要适配的 3D 对象
   */
  fitToModel(model: THREE.Object3D): void {
    // 计算模型的包围盒
    const boundingBox = new THREE.Box3().setFromObject(model)

    // 检查包围盒是否有效
    if (boundingBox.isEmpty()) {
      console.warn('[CameraController] 模型包围盒为空，无法适配相机')
      return
    }

    // 获取包围盒中心点
    const center = new THREE.Vector3()
    boundingBox.getCenter(center)

    // 获取包围盒尺寸
    const size = new THREE.Vector3()
    boundingBox.getSize(size)

    // 计算包围球半径（使用对角线长度的一半）
    const maxDim = Math.max(size.x, size.y, size.z)
    const radius = maxDim / 2

    // 计算相机距离
    // 使用 FOV 计算合适的距离，确保模型完整显示
    const fovRad = THREE.MathUtils.degToRad(this.camera.fov)
    const distance = radius / Math.sin(fovRad / 2)

    // 添加一些边距（1.5 倍距离）
    const cameraDistance = distance * 1.5

    // 计算相机位置（从右上方观察）
    const cameraOffset = new THREE.Vector3(1, 0.8, 1).normalize()
    const cameraPosition = center
      .clone()
      .add(cameraOffset.multiplyScalar(cameraDistance))

    // 设置相机位置
    this.camera.position.copy(cameraPosition)

    // 设置控制器目标点为模型中心
    this.controls.target.copy(center)

    // 更新相机近远裁剪面
    // 根据模型大小动态调整，避免裁剪问题
    this.camera.near = Math.max(0.01, cameraDistance * 0.01)
    this.camera.far = Math.max(100, cameraDistance * 10)
    this.camera.updateProjectionMatrix()

    // 更新控制器
    this.controls.update()
  }

  /**
   * 设置相机位置
   *
   * @param x - X 坐标
   * @param y - Y 坐标
   * @param z - Z 坐标
   */
  setPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z)
    this.controls.update()
  }

  /**
   * 设置相机目标点（控制器观察点）
   *
   * @param x - X 坐标
   * @param y - Y 坐标
   * @param z - Z 坐标
   */
  setTarget(x: number, y: number, z: number): void {
    this.controls.target.set(x, y, z)
    this.controls.update()
  }

  /**
   * 更新控制器
   *
   * 应在每帧渲染循环中调用，用于更新阻尼效果
   */
  update(): void {
    this.controls.update()
  }

  /**
   * 处理窗口大小变化
   *
   * 更新相机宽高比
   */
  resize(): void {
    const width = this.container.clientWidth
    const height = this.container.clientHeight

    if (width > 0 && height > 0) {
      this.camera.aspect = width / height
      this.camera.updateProjectionMatrix()
    }
  }

  /**
   * 重置相机到默认位置
   */
  reset(): void {
    this.camera.position.set(
      CAMERA_CONFIG.defaultPosition.x,
      CAMERA_CONFIG.defaultPosition.y,
      CAMERA_CONFIG.defaultPosition.z
    )

    this.controls.target.set(
      CAMERA_CONFIG.defaultTarget.x,
      CAMERA_CONFIG.defaultTarget.y,
      CAMERA_CONFIG.defaultTarget.z
    )

    this.controls.update()
  }

  /**
   * 释放资源
   *
   * 清理控制器事件监听器
   */
  dispose(): void {
    this.controls.dispose()
  }
}
