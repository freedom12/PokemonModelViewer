/**
 * 摄像机工具模块
 *
 * 用于计算摄像机距离和自动调整摄像机位置以完整显示模型
 *
 * Property 7: 摄像机距离计算
 * 对于任意模型包围盒，计算的摄像机距离应使整个模型在视锥体内可见，
 * 即 distance >= max(width, height, depth) / (2 * tan(fov/2))
 *
 * @validates 需求 5.2: 模型添加到场景后自动调整摄像机位置以完整显示模型
 */

import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * 包围盒尺寸接口
 */
export interface BoundingBoxSize {
  /** 宽度 (X 轴) */
  width: number;
  /** 高度 (Y 轴) */
  height: number;
  /** 深度 (Z 轴) */
  depth: number;
}

/**
 * 摄像机定位结果接口
 */
export interface CameraFitResult {
  /** 计算的摄像机距离 */
  distance: number;
  /** 包围盒中心点 */
  center: THREE.Vector3;
  /** 包围盒尺寸 */
  size: BoundingBoxSize;
}

/**
 * 默认配置常量
 */
const DEFAULT_CONFIG = {
  /** 默认视场角 (度) */
  defaultFov: 75,
  /** 安全边距系数，确保模型不会紧贴视锥体边缘 */
  marginFactor: 1.2,
  /** 最小摄像机距离 */
  minDistance: 0.1,
} as const;

/**
 * 计算摄像机距离
 *
 * 根据模型包围盒和摄像机视场角计算合适的摄像机距离，
 * 使整个模型在视锥体内完全可见。
 *
 * 计算公式: distance = maxDimension / (2 * tan(fov/2)) * marginFactor
 *
 * 其中:
 * - maxDimension = max(width, height, depth) 是包围盒的最大维度
 * - fov 是摄像机的垂直视场角（弧度）
 * - marginFactor 是安全边距系数，确保模型不会紧贴边缘
 *
 * @param boundingBox - Three.js Box3 包围盒对象
 * @param fovDegrees - 摄像机垂直视场角（度），默认 75 度
 * @param marginFactor - 安全边距系数，默认 1.2
 * @returns 计算的摄像机距离
 *
 * @example
 * const box = new THREE.Box3(
 *   new THREE.Vector3(-1, -1, -1),
 *   new THREE.Vector3(1, 1, 1)
 * )
 * const distance = calculateCameraDistance(box, 75)
 * // distance >= 2 / (2 * tan(75/2 * PI/180)) * 1.2
 *
 * @validates Property 7: 摄像机距离计算
 * @validates 需求 5.2: 模型添加到场景后自动调整摄像机位置以完整显示模型
 */
export function calculateCameraDistance(
  boundingBox: THREE.Box3,
  fovDegrees: number = DEFAULT_CONFIG.defaultFov,
  marginFactor: number = DEFAULT_CONFIG.marginFactor,
): number {
  // 验证输入参数
  if (fovDegrees <= 0 || fovDegrees >= 180) {
    console.warn("cameraUtils: 无效的视场角，使用默认值 75 度");
    fovDegrees = DEFAULT_CONFIG.defaultFov;
  }

  if (marginFactor <= 0) {
    console.warn("cameraUtils: 无效的边距系数，使用默认值 1.2");
    marginFactor = DEFAULT_CONFIG.marginFactor;
  }

  // 计算包围盒尺寸
  const size = new THREE.Vector3();
  boundingBox.getSize(size);

  const width = size.x;
  const height = size.y;
  const depth = size.z;

  // 获取最大维度
  const maxDimension = Math.max(width, height, depth);

  // 如果包围盒为空或尺寸为零，返回最小距离
  if (maxDimension <= 0) {
    return DEFAULT_CONFIG.minDistance;
  }

  // 将视场角从度转换为弧度
  const fovRadians = (fovDegrees * Math.PI) / 180;

  // 计算摄像机距离
  // 公式: distance = maxDimension / (2 * tan(fov/2))
  // Property 7 要求: distance >= max(width, height, depth) / (2 * tan(fov/2))
  const halfFov = fovRadians / 2;
  const tanHalfFov = Math.tan(halfFov);

  // 基础距离计算
  const baseDistance = maxDimension / (2 * tanHalfFov);

  // 应用安全边距系数
  const distance = baseDistance * marginFactor;

  // 确保距离不小于最小值
  return Math.max(distance, DEFAULT_CONFIG.minDistance);
}

