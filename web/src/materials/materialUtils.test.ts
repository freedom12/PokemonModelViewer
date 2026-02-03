/**
 * 材质参数工具函数单元测试
 * 
 * 测试材质参数读取和 UV 变换应用功能
 * 
 * @validates 需求 4.10: 提供材质参数读取工具函数
 * @validates 需求 4.11: 支持 UV 缩放和偏移参数
 */

import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { MaterialData } from '../core/data'
import {
  getFloatParameter,
  getColorParameter,
  applyUVScaleOffset,
  getUVScaleOffset,
  applyUVScaleOffsetToAll,
  getColorParameterAsColor,
  getTextureByName,
  getTextureByType,
  setupTextureWithUV,
} from './materialUtils'

/**
 * 创建测试用的 MaterialData
 */
function createTestMaterialData(
  floatParams: Map<string, number> = new Map(),
  colorParams: Map<string, THREE.Vector4> = new Map(),
  textures: Array<{
    name: string;
    filename: string;
    slot: number;
    type: 'albedo' | 'normal' | 'emission' | 'roughness' | 'metalness' | 'ao' | 'mask' | 'region' | 'unknown';
  }> = []
): MaterialData {
  return new MaterialData(
    'test_material',
    'TestShader',
    [],
    textures,
    floatParams,
    colorParams,
    null,
    []
  )
}

