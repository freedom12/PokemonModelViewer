/**
 * 纹理加载器模块
 *
 * 负责加载 PNG 纹理文件并创建 Three.js 材质
 *
 * @module services/textureLoader
 */

import * as THREE from "three";
import { type TRMTR, type Material as TRMTRMaterial } from "../parsers";
import {
  getTextureType,
  getTextureTypeFromName,
  mapToMaterialProperty,
  type MaterialPropertyName,
} from "../utils/textureMapping";

/**
 * 纹理引用信息
 */
export interface TextureReference {
  /** 纹理类型 */
  type: "albedo" | "normal" | "emission" | "roughness" | "metalness" | "ao" | "mask" | "region" | "unknown";
  /** 纹理文件名 */
  filename: string;
  /** 纹理名称（着色器中的名称） */
  name: string;
  /** 纹理槽位 */
  slot: number;
}

/**
 * 检查材质中是否启用了指定的贴图类型
 *
 * @param material - TRMTR 材质数据
 * @param mapType - 贴图类型 ('NormalMap', 'EmissionMap', 'AOMap', 'AlphaMap')
 * @returns 是否启用
 */
function isMapEnabled(material: TRMTRMaterial, mapType: string): boolean {
  const shadersCount = material.shadersLength();

  for (let i = 0; i < shadersCount; i++) {
    const shader = material.shaders(i);
    if (!shader) continue;

    const valuesCount = shader.shaderValuesLength();

    for (let j = 0; j < valuesCount; j++) {
      const param = shader.shaderValues(j);
      if (!param) continue;

      const paramName = param.stringName();
      const paramValue = param.stringValue();

      if (paramName === `Enable${mapType}` && paramValue === "True") {
        return true;
      }
    }
  }

  return false;
}

/**
 * 从材质数据中读取浮点参数值
 *
 * @param material - TRMTR 材质数据
 * @param paramName - 参数名称
 * @param defaultValue - 默认值
 * @returns 参数值或默认值
 */
function getFloatParameter(material: TRMTRMaterial, paramName: string, defaultValue: number = 0): number {
  const floatParamCount = material.floatParameterLength();

  for (let i = 0; i < floatParamCount; i++) {
    const param = material.floatParameter(i);
    if (!param) continue;

    const name = param.floatName();
    if (name === paramName) {
      const value = param.floatValue();
      // 检查值是否有效（不为 NaN 或 undefined）
      return (value !== undefined && !isNaN(value)) ? value : defaultValue;
    }
  }

  return defaultValue;
}

/**
 * 从材质数据中读取颜色参数值
 *
 * @param material - TRMTR 材质数据
 * @param paramName - 参数名称
 * @param defaultValue - 默认值
 * @returns 颜色值或默认值
 */
function getColorParameter(material: TRMTRMaterial, paramName: string, defaultValue: THREE.Vector4 = new THREE.Vector4()): THREE.Vector4 {
  const colorParamCount = material.float4ParameterLength();

  for (let i = 0; i < colorParamCount; i++) {
    const param = material.float4Parameter(i);
    if (!param) continue;

    const name = param.colorName();
    if (name === paramName) {
      const colorValue = param.colorValue();
      if (colorValue) {
        return new THREE.Vector4(colorValue.r(), colorValue.g(), colorValue.b(), colorValue.a());
      }
    }
  }

  return defaultValue;
}

/**
 * 获取材质的主要shader名称
 *
 * @param material - TRMTR 材质数据
 * @returns shader名称，如果没有则返回null
 */
function getMaterialShaderName(material: TRMTRMaterial): string | null {
  const shadersCount = material.shadersLength();

  for (let i = 0; i < shadersCount; i++) {
    const shader = material.shaders(i);
    if (!shader) continue;

    const shaderName = shader.shaderName();
    if (shaderName) {
      return shaderName;
    }
  }

  return null;
}

/**
 * 材质创建选项
 */
export interface MaterialOptions {
  /** 是否启用透明 */
  transparent?: boolean;
  /** 是否双面渲染 */
  doubleSide?: boolean;
  /** 自发光颜色 */
  emissiveColor?: THREE.Color;
  /** 自发光强度 */
  emissiveIntensity?: number;
}

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
 * Three.js 纹理加载器实例（单例）
 */
let textureLoaderInstance: THREE.TextureLoader | null = null;

/**
 * 获取纹理加载器实例
 *
 * @returns Three.js TextureLoader 实例
 */
function getTextureLoader(): THREE.TextureLoader {
  if (!textureLoaderInstance) {
    textureLoaderInstance = new THREE.TextureLoader();
  }
  return textureLoaderInstance;
}

