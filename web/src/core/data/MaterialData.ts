/**
 * MaterialData 类
 *
 * 存储材质属性（纹理引用、shader参数、渲染状态），
 * 用于将原始FlatBuffers数据转换为通用格式。
 *
 * @module core/data/MaterialData
 */

import * as THREE from 'three';
import {
  IMaterialData,
  TextureReference,
  TextureType,
  SamplerData,
  UVWrapMode,
  ShaderData,
} from './types';

/**
 * MaterialData 类实现
 *
 * 用于存储解析后的材质属性数据，包括shader名称、纹理引用、
 * 浮点参数、颜色参数、透明类型和采样器配置。
 *
 * @implements {IMaterialData}
 *
 * @example
 * ```typescript
 * const materialData = new MaterialData(
 *   'body_mat',
 *   'IkCharacter',
 *   textures,
 *   floatParams,
 *   colorParams,
 *   'Opaque',
 *   samplers
 * );
 *
 * // 获取纹理引用
 * const albedoTexture = materialData.getTextureByType('albedo');
 *
 * // 获取参数
 * const roughness = materialData.getFloatParam('Roughness', 0.5);
 * const baseColor = materialData.getColorParam('BaseColor');
 * ```
 */
export class MaterialData implements IMaterialData {
  /**
   * 创建 MaterialData 实例
   *
   * @param name - 材质名称
   * @param shaderName - Shader 名称，可为 null
   * @param shaders - Shader 数据数组
   * @param textures - 纹理引用数组
   * @param floatParams - 浮点参数映射
   * @param colorParams - 颜色参数映射（Vector4 格式）
   * @param alphaType - 透明类型，可为 null
   * @param samplers - 采样器数据数组
   */
  constructor(
    public readonly name: string,
    public readonly shaderName: string | null,
    public readonly shaders: ShaderData[],
    public readonly textures: TextureReference[],
    public readonly floatParams: Map<string, number>,
    public readonly colorParams: Map<string, THREE.Vector4>,
    public readonly alphaType: string | null,
    public readonly samplers: SamplerData[]
  ) {}

  /**
   * 获取纹理数量
   */
  get textureCount(): number {
    return this.textures.length;
  }

  /**
   * 获取浮点参数数量
   */
  get floatParamCount(): number {
    return this.floatParams.size;
  }

  /**
   * 获取颜色参数数量
   */
  get colorParamCount(): number {
    return this.colorParams.size;
  }

  /**
   * 检查是否为透明材质
   */
  get isTransparent(): boolean {
    if (!this.alphaType) return false;
    // const transparentTypes = ['Blend', 'Translucent', 'Additive', 'AlphaBlend'];
    // return transparentTypes.some((type) =>
    //   this.alphaType!.toLowerCase().includes(type.toLowerCase())
    // );
    return false;
  }

  /**
   * 检查是否有指定类型的纹理
   *
   * @param type - 纹理类型
   * @returns 是否存在该类型纹理
   */
  hasTextureType(type: TextureType): boolean {
    return this.textures.some((tex) => tex.type === type);
  }

  /**
   * 根据类型获取纹理引用
   *
   * @param type - 纹理类型
   * @returns 纹理引用，如果不存在则返回 null
   */
  getTextureByType(type: TextureType): TextureReference | null {
    return this.textures.find((tex) => tex.type === type) ?? null;
  }

  /**
   * 根据名称获取纹理引用
   *
   * @param name - 纹理名称
   * @returns 纹理引用，如果不存在则返回 null
   */
  getTextureByName(name: string): TextureReference | null {
    return this.textures.find((tex) => tex.name === name) ?? null;
  }

  /**
   * 根据槽位获取纹理引用
   *
   * @param slot - 纹理槽位
   * @returns 纹理引用，如果不存在则返回 null
   */
  getTextureBySlot(slot: number): TextureReference | null {
    return this.textures.find((tex) => tex.slot === slot) ?? null;
  }

  /**
   * 获取所有指定类型的纹理
   *
   * @param type - 纹理类型
   * @returns 纹理引用数组
   */
  getTexturesByType(type: TextureType): TextureReference[] {
    return this.textures.filter((tex) => tex.type === type);
  }

  /**
   * 获取浮点参数值
   *
   * @param name - 参数名称
   * @param defaultValue - 默认值，当参数不存在时返回
   * @returns 参数值
   */
  getFloatParam(name: string, defaultValue: number = 0): number {
    return this.floatParams.get(name) ?? defaultValue;
  }

