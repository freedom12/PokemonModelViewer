/**
 * MaterialFactory 单元测试
 * 
 * 测试材质工厂的策略模式注册机制、材质创建和默认材质功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as THREE from 'three'
import { MaterialFactory, MaterialCreator } from './MaterialFactory'
import { MaterialData } from '../core/data'

describe('MaterialFactory', () => {
  // 每个测试前清除所有注册
  beforeEach(() => {
    MaterialFactory.clearRegistrations()
  })

  afterEach(() => {
    MaterialFactory.clearRegistrations()
  })

  describe('register() 和 unregister()', () => {
    it('应该成功注册材质创建器', () => {
      const mockCreator: MaterialCreator = vi.fn(() => new THREE.MeshStandardMaterial())
      
      MaterialFactory.register('TestShader', mockCreator)
      
      expect(MaterialFactory.isRegistered('TestShader')).toBe(true)
      expect(MaterialFactory.getRegistrationCount()).toBe(1)
    })

    it('应该成功注销材质创建器', () => {
      const mockCreator: MaterialCreator = vi.fn(() => new THREE.MeshStandardMaterial())
      
      MaterialFactory.register('TestShader', mockCreator)
      expect(MaterialFactory.isRegistered('TestShader')).toBe(true)
      
      const result = MaterialFactory.unregister('TestShader')
      
      expect(result).toBe(true)
      expect(MaterialFactory.isRegistered('TestShader')).toBe(false)
    })

    it('注销不存在的创建器应返回 false', () => {
      const result = MaterialFactory.unregister('NonExistent')
      
      expect(result).toBe(false)
    })

    it('应该能覆盖已注册的创建器', () => {
      const mockCreator1: MaterialCreator = vi.fn(() => new THREE.MeshStandardMaterial({ color: 0xff0000 }))
      const mockCreator2: MaterialCreator = vi.fn(() => new THREE.MeshStandardMaterial({ color: 0x00ff00 }))
      
      MaterialFactory.register('TestShader', mockCreator1)
      MaterialFactory.register('TestShader', mockCreator2)
      
      expect(MaterialFactory.getRegistrationCount()).toBe(1)
    })

    it('不应该注册空的 shader 名称', () => {
      const mockCreator: MaterialCreator = vi.fn(() => new THREE.MeshStandardMaterial())
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      MaterialFactory.register('', mockCreator)
      MaterialFactory.register('   ', mockCreator)
      
      expect(MaterialFactory.getRegistrationCount()).toBe(0)
      consoleSpy.mockRestore()
    })
  })

  describe('getRegisteredShaders()', () => {
    it('应该返回所有已注册的 shader 名称', () => {
      const mockCreator: MaterialCreator = vi.fn(() => new THREE.MeshStandardMaterial())
      
      MaterialFactory.register('Shader1', mockCreator)
      MaterialFactory.register('Shader2', mockCreator)
      MaterialFactory.register('Shader3', mockCreator)
      
      const shaders = MaterialFactory.getRegisteredShaders()
      
      expect(shaders).toHaveLength(3)
      expect(shaders).toContain('Shader1')
      expect(shaders).toContain('Shader2')
      expect(shaders).toContain('Shader3')
    })

    it('没有注册时应返回空数组', () => {
      const shaders = MaterialFactory.getRegisteredShaders()
      
      expect(shaders).toHaveLength(0)
    })
  })

  describe('createDefault()', () => {
    it('应该创建默认的 MeshStandardMaterial', () => {
      const material = MaterialFactory.createDefault()
      
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial)
      expect(material.color.getHex()).toBe(0x808080) // 灰色
      expect(material.roughness).toBe(0.7)
      expect(material.metalness).toBe(0.0)
    })

    it('应该支持透明选项', () => {
      const material = MaterialFactory.createDefault({ transparent: true })
      
      expect(material.transparent).toBe(true)
    })

    it('应该支持双面渲染选项', () => {
      const materialDoubleSide = MaterialFactory.createDefault({ doubleSide: true })
      const materialFrontSide = MaterialFactory.createDefault({ doubleSide: false })
      
      expect(materialDoubleSide.side).toBe(THREE.DoubleSide)
      expect(materialFrontSide.side).toBe(THREE.FrontSide)
    })

    it('应该支持自发光颜色选项', () => {
      const emissiveColor = new THREE.Color(0xff0000)
      const material = MaterialFactory.createDefault({
        emissiveColor,
        emissiveIntensity: 0.5,
      })
      
      expect(material.emissive.getHex()).toBe(0xff0000)
      expect(material.emissiveIntensity).toBe(0.5)
    })

    it('默认应该是双面渲染', () => {
      const material = MaterialFactory.createDefault()
      
      expect(material.side).toBe(THREE.DoubleSide)
    })
  })

  describe('create()', () => {
    it('当 shader 类型已注册时应使用注册的创建器', async () => {
      const customMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 })
      const mockCreator: MaterialCreator = vi.fn(() => customMaterial)
      
      MaterialFactory.register('CustomShader', mockCreator)
      
      const materialData = new MaterialData(
        'test_material',
        'CustomShader',
        [],
        [],
        new Map(),
        new Map(),
        null,
        []
      )
      
      const material = await MaterialFactory.create(materialData, '/test/')
      
      expect(mockCreator).toHaveBeenCalled()
      expect(material).toBe(customMaterial)
      expect(material.name).toBe('test_material')
    })

    it('当 shader 类型未注册时应使用默认材质', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const materialData = new MaterialData(
        'test_material',
        'UnknownShader',
        [],
        [],
        new Map(),
        new Map(),
        null,
        []
      )
      
      const material = await MaterialFactory.create(materialData, '/test/')
      
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial)
      expect(material.name).toBe('test_material')
      
      consoleSpy.mockRestore()
    })

    it('当 shaderName 为 null 时应使用默认材质', async () => {
      const materialData = new MaterialData(
        'test_material',
        null,
        [],
        [],
        new Map(),
        new Map(),
        null,
        []
      )
      
      const material = await MaterialFactory.create(materialData, '/test/')
      
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial)
    })

    it('当创建器抛出错误时应回退到默认材质', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const mockCreator: MaterialCreator = vi.fn(() => {
        throw new Error('创建失败')
      })
      
      MaterialFactory.register('ErrorShader', mockCreator)
      
      const materialData = new MaterialData(
        'test_material',
        'ErrorShader',
        [],
        [],
        new Map(),
        new Map(),
        null,
        []
      )
      
      const material = await MaterialFactory.create(materialData, '/test/')
      
      expect(material).toBeInstanceOf(THREE.MeshStandardMaterial)
      
      consoleSpy.mockRestore()
    })
  })

  describe('createAll()', () => {
    it('应该为所有材质数据创建材质', async () => {
      const materialDatas = [
        new MaterialData('mat1', null, [], [], new Map(), new Map(), null, []),
        new MaterialData('mat2', null, [], [], new Map(), new Map(), null, []),
        new MaterialData('mat3', null, [], [], new Map(), new Map(), null, []),
      ]
      
      const materials = await MaterialFactory.createAll(materialDatas, '/test/')
      
      expect(materials).toHaveLength(3)
      expect(materials[0].name).toBe('mat1')
      expect(materials[1].name).toBe('mat2')
      expect(materials[2].name).toBe('mat3')
    })

    it('单个材质创建失败时应继续创建其他材质', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const mockCreator: MaterialCreator = vi.fn(() => {
        throw new Error('创建失败')
      })
      
      MaterialFactory.register('ErrorShader', mockCreator)
      
      const materialDatas = [
        new MaterialData('mat1', null, [], [], new Map(), new Map(), null, []),
        new MaterialData('mat2', 'ErrorShader', [], [], new Map(), new Map(), null, []),
        new MaterialData('mat3', null, [], [], new Map(), new Map(), null, []),
      ]
      
      const materials = await MaterialFactory.createAll(materialDatas, '/test/')
      
      expect(materials).toHaveLength(3)
      // 所有材质都应该被创建（失败的使用默认材质）
      materials.forEach(mat => {
        expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial)
      })
      
      consoleSpy.mockRestore()
    })
  })

  describe('dispose()', () => {
    it('应该释放 MeshStandardMaterial 的资源', () => {
      const material = new THREE.MeshStandardMaterial()
      const texture = new THREE.Texture()
      material.map = texture
      
      const disposeSpy = vi.spyOn(texture, 'dispose')
      const materialDisposeSpy = vi.spyOn(material, 'dispose')
      
      MaterialFactory.dispose(material)
      
      expect(disposeSpy).toHaveBeenCalled()
      expect(materialDisposeSpy).toHaveBeenCalled()
    })

    it('应该释放 userData 中的纹理', () => {
      const material = new THREE.MeshStandardMaterial()
      const customTexture = new THREE.Texture()
      material.userData.customMap = customTexture
      
      const disposeSpy = vi.spyOn(customTexture, 'dispose')
      
      MaterialFactory.dispose(material)
      
      expect(disposeSpy).toHaveBeenCalled()
    })

    it('应该释放 ShaderMaterial 的 uniforms 中的纹理', () => {
      const texture = new THREE.Texture()
      const material = new THREE.ShaderMaterial({
        uniforms: {
          testMap: { value: texture },
        },
      })
      
      const disposeSpy = vi.spyOn(texture, 'dispose')
      
      MaterialFactory.dispose(material)
      
      expect(disposeSpy).toHaveBeenCalled()
    })
  })

  describe('disposeAll()', () => {
    it('应该释放所有材质的资源', () => {
      const materials = [
        new THREE.MeshStandardMaterial(),
        new THREE.MeshStandardMaterial(),
        new THREE.MeshStandardMaterial(),
      ]
      
      const disposeSpies = materials.map(mat => vi.spyOn(mat, 'dispose'))
      
      MaterialFactory.disposeAll(materials)
      
      disposeSpies.forEach(spy => {
        expect(spy).toHaveBeenCalled()
      })
    })
  })

  describe('clearRegistrations()', () => {
    it('应该清除所有注册的创建器', () => {
      const mockCreator: MaterialCreator = vi.fn(() => new THREE.MeshStandardMaterial())
      
      MaterialFactory.register('Shader1', mockCreator)
      MaterialFactory.register('Shader2', mockCreator)
      
      expect(MaterialFactory.getRegistrationCount()).toBe(2)
      
      MaterialFactory.clearRegistrations()
      
      expect(MaterialFactory.getRegistrationCount()).toBe(0)
    })
  })

  describe('Property 11: 材质工厂策略正确性', () => {
    /**
     * **Validates: Requirements 4.3, 4.4**
     * 
     * 对于任意已注册的 shader 类型，MaterialFactory 应返回对应的具体材质；
     * 对于未注册的 shader 类型，应返回默认材质。
     */
    it('已注册的 shader 应使用注册的创建器', async () => {
      const customMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 })
      const mockCreator: MaterialCreator = vi.fn(() => customMaterial)
      
      MaterialFactory.register('RegisteredShader', mockCreator)
      
      const materialData = new MaterialData(
        'test',
        'RegisteredShader',
        [],
        [],
        new Map(),
        new Map(),
        null,
        []
      )
      
      const result = await MaterialFactory.create(materialData, '/test/')
      
      expect(mockCreator).toHaveBeenCalledTimes(1)
      expect(result).toBe(customMaterial)
    })

    it('未注册的 shader 应使用默认材质', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const materialData = new MaterialData(
        'test',
        'UnregisteredShader',
        [],
        [],
        new Map(),
        new Map(),
        null,
        []
      )
      
      const result = await MaterialFactory.create(materialData, '/test/')
      
      expect(result).toBeInstanceOf(THREE.MeshStandardMaterial)
      // 默认材质的颜色应该是灰色
      expect((result as THREE.MeshStandardMaterial).color.getHex()).toBe(0x808080)
      
      consoleSpy.mockRestore()
    })
  })
})