/**
 * 加载单个 PNG 纹理
 *
 * 异步加载指定路径的纹理文件，返回 Three.js Texture 对象
 *
 * @param path - 纹理文件路径
 * @returns Promise<THREE.Texture> 加载的纹理对象
 * @throws 如果纹理加载失败则抛出错误
 *
 * @validates 需求 4.1: 根据 TRMTR 中的纹理引用加载对应的 PNG 纹理文件
 * @validates 需求 4.2: 纹理文件加载完成后创建 Three.js Texture 对象
 *
 * @example
 * const texture = await loadTexture('/pokemon/pm0001/pm0001_00_00/pm0001_00_00_alb.png')
 */
export async function loadTexture(path: string): Promise<THREE.Texture> {
  const loader = getTextureLoader();

  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (texture) => {
        // 设置纹理参数
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;

        resolve(texture);
      },
      undefined, // onProgress 回调（不使用）
      (error) => {
        reject(new Error(`Failed to load texture: ${path} - ${error}`));
      },
    );
  });
}

/**
 * 批量加载纹理
 *
 * 并行加载多个纹理文件，返回纹理映射表
 *
 * @param textures - 纹理引用数组
 * @param basePath - 纹理文件基础路径
 * @returns Promise<Map<string, THREE.Texture>> 纹理名称到纹理对象的映射
 *
 * @example
 * const textures = await loadTextures(
 *   [{ type: 'albedo', filename: 'pm0001_00_00_alb.png', name: 'BaseColor', slot: 0 }],
 *   '/pokemon/pm0001/pm0001_00_00/'
 * )
 */
