/**
 * FresnelEffect 材质
 *
 * FresnelEffect 是支持菲涅尔效果的材质，具有折射、Fresnel纹理、局部IBL、AO和自发光遮罩等特性。
 * 主要用于具有玻璃、水晶或其他透明/半透明效果的宝可梦部件。
 *
 * @module materials/FresnelEffectMaterial
 */

import * as THREE from 'three';
import { MaterialData } from '../core/data';
import type { MaterialCreator } from './MaterialFactory';
import {
  getFloatParameter,
  getColorParameter,
  applyUVScaleOffset,
  getTextureByName,
} from './materialUtils';

/**
 * FresnelEffect 材质参数接口
 */
export interface FresnelEffectParams {
  /** 基础颜色 */
  baseColor: THREE.Vector4;
  /** 第一层基础颜色 */
  baseColorLayer1: THREE.Vector4;
  /** 自发光颜色 */
  emissionColor: THREE.Vector4;
  /** 自发光强度 */
  emissionIntensity: number;
  /** 第一层自发光强度 */
  emissionIntensityLayer1: number;
  /** 金属度 */
  metallic: number;
  /** 粗糙度 */
  roughness: number;
  /** 法线高度 */
  normalHeight: number;
  /** 第一层法线高度 */
  normalHeight1: number;
  /** UV 缩放和偏移 */
  uvScaleOffset: THREE.Vector4;
  /** 第一层 UV 缩放和偏移 */
  uvScaleOffset1: THREE.Vector4;
  /** Parallax UV 强度 */
  parallaxUVIntensity: THREE.Vector4;
  /** 第一层蒙版缩放 */
  layerMaskScale1: number;
  /** 局部镜面探针强度 */
  localSpecularProbeIntensity: number;
  /** Fresnel 透明度最小值 */
  fresnelAlphaMin: number;
  /** Fresnel 透明度最大值 */
  fresnelAlphaMax: number;
  /** Fresnel 角度偏移 */
  fresnelAngleBias: number;
  /** 基础颜色贴图饱和度 */
  baseColorMapSaturation: number;
}

/**
 * 创建 FresnelEffect 材质
 *
 * @param data - 材质数据
 * @param basePath - 纹理文件基础路径
 * @param textureMap - 已加载的纹理映射表
 * @returns THREE.MeshPhysicalMaterial FresnelEffect 材质
 */
export const createFresnelEffectMaterial: MaterialCreator = (
  data: MaterialData,
  basePath: string,
  textureMap: Map<string, THREE.Texture>
): THREE.Material => {
  // 读取材质参数
  const params = extractFresnelEffectParams(data);

  // 检查是否真的需要透明效果
  const needsTransparency = params.baseColor.w < 1.0 || 
    (params.fresnelAlphaMin < 1.0 && params.fresnelAlphaMax < 1.0);

  // 创建基础 PBR 材质
  const material = new THREE.MeshPhysicalMaterial({
    name: data.name,
    transparent: needsTransparency,
    side: THREE.DoubleSide,
    depthWrite: !needsTransparency, // 透明材质不写入深度
  });

  // 设置基础颜色
  const baseColorRGB = new THREE.Color(
    params.baseColor.x,
    params.baseColor.y,
    params.baseColor.z
  );
  material.color = baseColorRGB;
  
  // 只有当alpha确实小于1时才设置opacity
  if (params.baseColor.w < 1.0) {
    material.opacity = params.baseColor.w;
  }

  // 设置 PBR 参数
  material.metalness = params.metallic;
  material.roughness = params.roughness;

  // 应用纹理
  applyTextures(material, data, textureMap, params);

  // 设置自发光
  if (params.emissionIntensity > 0 || params.emissionIntensityLayer1 > 0) {
    const emissiveColor = new THREE.Color(
      params.emissionColor.x,
      params.emissionColor.y,
      params.emissionColor.z
    );
    material.emissive = emissiveColor;
    material.emissiveIntensity = Math.max(
      params.emissionIntensity,
      params.emissionIntensityLayer1
    );
  }

  // 只在需要折射效果且参数合理时启用transmission
  // FresnelAlphaMin > FresnelAlphaMax 表示边缘更透明（典型的菲涅尔效果）
  if (params.fresnelAlphaMin > params.fresnelAlphaMax && params.fresnelAlphaMax < 0.9) {
    // 使用轻微的透射效果
    material.transmission = (1.0 - params.fresnelAlphaMax) * 0.3; // 限制透射强度
    material.thickness = 0.5;
    material.ior = 1.45; // 玻璃的折射率
  }

  // 设置环境光遮蔽强度
  material.aoMapIntensity = 1.0;

  return material;
};

