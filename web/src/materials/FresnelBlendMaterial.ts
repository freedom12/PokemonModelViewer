/**
 * FresnelBlend 材质
 *
 * FresnelBlend 是支持多层混合（最多5层）和菲涅尔效果的高级 PBR 材质。
 * 使用 LayerMaskMap 的 RGBA 通道控制多层颜色和材质属性的混合。
 * 主要用于需要复杂颜色变化和菲涅尔高光效果的宝可梦部件。
 *
 * @module materials/FresnelBlendMaterial
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
 * FresnelBlend 材质参数接口
 */
export interface FresnelBlendParams {
  /** 基础颜色 */
  baseColor: THREE.Vector4;
  /** 第1-9层基础颜色 */
  baseColorLayer1: THREE.Vector4;
  baseColorLayer2: THREE.Vector4;
  baseColorLayer3: THREE.Vector4;
  baseColorLayer4: THREE.Vector4;
  baseColorLayer5: THREE.Vector4;
  baseColorLayer6: THREE.Vector4;
  baseColorLayer7: THREE.Vector4;
  baseColorLayer8: THREE.Vector4;
  baseColorLayer9: THREE.Vector4;
  /** 自发光颜色 */
  emissionColor: THREE.Vector4;
  /** 第1-5层自发光颜色 */
  emissionColorLayer1: THREE.Vector4;
  emissionColorLayer2: THREE.Vector4;
  emissionColorLayer3: THREE.Vector4;
  emissionColorLayer4: THREE.Vector4;
  emissionColorLayer5: THREE.Vector4;
  /** 自发光强度 */
  emissionIntensity: number;
  emissionIntensityLayer1: number;
  emissionIntensityLayer2: number;
  emissionIntensityLayer3: number;
  emissionIntensityLayer4: number;
  emissionIntensityLayer5: number;
  /** 金属度 */
  metallic: number;
  metallicLayer1: number;
  metallicLayer2: number;
  metallicLayer3: number;
  metallicLayer4: number;
  metallicLayer5: number;
  /** 粗糙度 */
  roughness: number;
  roughnessLayer1: number;
  roughnessLayer2: number;
  roughnessLayer3: number;
  roughnessLayer4: number;
  roughnessLayer5: number;
  /** 反射率 */
  reflectance: number;
  /** 法线高度 */
  normalHeight: number;
  /** 层蒙版缩放 */
  layerMaskScale1: number;
  layerMaskScale2: number;
  layerMaskScale3: number;
  layerMaskScale4: number;
  /** Fresnel 参数 */
  fresnelAlphaMin: number;
  fresnelAlphaMax: number;
  fresnelAngleBias: number;
  fresnelPower: number;
  /** AO 强度 */
  aoIntensity: number;
  aoIntensityFresnel: number;
  /** SSS 遮罩偏移 */
  sssMaskOffset: number;
  /** UV 缩放和偏移 */
  uvScaleOffset: THREE.Vector4;
  uvScaleOffset1: THREE.Vector4;
  uvScaleOffsetNormal: THREE.Vector4;
}

/**
 * 创建 FresnelBlend 材质
 *
 * @param data - 材质数据
 * @param basePath - 纹理文件基础路径
 * @param textureMap - 已加载的纹理映射表
 * @returns THREE.MeshPhysicalMaterial FresnelBlend 材质
 */
