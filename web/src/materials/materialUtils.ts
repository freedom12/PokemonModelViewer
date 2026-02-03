/**
 * 材质参数工具函数
 *
 * 提供从 MaterialData 中读取参数的工具函数，支持默认值。
 * 这些函数是对 MaterialData 方法的包装，提供更简洁的调用方式。
 *
 * @module materials/materialUtils
 *
 * @validates 需求 4.10: 提供材质参数读取工具函数（浮点参数、颜色参数、纹理引用）
 * @validates 需求 4.11: 支持 UV 缩放和偏移参数
 */

import * as THREE from 'three';
import { MaterialData } from '../core/data';

/**
 * 从材质数据中获取浮点参数
 *
 * 如果参数不存在，返回默认值。
 *
 * @param data - 材质数据
 * @param name - 参数名称
 * @param defaultValue - 默认值，当参数不存在时返回
 * @returns 参数值
 *
 * @example
 * ```typescript
 * const roughness = getFloatParameter(materialData, 'Roughness', 0.5);
 * const metalness = getFloatParameter(materialData, 'Metallic', 0.0);
 * ```
 */
export function getFloatParameter(
  data: MaterialData,
  name: string,
  defaultValue: number
): number {
  return data.getFloatParam(name, defaultValue);
}

/**
 * 从材质数据中获取颜色参数
 *
 * 如果参数不存在，返回默认值的克隆。
 * 返回的是新的 Vector4 实例，不会影响原始数据。
 *
 * @param data - 材质数据
 * @param name - 参数名称
 * @param defaultValue - 默认值，当参数不存在时返回
 * @returns 参数值（Vector4 格式）
 *
 * @example
 * ```typescript
 * const baseColor = getColorParameter(
 *   materialData,
 *   'BaseColor',
 *   new THREE.Vector4(1, 1, 1, 1)
 * );
 * ```
 */
export function getColorParameter(
  data: MaterialData,
  name: string,
  defaultValue: THREE.Vector4
): THREE.Vector4 {
  return data.getColorParam(name, defaultValue);
}

/**
 * 将 UV 缩放和偏移应用到纹理
 *
 * scaleOffset 参数格式：
 * - x: U 方向缩放
 * - y: V 方向缩放
 * - z: U 方向偏移
 * - w: V 方向偏移
 *
 * @param texture - Three.js 纹理对象
 * @param scaleOffset - UV 缩放和偏移参数（Vector4 格式）
 *
 * @example
 * ```typescript
 * const uvScaleOffset = getColorParameter(
 *   materialData,
 *   'UVScaleOffset',
 *   new THREE.Vector4(1, 1, 0, 0)
 * );
 * applyUVScaleOffset(texture, uvScaleOffset);
 * ```
 */
export function applyUVScaleOffset(
  texture: THREE.Texture,
  scaleOffset: THREE.Vector4
): void {
  // 设置 UV 缩放（repeat）
  texture.repeat.set(scaleOffset.x, scaleOffset.y);

  // 设置 UV 偏移（offset）
  texture.offset.set(scaleOffset.z, scaleOffset.w);
}

/**
 * 从材质数据中获取 UV 缩放偏移参数
 *
 * 这是一个便捷函数，用于获取常用的 UVScaleOffset 参数。
 * 默认值为 (1, 1, 0, 0)，即无缩放无偏移。
 *
 * @param data - 材质数据
 * @param paramName - 参数名称，默认为 'UVScaleOffset'
 * @returns UV 缩放偏移参数（Vector4 格式）
 *
 * @example
 * ```typescript
 * const uvScaleOffset = getUVScaleOffset(materialData);
 * applyUVScaleOffset(texture, uvScaleOffset);
 * ```
 */
export function getUVScaleOffset(
  data: MaterialData,
  paramName: string = 'UVScaleOffset'
): THREE.Vector4 {
  return data.getColorParam(paramName, new THREE.Vector4(1.0, 1.0, 0.0, 0.0));
}

/**
 * 批量应用 UV 缩放偏移到多个纹理
 *
 * @param textures - 纹理数组
 * @param scaleOffset - UV 缩放和偏移参数
 *
 * @example
 * ```typescript
 * const textures = [baseColorTexture, normalTexture, aoTexture];
 * applyUVScaleOffsetToAll(textures, uvScaleOffset);
 * ```
 */
export function applyUVScaleOffsetToAll(
  textures: (THREE.Texture | null | undefined)[],
  scaleOffset: THREE.Vector4
): void {
  for (const texture of textures) {
    if (texture) {
      applyUVScaleOffset(texture, scaleOffset);
    }
  }
}

/**
 * 从材质数据中获取颜色参数并转换为 THREE.Color
 *
 * @param data - 材质数据
 * @param name - 参数名称
 * @param defaultValue - 默认值
 * @returns THREE.Color 对象
 *
 * @example
 * ```typescript
 * const emissiveColor = getColorParameterAsColor(
 *   materialData,
 *   'EmissiveColor',
 *   new THREE.Color(0, 0, 0)
 * );
 * ```
 */
export function getColorParameterAsColor(
  data: MaterialData,
  name: string,
  defaultValue: THREE.Color
): THREE.Color {
  return data.getColorParamAsColor(name, defaultValue);
}

/**
 * 根据纹理名称从材质数据和纹理映射中获取纹理
 *
 * @param data - 材质数据
 * @param textureMap - 已加载的纹理映射表
 * @param textureName - 纹理名称
 * @returns 纹理对象或 null
 *
 * @example
 * ```typescript
 * const baseColorTexture = getTextureByName(
 *   materialData,
 *   textureMap,
 *   'BaseColorMap'
 * );
 * ```
 */
export function getTextureByName(
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

/**
 * 根据纹理类型从材质数据和纹理映射中获取纹理
 *
 * @param data - 材质数据
 * @param textureMap - 已加载的纹理映射表
 * @param textureType - 纹理类型
 * @returns 纹理对象或 null
 *
 * @example
 * ```typescript
 * const albedoTexture = getTextureByType(
 *   materialData,
 *   textureMap,
 *   'albedo'
 * );
 * ```
 */
export function getTextureByType(
  data: MaterialData,
  textureMap: Map<string, THREE.Texture>,
  textureType:
    | 'albedo'
    | 'normal'
    | 'emission'
    | 'roughness'
    | 'metalness'
    | 'ao'
    | 'mask'
    | 'region'
    | 'unknown'
): THREE.Texture | null {
  const textureRef = data.getTextureByType(textureType);
  if (textureRef) {
    return textureMap.get(textureRef.filename) || null;
  }
  return null;
}

/**
 * 设置纹理的 UV 变换并返回纹理
 *
 * 这是一个便捷函数，用于在获取纹理的同时应用 UV 变换。
 *
 * @param texture - 纹理对象（可为 null）
 * @param scaleOffset - UV 缩放和偏移参数
 * @returns 应用了 UV 变换的纹理，如果输入为 null 则返回 null
 *
 * @example
 * ```typescript
 * const texture = setupTextureWithUV(
 *   getTextureByName(data, textureMap, 'BaseColorMap'),
 *   uvScaleOffset
 * );
 * ```
 */
export function setupTextureWithUV(
  texture: THREE.Texture | null,
  scaleOffset: THREE.Vector4
): THREE.Texture | null {
  if (texture) {
    applyUVScaleOffset(texture, scaleOffset);
  }
  return texture;
}