/**
 * 从材质数据中提取 FresnelEffect 参数
 *
 * @param data - 材质数据
 * @returns FresnelEffect 参数对象
 */
function extractFresnelEffectParams(data: MaterialData): FresnelEffectParams {
  return {
    // 基础颜色参数
    baseColor: getColorParameter(
      data,
      'BaseColor',
      new THREE.Vector4(1, 1, 1, 1)
    ),
    baseColorLayer1: getColorParameter(
      data,
      'BaseColorLayer1',
      new THREE.Vector4(1, 1, 1, 1)
    ),
    emissionColor: getColorParameter(
      data,
      'EmissionColor',
      new THREE.Vector4(0, 0, 0, 1)
    ),

    // 强度参数
    emissionIntensity: getFloatParameter(data, 'EmissionIntensity', 0.0),
    emissionIntensityLayer1: getFloatParameter(
      data,
      'EmissionIntensityLayer1',
      0.0
    ),
    metallic: getFloatParameter(data, 'Metallic', 0.0),
    roughness: getFloatParameter(data, 'Roughness', 0.5),
    normalHeight: getFloatParameter(data, 'NormalHeight', 1.0),
    normalHeight1: getFloatParameter(data, 'NormalHeight1', 1.0),

    // UV 参数
    uvScaleOffset: getColorParameter(
      data,
      'UVScaleOffset',
      new THREE.Vector4(1, 1, 0, 0)
    ),
    uvScaleOffset1: getColorParameter(
      data,
      'UVScaleOffset1',
      new THREE.Vector4(1, 1, 0, 0)
    ),
    parallaxUVIntensity: getColorParameter(
      data,
      'ParallaxUVIntensity',
      new THREE.Vector4(0, 0, 0, 0)
    ),

    // 特效参数
    layerMaskScale1: getFloatParameter(data, 'LayerMaskScale1', 1.0),
    localSpecularProbeIntensity: getFloatParameter(
      data,
      'LocalSpecularProbeIntensity',
      1.0
    ),
    fresnelAlphaMin: getFloatParameter(data, 'FresnelAlphaMin', 1.0),
    fresnelAlphaMax: getFloatParameter(data, 'FresnelAlphaMax', 0.0),
    fresnelAngleBias: getFloatParameter(data, 'FresnelAngleBias', 0.0),
    baseColorMapSaturation: getFloatParameter(
      data,
      'BaseColorMapSaturation',
      1.0
    ),
  };
}

/**
 * 应用纹理到材质
 *
 * FresnelEffect 支持的纹理类型：
 * - BaseColorMap: 基础颜色贴图
 * - BaseColorMap1: 第一层基础颜色贴图
 * - NormalMap: 法线贴图
 * - NormalMap1: 第一层法线贴图
 * - FresnelMaskMap: 菲涅尔遮罩贴图
 * - AOMap: 环境光遮蔽贴图
 * - EmissionColorMap: 自发光颜色贴图
 * - EmissionMaskMap: 自发光遮罩贴图
 * - LocalSpecularProbe: 局部镜面探针
 *
 * @param material - Three.js 材质对象
 * @param data - 材质数据
 * @param textureMap - 已加载的纹理映射表
 * @param params - 材质参数
 */