  /**
   * 检查是否存在指定的浮点参数
   *
   * @param name - 参数名称
   * @returns 是否存在
   */
  hasFloatParam(name: string): boolean {
    return this.floatParams.has(name);
  }

  /**
   * 获取颜色参数值
   *
   * @param name - 参数名称
   * @param defaultValue - 默认值，当参数不存在时返回
   * @returns 参数值（Vector4 格式）
   */
  getColorParam(name: string, defaultValue?: THREE.Vector4): THREE.Vector4 {
    const value = this.colorParams.get(name);
    if (value) {
      return value.clone();
    }
    return defaultValue?.clone() ?? new THREE.Vector4(1, 1, 1, 1);
  }

  /**
   * 检查是否存在指定的颜色参数
   *
   * @param name - 参数名称
   * @returns 是否存在
   */
  hasColorParam(name: string): boolean {
    return this.colorParams.has(name);
  }

  /**
   * 获取指定 shader 的字符串参数值
   *
   * @param shaderIndex - shader 索引
   * @param paramName - 参数名称
   * @returns 参数值，如果不存在则返回 null
   */
  getShaderValue(shaderIndex: number, paramName: string): string | null {
    if (shaderIndex < 0 || shaderIndex >= this.shaders.length) {
      return null;
    }
    const shader = this.shaders[shaderIndex];
    const value = shader.values.find((v) => v.name === paramName);
    return value?.value ?? null;
  }

  /**
   * 检查指定 shader 是否启用了某个功能
   *
   * @param shaderIndex - shader 索引
   * @param paramName - 参数名称
   * @returns 是否启用（值为 "True"）
   */
  isShaderFeatureEnabled(shaderIndex: number, paramName: string): boolean {
    const value = this.getShaderValue(shaderIndex, paramName);
    return value?.toLowerCase() === 'true';
  }

  /**
   * 在所有 shader 中查找参数值
   *
   * @param paramName - 参数名称
   * @returns 参数值，如果不存在则返回 null
   */
  findShaderValue(paramName: string): string | null {
    for (const shader of this.shaders) {
      const value = shader.values.find((v) => v.name === paramName);
      if (value) {
        return value.value;
      }
    }
    return null;
  }

  /**
   * 检查任意 shader 是否启用了某个功能
   *
   * @param paramName - 参数名称
   * @returns 是否启用（值为 "True"）
   */
  isAnyShaderFeatureEnabled(paramName: string): boolean {
    const value = this.findShaderValue(paramName);
    return value?.toLowerCase() === 'true';
  }

  /**
   * 获取颜色参数作为 THREE.Color
   *
   * @param name - 参数名称
   * @param defaultValue - 默认值
   * @returns THREE.Color 对象
   */
  getColorParamAsColor(name: string, defaultValue?: THREE.Color): THREE.Color {
    const vec4 = this.colorParams.get(name);
    if (vec4) {
      return new THREE.Color(vec4.x, vec4.y, vec4.z);
    }
    return defaultValue?.clone() ?? new THREE.Color(1, 1, 1);
  }

  /**
   * 获取指定槽位的采样器数据
   *
   * @param slot - 采样器槽位
   * @returns 采样器数据，如果不存在则返回默认值
   */
  getSampler(slot: number): SamplerData {
    if (slot >= 0 && slot < this.samplers.length) {
      return this.samplers[slot];
    }
    // 返回默认采样器配置
    return {
      wrapU: 'repeat',
      wrapV: 'repeat',
    };
  }

  /**
   * 将 UV 包裹模式转换为 Three.js 包裹模式
   *
   * @param mode - UV 包裹模式
   * @returns Three.js 包裹模式常量
   */
  static uvWrapModeToThree(mode: UVWrapMode): THREE.Wrapping {
    switch (mode) {
      case 'repeat':
        return THREE.RepeatWrapping;
      case 'clamp':
        return THREE.RepeatWrapping; //特殊处理为RepeatWrapping
      case 'mirror':
        return THREE.MirroredRepeatWrapping;
      default:
        return THREE.RepeatWrapping;
    }
  }

