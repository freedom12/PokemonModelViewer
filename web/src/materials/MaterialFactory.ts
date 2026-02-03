/**
 * MaterialFactory 类
 *
 * 材质工厂，使用策略模式根据 shader 类型创建对应的材质。
 * 支持注册自定义材质创建器，未注册的 shader 类型将使用默认材质。
 *
 * @module materials/MaterialFactory
 *
 * @validates 需求 4.1: 提供 MaterialFactory 类，用于根据 shader 类型创建材质
 * @validates 需求 4.2: 默认使用 MeshStandardMaterial 作为 Default_Material
 * @validates 需求 4.3: 当 shader 类型有对应的 Specific_Material 实现时使用具体材质
 * @validates 需求 4.4: 当 shader 类型没有对应实现时回退到 Default_Material
 */

import * as THREE from 'three';
import { MaterialData, MaterialOptions } from '../core/data';
import { resolveResourcePath } from '../services/resourceLoader';

/**
 * 材质创建器函数类型
 *
 * 用于创建特定 shader 类型的材质
 *
 * @param data - 材质数据
 * @param basePath - 纹理文件基础路径
 * @param textureMap - 已加载的纹理映射表
 * @returns 创建的 Three.js 材质
 */
export type MaterialCreator = (
  data: MaterialData,
  basePath: string,
  textureMap: Map<string, THREE.Texture>
) => THREE.Material;

/**
 * 纹理加载器函数类型
 *
 * 用于异步加载纹理
 *
 * @param path - 纹理文件路径
 * @returns Promise<THREE.Texture> 加载的纹理对象
 */
export type TextureLoader = (path: string) => Promise<THREE.Texture>;

/**
 * 默认材质选项
 */
const DEFAULT_MATERIAL_OPTIONS: MaterialOptions = {
  transparent: false,
  doubleSide: true,
  emissiveColor: new THREE.Color(0xffffff),
  emissiveIntensity: 1.0,
};

/**
 * MaterialFactory 类
 *
 * 使用策略模式管理材质创建器，根据 shader 类型创建对应的材质。
 *
 * @example
 * ```typescript
 * // 注册自定义材质创建器
 * MaterialFactory.register('EyeClearCoat', createEyeClearCoatMaterial);
 * MaterialFactory.register('Unlit', createFireMaterial);
 *
 * // 创建材质
 * const material = await MaterialFactory.create(materialData, '/SCVI/pm0001/');
 *
 * // 创建默认材质
 * const defaultMat = MaterialFactory.createDefault({ transparent: true });
 * ```
 */
export class MaterialFactory {
  /**
   * 材质创建器映射表
   * key: shader 名称
   * value: 材质创建器函数
   */
  private static creators: Map<string, MaterialCreator> = new Map();

  /**
   * 纹理加载器实例
   */
  private static textureLoader: TextureLoader | null = null;

  /**
   * Three.js 纹理加载器实例（单例）
   */
  private static threeTextureLoader: THREE.TextureLoader | null = null;

  /**
   * 注册材质创建器
   *
   * 为指定的 shader 类型注册材质创建器函数。
   * 如果该 shader 类型已注册，将覆盖原有的创建器。
   *
   * @param shaderName - Shader 名称
   * @param creator - 材质创建器函数
   *
   * @example
   * ```typescript
   * MaterialFactory.register('EyeClearCoat', (data, basePath, textureMap) => {
   *   const material = new THREE.MeshStandardMaterial();
   *   // 自定义材质设置...
   *   return material;
   * });
   * ```
   */
  static register(shaderName: string, creator: MaterialCreator): void {
    if (!shaderName || shaderName.trim() === '') {
      console.warn('[MaterialFactory] 无法注册空的 shader 名称');
      return;
    }

    if (MaterialFactory.creators.has(shaderName)) {
      console.warn(`[MaterialFactory] 覆盖已注册的材质创建器: ${shaderName}`);
    }

    MaterialFactory.creators.set(shaderName, creator);
  }

  /**
   * 注销材质创建器
   *
   * 移除指定 shader 类型的材质创建器。
   *
   * @param shaderName - Shader 名称
   * @returns 是否成功移除
   *
   * @example
   * ```typescript
   * MaterialFactory.unregister('EyeClearCoat');
   * ```
   */
  static unregister(shaderName: string): boolean {
    return MaterialFactory.creators.delete(shaderName);
  }