function applyTextures(
  material: THREE.MeshPhysicalMaterial,
  data: MaterialData,
  textureMap: Map<string, THREE.Texture>,
  params: FresnelEffectParams
): void {
  // 基础颜色贴图
  const baseColorMap = getTextureByName(data, textureMap, 'BaseColorMap');
  if (baseColorMap) {
    material.map = baseColorMap;
    applyUVScaleOffset(baseColorMap, params.uvScaleOffset);
    baseColorMap.colorSpace = THREE.SRGBColorSpace;
  }

  // 第一层基础颜色贴图（如果存在，可以混合）
  const baseColorMap1 = getTextureByName(data, textureMap, 'BaseColorMap1');
  if (baseColorMap1) {
    // 如果需要双层混合，可以在这里处理
    // 目前简单地使用第一层贴图覆盖
    if (!baseColorMap) {
      material.map = baseColorMap1;
      applyUVScaleOffset(baseColorMap1, params.uvScaleOffset1);
      baseColorMap1.colorSpace = THREE.SRGBColorSpace;
    }
  }

  // 法线贴图
  const normalMap = getTextureByName(data, textureMap, 'NormalMap');
  if (normalMap) {
    material.normalMap = normalMap;
    material.normalScale = new THREE.Vector2(
      params.normalHeight,
      -params.normalHeight  // Y轴翻转，因为宝可梦模型使用DirectX格式
    );
    applyUVScaleOffset(normalMap, params.uvScaleOffset1);
  }

  // 第一层法线贴图
  const normalMap1 = getTextureByName(data, textureMap, 'NormalMap1');
  if (normalMap1 && !normalMap) {
    material.normalMap = normalMap1;
    material.normalScale = new THREE.Vector2(
      params.normalHeight1,
      -params.normalHeight1  // Y轴翻转
    );
    applyUVScaleOffset(normalMap1, params.uvScaleOffset1);
  }

  // 环境光遮蔽贴图
  const aoMap = getTextureByName(data, textureMap, 'AOMap');
  if (aoMap) {
    material.aoMap = aoMap;
    applyUVScaleOffset(aoMap, params.uvScaleOffset);
  }

  // 自发光颜色贴图
  const emissionMap = getTextureByName(data, textureMap, 'EmissionColorMap');
  if (emissionMap) {
    material.emissiveMap = emissionMap;
    applyUVScaleOffset(emissionMap, params.uvScaleOffset);
    emissionMap.colorSpace = THREE.SRGBColorSpace;
  }

  // 菲涅尔遮罩贴图（不直接用作alphaMap，避免意外透明）
  const fresnelMaskMap = getTextureByName(data, textureMap, 'FresnelMaskMap');
  if (fresnelMaskMap) {
    // FresnelMaskMap 通常用于控制菲涅尔效果强度，不直接作为alpha
    // 如果需要透明效果，应该由材质参数控制
    // material.alphaMap = fresnelMaskMap; // 移除这行，避免意外透明
    applyUVScaleOffset(fresnelMaskMap, params.uvScaleOffset);
  }

  // 自发光遮罩贴图
  const emissionMaskMap = getTextureByName(data, textureMap, 'EmissionMaskMap');
  if (emissionMaskMap && !material.emissiveMap) {
    // 如果没有 emissiveMap，使用 emissionMaskMap 作为自发光强度控制
    material.emissiveMap = emissionMaskMap;
    applyUVScaleOffset(emissionMaskMap, params.uvScaleOffset);
  }

  // 局部镜面探针（可用作环境贴图）
  const localSpecularProbe = getTextureByName(data, textureMap, 'LocalSpecularProbe');
  if (localSpecularProbe) {
    // 设置为环境贴图
    material.envMap = localSpecularProbe;
    material.envMapIntensity = params.localSpecularProbeIntensity;
  }
}