export const createFresnelBlendMaterial: MaterialCreator = (
  data: MaterialData,
  basePath: string,
  textureMap: Map<string, THREE.Texture>
): THREE.Material => {
  // 读取材质参数
  const params = extractFresnelBlendParams(data);

  // 获取纹理
  const baseColorMap = getTextureByName(data, textureMap, 'BaseColorMap');
  const normalMap = getTextureByName(data, textureMap, 'NormalMap');
  const metallicMap = getTextureByName(data, textureMap, 'MetallicMap');
  const roughnessMap = getTextureByName(data, textureMap, 'RoughnessMap');
  const aoMap = getTextureByName(data, textureMap, 'AOMap');
  const layerMaskMap = getTextureByName(data, textureMap, 'LayerMaskMap');
  const highlightMaskMap = getTextureByName(data, textureMap, 'HighlightMaskMap');

  // 创建基础 PBR 材质
  const material = new THREE.MeshPhysicalMaterial({
    name: data.name,
    transparent: false,
    side: THREE.DoubleSide,
    depthWrite: true,
  });

  // 设置基础颜色
  material.color = new THREE.Color(
    params.baseColor.x,
    params.baseColor.y,
    params.baseColor.z
  );

  // 设置 PBR 参数
  material.metalness = params.metallic;
  material.roughness = params.roughness;
  material.reflectivity = params.reflectance;

  // 应用基础颜色贴图
  if (baseColorMap) {
    material.map = baseColorMap;
    applyUVScaleOffset(baseColorMap, params.uvScaleOffset);
    baseColorMap.colorSpace = THREE.SRGBColorSpace;
  }

  // 应用法线贴图
  if (normalMap) {
    material.normalMap = normalMap;
    material.normalScale = new THREE.Vector2(
      params.normalHeight,
      -params.normalHeight // Y轴翻转
    );
    applyUVScaleOffset(normalMap, params.uvScaleOffsetNormal);
  }

  // 应用金属度贴图
  if (metallicMap) {
    material.metalnessMap = metallicMap;
    applyUVScaleOffset(metallicMap, params.uvScaleOffset);
  }

  // 应用粗糙度贴图
  if (roughnessMap) {
    material.roughnessMap = roughnessMap;
    applyUVScaleOffset(roughnessMap, params.uvScaleOffset);
  }

  // 应用环境光遮蔽贴图
  if (aoMap) {
    material.aoMap = aoMap;
    material.aoMapIntensity = params.aoIntensity;
    applyUVScaleOffset(aoMap, params.uvScaleOffset);
  }

  // 设置自发光
  const hasEmission =
    params.emissionIntensity > 0 ||
    params.emissionIntensityLayer1 > 0 ||
    params.emissionIntensityLayer2 > 0 ||
    params.emissionIntensityLayer3 > 0 ||
    params.emissionIntensityLayer4 > 0 ||
    params.emissionIntensityLayer5 > 0;

  if (hasEmission) {
    material.emissive = new THREE.Color(
      params.emissionColor.x,
      params.emissionColor.y,
      params.emissionColor.z
    );
    material.emissiveIntensity = Math.max(
      params.emissionIntensity,
      params.emissionIntensityLayer1,
      params.emissionIntensityLayer2,
      params.emissionIntensityLayer3,
      params.emissionIntensityLayer4,
      params.emissionIntensityLayer5
    );
  }

  // 如果有层蒙版贴图，需要使用shader混合多层
  if (layerMaskMap) {
    // 存储参数供shader使用
    material.userData.fresnelBlendParams = params;
    material.userData.layerMaskMap = layerMaskMap;
    material.userData.highlightMaskMap = highlightMaskMap;

    // 应用UV变换到层蒙版
    applyUVScaleOffset(layerMaskMap, params.uvScaleOffset);

    if (highlightMaskMap) {
      applyUVScaleOffset(highlightMaskMap, params.uvScaleOffset);
    }
  }

  return material;
};

/**
 * 从材质数据中提取 FresnelBlend 参数
 *
 * @param data - 材质数据
 * @returns FresnelBlend 参数对象
 */