  /**
   * 检查是否已注册指定的 shader 类型
   *
   * @param shaderName - Shader 名称
   * @returns 是否已注册
   */
  static isRegistered(shaderName: string): boolean {
    return MaterialFactory.creators.has(shaderName);
  }

  /**
   * 获取所有已注册的 shader 类型
   *
   * @returns shader 名称数组
   */
  static getRegisteredShaders(): string[] {
    return Array.from(MaterialFactory.creators.keys());
  }

  /**
   * 设置纹理加载器
   *
   * 设置用于加载纹理的自定义加载器函数。
   * 如果不设置，将使用默认的 Three.js TextureLoader。
   *
   * @param loader - 纹理加载器函数
   */
  static setTextureLoader(loader: TextureLoader): void {
    MaterialFactory.textureLoader = loader;
  }

  /**
   * 获取 Three.js 纹理加载器实例
   *
   * @returns Three.js TextureLoader 实例
   */
  private static getThreeTextureLoader(): THREE.TextureLoader {
    if (!MaterialFactory.threeTextureLoader) {
      MaterialFactory.threeTextureLoader = new THREE.TextureLoader();
    }
    return MaterialFactory.threeTextureLoader;
  }

  /**
   * 加载单个纹理
   *
   * @param path - 纹理文件路径
   * @returns Promise<THREE.Texture> 加载的纹理对象
   */
  private static async loadTexture(path: string): Promise<THREE.Texture> {
    // 如果设置了自定义加载器，使用自定义加载器
    if (MaterialFactory.textureLoader) {
      return MaterialFactory.textureLoader(path);
    }

    // 解析资源路径（支持本地/远程切换）
    const resolvedPath = resolveResourcePath(path);

    // 使用默认的 Three.js TextureLoader
    const loader = MaterialFactory.getThreeTextureLoader();

    return new Promise((resolve, reject) => {
      loader.load(
        resolvedPath,
        (texture) => {
          // 设置默认纹理参数
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = true;
          resolve(texture);
        },
        undefined,
        (error) => {
          reject(new Error(`纹理加载失败: ${resolvedPath} - ${error}`));
        }
      );
    });
  }

