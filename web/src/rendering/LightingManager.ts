/**
 * LightingManager.ts - 光照管理器类
 *
 * 封装 Three.js 环境光、方向光和环境贴图
 * 提供光照强度控制和资源管理功能
 *
 * 需求: 5.4
 */
import * as THREE from 'three';

/**
 * 光照配置常量
 */
const LIGHTING_CONFIG = {
  // 环境光配置
  ambient: {
    color: 0xffffff,
    intensity: 0.4,
  },
  // 方向光配置
  directional: {
    color: 0xffffff,
    intensity: 0.6,
    position: { x: 5, y: 10, z: 7 },
    // 阴影配置
    shadow: {
      enabled: true,
      mapSize: 2048, // 阴影贴图分辨率
      bias: -0.0001, // 阴影偏移，减少阴影失真
      normalBias: 0.02, // 法线偏移，减少自阴影失真
      // 阴影相机范围
      camera: {
        near: 0.1,
        far: 50,
        left: -10,
        right: 10,
        top: 10,
        bottom: -10,
      },
    },
  },
  // 环境贴图配置
  environment: {
    enabled: true,
    intensity: 1.0,
    // 渐变颜色配置（用于生成环境贴图）
    gradientColors: {
      top: '#cccccc', // 顶部灰色
      upperMiddle: '#a0d0e0', // 浅灰蓝色
      lowerMiddle: '#5a9bb8', // 中等蓝色
      bottom: '#2f5a7a', // 深灰蓝色
    },
    // 环境贴图尺寸
    size: 512,
  },
} as const;

/**
 * 光照管理器类
 *
 * 管理场景中的光照系统，包括：
 * - 环境光（AmbientLight）：提供基础照明
 * - 方向光（DirectionalLight）：模拟太阳光
 * - 环境贴图（CubeTexture）：为 PBR 材质提供反射
 */
export class LightingManager {
  /** 环境光 */
  readonly ambientLight: THREE.AmbientLight;

  /** 方向光 */
  readonly directionalLight: THREE.DirectionalLight;

  /** 环境贴图（用于 PBR 材质反射） */
  readonly environmentMap: THREE.CubeTexture | null;

  /** 场景引用 */
  private readonly scene: THREE.Scene;

  /**
   * 创建光照管理器
   *
   * @param scene - Three.js 场景对象
   */
  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 创建环境光
    this.ambientLight = new THREE.AmbientLight(
      LIGHTING_CONFIG.ambient.color,
      LIGHTING_CONFIG.ambient.intensity
    );
    scene.add(this.ambientLight);

    // 创建方向光
    this.directionalLight = new THREE.DirectionalLight(
      LIGHTING_CONFIG.directional.color,
      LIGHTING_CONFIG.directional.intensity
    );
    this.directionalLight.position.set(
      LIGHTING_CONFIG.directional.position.x,
      LIGHTING_CONFIG.directional.position.y,
      LIGHTING_CONFIG.directional.position.z
    );

    // 配置方向光阴影
    const shadowConfig = LIGHTING_CONFIG.directional.shadow;
    this.directionalLight.castShadow = shadowConfig.enabled;
    this.directionalLight.shadow.mapSize.width = shadowConfig.mapSize;
    this.directionalLight.shadow.mapSize.height = shadowConfig.mapSize;
    this.directionalLight.shadow.bias = shadowConfig.bias;
    this.directionalLight.shadow.normalBias = shadowConfig.normalBias;
    this.directionalLight.shadow.camera.near = shadowConfig.camera.near;
    this.directionalLight.shadow.camera.far = shadowConfig.camera.far;
    this.directionalLight.shadow.camera.left = shadowConfig.camera.left;
    this.directionalLight.shadow.camera.right = shadowConfig.camera.right;
    this.directionalLight.shadow.camera.top = shadowConfig.camera.top;
    this.directionalLight.shadow.camera.bottom = shadowConfig.camera.bottom;

    scene.add(this.directionalLight);