function extractFresnelBlendParams(data: MaterialData): FresnelBlendParams {
  return {
    // 基础颜色参数
    baseColor: getColorParameter(data, 'BaseColor', new THREE.Vector4(1, 1, 1, 1)),
    baseColorLayer1: getColorParameter(
      data,
      'BaseColorLayer1',
      new THREE.Vector4(1, 1, 1, 1)
    ),
    baseColorLayer2: getColorParameter(
      data,
      'BaseColorLayer2',
      new THREE.Vector4(1, 1, 1, 1)
    ),
    baseColorLayer3: getColorParameter(
      data,
      'BaseColorLayer3',
      new THREE.Vector4(1, 1, 1, 1)
    ),
    baseColorLayer4: getColorParameter(
      data,
      'BaseColorLayer4',
      new THREE.Vector4(1, 1, 1, 1)
    ),
    baseColorLayer5: getColorParameter(
      data,
      'BaseColorLayer5',
      new THREE.Vector4(0, 0, 0, 1)
    ),
    baseColorLayer6: getColorParameter(
      data,
      'BaseColorLayer6',
      new THREE.Vector4(1, 1, 1, 1)
    ),
    baseColorLayer7: getColorParameter(
      data,
      'BaseColorLayer7',
      new THREE.Vector4(1, 1, 1, 1)
    ),
    baseColorLayer8: getColorParameter(
      data,
      'BaseColorLayer8',
      new THREE.Vector4(1, 1, 1, 1)
    ),
    baseColorLayer9: getColorParameter(
      data,
      'BaseColorLayer9',
      new THREE.Vector4(0, 0, 0, 1)
    ),

    // 自发光颜色参数
    emissionColor: getColorParameter(
      data,
      'EmissionColor',
      new THREE.Vector4(0, 0, 0, 1)
    ),
    emissionColorLayer1: getColorParameter(
      data,
      'EmissionColorLayer1',
      new THREE.Vector4(1, 1, 1, 1)
    ),
    emissionColorLayer2: getColorParameter(
      data,
      'EmissionColorLayer2',
      new THREE.Vector4(1, 1, 1, 1)
    ),
    emissionColorLayer3: getColorParameter(
      data,
      'EmissionColorLayer3',
      new THREE.Vector4(1, 1, 1, 1)
    ),
    emissionColorLayer4: getColorParameter(
      data,
      'EmissionColorLayer4',
      new THREE.Vector4(1, 1, 1, 1)
    ),
    emissionColorLayer5: getColorParameter(
      data,
      'EmissionColorLayer5',
      new THREE.Vector4(1, 1, 1, 1)
    ),

    // 强度参数
    emissionIntensity: getFloatParameter(data, 'EmissionIntensity', 0.0),
    emissionIntensityLayer1: getFloatParameter(data, 'EmissionIntensityLayer1', 0.0),
    emissionIntensityLayer2: getFloatParameter(data, 'EmissionIntensityLayer2', 0.0),
    emissionIntensityLayer3: getFloatParameter(data, 'EmissionIntensityLayer3', 0.0),
    emissionIntensityLayer4: getFloatParameter(data, 'EmissionIntensityLayer4', 0.0),
    emissionIntensityLayer5: getFloatParameter(data, 'EmissionIntensityLayer5', 0.0),

    // PBR 参数
    metallic: getFloatParameter(data, 'Metallic', 0.0),
    metallicLayer1: getFloatParameter(data, 'MetallicLayer1', 0.0),
    metallicLayer2: getFloatParameter(data, 'MetallicLayer2', 0.0),
    metallicLayer3: getFloatParameter(data, 'MetallicLayer3', 0.0),
    metallicLayer4: getFloatParameter(data, 'MetallicLayer4', 0.0),
    metallicLayer5: getFloatParameter(data, 'MetallicLayer5', 0.0),

    roughness: getFloatParameter(data, 'Roughness', 0.5),
    roughnessLayer1: getFloatParameter(data, 'RoughnessLayer1', 0.5),
    roughnessLayer2: getFloatParameter(data, 'RoughnessLayer2', 0.5),
    roughnessLayer3: getFloatParameter(data, 'RoughnessLayer3', 0.5),
    roughnessLayer4: getFloatParameter(data, 'RoughnessLayer4', 0.5),
    roughnessLayer5: getFloatParameter(data, 'RoughnessLayer5', 0.5),

    reflectance: getFloatParameter(data, 'Reflectance', 0.5),
    normalHeight: getFloatParameter(data, 'NormalHeight', 1.0),

    // 层蒙版缩放
    layerMaskScale1: getFloatParameter(data, 'LayerMaskScale1', 1.0),
    layerMaskScale2: getFloatParameter(data, 'LayerMaskScale2', 1.0),
    layerMaskScale3: getFloatParameter(data, 'LayerMaskScale3', 1.0),
    layerMaskScale4: getFloatParameter(data, 'LayerMaskScale4', 1.0),

    // Fresnel 参数
    fresnelAlphaMin: getFloatParameter(data, 'FresnelAlphaMin', 0.0),
    fresnelAlphaMax: getFloatParameter(data, 'FresnelAlphaMax', 1.0),
    fresnelAngleBias: getFloatParameter(data, 'FresnelAngleBias', 0.0),
    fresnelPower: getFloatParameter(data, 'FresnelPower', 1.0),

    // AO 参数
    aoIntensity: getFloatParameter(data, 'AOIntensity', 1.0),
    aoIntensityFresnel: getFloatParameter(data, 'AOIntensityFresnel', 1.0),

    // SSS 参数
    sssMaskOffset: getFloatParameter(data, 'SSSMaskOffset', 1.0),

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
    uvScaleOffsetNormal: getColorParameter(
      data,
      'UVScaleOffsetNormal',
      new THREE.Vector4(1, 1, 0, 0)
    ),
  };
}