  /**
   * 加载材质所需的所有纹理
   *
   * @param data - 材质数据
   * @param basePath - 纹理文件基础路径
   * @returns Promise<Map<string, THREE.Texture>> 纹理映射表
   */
  private static async loadTextures(
    data: MaterialData,
    basePath: string
  ): Promise<Map<string, THREE.Texture>> {
    const textureMap = new Map<string, THREE.Texture>();

    // 并行加载所有纹理
    const loadPromises = data.textures.map(async (textureRef) => {
      const fullPath = `${basePath}${textureRef.filename}`;

      try {
        const texture = await MaterialFactory.loadTexture(fullPath);

        // 根据纹理类型设置颜色空间
        if (
          textureRef.type === 'normal' ||
          textureRef.type === 'roughness' ||
          textureRef.type === 'metalness' ||
          textureRef.type === 'ao'
        ) {
          texture.colorSpace = THREE.LinearSRGBColorSpace;
        }

        // 设置纹理包裹模式
        const sampler = data.getSampler(textureRef.slot);
        texture.wrapS = MaterialData.uvWrapModeToThree(sampler.wrapU);
        texture.wrapT = MaterialData.uvWrapModeToThree(sampler.wrapV);
        texture.needsUpdate = true;

        return { name: textureRef.filename, texture };
      } catch (error) {
        // 纹理加载失败时记录警告，继续处理其他纹理
        console.warn('[MaterialFactory] 纹理加载失败，将使用默认材质:', {
          filename: textureRef.filename,
          fullPath,
          textureType: textureRef.type,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
        return null;
      }
    });

    const results = await Promise.all(loadPromises);

    // 将成功加载的纹理添加到映射表
    for (const result of results) {
      if (result) {
        textureMap.set(result.name, result.texture);
      }
    }

    // 为 EyeClearCoat 材质加载额外的 HighlightMaskMap 纹理
    // 当 EnableHighlight 启用但没有 HighlightMaskMap 时，从 LayerMaskMap 生成文件名
    await MaterialFactory.loadHighlightMaskIfNeeded(data, basePath, textureMap);

    return textureMap;
  }

  /**
   * 为 EyeClearCoat 材质加载 HighlightMaskMap 纹理
   *
   * 当 EnableHighlight 启用但没有 HighlightMaskMap 时，
   * 优先尝试加载 {材质名}_msk 格式的文件，如果不存在则回退到
   * 从 LayerMaskMap 的文件名生成 _msk 纹理文件名并加载
   *
   * @param data - 材质数据
   * @param basePath - 纹理文件基础路径
   * @param textureMap - 已加载的纹理映射表
   */
  private static async loadHighlightMaskIfNeeded(
    data: MaterialData,
    basePath: string,
    textureMap: Map<string, THREE.Texture>
  ): Promise<void> {
    // 检查是否是 EyeClearCoat 材质
    if (data.shaderName !== 'EyeClearCoat') {
      return;
    }

    // 检查是否启用了 EnableHighlight
    if (!data.isAnyShaderFeatureEnabled('EnableHighlight')) {
      return;
    }

    // 检查是否已有 HighlightMaskMap
    const highlightMaskRef = data.getTextureByName('HighlightMaskMap');
    if (highlightMaskRef) {
      return;
    }

    // 获取 LayerMaskMap 纹理引用用于采样器设置
    const layerMaskRef = data.getTextureByName('LayerMaskMap');
    // 从 LayerMaskMap 文件名生成 _msk 文件名
    if (!layerMaskRef || !layerMaskRef.filename.includes('_eye_lym')) {
      return;
    }

    // 优先尝试 {材质名}_msk 格式
    const materialBasedFilename = layerMaskRef.filename.replace(
      '_eye_lym',
      `_${data.name}_msk`
    );
    const materialBasedPath = `${basePath}${materialBasedFilename}`;

    try {
      const texture = await MaterialFactory.loadTexture(materialBasedPath);

      // 如果有 LayerMaskMap，复制其采样器设置
      if (layerMaskRef) {
        const sampler = data.getSampler(layerMaskRef.slot);
        texture.wrapS = MaterialData.uvWrapModeToThree(sampler.wrapU);
        texture.wrapT = MaterialData.uvWrapModeToThree(sampler.wrapV);
      }
      texture.needsUpdate = true;

      textureMap.set('eye_hight_mask', texture);
      return;
    } catch {
      // {材质名}_msk 不存在，尝试回退方案
    }

    const fallbackFilename = layerMaskRef.filename.replace('_eye_lym', '_eye_msk');
    const fallbackPath = `${basePath}${fallbackFilename}`;

    try {
      const texture = await MaterialFactory.loadTexture(fallbackPath);

      // 复制 LayerMaskMap 的采样器设置
      const sampler = data.getSampler(layerMaskRef.slot);
      texture.wrapS = MaterialData.uvWrapModeToThree(sampler.wrapU);
      texture.wrapT = MaterialData.uvWrapModeToThree(sampler.wrapV);
      texture.needsUpdate = true;

      textureMap.set(fallbackFilename, texture);
    } catch (error) {
      // HighlightMaskMap 加载失败不是致命错误，只记录警告
      console.warn('[MaterialFactory] HighlightMaskMap 加载失败:', {
        materialName: data.name,
        triedPaths: [materialBasedFilename, fallbackFilename],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 创建材质
   *
   * 根据材质数据中的 shader 类型创建对应的材质。
   * 如果 shader 类型已注册，使用注册的创建器；否则使用默认材质。
   *
   * @param data - 材质数据
   * @param basePath - 纹理文件基础路径
   * @returns Promise<THREE.Material> 创建的材质
   *
   * @validates 需求 4.3: 当 shader 类型有对应的 Specific_Material 实现时使用具体材质
   * @validates 需求 4.4: 当 shader 类型没有对应实现时回退到 Default_Material
   * @validates 需求 4.12: 纹理加载失败时使用默认材质并记录警告
   *
   * @example
   * ```typescript
   * const material = await MaterialFactory.create(
   *   materialData,
   *   '/SCVI/pm0001/pm0001_00_00/'
   * );
   * ```
   */
  static async create(data: MaterialData, basePath: string): Promise<THREE.Material> {
    const shaderName = data.shaderName;

    // 加载所有纹理
    const textureMap = await MaterialFactory.loadTextures(data, basePath);

    // 检查是否有注册的材质创建器
    if (shaderName && MaterialFactory.creators.has(shaderName)) {
      try {
        const creator = MaterialFactory.creators.get(shaderName)!;
        const material = creator(data, basePath, textureMap);

        // 设置材质名称
        if (data.name) {
          material.name = data.name;
        }

        return material;
      } catch (error) {
        // 创建器执行失败时，回退到默认材质
        console.warn('[MaterialFactory] 材质创建器执行失败，使用默认材质:', {
          materialName: data.name,
          shaderName,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
      }
    } else if (shaderName) {
      // shader 类型未注册，记录警告
      console.warn('[MaterialFactory] Shader 类型未注册，使用默认材质:', {
        materialName: data.name,
        shaderName,
        registeredShaders: MaterialFactory.getRegisteredShaders(),
        timestamp: new Date().toISOString(),
      });
    }

    // 使用默认材质创建逻辑
    return MaterialFactory.createDefaultFromData(data, textureMap);
  }

  /**
   * 根据材质数据创建默认材质
   *
   * @param data - 材质数据
   * @param textureMap - 已加载的纹理映射表
   * @returns THREE.MeshStandardMaterial 默认材质
   */
  private static createDefaultFromData(
    data: MaterialData,
    textureMap: Map<string, THREE.Texture>
  ): THREE.MeshStandardMaterial {
    // 如果没有纹理，返回简单的默认材质
    if (textureMap.size === 0) {
      const material = MaterialFactory.createDefault({
        transparent: data.isTransparent,
        doubleSide: true,
      });
      material.name = data.name;
      return material;
    }

    // 创建带纹理的默认材质
    const material = new THREE.MeshStandardMaterial({
      roughness: data.getFloatParam('Roughness', 0.7),
      metalness: data.getFloatParam('Metallic', 0.0),
      side: THREE.DoubleSide,
      transparent: data.isTransparent,
    });

    // 获取 UV 缩放和偏移参数
    const uvScaleOffset = data.getColorParam(
      'UVScaleOffset',
      new THREE.Vector4(1.0, 1.0, 0.0, 0.0)
    );

    // 应用纹理
    for (const textureRef of data.textures) {
      const texture = textureMap.get(textureRef.filename);
      if (!texture) continue;

      // 应用 UV 变换
      texture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
      texture.offset.set(uvScaleOffset.z, uvScaleOffset.w);

      // 根据纹理类型设置材质属性
      switch (textureRef.type) {
        case 'albedo':
          material.map = texture;
          break;
        case 'normal':
          material.normalMap = texture;
          material.normalScale.set(1, 1);
          break;
        case 'emission':
          material.emissiveMap = texture;
          material.emissive = new THREE.Color(0xffffff);
          material.emissiveIntensity = 1.0;
          break;
        case 'roughness':
          material.roughnessMap = texture;
          break;
        case 'metalness':
          material.metalnessMap = texture;
          break;
        case 'ao':
          material.aoMap = texture;
          break;
      }
    }

    // 设置透明度
    if (data.isTransparent) {
      material.transparent = true;
      material.alphaTest = 0.5;
    }

    // 设置材质名称
    material.name = data.name;

    return material;
  }

  /**
   * 创建默认材质
   *
   * 创建一个基础的 MeshStandardMaterial，用于纹理加载失败或
   * shader 类型未注册时的降级处理。
   *
   * @param options - 材质选项
   * @returns THREE.MeshStandardMaterial 默认材质
   *
   * @validates 需求 4.2: 默认使用 MeshStandardMaterial 作为 Default_Material
   *
   * @example
   * ```typescript
   * // 创建基础默认材质
   * const material = MaterialFactory.createDefault();
   *
   * // 创建带选项的默认材质
   * const transparentMaterial = MaterialFactory.createDefault({
   *   transparent: true,
   *   doubleSide: true,
   *   emissiveColor: new THREE.Color(0xff0000),
   *   emissiveIntensity: 0.5
   * });
   * ```
   */
  static createDefault(options: MaterialOptions = {}): THREE.MeshStandardMaterial {
    const mergedOptions = { ...DEFAULT_MATERIAL_OPTIONS, ...options };

    const material = new THREE.MeshStandardMaterial({
      color: 0x808080, // 灰色
      roughness: 0.7,
      metalness: 0.0,
      side: mergedOptions.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      transparent: mergedOptions.transparent,
    });

    // 设置自发光（如果指定）
    if (mergedOptions.emissiveColor) {
      material.emissive = mergedOptions.emissiveColor;
      material.emissiveIntensity = mergedOptions.emissiveIntensity ?? 1.0;
    }

    return material;
  }

  /**
   * 批量创建材质
   *
   * 为多个材质数据创建对应的材质。
   *
   * @param materials - 材质数据数组
   * @param basePath - 纹理文件基础路径
   * @returns Promise<THREE.Material[]> 材质数组
   *
   * @example
   * ```typescript
   * const materials = await MaterialFactory.createAll(
   *   modelData.materials,
   *   '/SCVI/pm0001/pm0001_00_00/'
   * );
   * ```
   */
  static async createAll(
    materials: MaterialData[],
    basePath: string
  ): Promise<THREE.Material[]> {
    const results: THREE.Material[] = [];

    for (const materialData of materials) {
      try {
        const material = await MaterialFactory.create(materialData, basePath);
        results.push(material);
      } catch (error) {
        // 单个材质创建失败时，使用默认材质
        console.warn('[MaterialFactory] 材质创建失败，使用默认材质:', {
          materialName: materialData.name,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
        const defaultMaterial = MaterialFactory.createDefault();
        defaultMaterial.name = materialData.name;
        results.push(defaultMaterial);
      }
    }

    return results;
  }

  /**
   * 释放材质资源
   *
   * 释放材质及其关联的纹理资源。
   *
   * @param material - 要释放的材质
   */
  static dispose(material: THREE.Material): void {
    // 处理 MeshStandardMaterial
    if (material instanceof THREE.MeshStandardMaterial) {
      // 释放所有纹理
      if (material.map) {
        material.map.dispose();
      }
      if (material.normalMap) {
        material.normalMap.dispose();
      }
      if (material.emissiveMap) {
        material.emissiveMap.dispose();
      }
      if (material.aoMap) {
        material.aoMap.dispose();
      }
      if (material.alphaMap) {
        material.alphaMap.dispose();
      }
      if (material.roughnessMap) {
        material.roughnessMap.dispose();
      }
      if (material.metalnessMap) {
        material.metalnessMap.dispose();
      }

      // 释放 userData 中的纹理（用于自定义材质）
      if (material.userData) {
        for (const key in material.userData) {
          const value = material.userData[key];
          if (value instanceof THREE.Texture) {
            value.dispose();
          }
        }
      }
    }
    // 处理 MeshBasicMaterial
    else if (material instanceof THREE.MeshBasicMaterial) {
      if (material.map) {
        material.map.dispose();
      }
      // 释放 userData 中的纹理
      if (material.userData) {
        for (const key in material.userData) {
          const value = material.userData[key];
          if (value instanceof THREE.Texture) {
            value.dispose();
          }
        }
      }
    }
    // 处理 ShaderMaterial
    else if (material instanceof THREE.ShaderMaterial) {
      // 释放 uniforms 中的纹理
      for (const uniformName in material.uniforms) {
        const uniform = material.uniforms[uniformName];
        if (uniform.value instanceof THREE.Texture) {
          uniform.value.dispose();
        }
      }
    }

    // 释放材质本身
    material.dispose();
  }

  /**
   * 批量释放材质资源
   *
   * @param materials - 要释放的材质数组
   */
  static disposeAll(materials: THREE.Material[]): void {
    for (const material of materials) {
      MaterialFactory.dispose(material);
    }
  }

  /**
   * 清除所有注册的材质创建器
   *
   * 主要用于测试或重置工厂状态。
   */
  static clearRegistrations(): void {
    MaterialFactory.creators.clear();
  }

  /**
   * 获取已注册的材质创建器数量
   *
   * @returns 已注册的创建器数量
   */
  static getRegistrationCount(): number {
    return MaterialFactory.creators.size;
  }
}