describe('materialUtils', () => {
  describe('getFloatParameter()', () => {
    it('应该返回存在的浮点参数值', () => {
      const floatParams = new Map<string, number>()
      floatParams.set('Roughness', 0.7)
      floatParams.set('Metallic', 0.3)
      
      const data = createTestMaterialData(floatParams)
      
      expect(getFloatParameter(data, 'Roughness', 0.5)).toBe(0.7)
      expect(getFloatParameter(data, 'Metallic', 0.0)).toBe(0.3)
    })

    it('应该返回默认值当参数不存在时', () => {
      const data = createTestMaterialData()
      
      expect(getFloatParameter(data, 'NonExistent', 0.5)).toBe(0.5)
      expect(getFloatParameter(data, 'AnotherNonExistent', 1.0)).toBe(1.0)
    })

    it('应该正确处理零值参数', () => {
      const floatParams = new Map<string, number>()
      floatParams.set('ZeroValue', 0)
      
      const data = createTestMaterialData(floatParams)
      
      expect(getFloatParameter(data, 'ZeroValue', 1.0)).toBe(0)
    })

    it('应该正确处理负值参数', () => {
      const floatParams = new Map<string, number>()
      floatParams.set('NegativeValue', -0.5)
      
      const data = createTestMaterialData(floatParams)
      
      expect(getFloatParameter(data, 'NegativeValue', 0.0)).toBe(-0.5)
    })
  })

  describe('getColorParameter()', () => {
    it('应该返回存在的颜色参数值', () => {
      const colorParams = new Map<string, THREE.Vector4>()
      colorParams.set('BaseColor', new THREE.Vector4(1.0, 0.5, 0.25, 1.0))
      
      const data = createTestMaterialData(new Map(), colorParams)
      const defaultValue = new THREE.Vector4(0, 0, 0, 1)
      
      const result = getColorParameter(data, 'BaseColor', defaultValue)
      
      expect(result.x).toBe(1.0)
      expect(result.y).toBe(0.5)
      expect(result.z).toBe(0.25)
      expect(result.w).toBe(1.0)
    })

    it('应该返回默认值当参数不存在时', () => {
      const data = createTestMaterialData()
      const defaultValue = new THREE.Vector4(0.5, 0.5, 0.5, 1.0)
      
      const result = getColorParameter(data, 'NonExistent', defaultValue)
      
      expect(result.x).toBe(0.5)
      expect(result.y).toBe(0.5)
      expect(result.z).toBe(0.5)
      expect(result.w).toBe(1.0)
    })

    it('应该返回新的 Vector4 实例（不影响原始数据）', () => {
      const colorParams = new Map<string, THREE.Vector4>()
      const originalColor = new THREE.Vector4(1.0, 0.5, 0.25, 1.0)
      colorParams.set('BaseColor', originalColor)
      
      const data = createTestMaterialData(new Map(), colorParams)
      const defaultValue = new THREE.Vector4(0, 0, 0, 1)
      
      const result = getColorParameter(data, 'BaseColor', defaultValue)
      
      // 修改返回值不应影响原始数据
      result.x = 0
      expect(originalColor.x).toBe(1.0)
    })
  })

  describe('applyUVScaleOffset()', () => {
    it('应该正确应用 UV 缩放和偏移', () => {
      const texture = new THREE.Texture()
      const scaleOffset = new THREE.Vector4(2.0, 3.0, 0.5, 0.25)
      
      applyUVScaleOffset(texture, scaleOffset)
      
      // 检查缩放（repeat）
      expect(texture.repeat.x).toBe(2.0)
      expect(texture.repeat.y).toBe(3.0)
      
      // 检查偏移（offset）
      expect(texture.offset.x).toBe(0.5)
      expect(texture.offset.y).toBe(0.25)
    })

    it('应该正确处理默认值（无缩放无偏移）', () => {
      const texture = new THREE.Texture()
      const scaleOffset = new THREE.Vector4(1.0, 1.0, 0.0, 0.0)
      
      applyUVScaleOffset(texture, scaleOffset)
      
      expect(texture.repeat.x).toBe(1.0)
      expect(texture.repeat.y).toBe(1.0)
      expect(texture.offset.x).toBe(0.0)
      expect(texture.offset.y).toBe(0.0)
    })

    it('应该正确处理负值偏移', () => {
      const texture = new THREE.Texture()
      const scaleOffset = new THREE.Vector4(1.0, 1.0, -0.5, -0.25)
      
      applyUVScaleOffset(texture, scaleOffset)
      
      expect(texture.offset.x).toBe(-0.5)
      expect(texture.offset.y).toBe(-0.25)
    })

    /**
     * **Validates: Requirements 4.11**
     * 
     * Property 13: UV变换应用正确性
     * 对于任意 UV 缩放和偏移参数，应用到纹理后，
     * 纹理的 repeat 和 offset 属性应与参数值一致。
     */
    it('Property 13: UV 变换应用正确性', () => {
      const testCases = [
        new THREE.Vector4(1.0, 1.0, 0.0, 0.0),
        new THREE.Vector4(2.0, 2.0, 0.0, 0.0),
        new THREE.Vector4(0.5, 0.5, 0.5, 0.5),
        new THREE.Vector4(1.0, 2.0, 0.25, 0.75),
        new THREE.Vector4(3.0, 0.5, -0.1, 0.3),
      ]

      for (const scaleOffset of testCases) {
        const texture = new THREE.Texture()
        applyUVScaleOffset(texture, scaleOffset)

        expect(texture.repeat.x).toBe(scaleOffset.x)
        expect(texture.repeat.y).toBe(scaleOffset.y)
        expect(texture.offset.x).toBe(scaleOffset.z)
        expect(texture.offset.y).toBe(scaleOffset.w)
      }
    })
  })

  describe('getUVScaleOffset()', () => {
    it('应该返回存在的 UVScaleOffset 参数', () => {
      const colorParams = new Map<string, THREE.Vector4>()
      colorParams.set('UVScaleOffset', new THREE.Vector4(2.0, 3.0, 0.1, 0.2))
      
      const data = createTestMaterialData(new Map(), colorParams)
      
      const result = getUVScaleOffset(data)
      
      expect(result.x).toBe(2.0)
      expect(result.y).toBe(3.0)
      expect(result.z).toBe(0.1)
      expect(result.w).toBe(0.2)
    })

    it('应该返回默认值当参数不存在时', () => {
      const data = createTestMaterialData()
      
      const result = getUVScaleOffset(data)
      
      expect(result.x).toBe(1.0)
      expect(result.y).toBe(1.0)
      expect(result.z).toBe(0.0)
      expect(result.w).toBe(0.0)
    })

    it('应该支持自定义参数名称', () => {
      const colorParams = new Map<string, THREE.Vector4>()
      colorParams.set('CustomUVParam', new THREE.Vector4(4.0, 5.0, 0.3, 0.4))
      
      const data = createTestMaterialData(new Map(), colorParams)
      
      const result = getUVScaleOffset(data, 'CustomUVParam')
      
      expect(result.x).toBe(4.0)
      expect(result.y).toBe(5.0)
      expect(result.z).toBe(0.3)
      expect(result.w).toBe(0.4)
    })
  })

  describe('applyUVScaleOffsetToAll()', () => {
    it('应该批量应用 UV 变换到多个纹理', () => {
      const textures = [
        new THREE.Texture(),
        new THREE.Texture(),
        new THREE.Texture(),
      ]
      const scaleOffset = new THREE.Vector4(2.0, 2.0, 0.5, 0.5)
      
      applyUVScaleOffsetToAll(textures, scaleOffset)
      
      for (const texture of textures) {
        expect(texture.repeat.x).toBe(2.0)
        expect(texture.repeat.y).toBe(2.0)
        expect(texture.offset.x).toBe(0.5)
        expect(texture.offset.y).toBe(0.5)
      }
    })

    it('应该跳过 null 和 undefined 纹理', () => {
      const texture1 = new THREE.Texture()
      const texture2 = new THREE.Texture()
      const textures: (THREE.Texture | null | undefined)[] = [
        texture1,
        null,
        texture2,
        undefined,
      ]
      const scaleOffset = new THREE.Vector4(2.0, 2.0, 0.5, 0.5)
      
      // 不应该抛出错误
      expect(() => applyUVScaleOffsetToAll(textures, scaleOffset)).not.toThrow()
      
      // 有效纹理应该被正确设置
      expect(texture1.repeat.x).toBe(2.0)
      expect(texture2.repeat.x).toBe(2.0)
    })
  })

  describe('getColorParameterAsColor()', () => {
    it('应该将颜色参数转换为 THREE.Color', () => {
      const colorParams = new Map<string, THREE.Vector4>()
      colorParams.set('EmissiveColor', new THREE.Vector4(1.0, 0.5, 0.25, 1.0))
      
      const data = createTestMaterialData(new Map(), colorParams)
      const defaultValue = new THREE.Color(0, 0, 0)
      
      const result = getColorParameterAsColor(data, 'EmissiveColor', defaultValue)
      
      expect(result.r).toBe(1.0)
      expect(result.g).toBe(0.5)
      expect(result.b).toBe(0.25)
    })

    it('应该返回默认值当参数不存在时', () => {
      const data = createTestMaterialData()
      const defaultValue = new THREE.Color(0.5, 0.5, 0.5)
      
      const result = getColorParameterAsColor(data, 'NonExistent', defaultValue)
      
      expect(result.r).toBe(0.5)
      expect(result.g).toBe(0.5)
      expect(result.b).toBe(0.5)
    })
  })

  describe('getTextureByName()', () => {
    it('应该根据名称获取纹理', () => {
      const textures = [
        { name: 'BaseColorMap', filename: 'base.png', slot: 0, type: 'albedo' as const },
        { name: 'NormalMap', filename: 'normal.png', slot: 1, type: 'normal' as const },
      ]
      const data = createTestMaterialData(new Map(), new Map(), textures)
      
      const textureMap = new Map<string, THREE.Texture>()
      const baseTexture = new THREE.Texture()
      const normalTexture = new THREE.Texture()
      textureMap.set('base.png', baseTexture)
      textureMap.set('normal.png', normalTexture)
      
      const result = getTextureByName(data, textureMap, 'BaseColorMap')
      
      expect(result).toBe(baseTexture)
    })

    it('应该返回 null 当纹理名称不存在时', () => {
      const data = createTestMaterialData()
      const textureMap = new Map<string, THREE.Texture>()
      
      const result = getTextureByName(data, textureMap, 'NonExistent')
      
      expect(result).toBeNull()
    })

    it('应该返回 null 当纹理文件未加载时', () => {
      const textures = [
        { name: 'BaseColorMap', filename: 'base.png', slot: 0, type: 'albedo' as const },
      ]
      const data = createTestMaterialData(new Map(), new Map(), textures)
      
      const textureMap = new Map<string, THREE.Texture>() // 空的纹理映射
      
      const result = getTextureByName(data, textureMap, 'BaseColorMap')
      
      expect(result).toBeNull()
    })
  })

  describe('getTextureByType()', () => {
    it('应该根据类型获取纹理', () => {
      const textures = [
        { name: 'BaseColorMap', filename: 'base.png', slot: 0, type: 'albedo' as const },
        { name: 'NormalMap', filename: 'normal.png', slot: 1, type: 'normal' as const },
      ]
      const data = createTestMaterialData(new Map(), new Map(), textures)
      
      const textureMap = new Map<string, THREE.Texture>()
      const baseTexture = new THREE.Texture()
      const normalTexture = new THREE.Texture()
      textureMap.set('base.png', baseTexture)
      textureMap.set('normal.png', normalTexture)
      
      expect(getTextureByType(data, textureMap, 'albedo')).toBe(baseTexture)
      expect(getTextureByType(data, textureMap, 'normal')).toBe(normalTexture)
    })

    it('应该返回 null 当纹理类型不存在时', () => {
      const data = createTestMaterialData()
      const textureMap = new Map<string, THREE.Texture>()
      
      const result = getTextureByType(data, textureMap, 'emission')
      
      expect(result).toBeNull()
    })
  })

  describe('setupTextureWithUV()', () => {
    it('应该设置纹理的 UV 变换并返回纹理', () => {
      const texture = new THREE.Texture()
      const scaleOffset = new THREE.Vector4(2.0, 3.0, 0.1, 0.2)
      
      const result = setupTextureWithUV(texture, scaleOffset)
      
      expect(result).toBe(texture)
      expect(texture.repeat.x).toBe(2.0)
      expect(texture.repeat.y).toBe(3.0)
      expect(texture.offset.x).toBe(0.1)
      expect(texture.offset.y).toBe(0.2)
    })

    it('应该返回 null 当输入为 null 时', () => {
      const scaleOffset = new THREE.Vector4(2.0, 3.0, 0.1, 0.2)
      
      const result = setupTextureWithUV(null, scaleOffset)
      
      expect(result).toBeNull()
    })
  })

  describe('Property 12: 材质参数读取正确性', () => {
    /**
     * **Validates: Requirements 4.10**
     * 
     * 对于任意 MaterialData 中存储的浮点参数和颜色参数，
     * 读取工具函数应返回正确的值；对于不存在的参数应返回默认值。
     */
    it('应该正确读取存在的浮点参数', () => {
      const floatParams = new Map<string, number>()
      floatParams.set('Roughness', 0.7)
      floatParams.set('Metallic', 0.3)
      floatParams.set('EmissionIntensity', 1.5)
      
      const data = createTestMaterialData(floatParams)
      
      expect(getFloatParameter(data, 'Roughness', 0.0)).toBe(0.7)
      expect(getFloatParameter(data, 'Metallic', 0.0)).toBe(0.3)
      expect(getFloatParameter(data, 'EmissionIntensity', 0.0)).toBe(1.5)
    })

    it('应该正确读取存在的颜色参数', () => {
      const colorParams = new Map<string, THREE.Vector4>()
      colorParams.set('BaseColor', new THREE.Vector4(1.0, 0.5, 0.25, 1.0))
      colorParams.set('EmissiveColor', new THREE.Vector4(0.0, 1.0, 0.0, 1.0))
      
      const data = createTestMaterialData(new Map(), colorParams)
      const defaultValue = new THREE.Vector4(0, 0, 0, 1)
      
      const baseColor = getColorParameter(data, 'BaseColor', defaultValue)
      expect(baseColor.x).toBe(1.0)
      expect(baseColor.y).toBe(0.5)
      expect(baseColor.z).toBe(0.25)
      
      const emissiveColor = getColorParameter(data, 'EmissiveColor', defaultValue)
      expect(emissiveColor.x).toBe(0.0)
      expect(emissiveColor.y).toBe(1.0)
      expect(emissiveColor.z).toBe(0.0)
    })

    it('应该为不存在的参数返回默认值', () => {
      const data = createTestMaterialData()
      
      // 浮点参数默认值
      expect(getFloatParameter(data, 'NonExistent', 0.5)).toBe(0.5)
      expect(getFloatParameter(data, 'AnotherNonExistent', 1.0)).toBe(1.0)
      
      // 颜色参数默认值
      const defaultColor = new THREE.Vector4(0.5, 0.5, 0.5, 1.0)
      const result = getColorParameter(data, 'NonExistent', defaultColor)
      expect(result.x).toBe(0.5)
      expect(result.y).toBe(0.5)
      expect(result.z).toBe(0.5)
      expect(result.w).toBe(1.0)
    })
  })
})