/**
 * 从包围盒获取尺寸信息
 *
 * @param boundingBox - Three.js Box3 包围盒对象
 * @returns 包围盒尺寸对象
 */
export function getBoundingBoxSize(boundingBox: THREE.Box3): BoundingBoxSize {
  const size = new THREE.Vector3();
  boundingBox.getSize(size);

  return {
    width: size.x,
    height: size.y,
    depth: size.z,
  };
}

/**
 * 从包围盒获取中心点
 *
 * @param boundingBox - Three.js Box3 包围盒对象
 * @returns 包围盒中心点
 */
export function getBoundingBoxCenter(boundingBox: THREE.Box3): THREE.Vector3 {
  const center = new THREE.Vector3();
  boundingBox.getCenter(center);
  return center;
}

/**
 * 自动调整摄像机位置以完整显示模型
 *
 * 根据模型的包围盒自动计算并设置摄像机位置，使整个模型在视图中完全可见。
 * 同时更新 OrbitControls 的目标点为模型中心。
 *
 * @param object - 要显示的 Three.js 对象（通常是模型的 Group 或 Mesh）
 * @param camera - Three.js 透视摄像机
 * @param controls - OrbitControls 控制器（可选）
 * @param marginFactor - 安全边距系数，默认 1.2
 * @returns 摄像机定位结果，包含距离、中心点和尺寸信息
 *
 * @example
 * const model = new THREE.Group()
 * // ... 添加网格到 model
 * const result = fitCameraToModel(model, camera, controls)
 * console.log(`摄像机距离: ${result.distance}`)
 * console.log(`模型中心: ${result.center.toArray()}`)
 *
 * @validates 需求 5.2: 模型添加到场景后自动调整摄像机位置以完整显示模型
 */
export function fitCameraToModel(
  object: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  controls?: OrbitControls | null,
  marginFactor: number = DEFAULT_CONFIG.marginFactor,
): CameraFitResult {
  // 计算对象的包围盒
  const boundingBox = new THREE.Box3().setFromObject(object);

  // 获取包围盒中心点
  const center = getBoundingBoxCenter(boundingBox);

  // 获取包围盒尺寸
  const size = getBoundingBoxSize(boundingBox);

  // 计算摄像机距离
  const distance = calculateCameraDistance(
    boundingBox,
    camera.fov,
    marginFactor,
  );

  // 设置摄像机位置
  // 将摄像机放置在模型中心的正前方（Z 轴正方向）
  camera.position.set(center.x, center.y, center.z + distance);

  // 让摄像机看向模型中心
  camera.lookAt(center);

  // 更新摄像机投影矩阵
  camera.updateProjectionMatrix();

  // 如果提供了 OrbitControls，更新其目标点
  if (controls) {
    controls.target.copy(center);
    controls.update();
  }

  return {
    distance,
    center,
    size,
  };
}

/**
 * 计算最小可见距离
 *
 * 根据 Property 7 的要求，计算使模型完全可见的最小摄像机距离。
 * 此函数不包含安全边距，返回理论最小值。
 *
 * @param maxDimension - 包围盒的最大维度
 * @param fovDegrees - 摄像机垂直视场角（度）
 * @returns 最小可见距离
 *
 * @validates Property 7: distance >= max(width, height, depth) / (2 * tan(fov/2))
 */
export function calculateMinimumVisibleDistance(
  maxDimension: number,
  fovDegrees: number,
): number {
  if (maxDimension <= 0) {
    return DEFAULT_CONFIG.minDistance;
  }

  if (fovDegrees <= 0 || fovDegrees >= 180) {
    fovDegrees = DEFAULT_CONFIG.defaultFov;
  }

  const fovRadians = (fovDegrees * Math.PI) / 180;
  const halfFov = fovRadians / 2;
  const tanHalfFov = Math.tan(halfFov);

  return maxDimension / (2 * tanHalfFov);
}

/**
 * 验证摄像机距离是否满足 Property 7
 *
 * 检查给定的摄像机距离是否足以使指定尺寸的模型完全可见。
 *
 * @param distance - 摄像机距离
 * @param maxDimension - 包围盒的最大维度
 * @param fovDegrees - 摄像机垂直视场角（度）
 * @returns 是否满足最小距离要求
 *
 * @validates Property 7: distance >= max(width, height, depth) / (2 * tan(fov/2))
 */
export function isDistanceSufficient(
  distance: number,
  maxDimension: number,
  fovDegrees: number,
): boolean {
  const minDistance = calculateMinimumVisibleDistance(maxDimension, fovDegrees);
  return distance >= minDistance;
}