  /**
   * 克隆 MaterialData 实例
   *
   * @returns 新的 MaterialData 实例
   */
  clone(): MaterialData {
    // 深拷贝 shaders 数组
    const clonedShaders = this.shaders.map((shader) => ({
      name: shader.name,
      values: shader.values.map((v) => ({ ...v })),
    }));

    // 深拷贝纹理引用数组
    const clonedTextures = this.textures.map((tex) => ({ ...tex }));

    // 深拷贝浮点参数映射
    const clonedFloatParams = new Map<string, number>();
    this.floatParams.forEach((value, key) => {
      clonedFloatParams.set(key, value);
    });

    // 深拷贝颜色参数映射
    const clonedColorParams = new Map<string, THREE.Vector4>();
    this.colorParams.forEach((value, key) => {
      clonedColorParams.set(key, value.clone());
    });

    // 深拷贝采样器数组
    const clonedSamplers = this.samplers.map((sampler) => ({ ...sampler }));

    return new MaterialData(
      this.name,
      this.shaderName,
      clonedShaders,
      clonedTextures,
      clonedFloatParams,
      clonedColorParams,
      this.alphaType,
      clonedSamplers
    );
  }

  /**
   * 验证 MaterialData 的完整性
   *
   * @returns 验证结果，包含是否有效和错误信息
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查名称
    if (!this.name || this.name.trim() === '') {
      errors.push('Material name is required');
    }

    // 检查纹理引用的完整性
    for (let i = 0; i < this.textures.length; i++) {
      const tex = this.textures[i];
      if (!tex.name || tex.name.trim() === '') {
        errors.push(`Texture at index ${i} has no name`);
      }
      if (!tex.filename || tex.filename.trim() === '') {
        errors.push(`Texture "${tex.name}" at index ${i} has no filename`);
      }
      if (tex.slot < 0) {
        errors.push(`Texture "${tex.name}" has invalid slot: ${tex.slot}`);
      }
    }

    // 检查采样器槽位是否与纹理对应
    const maxTextureSlot = Math.max(...this.textures.map((t) => t.slot), -1);
    if (maxTextureSlot >= 0 && this.samplers.length === 0) {
      // 这只是警告，不是错误
      // 因为可以使用默认采样器
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取材质的调试信息字符串
   *
   * @returns 调试信息字符串
   */
  toString(): string {
    const lines: string[] = [
      `MaterialData: ${this.name}`,
      `  Shader: ${this.shaderName ?? 'null'}`,
      `  Alpha Type: ${this.alphaType ?? 'null'}`,
      `  Textures (${this.textureCount}):`,
    ];

    for (const tex of this.textures) {
      lines.push(`    - [${tex.slot}] ${tex.name} (${tex.type}): ${tex.filename}`);
    }

    lines.push(`  Float Params (${this.floatParamCount}):`);
    this.floatParams.forEach((value, key) => {
      lines.push(`    - ${key}: ${value}`);
    });

    lines.push(`  Color Params (${this.colorParamCount}):`);
    this.colorParams.forEach((value, key) => {
      lines.push(
        `    - ${key}: (${value.x.toFixed(3)}, ${value.y.toFixed(3)}, ${value.z.toFixed(3)}, ${value.w.toFixed(3)})`
      );
    });

    lines.push(`  Samplers (${this.samplers.length}):`);
    this.samplers.forEach((sampler, index) => {
      lines.push(`    - [${index}] wrapU: ${sampler.wrapU}, wrapV: ${sampler.wrapV}`);
    });

    return lines.join('\n');
  }

  /**
   * 创建一个空的 MaterialData 实例
   *
   * @param name - 材质名称
   * @returns 空的 MaterialData 实例
   */
  static createEmpty(name: string): MaterialData {
    return new MaterialData(
      name,
      null,
      [],
      [],
      new Map<string, number>(),
      new Map<string, THREE.Vector4>(),
      null,
      []
    );
  }

  /**
   * 创建默认材质数据
   *
   * @param name - 材质名称
   * @returns 带有默认参数的 MaterialData 实例
   */
  static createDefault(name: string): MaterialData {
    const floatParams = new Map<string, number>();
    floatParams.set('Roughness', 0.5);
    floatParams.set('Metalness', 0.0);

    const colorParams = new Map<string, THREE.Vector4>();
    colorParams.set('BaseColor', new THREE.Vector4(1, 1, 1, 1));
    colorParams.set('EmissiveColor', new THREE.Vector4(0, 0, 0, 1));

    return new MaterialData(name, null, [], [], floatParams, colorParams, 'Opaque', []);
  }
}
