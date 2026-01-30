/**
 * 纹理加载器模块
 *
 * 负责加载 PNG 纹理文件并创建 Three.js 材质
 *
 * @module services/textureLoader
 */

import * as THREE from "three";
import { UVWrapMode, type TRMTR, type Material as TRMTRMaterial } from "../parsers";

/**
 * 将UVWrapMode转换为Three.js纹理wrapping常量
 *
 * @param wrapMode - UVWrapMode枚举值
 * @returns Three.js wrapping常量
 */
function getThreeWrapMode(wrapMode: UVWrapMode): THREE.Wrapping {
  switch (wrapMode) {
    case UVWrapMode.CLAMP: //不知道为什么CLAMP模式表现和REPEAT一样
      return THREE.RepeatWrapping;
    case UVWrapMode.MIRROR:
      return THREE.MirroredRepeatWrapping;
    case UVWrapMode.WRAP:
    default:
      return THREE.RepeatWrapping;
  }
}
import { resolveResourcePath } from "./resourceLoader";
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
 * const texture = await loadTexture('/SCVI/pm0001/pm0001_00_00/pm0001_00_00_alb.png')
 */
export async function loadTexture(path: string): Promise<THREE.Texture> {
  const loader = getTextureLoader();
  const resolvedPath = resolveResourcePath(path);

  return new Promise((resolve, reject) => {
    loader.load(
      resolvedPath,
      (texture) => {
        // 设置纹理参数
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;

        resolve(texture);
      },
      undefined, // onProgress 回调（不使用）
      (error) => {
        reject(new Error(`Failed to load texture: ${resolvedPath} - ${error}`));
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
 *   '/SCVI/pm0001/pm0001_00_00/'
 * )
 */
export async function loadTextures(
  textures: TextureReference[],
  basePath: string,
  material?: TRMTRMaterial,
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

      // 设置纹理wrapping模式
      if (material) {
        const sampler = material.samplers(textureRef.slot);
        if (sampler) {
          texture.wrapS = getThreeWrapMode(sampler.repeatU());
          texture.wrapT = getThreeWrapMode(sampler.repeatV());
        }
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
    const textureSlot = texture.textureSlot() || 0;
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
 * const material = await createMaterial(trmtrMaterial, '/SCVI/pm0001/pm0001_00_00/')
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

  // 如果是NonDirectional，使用自定义non-directional材质
  if (shaderName === "NonDirectional") {
    return await createNonDirectionalMaterial(material, basePath, mergedOptions);
  }

  // 如果是IkCharacter，使用自定义IkCharacter材质
  if (shaderName === "IkCharacter") {
    return await createIkCharacterMaterial(material, basePath, mergedOptions);
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
  const textureMap = await loadTextures(textureRefs, basePath, material);

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

  // 获取UV缩放和平移参数
  const uvScaleOffset = getColorParameter(material, "UVScaleOffset", new THREE.Vector4(1.0, 1.0, 0.0, 0.0));
  const uvScaleOffsetNormal = getColorParameter(material, "UVScaleOffsetNormal", new THREE.Vector4(1.0, 1.0, 0.0, 0.0));

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
    applyTextureToMaterial(threeMaterial, propertyName, texture, mergedOptions, textureRef.type === "normal" ? uvScaleOffsetNormal : uvScaleOffset);
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
  uvScaleOffset: THREE.Vector4,
): void {
  // 应用UV变换到纹理
  texture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
  texture.offset.set(uvScaleOffset.z, uvScaleOffset.w);

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
 * const materials = await createAllMaterials(trmtr, '/SCVI/pm0001/pm0001_00_00/')
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
  const textureMap = await loadTextures(textureRefs, basePath, material);

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

  // 获取UV缩放和平移参数
  const uvScaleOffset = getColorParameter(material, "UVScaleOffset", new THREE.Vector4(1.0, 1.0, 0.0, 0.0));
  const uvScaleOffsetNormal = getColorParameter(material, "UVScaleOffsetNormal", new THREE.Vector4(1.0, 1.0, 0.0, 0.0));

  // 创建MeshStandardMaterial，使用内置着色器
  const eyeClearCoatMaterial = new THREE.MeshStandardMaterial({
    side: mergedOptions.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    transparent: mergedOptions.transparent,
  });

  // 设置纹理
  if (layerMaskTexture) {
    eyeClearCoatMaterial.userData.layerMaskMap = layerMaskTexture;
    // 应用UV变换到LayerMask纹理
    layerMaskTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    layerMaskTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }
  if (highlightMaskTexture) {
    eyeClearCoatMaterial.userData.highlightMaskMap = highlightMaskTexture;
    // 应用UV变换到HighlightMask纹理
    highlightMaskTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    highlightMaskTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }
  if (normalTexture) {
    eyeClearCoatMaterial.normalMap = normalTexture;
    // 应用UV变换到法线纹理
    normalTexture.repeat.set(uvScaleOffsetNormal.x, uvScaleOffsetNormal.y);
    normalTexture.offset.set(uvScaleOffsetNormal.z, uvScaleOffsetNormal.w);
  }
  if (normalTexture1) {
    eyeClearCoatMaterial.userData.normalMap1 = normalTexture1;
    // 应用UV变换到第二套法线纹理
    normalTexture1.repeat.set(uvScaleOffsetNormal.x, uvScaleOffsetNormal.y);
    normalTexture1.offset.set(uvScaleOffsetNormal.z, uvScaleOffsetNormal.w);
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
    uvScaleOffset,
    uvScaleOffsetNormal,
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

          vec4 albedo = vec4(1.0);
          vec4 baseColor = (albedo * baseColorLayer1) * weight1 + albedo * (1.0 - weight1);
          baseColor = (albedo * baseColorLayer2) * weight2 + baseColor * (1.0 - weight2);
          baseColor = (albedo * baseColorLayer3) * weight3 + baseColor * (1.0 - weight3);
          baseColor = (albedo * baseColorLayer4) * weight4 + baseColor * (1.0 - weight4);
          diffuseColor = baseColor;

          // vec4 baseColor = baseColorLayer1 * weight1 +
          //                 baseColorLayer2 * weight2 +
          //                 baseColorLayer3 * weight3 +
          //                 baseColorLayer4 * weight4;

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
  const textureMap = await loadTextures(textureRefs, basePath, material);

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

  // 获取UV缩放和平移参数
  const uvScaleOffset = getColorParameter(material, "UVScaleOffset", new THREE.Vector4(1.0, 1.0, 0.0, 0.0));

  // 创建MeshBasicMaterial，使用内置着色器
  const fireMaterial = new THREE.MeshBasicMaterial({
    side: mergedOptions.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    transparent: mergedOptions.transparent,
  });

  // 设置纹理
  if (baseColorTexture) {
    fireMaterial.map = baseColorTexture;
    // 应用UV变换到BaseColor纹理
    baseColorTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    baseColorTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }
  if (layerMaskTexture) {
    fireMaterial.userData.layerMaskMap = layerMaskTexture;
    // 应用UV变换到LayerMask纹理
    layerMaskTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    layerMaskTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }
  if (displacementTexture) {
    fireMaterial.userData.displacementMap = displacementTexture;
    // 应用UV变换到Displacement纹理
    displacementTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    displacementTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }

  // 存储Fire参数
  fireMaterial.userData.fireParams = {
    baseColor,
    baseColorLayer1,
    baseColorLayer2,
    baseColorLayer3,
    baseColorLayer4,
    emissionIntensity,
    uvScaleOffset,
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

export async function createNonDirectionalMaterial(
  material: TRMTRMaterial,
  basePath: string,
  options: MaterialOptions = {},
): Promise<THREE.MeshBasicMaterial> {
  const mergedOptions = { ...DEFAULT_MATERIAL_OPTIONS, ...options };

  // 提取纹理引用
  const textureRefs = extractTextureReferences(material);
  const textureMap = await loadTextures(textureRefs, basePath, material);

  // 获取纹理
  const baseColorTexture = findTextureByName(material, textureMap, "BaseColorMap");
  const layerMaskTexture = findTextureByName(material, textureMap, "LayerMaskMap");
  const displacementTexture = findTextureByName(material, textureMap, "DisplacementMap");

  // 获取各层的参数
  const baseColorLayer1 = getColorParameter(material, "BaseColorLayer1", new THREE.Vector4(0.205198, 0.141264, 0.216, 1.0));
  const baseColorLayer2 = getColorParameter(material, "BaseColorLayer2", new THREE.Vector4(0.23086, 0.138408, 0.292, 1.0));
  const baseColorLayer3 = getColorParameter(material, "BaseColorLayer3", new THREE.Vector4(0.230895, 0.141328, 0.292, 1.0));
  const baseColorLayer4 = getColorParameter(material, "BaseColorLayer4", new THREE.Vector4(0.127488, 0.08235, 0.15, 1.0));

  const layerMaskScale1 = getFloatParameter(material, "LayerMaskScale1", 1.0);
  const layerMaskScale2 = getFloatParameter(material, "LayerMaskScale2", 1.0);
  const layerMaskScale3 = getFloatParameter(material, "LayerMaskScale3", 1.0);
  const layerMaskScale4 = getFloatParameter(material, "LayerMaskScale4", 1.0);

  const displacementHeight = getFloatParameter(material, "DisplacementHeight", 0.3);
  const emissionIntensity = getFloatParameter(material, "EmissionIntensity", 1.0);
  const discardValue = getFloatParameter(material, "DiscardValue", 0.0);

  // 获取UV缩放和平移参数
  const uvScaleOffset = getColorParameter(material, "UVScaleOffset", new THREE.Vector4(1.0, 1.0, 0.0, 0.0));

  // 创建MeshBasicMaterial，使用内置着色器
  const nonDirectionalMaterial = new THREE.MeshBasicMaterial({
    side: mergedOptions.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    transparent: true, // 烟雾材质需要透明
    depthWrite: false, // 不写入深度缓冲，允许其他物体渲染在烟雾上
    depthTest: true,   // 进行深度测试，但设置较低的渲染顺序确保最后渲染
  });


  // 设置纹理
  if (baseColorTexture) {
    nonDirectionalMaterial.map = baseColorTexture;
    // 应用UV变换到BaseColor纹理
    baseColorTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    baseColorTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }
  if (layerMaskTexture) {
    nonDirectionalMaterial.userData.layerMaskMap = layerMaskTexture;
    // 应用UV变换到LayerMask纹理
    layerMaskTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    layerMaskTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }
  if (displacementTexture) {
    nonDirectionalMaterial.userData.displacementMap = displacementTexture;
    // 应用UV变换到Displacement纹理
    displacementTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    displacementTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }

  // 存储NonDirectional参数
  nonDirectionalMaterial.userData.nonDirectionalParams = {
    baseColorLayer1,
    baseColorLayer2,
    baseColorLayer3,
    baseColorLayer4,
    layerMaskScale1,
    layerMaskScale2,
    layerMaskScale3,
    layerMaskScale4,
    displacementHeight,
    emissionIntensity,
    discardValue,
    uvScaleOffset,
  };

  // 使用onBeforeCompile修改片段着色器
  nonDirectionalMaterial.onBeforeCompile = (shader) => {
    // 添加uniforms
    shader.uniforms.layerMaskMap = { value: layerMaskTexture || null };
    shader.uniforms.displacementMap = { value: displacementTexture || null };
    shader.uniforms.baseColorLayer1 = { value: baseColorLayer1 };
    shader.uniforms.baseColorLayer2 = { value: baseColorLayer2 };
    shader.uniforms.baseColorLayer3 = { value: baseColorLayer3 };
    shader.uniforms.baseColorLayer4 = { value: baseColorLayer4 };
    shader.uniforms.layerMaskScale1 = { value: layerMaskScale1 };
    shader.uniforms.layerMaskScale2 = { value: layerMaskScale2 };
    shader.uniforms.layerMaskScale3 = { value: layerMaskScale3 };
    shader.uniforms.layerMaskScale4 = { value: layerMaskScale4 };
    shader.uniforms.displacementHeight = { value: displacementHeight };
    shader.uniforms.emissionIntensity = { value: emissionIntensity };
    shader.uniforms.discardValue = { value: discardValue };

    // 修改片段着色器，添加NonDirectional逻辑
    const fragmentShader = shader.fragmentShader;

    // 在片段着色器的开头添加uniform声明
    const uniformDeclarations = `
      uniform sampler2D layerMaskMap;
      uniform sampler2D displacementMap;
      uniform vec4 baseColorLayer1;
      uniform vec4 baseColorLayer2;
      uniform vec4 baseColorLayer3;
      uniform vec4 baseColorLayer4;
      uniform float layerMaskScale1;
      uniform float layerMaskScale2;
      uniform float layerMaskScale3;
      uniform float layerMaskScale4;
      uniform float displacementHeight;
      uniform float emissionIntensity;
      uniform float discardValue;
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
        // 在diffuseColor赋值之后添加NonDirectional逻辑
        const nonDirectionalLogic = `
          // NonDirectional 多层混合逻辑
          vec4 layerMask = texture2D(layerMaskMap, vUv);
          float weight1 = layerMask.r * layerMaskScale1;
          float weight2 = layerMask.g * layerMaskScale2;
          float weight3 = layerMask.b * layerMaskScale3;
          float weight4 = layerMask.a * layerMaskScale4;

          // 应用位移贴图（如果存在）
          float displacement = texture2D(displacementMap, vUv).r * displacementHeight;

          vec4 layerColor = baseColorLayer1 * weight1 +
                           baseColorLayer2 * weight2 +
                           baseColorLayer3 * weight3 +
                           baseColorLayer4 * weight4;

          // 应用基础颜色纹理
          vec4 baseColorTex = texture2D(map, vUv);
          vec4 finalColor = baseColorTex * layerColor;

          // 应用自发光强度
          finalColor.rgb *= emissionIntensity;

          // 应用位移影响（简单的高度映射）
          finalColor.rgb += vec3(displacement * 0.1);

          diffuseColor = finalColor;
        `;

        // 在diffuseColor赋值之后插入NonDirectional逻辑
        mainFunctionBody = mainFunctionBody.replace(diffuseColorMatch[0], diffuseColorMatch[0] + nonDirectionalLogic);
      }

      // 重新构建main函数
      shader.fragmentShader = shader.fragmentShader.replace(mainFunctionMatch[0], `void main() {${mainFunctionBody}}`);
    }
  };

  // 设置材质名称
  const materialName = material.name();
  if (materialName) {
    nonDirectionalMaterial.name = materialName;
  }

  return nonDirectionalMaterial;
}

/**
 * 创建IkCharacter材质
 *
 * IkCharacter是一种多层PBR材质，使用LayerMaskMap的RGBA通道作为四层蒙版
 * 每一层都有独立的颜色，支持法线贴图、AO等PBR特性
 *
 * @param material - TRMTR 材质数据
 * @param basePath - 纹理文件基础路径
 * @param options - 材质选项
 * @returns Promise<THREE.MeshStandardMaterial> IkCharacter材质
 */
export async function createIkCharacterMaterial(
  material: TRMTRMaterial,
  basePath: string,
  options: MaterialOptions = {},
): Promise<THREE.MeshStandardMaterial> {
  const mergedOptions = { ...DEFAULT_MATERIAL_OPTIONS, ...options };

  // 提取纹理引用
  const textureRefs = extractTextureReferences(material);
  const textureMap = await loadTextures(textureRefs, basePath, material);

  // 获取纹理
  const baseColorTexture = findTextureByName(material, textureMap, "BaseColorMap");
  const normalTexture = findTextureByName(material, textureMap, "NormalMap");
  const occlusionTexture = findTextureByName(material, textureMap, "OcclusionMap");
  const layerMaskTexture = findTextureByName(material, textureMap, "LayerMaskMap");

  // 获取各层的参数（如果没有则使用默认值）
  const baseColorLayer1 = getColorParameter(material, "BaseColorLayer1", new THREE.Vector4(1.0, 1.0, 1.0, 1.0));
  const baseColorLayer2 = getColorParameter(material, "BaseColorLayer2", new THREE.Vector4(1.0, 1.0, 1.0, 1.0));
  const baseColorLayer3 = getColorParameter(material, "BaseColorLayer3", new THREE.Vector4(1.0, 1.0, 1.0, 1.0));
  const baseColorLayer4 = getColorParameter(material, "BaseColorLayer4", new THREE.Vector4(1.0, 1.0, 1.0, 1.0));

  const baseColor = getColorParameter(material, "BaseColor", new THREE.Vector4(1.0, 1.0, 1.0, 1.0));
  const roughness = getFloatParameter(material, "Roughness", 0.7);
  const metalness = getFloatParameter(material, "Metallic", 0.0);
  const emissionIntensity = getFloatParameter(material, "EmissionIntensity", 1.0);

  // 获取UV缩放和平移参数
  const uvScaleOffset = getColorParameter(material, "UVScaleOffset", new THREE.Vector4(1.0, 1.0, 0.0, 0.0));

  // 创建MeshStandardMaterial
  const ikCharacterMaterial = new THREE.MeshStandardMaterial({
    roughness,
    metalness,
    side: mergedOptions.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    transparent: mergedOptions.transparent,
  });

  // 设置纹理
  if (baseColorTexture) {
    ikCharacterMaterial.map = baseColorTexture;
    // 应用UV变换
    baseColorTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    baseColorTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }
  if (normalTexture) {
    ikCharacterMaterial.normalMap = normalTexture;
    // 应用UV变换
    normalTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    normalTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }
  if (occlusionTexture) {
    ikCharacterMaterial.aoMap = occlusionTexture;
    ikCharacterMaterial.aoMapIntensity = 1.0;
    // 应用UV变换
    occlusionTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    occlusionTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }
  if (layerMaskTexture) {
    ikCharacterMaterial.userData.layerMaskMap = layerMaskTexture;
    // 应用UV变换
    layerMaskTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    layerMaskTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }

  // 存储IkCharacter参数
  ikCharacterMaterial.userData.ikCharacterParams = {
    baseColor,
    baseColorLayer1,
    baseColorLayer2,
    baseColorLayer3,
    baseColorLayer4,
    emissionIntensity,
    uvScaleOffset,
  };

  // 如果有LayerMaskMap，使用onBeforeCompile修改片段着色器
  if (layerMaskTexture) {
    ikCharacterMaterial.onBeforeCompile = (shader) => {
      // 添加uniforms
      shader.uniforms.layerMaskMap = { value: layerMaskTexture || null };
      shader.uniforms.baseColor = { value: baseColor };
      shader.uniforms.baseColorLayer1 = { value: baseColorLayer1 };
      shader.uniforms.baseColorLayer2 = { value: baseColorLayer2 };
      shader.uniforms.baseColorLayer3 = { value: baseColorLayer3 };
      shader.uniforms.baseColorLayer4 = { value: baseColorLayer4 };
      shader.uniforms.emissionIntensity = { value: emissionIntensity };

      // 修改片段着色器，添加IkCharacter多层混合逻辑
      const fragmentShader = shader.fragmentShader;

      // 在片段着色器的开头添加uniform声明和varying
      const additions = `
        uniform sampler2D layerMaskMap;
        uniform vec4 baseColor;
        uniform vec4 baseColorLayer1;
        uniform vec4 baseColorLayer2;
        uniform vec4 baseColorLayer3;
        uniform vec4 baseColorLayer4;
        uniform float emissionIntensity;
        varying vec2 vUv;
      `;

      // 替换片段着色器，在main函数前添加
      shader.fragmentShader = fragmentShader.replace(
        '#include <common>',
        '#include <common>\n' + additions
      );

      // 确保顶点着色器有varying vec2 vUv;
      if (!shader.vertexShader.includes('varying vec2 vUv;')) {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          '#include <common>\nvarying vec2 vUv;'
        );
      }

      // 找到片段着色器的main函数，并修改颜色计算部分
      const mainFunctionRegex = /void main\(\) \{([\s\S]*?)\}/;
      const mainFunctionMatch = fragmentShader.match(mainFunctionRegex);

      if (mainFunctionMatch) {
        let mainFunctionBody = mainFunctionMatch[1];

        // 查找diffuseColor的赋值
        const diffuseColorAssignmentRegex = /(diffuseColor\s*=.*;)/;
        const diffuseColorMatch = mainFunctionBody.match(diffuseColorAssignmentRegex);

        if (diffuseColorMatch) {
          // 在diffuseColor赋值之后添加IkCharacter多层混合逻辑
          const ikCharacterLogic = `
            // IkCharacter 多层混合逻辑
            vec4 layerMask = texture2D(layerMaskMap, vUv);
            float weight1 = layerMask.r;
            float weight2 = layerMask.g;
            float weight3 = layerMask.b;
            float weight4 = layerMask.a;

            vec4 layerColor = baseColorLayer1 * weight1 +
                             baseColorLayer2 * weight2 +
                             baseColorLayer3 * weight3 +
                             baseColorLayer4 * weight4;

            // 应用层颜色到diffuseColor
            diffuseColor *= layerColor;
          `;

          // 在diffuseColor赋值之后插入逻辑
          mainFunctionBody = mainFunctionBody.replace(diffuseColorMatch[0], diffuseColorMatch[0] + ikCharacterLogic);
        }

        // 重新构建main函数
        shader.fragmentShader = shader.fragmentShader.replace(mainFunctionMatch[0], `void main() {${mainFunctionBody}}`);
      }
    };
  }

  // 设置材质名称
  const materialName = material.name();
  if (materialName) {
    ikCharacterMaterial.name = materialName;
  }

  return ikCharacterMaterial;
}