    // 创建环境贴图
    if (LIGHTING_CONFIG.environment.enabled) {
      this.environmentMap = this.createEnvironmentMap();
      scene.environment = this.environmentMap;
    } else {
      this.environmentMap = null;
    }
  }

  /**
   * 创建环境贴图
   *
   * 生成一个简单的渐变环境贴图，用于 PBR 材质的反射效果。
   * 使用 Canvas 绘制渐变，然后创建 CubeTexture。
   *
   * @returns 环境贴图
   */
  private createEnvironmentMap(): THREE.CubeTexture {
    const size = LIGHTING_CONFIG.environment.size;
    const colors = LIGHTING_CONFIG.environment.gradientColors;

    // 创建 Canvas 元素
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d')!;

    // 创建从亮到暗的渐变，模拟天空和地面
    const gradient = context.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, colors.top);
    gradient.addColorStop(0.3, colors.upperMiddle);
    gradient.addColorStop(0.7, colors.lowerMiddle);
    gradient.addColorStop(1, colors.bottom);

    // 填充渐变
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);

    // 添加噪点来模拟更真实的反射效果
    this.addNoiseToCanvas(context, size);

    // 创建纹理
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    // 创建 CubeTexture - 使用相同的纹理作为所有面
    // 这是一个简化实现，适合基础的环境反射
    const cubeTexture = new THREE.CubeTexture([
      texture.image, // 正 X（右）
      texture.image, // 负 X（左）
      texture.image, // 正 Y（上）
      texture.image, // 负 Y（下）
      texture.image, // 正 Z（前）
      texture.image, // 负 Z（后）
    ]);

    cubeTexture.needsUpdate = true;
    return cubeTexture;
  }

  /**
   * 向 Canvas 添加噪点
   *
   * 为环境贴图添加轻微的噪点，使反射效果更自然
   *
   * @param context - Canvas 2D 上下文
   * @param size - Canvas 尺寸
   */
  private addNoiseToCanvas(context: CanvasRenderingContext2D, size: number): void {
    const imageData = context.getImageData(0, 0, size, size);
    const data = imageData.data;

    // 为每个像素添加随机噪点
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 10;
      data[i] = Math.max(0, Math.min(255, data[i] + noise)); // R
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // B
      // Alpha 通道保持不变
    }

    context.putImageData(imageData, 0, 0);
  }

  /**
   * 设置环境光强度
   *
   * @param intensity - 光照强度（0-1 范围，可超出）
   */
  setAmbientIntensity(intensity: number): void {
    this.ambientLight.intensity = intensity;
  }

  /**
   * 设置方向光强度
   *
   * @param intensity - 光照强度（0-1 范围，可超出）
   */
  setDirectionalIntensity(intensity: number): void {
    this.directionalLight.intensity = intensity;
  }

  /**
   * 设置环境贴图强度
   *
   * 通过调整场景的 environmentIntensity 属性来控制
   * PBR 材质的环境反射强度
   *
   * @param intensity - 环境强度（0-1 范围，可超出）
   */
  setEnvironmentIntensity(intensity: number): void {
    // Three.js r155+ 支持 scene.environmentIntensity
    // 对于旧版本，需要遍历材质设置 envMapIntensity
    if ('environmentIntensity' in this.scene) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Three.js 版本兼容性处理
      (this.scene as any).environmentIntensity = intensity;
    } else {
      // 回退方案：遍历场景中的所有材质
      this.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];

          for (const material of materials) {
            if (
              material instanceof THREE.MeshStandardMaterial ||
              material instanceof THREE.MeshPhysicalMaterial
            ) {
              material.envMapIntensity = intensity;
            }
          }
        }
      });
    }
  }

  /**
   * 设置方向光位置
   *
   * @param x - X 坐标
   * @param y - Y 坐标
   * @param z - Z 坐标
   */
  setDirectionalLightPosition(x: number, y: number, z: number): void {
    this.directionalLight.position.set(x, y, z);
  }

  /**
   * 设置环境光颜色
   *
   * @param color - 颜色值（十六进制数字或颜色字符串）
   */
  setAmbientColor(color: THREE.ColorRepresentation): void {
    this.ambientLight.color.set(color);
  }

  /**
   * 设置方向光颜色
   *
   * @param color - 颜色值（十六进制数字或颜色字符串）
   */
  setDirectionalColor(color: THREE.ColorRepresentation): void {
    this.directionalLight.color.set(color);
  }

  /**
   * 重置光照到默认值
   */
  reset(): void {
    // 重置环境光
    this.ambientLight.color.setHex(LIGHTING_CONFIG.ambient.color);
    this.ambientLight.intensity = LIGHTING_CONFIG.ambient.intensity;

    // 重置方向光
    this.directionalLight.color.setHex(LIGHTING_CONFIG.directional.color);
    this.directionalLight.intensity = LIGHTING_CONFIG.directional.intensity;
    this.directionalLight.position.set(
      LIGHTING_CONFIG.directional.position.x,
      LIGHTING_CONFIG.directional.position.y,
      LIGHTING_CONFIG.directional.position.z
    );

    // 重置阴影
    this.directionalLight.castShadow = LIGHTING_CONFIG.directional.shadow.enabled;

    // 重置环境强度
    this.setEnvironmentIntensity(LIGHTING_CONFIG.environment.intensity);
  }

  /**
   * 设置方向光是否投射阴影
   *
   * @param enabled - 是否启用阴影
   */
  setDirectionalShadow(enabled: boolean): void {
    this.directionalLight.castShadow = enabled;
  }

  /**
   * 获取方向光是否投射阴影
   *
   * @returns 是否启用阴影
   */
  isDirectionalShadowEnabled(): boolean {
    return this.directionalLight.castShadow;
  }

  /**
   * 释放资源
   *
   * 从场景中移除光源并释放环境贴图
   */
  dispose(): void {
    // 从场景中移除光源
    this.scene.remove(this.ambientLight);
    this.scene.remove(this.directionalLight);

    // 释放环境贴图
    if (this.environmentMap) {
      this.environmentMap.dispose();
      // 清除场景的环境贴图引用
      if (this.scene.environment === this.environmentMap) {
        this.scene.environment = null;
      }
    }
  }
}