export async function loadTextures(
  textures: TextureReference[],
  basePath: string,
): Promise<Map<string, THREE.Texture>> {
  const textureMap = new Map<string, THREE.Texture>();

  // 并行加载所有纹理
  const loadPromises = textures.map(async (textureRef) => {
    const fullPath = `${basePath}${textureRef.filename}`;

    try {
      const texture = await loadTexture(fullPath);

      // 设置纹理颜色空间
      if (textureRef.type === "normal" || textureRef.type === "roughness" || textureRef.type === "metalness" || textureRef.type === "ao") {
        texture.colorSpace = THREE.LinearSRGBColorSpace;
      }

      return { name: textureRef.filename, texture };
    } catch (error) {
      // @validates 需求 8.5: 发生错误时在控制台记录详细错误信息用于调试
      // @validates 需求 8.3: 纹理加载失败时继续渲染模型但使用默认材质
      console.warn("[TextureLoader] 纹理加载失败，将使用默认材质:", {
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

  return textureMap;
}

/**
 * 根据纹理名称从材质中查找纹理
 *
 * @param material - TRMTR 材质数据
 * @param textureMap - 已加载的纹理映射表
 * @param textureName - 纹理名称
 * @returns 纹理对象或null
 */
function findTextureByName(
  material: TRMTRMaterial,
  textureMap: Map<string, THREE.Texture>,
  textureName: string,
): THREE.Texture | null {
  const texturesCount = material.texturesLength();

  for (let i = 0; i < texturesCount; i++) {
    const texture = material.textures(i);
    if (!texture) continue;

    const name = texture.textureName();
    if (name === textureName) {
      const textureFile = texture.textureFile();
      if (textureFile) {
        const pngFilename = convertBntxToPng(textureFile);
        return textureMap.get(pngFilename) || null;
      }
    }
  }

  return null;
}

/**
 * 将 .bntx 扩展名转换为 .png
 *
 * @param filename - 原始文件名
 * @returns 转换后的文件名
 */
function convertBntxToPng(filename: string): string {
  return filename.replace(/\.bntx$/i, ".png");
}

/**
 * 从 TRMTR Material 数据提取纹理引用
 *
 * @param material - TRMTR 材质数据
 * @returns 纹理引用数组
 */
export function extractTextureReferences(
  material: TRMTRMaterial,
): TextureReference[] {
  const references: TextureReference[] = [];

  const texturesCount = material.texturesLength();

  for (let i = 0; i < texturesCount; i++) {
    const texture = material.textures(i);
    if (!texture) continue;

    const textureFile = texture.textureFile();
    if (!textureFile) continue;

    const textureName = texture.textureName() || "";
    const textureSlot = texture.textureSlot();

    // 将 .bntx 扩展名转换为 .png
    const pngFilename = convertBntxToPng(textureFile);

    // 优先根据纹理名称确定纹理类型，如果失败则根据文件名后缀
    let textureType = getTextureTypeFromName(textureName);
    if (textureType === 'unknown') {
      textureType = getTextureType(pngFilename);
    }

    references.push({
      type: textureType,
      filename: pngFilename,
      name: textureName,
      slot: textureSlot,
    });
  }

  return references;
}

/**
 * 创建默认材质
 *
 * 当纹理加载失败时使用的降级材质
 *
 * @param options - 材质选项
 * @returns Three.js MeshStandardMaterial
 *
 * @validates 需求 4.7: 纹理文件加载失败时使用默认材质
 */
export function createDefaultMaterial(
  options: MaterialOptions = {},
): THREE.MeshStandardMaterial {
  const mergedOptions = { ...DEFAULT_MATERIAL_OPTIONS, ...options };

  const material = new THREE.MeshStandardMaterial({
    color: 0x808080, // 灰色
    roughness: 0.7,
    metalness: 0.0,
    side: mergedOptions.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    transparent: mergedOptions.transparent,
  });

  return material;
}

/**
 * 根据 TRMTR 材质数据创建 Three.js MeshStandardMaterial
 *
 * 加载材质中引用的所有纹理，并创建配置好的 MeshStandardMaterial
 *
 * @param material - TRMTR 材质数据
 * @param basePath - 纹理文件基础路径
 * @param options - 材质选项
 * @returns Promise<THREE.MeshStandardMaterial> 创建的材质
 *
 * @validates 需求 4.6: 所有纹理加载完成后创建 Three.js MeshStandardMaterial 并应用纹理
 * @validates 需求 4.7: 纹理文件加载失败时使用默认材质并记录警告信息
 *
 * @example
 * const material = await createMaterial(trmtrMaterial, '/pokemon/pm0001/pm0001_00_00/')
 */
export async function createMaterial(
  material: TRMTRMaterial,
  basePath: string,
  options: MaterialOptions = {},
): Promise<THREE.Material> {
  const mergedOptions = { ...DEFAULT_MATERIAL_OPTIONS, ...options };

  // 检查材质的shader类型
  const shaderName = getMaterialShaderName(material);

  // 如果是EyeClearCoat，使用自定义shader材质
  if (shaderName === "EyeClearCoat" || shaderName === "Eye") {
    return await createEyeClearCoatMaterial(material, basePath, mergedOptions);
  }

  // 如果是Unlit，使用自定义fire材质
  if (shaderName === "Unlit") {
    return await createFireMaterial(material, basePath, mergedOptions);
  }

  // 提取纹理引用
  const textureRefs = extractTextureReferences(material);

  // 如果没有纹理引用，返回默认材质
  if (textureRefs.length === 0) {
    // @validates 需求 8.5: 发生错误时在控制台记录详细错误信息用于调试
    console.warn("[TextureLoader] 材质没有纹理引用，使用默认材质:", {
      materialName: material.name(),
      timestamp: new Date().toISOString(),
    });
    return createDefaultMaterial(mergedOptions);
  }

  // 加载所有纹理
  const textureMap = await loadTextures(textureRefs, basePath);

  // 如果所有纹理都加载失败，返回默认材质
  // @validates 需求 8.3: 纹理加载失败时继续渲染模型但使用默认材质
  if (textureMap.size === 0) {
    console.warn("[TextureLoader] 所有纹理加载失败，使用默认材质:", {
      materialName: material.name(),
      textureCount: textureRefs.length,
      basePath,
      timestamp: new Date().toISOString(),
    });
    return createDefaultMaterial(mergedOptions);
  }

  // 创建材质
  const threeMaterial = new THREE.MeshStandardMaterial({
    roughness: 0.7,  // 默认值，会被材质数据覆盖
    metalness: 0.0,  // 默认值，会被材质数据覆盖
    side: mergedOptions.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    transparent: mergedOptions.transparent,
  });

  // 从材质数据中读取粗糙度和金属度参数
  const roughness = getFloatParameter(material, "Roughness", 0.7);
  const metalness = getFloatParameter(material, "Metallic", 0.0);

  threeMaterial.roughness = roughness;
  threeMaterial.metalness = metalness;

  for (const textureRef of textureRefs) {
    const texture = textureMap.get(textureRef.filename);
    if (!texture) continue;

    const propertyName = mapToMaterialProperty(textureRef.type);
    if (!propertyName) continue;

    // 检查是否启用了相应的贴图
    let isEnabled = false;
    if (textureRef.type === "albedo") {
      isEnabled = isMapEnabled(material, "BaseColorMap");
    } else if (textureRef.type === "normal") {
      isEnabled = isMapEnabled(material, "NormalMap");
    } else if (textureRef.type === "emission") {
      isEnabled = isMapEnabled(material, "EmissionColorMap");
    } else if (textureRef.type === "roughness") {
      isEnabled = isMapEnabled(material, "RoughnessMap");
    } else if (textureRef.type === "metalness") {
      isEnabled = isMapEnabled(material, "MetallicMap");
    } else if (textureRef.type === "ao") {
      isEnabled = isMapEnabled(material, "AOMap");
    } else if (textureRef.type === "mask") {
      // Alpha map通常通过alphaType来控制，这里简单检查
      // const alphaType = material.alphaType();
      // isEnabled = alphaType !== null && alphaType !== "Opaque";
    }

    if (!isEnabled) continue;

    // 根据属性名设置纹理
    applyTextureToMaterial(threeMaterial, propertyName, texture, mergedOptions);
  }

  // 设置材质名称
  const materialName = material.name();
  if (materialName) {
    threeMaterial.name = materialName;
  }

  // 检查是否需要透明
  const alphaType = material.alphaType();
  if (alphaType && alphaType !== "Opaque") {
    threeMaterial.transparent = true;
    threeMaterial.alphaTest = 0.5;
  }

  return threeMaterial;
}

/**
 * 将纹理应用到材质的指定属性
 *
 * @param material - Three.js 材质
 * @param propertyName - 材质属性名
 * @param texture - 纹理对象
 * @param options - 材质选项
 */
function applyTextureToMaterial(
  material: THREE.MeshStandardMaterial,
  propertyName: MaterialPropertyName,
  texture: THREE.Texture,
  options: MaterialOptions,
): void {
  switch (propertyName) {
    case "map":
      material.map = texture;
      break;

    case "normalMap":
      material.normalMap = texture;
      material.normalScale.set(1, 1);
      break;

    case "emissiveMap":
      material.emissiveMap = texture;
      material.emissive = options.emissiveColor || new THREE.Color(0xffffff);
      material.emissiveIntensity = options.emissiveIntensity || 1.0;
      break;

    case "roughnessMap":
      material.roughnessMap = texture;
      break;

    case "metalnessMap":
      material.metalnessMap = texture;
      break;

    case "aoMap":
      material.aoMap = texture;
      break;

    case "alphaMap":
      material.alphaMap = texture;
      material.transparent = true;
      break;
  }
}

/**
 * 从 TRMTR 数据创建所有材质
 *
 * @param trmtr - TRMTR 材质属性文件数据
 * @param basePath - 纹理文件基础路径
 * @param options - 材质选项
 * @returns Promise<THREE.MeshStandardMaterial[]> 材质数组
 *
 * @example
 * const materials = await createAllMaterials(trmtr, '/pokemon/pm0001/pm0001_00_00/')
 */
export async function createAllMaterials(
  trmtr: TRMTR,
  basePath: string,
  options: MaterialOptions = {},
): Promise<THREE.Material[]> {
  const materials: THREE.Material[] = [];

  const materialsCount = trmtr.materialsLength();

  for (let i = 0; i < materialsCount; i++) {
    const material = trmtr.materials(i);
    if (!material) {
      // 如果材质数据不存在，添加默认材质
      materials.push(createDefaultMaterial(options));
      continue;
    }

    try {
      const threeMaterial = await createMaterial(material, basePath, options);
      materials.push(threeMaterial);
    } catch (error) {
      // @validates 需求 8.3: 纹理加载失败时继续渲染模型但使用默认材质
      // @validates 需求 8.5: 发生错误时在控制台记录详细错误信息用于调试
      console.warn("[TextureLoader] 材质创建失败，使用默认材质:", {
        materialIndex: i,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      materials.push(createDefaultMaterial(options));
    }
  }

  return materials;
}

/**
 * 根据材质名称查找材质
 *
 * @param trmtr - TRMTR 材质属性文件数据
 * @param materialName - 材质名称
 * @returns 材质数据或 null
 */
export function findMaterialByName(
  trmtr: TRMTR,
  materialName: string,
): TRMTRMaterial | null {
  const materialsCount = trmtr.materialsLength();

  for (let i = 0; i < materialsCount; i++) {
    const material = trmtr.materials(i);
    if (material && material.name() === materialName) {
      return material;
    }
  }

  return null;
}

/**
 * 释放材质资源
 *
 * 释放材质及其关联的纹理资源
 *
 * @param material - 要释放的材质
 */
export function disposeMaterial(material: THREE.Material): void {
  // 处理MeshStandardMaterial
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
    // 释放userData中的纹理（用于EyeClearCoat和Fire）
    if (material.userData.layerMaskMap instanceof THREE.Texture) {
      material.userData.layerMaskMap.dispose();
    }
    if (material.userData.highlightMaskMap instanceof THREE.Texture) {
      material.userData.highlightMaskMap.dispose();
    }
    if (material.userData.normalMap1 instanceof THREE.Texture) {
      material.userData.normalMap1.dispose();
    }
    if (material.userData.displacementMap instanceof THREE.Texture) {
      material.userData.displacementMap.dispose();
    }
  }
  // 处理MeshBasicMaterial
  else if (material instanceof THREE.MeshBasicMaterial) {
    // 释放基础纹理
    if (material.map) {
      material.map.dispose();
    }
    // 释放userData中的纹理（用于Fire材质）
    if (material.userData.layerMaskMap instanceof THREE.Texture) {
      material.userData.layerMaskMap.dispose();
    }
    if (material.userData.displacementMap instanceof THREE.Texture) {
      material.userData.displacementMap.dispose();
    }
  }
  // 处理ShaderMaterial
  else if (material instanceof THREE.ShaderMaterial) {
    // 释放uniforms中的纹理
    for (const uniformName in material.uniforms) {
      const uniform = material.uniforms[uniformName];
      if (uniform.value instanceof THREE.Texture) {
        uniform.value.dispose();
      }
    }
  }

  // 释放材质
  material.dispose();
}

/**
 * 释放多个材质资源
 *
 * @param materials - 要释放的材质数组
 */
export function disposeAllMaterials(
  materials: THREE.Material[],
): void {
  for (const material of materials) {
    disposeMaterial(material);
  }
}

/**
 * 创建EyeClearCoat材质
 *
 * EyeClearCoat是一种多层材质，使用LayerMaskMap的RGBA通道作为四层蒙版
 * 每一层都有独立的颜色、金属度、粗糙度、自发光等属性
 *
 * @param material - TRMTR 材质数据
 * @param basePath - 纹理文件基础路径
 * @param options - 材质选项
 * @returns Promise<THREE.ShaderMaterial> EyeClearCoat材质
 */
export async function createEyeClearCoatMaterial(
  material: TRMTRMaterial,
  basePath: string,
  options: MaterialOptions = {},
): Promise<THREE.MeshStandardMaterial> {
  const mergedOptions = { ...DEFAULT_MATERIAL_OPTIONS, ...options };

  // 提取纹理引用
  const textureRefs = extractTextureReferences(material);
  const textureMap = await loadTextures(textureRefs, basePath);

  // 获取LayerMaskMap纹理
  const layerMaskTexture = findTextureByName(material, textureMap, "LayerMaskMap");

  // 获取HighlightMaskMap纹理（如果存在）
  const highlightMaskTexture = findTextureByName(material, textureMap, "HighlightMaskMap");

  // 获取法线纹理
  const normalTexture = findTextureByName(material, textureMap, "NormalMap");
  const normalTexture1 = findTextureByName(material, textureMap, "NormalMap1");

  // 获取各层的参数
  const baseColorLayer1 = getColorParameter(material, "BaseColorLayer1", new THREE.Vector4(0.184314, 0.015686, 0.019608, 1.0));
  const baseColorLayer2 = getColorParameter(material, "BaseColorLayer2", new THREE.Vector4(0.851613, 0.090107, 0.129314, 1.0));
  const baseColorLayer3 = getColorParameter(material, "BaseColorLayer3", new THREE.Vector4(0.8713, 0.8713, 0.8713, 1.0));
  const baseColorLayer4 = getColorParameter(material, "BaseColorLayer4", new THREE.Vector4(0.7157, 0.7157, 0.7157, 1.0));

  const metallicLayer1 = getFloatParameter(material, "MetallicLayer1", 0.0);
  const metallicLayer2 = getFloatParameter(material, "MetallicLayer2", 1.0);
  const metallicLayer3 = getFloatParameter(material, "MetallicLayer3", 0.0);
  const metallicLayer4 = getFloatParameter(material, "MetallicLayer4", 0.0);

  const roughnessLayer1 = getFloatParameter(material, "RoughnessLayer1", 0.8);
  const roughnessLayer2 = getFloatParameter(material, "RoughnessLayer2", 0.8);
  const roughnessLayer3 = getFloatParameter(material, "RoughnessLayer3", 0.8);
  const roughnessLayer4 = getFloatParameter(material, "RoughnessLayer4", 0.8);

  const emissionIntensityLayer1 = getFloatParameter(material, "EmissionIntensityLayer1", 0.2);
  const emissionIntensityLayer2 = getFloatParameter(material, "EmissionIntensityLayer2", 0.2);
  const emissionIntensityLayer3 = getFloatParameter(material, "EmissionIntensityLayer3", 0.5);
  const emissionIntensityLayer4 = getFloatParameter(material, "EmissionIntensityLayer4", 0.5);

  // 创建MeshStandardMaterial，使用内置着色器
  const eyeClearCoatMaterial = new THREE.MeshStandardMaterial({
    side: mergedOptions.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    transparent: mergedOptions.transparent,
  });

  // 设置纹理
  if (layerMaskTexture) {
    eyeClearCoatMaterial.userData.layerMaskMap = layerMaskTexture;
  }
  if (highlightMaskTexture) {
    eyeClearCoatMaterial.userData.highlightMaskMap = highlightMaskTexture;
  }
  if (normalTexture) {
    eyeClearCoatMaterial.normalMap = normalTexture;
  }
  if (normalTexture1) {
    eyeClearCoatMaterial.userData.normalMap1 = normalTexture1;
  }

  // 存储EyeClearCoat参数
  eyeClearCoatMaterial.userData.eyeClearCoatParams = {
    baseColorLayer1,
    baseColorLayer2,
    baseColorLayer3,
    baseColorLayer4,
    metallicLayer1,
    metallicLayer2,
    metallicLayer3,
    metallicLayer4,
    roughnessLayer1,
    roughnessLayer2,
    roughnessLayer3,
    roughnessLayer4,
    emissionIntensityLayer1,
    emissionIntensityLayer2,
    emissionIntensityLayer3,
    emissionIntensityLayer4,
  };

  // 使用onBeforeCompile修改片段着色器
  eyeClearCoatMaterial.onBeforeCompile = (shader) => {
    // 添加uniforms
    shader.uniforms.layerMaskMap = { value: layerMaskTexture || null };
    if (highlightMaskTexture) {
      shader.uniforms.highlightMaskMap = { value: highlightMaskTexture };
    }
    shader.uniforms.normalMap1 = { value: normalTexture1 || null };
    shader.uniforms.baseColorLayer1 = { value: baseColorLayer1 };
    shader.uniforms.baseColorLayer2 = { value: baseColorLayer2 };
    shader.uniforms.baseColorLayer3 = { value: baseColorLayer3 };
    shader.uniforms.baseColorLayer4 = { value: baseColorLayer4 };
    shader.uniforms.metallicLayer1 = { value: metallicLayer1 };
    shader.uniforms.metallicLayer2 = { value: metallicLayer2 };
    shader.uniforms.metallicLayer3 = { value: metallicLayer3 };
    shader.uniforms.metallicLayer4 = { value: metallicLayer4 };
    shader.uniforms.roughnessLayer1 = { value: roughnessLayer1 };
    shader.uniforms.roughnessLayer2 = { value: roughnessLayer2 };
    shader.uniforms.roughnessLayer3 = { value: roughnessLayer3 };
    shader.uniforms.roughnessLayer4 = { value: roughnessLayer4 };
    shader.uniforms.emissionIntensityLayer1 = { value: emissionIntensityLayer1 };
    shader.uniforms.emissionIntensityLayer2 = { value: emissionIntensityLayer2 };
    shader.uniforms.emissionIntensityLayer3 = { value: emissionIntensityLayer3 };
    shader.uniforms.emissionIntensityLayer4 = { value: emissionIntensityLayer4 };

    // 修改片段着色器，添加EyeClearCoat逻辑
    const fragmentShader = shader.fragmentShader;

    // 在片段着色器的开头添加uniform声明
    const uniformDeclarations = `
      uniform sampler2D layerMaskMap;
      ${highlightMaskTexture ? 'uniform sampler2D highlightMaskMap;' : ''}
      uniform sampler2D normalMap1;
      uniform vec4 baseColorLayer1;
      uniform vec4 baseColorLayer2;
      uniform vec4 baseColorLayer3;
      uniform vec4 baseColorLayer4;
      uniform float metallicLayer1;
      uniform float metallicLayer2;
      uniform float metallicLayer3;
      uniform float metallicLayer4;
      uniform float roughnessLayer1;
      uniform float roughnessLayer2;
      uniform float roughnessLayer3;
      uniform float roughnessLayer4;
      uniform float emissionIntensityLayer1;
      uniform float emissionIntensityLayer2;
      uniform float emissionIntensityLayer3;
      uniform float emissionIntensityLayer4;
    `;

    // 替换片段着色器，在main函数前添加uniforms
    shader.fragmentShader = fragmentShader.replace(
      '#include <common>',
      '#include <common>\n' + uniformDeclarations
    );

    // 确保vUv可用 - 检查顶点着色器
    if (!shader.vertexShader.includes('varying vec2 vUv;')) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vUv;'
      );
    }

    // 确保vUv被赋值 - 检查顶点着色器main函数
    if (!shader.vertexShader.includes('vUv = uv;')) {
      const vertexMainRegex = /void main\(\) \{([\s\S]*?)\}/;
      const vertexMainMatch = shader.vertexShader.match(vertexMainRegex);
      if (vertexMainMatch) {
        let vertexMainBody = vertexMainMatch[1];
        // 在main函数开始处添加vUv赋值
        vertexMainBody = 'vUv = uv;\n' + vertexMainBody;
        shader.vertexShader = shader.vertexShader.replace(vertexMainMatch[0], `void main() {${vertexMainBody}}`);
      }
    }

    // 确保vUv可用 - 检查片段着色器
    if (!shader.fragmentShader.includes('varying vec2 vUv;')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vUv;'
      );
    }

    // 找到片段着色器的main函数，并修改颜色计算部分
    const mainFunctionRegex = /void main\(\) \{([\s\S]*?)\}/;
    const mainFunctionMatch = fragmentShader.match(mainFunctionRegex);

    if (mainFunctionMatch) {
      let mainFunctionBody = mainFunctionMatch[1];

      // 查找diffuseColor的赋值，通常在PBR材质中
      const diffuseColorAssignmentRegex = /(diffuseColor\s*=.*;)/;
      const diffuseColorMatch = mainFunctionBody.match(diffuseColorAssignmentRegex);

      if (diffuseColorMatch) {
        // 在diffuseColor赋值之后添加EyeClearCoat逻辑
        const eyeClearCoatLogic = `
          // EyeClearCoat 多层混合逻辑
          vec4 layerMask = texture(layerMaskMap, vUv);
          float weight1 = layerMask.r;
          float weight2 = layerMask.g;
          float weight3 = layerMask.b;
          float weight4 = layerMask.a;

          vec4 baseColor = baseColorLayer1 * weight1 +
                          baseColorLayer2 * weight2 +
                          baseColorLayer3 * weight3 +
                          baseColorLayer4 * weight4;

          vec4 highlightMask = vec4(0.0);
          ${highlightMaskTexture ? "vec4 highlightSample = texture(highlightMaskMap, vUv); highlightMask = highlightSample;" : ""}

          diffuseColor.rgb = baseColor.rgb + highlightMask.rgb;
        `;

        // 在diffuseColor赋值之后插入EyeClearCoat逻辑
        mainFunctionBody = mainFunctionBody.replace(diffuseColorMatch[0], diffuseColorMatch[0] + eyeClearCoatLogic);
      }

      // 重新构建main函数
      shader.fragmentShader = shader.fragmentShader.replace(mainFunctionMatch[0], `void main() {${mainFunctionBody}}`);
    }
  };

  // 设置材质名称
  const materialName = material.name();
  if (materialName) {
    eyeClearCoatMaterial.name = materialName;
  }

  return eyeClearCoatMaterial;
}

/**
 * 创建Fire材质
 *
 * Fire是一种Unlit多层材质，使用LayerMaskMap的RGBA通道作为四层蒙版
 * 每一层都有独立的颜色，支持位移贴图（但在fragment中不处理以保证顶点动画正常）
 *
 * @param material - TRMTR 材质数据
 * @param basePath - 纹理文件基础路径
 * @param options - 材质选项
 * @returns Promise<THREE.MeshBasicMaterial> Fire材质
 */
export async function createFireMaterial(
  material: TRMTRMaterial,
  basePath: string,
  options: MaterialOptions = {},
): Promise<THREE.MeshBasicMaterial> {
  const mergedOptions = { ...DEFAULT_MATERIAL_OPTIONS, ...options };

  // 提取纹理引用
  const textureRefs = extractTextureReferences(material);
  const textureMap = await loadTextures(textureRefs, basePath);

  // 获取纹理
  const baseColorTexture = findTextureByName(material, textureMap, "BaseColorMap");
  const layerMaskTexture = findTextureByName(material, textureMap, "LayerMaskMap");
  const displacementTexture = findTextureByName(material, textureMap, "DisplacementMap");

  // 获取各层的参数
  const baseColorLayer1 = getColorParameter(material, "BaseColorLayer1", new THREE.Vector4(5.0, 0.075, 0.0295, 1.0));
  const baseColorLayer2 = getColorParameter(material, "BaseColorLayer2", new THREE.Vector4(4.0, 0.8, 0.18, 1.0));
  const baseColorLayer3 = getColorParameter(material, "BaseColorLayer3", new THREE.Vector4(1.0, 1.0, 1.0, 1.0));
  const baseColorLayer4 = getColorParameter(material, "BaseColorLayer4", new THREE.Vector4(1.0, 1.0, 1.0, 1.0));

  const baseColor = getColorParameter(material, "BaseColor", new THREE.Vector4(1.0, 1.0, 1.0, 1.0));

  const emissionIntensity = getFloatParameter(material, "EmissionIntensity", 1.0);

  // 创建MeshBasicMaterial，使用内置着色器
  const fireMaterial = new THREE.MeshBasicMaterial({
    side: mergedOptions.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    transparent: mergedOptions.transparent,
  });

  // 设置纹理
  if (baseColorTexture) {
    fireMaterial.map = baseColorTexture;
  }
  if (layerMaskTexture) {
    fireMaterial.userData.layerMaskMap = layerMaskTexture;
  }
  if (displacementTexture) {
    fireMaterial.userData.displacementMap = displacementTexture;
  }

  // 存储Fire参数
  fireMaterial.userData.fireParams = {
    baseColor,
    baseColorLayer1,
    baseColorLayer2,
    baseColorLayer3,
    baseColorLayer4,
    emissionIntensity,
  };

  // 使用onBeforeCompile修改片段着色器
  fireMaterial.onBeforeCompile = (shader) => {
    // 添加uniforms
    shader.uniforms.layerMaskMap = { value: layerMaskTexture || null };
    shader.uniforms.baseColor = { value: baseColor };
    shader.uniforms.baseColorLayer1 = { value: baseColorLayer1 };
    shader.uniforms.baseColorLayer2 = { value: baseColorLayer2 };
    shader.uniforms.baseColorLayer3 = { value: baseColorLayer3 };
    shader.uniforms.baseColorLayer4 = { value: baseColorLayer4 };
    shader.uniforms.emissionIntensity = { value: emissionIntensity };

    // 修改片段着色器，添加Fire逻辑
    const fragmentShader = shader.fragmentShader;

    // 在片段着色器的开头添加uniform声明
    const uniformDeclarations = `
      uniform sampler2D layerMaskMap;
      uniform vec4 baseColor;
      uniform vec4 baseColorLayer1;
      uniform vec4 baseColorLayer2;
      uniform vec4 baseColorLayer3;
      uniform vec4 baseColorLayer4;
      uniform float emissionIntensity;
    `;

    // 替换片段着色器，在main函数前添加uniforms
    shader.fragmentShader = fragmentShader.replace(
      '#include <common>',
      '#include <common>\n' + uniformDeclarations
    );

    // 确保vUv可用 - 检查顶点着色器
    if (!shader.vertexShader.includes('varying vec2 vUv;')) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vUv;'
      );
    }

    // 确保vUv被赋值 - 检查顶点着色器main函数
    if (!shader.vertexShader.includes('vUv = uv;')) {
      const vertexMainRegex = /void main\(\) \{([\s\S]*?)\}/;
      const vertexMainMatch = shader.vertexShader.match(vertexMainRegex);
      if (vertexMainMatch) {
        let vertexMainBody = vertexMainMatch[1];
        // 在main函数开始处添加vUv赋值
        vertexMainBody = 'vUv = uv;\n' + vertexMainBody;
        shader.vertexShader = shader.vertexShader.replace(vertexMainMatch[0], `void main() {${vertexMainBody}}`);
      }
    }

    // 确保vUv可用 - 检查片段着色器
    if (!shader.fragmentShader.includes('varying vec2 vUv;')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vUv;'
      );
    }

    // 找到片段着色器的main函数，并修改颜色计算部分
    const mainFunctionRegex = /void main\(\) \{([\s\S]*?)\}/;
    const mainFunctionMatch = fragmentShader.match(mainFunctionRegex);

    if (mainFunctionMatch) {
      let mainFunctionBody = mainFunctionMatch[1];

      // 查找diffuseColor的赋值，通常在基础材质中
      const diffuseColorAssignmentRegex = /(diffuseColor\s*=.*;)/;
      const diffuseColorMatch = mainFunctionBody.match(diffuseColorAssignmentRegex);

      if (diffuseColorMatch) {
        // 在diffuseColor赋值之后添加Fire逻辑
        const fireLogic = `
          // Fire 多层混合逻辑
          vec4 layerMask = texture2D(layerMaskMap, vUv);
          float weight1 = layerMask.r;
          float weight2 = layerMask.g;
          float weight3 = layerMask.b;
          float weight4 = layerMask.a;

          vec4 layerColor = baseColorLayer1 * weight1 +
                           baseColorLayer2 * weight2 +
                           baseColorLayer3 * weight3 +
                           baseColorLayer4 * weight4;

          // 应用基础颜色纹理
          vec4 baseColorTex = texture2D(map, vUv);
          vec4 finalColor = baseColor * baseColorTex * layerColor;

          // 应用自发光强度
          finalColor.rgb *= emissionIntensity;

          diffuseColor = finalColor;
        `;

        // 在diffuseColor赋值之后插入Fire逻辑
        mainFunctionBody = mainFunctionBody.replace(diffuseColorMatch[0], diffuseColorMatch[0] + fireLogic);
      }

      // 重新构建main函数
      shader.fragmentShader = shader.fragmentShader.replace(mainFunctionMatch[0], `void main() {${mainFunctionBody}}`);
    }
  };

  // 设置材质名称
  const materialName = material.name();
  if (materialName) {
    fireMaterial.name = materialName;
  }

  return fireMaterial;
}
