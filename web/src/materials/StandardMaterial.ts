/**
 * Standard 材质
 *
 * Standard 是基础的 PBR 材质，支持完整的物理渲染特性。
 * 使用标准的纹理贴图和参数，适用于大多数普通模型部件。
 *
 * @module materials/StandardMaterial
 */

import * as THREE from 'three';
import { MaterialData } from '../core/data';
import type { MaterialCreator } from './MaterialFactory';

/**
 * Standard 材质参数接口
 */
export interface StandardParams {
  /** 基础颜色 */
  baseColor?: THREE.Vector4;
  /** 自发光颜色 */
  emissionColor?: THREE.Vector4;
  /** 自发光强度 */
  emissionIntensity: number;
  /** 金属度 */
  metallic: number;
  /** 粗糙度 */
  roughness: number;
  /** 法线高度 */
  normalHeight: number;
  /** UV 缩放和偏移 */
  uvScaleOffset: THREE.Vector4;
}

/**
 * 创建 Standard 材质
 *
 * @param data - 材质数据
 * @param basePath - 纹理文件基础路径
 * @param textureMap - 已加载的纹理映射表
 * @returns THREE.MeshStandardMaterial Standard 材质
 */
export const createStandardMaterial: MaterialCreator = (
  data: MaterialData,
  basePath: string,
  textureMap: Map<string, THREE.Texture>
): THREE.Material => {
  // 获取纹理
  const baseColorTexture = getTextureByName(data, textureMap, 'BaseColorMap');
  const normalTexture = getTextureByName(data, textureMap, 'NormalMap');
  const metallicTexture = getTextureByName(data, textureMap, 'MetallicMap');
  const roughnessTexture = getTextureByName(data, textureMap, 'RoughnessMap');
  const aoTexture = getTextureByName(data, textureMap, 'AOMap');
  const emissionTexture = getTextureByName(data, textureMap, 'EmissionColorMap');

  // 获取参数
  const baseColor = data.getColorParam('BaseColor', new THREE.Vector4(1.0, 1.0, 1.0, 1.0));
  const emissionColor = data.getColorParam(
    'EmissionColor',
    new THREE.Vector4(1.0, 1.0, 1.0, 1.0)
  );
  const emissionIntensity = data.getFloatParam('EmissionIntensity', 0.0);
  const normalHeight = data.getFloatParam('NormalHeight', 1.0);

  // 获取 UV 缩放和偏移参数
  const uvScaleOffset = data.getColorParam(
    'UVScaleOffset',
    new THREE.Vector4(1.0, 1.0, 0.0, 0.0)
  );

  // 如果有贴图，基础值应该为1.0让贴图完全控制；如果没有贴图，使用参数值
  const metallic = metallicTexture
    ? data.getFloatParam('Metallic', 1.0)
    : data.getFloatParam('Metallic', 0.0);
  const roughness = roughnessTexture
    ? data.getFloatParam('Roughness', 1.0)
    : data.getFloatParam('Roughness', 0.7);

  // 创建 MeshStandardMaterial
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(baseColor.x, baseColor.y, baseColor.z),
    roughness,
    metalness: metallic,
    side: THREE.DoubleSide,
    transparent: data.isTransparent,
  });

  // 设置纹理和 UV 变换
  if (baseColorTexture) {
    material.map = baseColorTexture;
    baseColorTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    baseColorTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }

  if (normalTexture) {
    material.normalMap = normalTexture;
    material.normalScale = new THREE.Vector2(normalHeight, normalHeight);
    normalTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    normalTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }

  if (metallicTexture) {
    material.metalnessMap = metallicTexture;
    metallicTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    metallicTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }

  if (roughnessTexture) {
    material.roughnessMap = roughnessTexture;
    roughnessTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    roughnessTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }

  if (aoTexture) {
    material.aoMap = aoTexture;
    material.aoMapIntensity = 1.0;
    aoTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    aoTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  }

  if (emissionTexture) {
    material.emissiveMap = emissionTexture;
    material.emissive = new THREE.Color(emissionColor.x, emissionColor.y, emissionColor.z);
    material.emissiveIntensity = emissionIntensity;
    emissionTexture.repeat.set(uvScaleOffset.x, uvScaleOffset.y);
    emissionTexture.offset.set(uvScaleOffset.z, uvScaleOffset.w);
  } else if (emissionIntensity > 0) {
    // 即使没有自发光贴图，如果有自发光强度也设置自发光
    material.emissive = new THREE.Color(emissionColor.x, emissionColor.y, emissionColor.z);
    material.emissiveIntensity = emissionIntensity;
  }

  // 存储 Standard 参数
  const standardParams: StandardParams = {
    baseColor,
    emissionColor,
    emissionIntensity,
    metallic,
    roughness,
    normalHeight,
    uvScaleOffset,
  };
  material.userData.standardParams = standardParams;

  // 设置材质名称
  material.name = data.name;

  return material;
};

/**
 * 根据纹理名称从材质数据中查找纹理
 *
 * @param data - 材质数据
 * @param textureMap - 已加载的纹理映射表
 * @param textureName - 纹理名称
 * @returns 纹理对象或 null
 */
function getTextureByName(
  data: MaterialData,
  textureMap: Map<string, THREE.Texture>,
  textureName: string
): THREE.Texture | null {
  const textureRef = data.getTextureByName(textureName);
  if (textureRef) {
    return textureMap.get(textureRef.filename) || null;
  }
  return null;
}
