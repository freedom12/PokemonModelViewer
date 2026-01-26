/**
 * 纹理加载器模块
 * 
 * 负责加载 PNG 纹理文件并创建 Three.js 材质
 * 
 * @module services/textureLoader
 */

import * as THREE from 'three'
import {
  type TRMTR,
  type Material as TRMTRMaterial
} from '../parsers'
import {
  getTextureType,
  mapToMaterialProperty,
  type TextureType,
  type MaterialPropertyName
} from '../utils/textureMapping'

/**
 * 纹理引用信息
 */
export interface TextureReference {
  /** 纹理类型 */
  type: TextureType
  /** 纹理文件名 */
  filename: string
  /** 纹理名称（着色器中的名称） */
  name: string
  /** 纹理槽位 */
  slot: number
}

/**
 * 材质创建选项
 */
export interface MaterialOptions {
  /** 是否启用透明 */
  transparent?: boolean
  /** 是否双面渲染 */
  doubleSide?: boolean
  /** 自发光颜色 */
  emissiveColor?: THREE.Color
  /** 自发光强度 */
  emissiveIntensity?: number
}

/**
 * 默认材质选项
 */
const DEFAULT_MATERIAL_OPTIONS: MaterialOptions = {
  transparent: false,
  doubleSide: true,
  emissiveColor: new THREE.Color(0xffffff),
  emissiveIntensity: 1.0
}

/**
 * Three.js 纹理加载器实例（单例）
 */
let textureLoaderInstance: THREE.TextureLoader | null = null

/**
 * 获取纹理加载器实例
 * 
 * @returns Three.js TextureLoader 实例
 */
function getTextureLoader(): THREE.TextureLoader {
  if (!textureLoaderInstance) {
    textureLoaderInstance = new THREE.TextureLoader()
  }
  return textureLoaderInstance
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
  const loader = getTextureLoader()
  
  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (texture) => {
        // 设置纹理参数
        texture.colorSpace = THREE.SRGBColorSpace
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
        texture.minFilter = THREE.LinearMipmapLinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.generateMipmaps = true
        
        resolve(texture)
      },
      undefined, // onProgress 回调（不使用）
      (error) => {
        reject(new Error(`Failed to load texture: ${path} - ${error}`))
      }
    )
  })
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
  basePath: string
): Promise<Map<string, THREE.Texture>> {
  const textureMap = new Map<string, THREE.Texture>()
  
  // 并行加载所有纹理
  const loadPromises = textures.map(async (textureRef) => {
    const fullPath = `${basePath}${textureRef.filename}`
    
    try {
      const texture = await loadTexture(fullPath)
      
      // 对于法线贴图，使用线性颜色空间
      if (textureRef.type === 'normal') {
        texture.colorSpace = THREE.LinearSRGBColorSpace
      }
      
      return { name: textureRef.filename, texture }
    } catch (error) {
      console.warn(`Failed to load texture ${textureRef.filename}:`, error)
      return null
    }
  })
  
  const results = await Promise.all(loadPromises)
  
  // 将成功加载的纹理添加到映射表
  for (const result of results) {
    if (result) {
      textureMap.set(result.name, result.texture)
    }
  }
  
  return textureMap
}

/**
 * 从 TRMTR Material 数据提取纹理引用
 * 
 * @param material - TRMTR 材质数据
 * @returns 纹理引用数组
 */
export function extractTextureReferences(material: TRMTRMaterial): TextureReference[] {
  const references: TextureReference[] = []
  
  const texturesCount = material.texturesLength()
  
  for (let i = 0; i < texturesCount; i++) {
    const texture = material.textures(i)
    if (!texture) continue
    
    const textureFile = texture.textureFile()
    if (!textureFile) continue
    
    const textureName = texture.textureName() || ''
    const textureSlot = texture.textureSlot()
    
    // 根据文件名确定纹理类型
    const textureType = getTextureType(textureFile)
    
    references.push({
      type: textureType,
      filename: textureFile,
      name: textureName,
      slot: textureSlot
    })
  }
  
  return references
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
  options: MaterialOptions = {}
): THREE.MeshStandardMaterial {
  const mergedOptions = { ...DEFAULT_MATERIAL_OPTIONS, ...options }
  
  const material = new THREE.MeshStandardMaterial({
    color: 0x808080, // 灰色
    roughness: 0.7,
    metalness: 0.0,
    side: mergedOptions.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    transparent: mergedOptions.transparent
  })
  
  return material
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
  options: MaterialOptions = {}
): Promise<THREE.MeshStandardMaterial> {
  const mergedOptions = { ...DEFAULT_MATERIAL_OPTIONS, ...options }
  
  // 提取纹理引用
  const textureRefs = extractTextureReferences(material)
  
  // 如果没有纹理引用，返回默认材质
  if (textureRefs.length === 0) {
    console.warn(`Material "${material.name()}" has no textures, using default material`)
    return createDefaultMaterial(mergedOptions)
  }
  
  // 加载所有纹理
  const textureMap = await loadTextures(textureRefs, basePath)
  
  // 如果所有纹理都加载失败，返回默认材质
  if (textureMap.size === 0) {
    console.warn(`All textures failed to load for material "${material.name()}", using default material`)
    return createDefaultMaterial(mergedOptions)
  }
  
  // 创建材质
  const threeMaterial = new THREE.MeshStandardMaterial({
    roughness: 0.7,
    metalness: 0.0,
    side: mergedOptions.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    transparent: mergedOptions.transparent
  })
  
  // 应用纹理到材质
  let hasAlbedo = false
  
  for (const textureRef of textureRefs) {
    const texture = textureMap.get(textureRef.filename)
    if (!texture) continue
    
    const propertyName = mapToMaterialProperty(textureRef.type)
    if (!propertyName) continue
    
    // 根据属性名设置纹理
    applyTextureToMaterial(threeMaterial, propertyName, texture, mergedOptions)
    
    if (textureRef.type === 'albedo') {
      hasAlbedo = true
    }
  }
  
  // 如果没有漫反射贴图，设置默认颜色
  if (!hasAlbedo) {
    threeMaterial.color.setHex(0xffffff)
  }
  
  // 设置材质名称
  const materialName = material.name()
  if (materialName) {
    threeMaterial.name = materialName
  }
  
  // 检查是否需要透明
  const alphaType = material.alphaType()
  if (alphaType && alphaType !== 'Opaque') {
    threeMaterial.transparent = true
    threeMaterial.alphaTest = 0.5
  }
  
  return threeMaterial
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
  options: MaterialOptions
): void {
  switch (propertyName) {
    case 'map':
      material.map = texture
      break
      
    case 'normalMap':
      material.normalMap = texture
      material.normalScale.set(1, 1)
      break
      
    case 'emissiveMap':
      material.emissiveMap = texture
      material.emissive = options.emissiveColor || new THREE.Color(0xffffff)
      material.emissiveIntensity = options.emissiveIntensity || 1.0
      break
      
    case 'aoMap':
      material.aoMap = texture
      material.aoMapIntensity = 1.0
      break
      
    case 'alphaMap':
      material.alphaMap = texture
      material.transparent = true
      break
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
  options: MaterialOptions = {}
): Promise<THREE.MeshStandardMaterial[]> {
  const materials: THREE.MeshStandardMaterial[] = []
  
  const materialsCount = trmtr.materialsLength()
  
  for (let i = 0; i < materialsCount; i++) {
    const material = trmtr.materials(i)
    if (!material) {
      // 如果材质数据不存在，添加默认材质
      materials.push(createDefaultMaterial(options))
      continue
    }
    
    try {
      const threeMaterial = await createMaterial(material, basePath, options)
      materials.push(threeMaterial)
    } catch (error) {
      console.warn(`Failed to create material at index ${i}:`, error)
      materials.push(createDefaultMaterial(options))
    }
  }
  
  return materials
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
  materialName: string
): TRMTRMaterial | null {
  const materialsCount = trmtr.materialsLength()
  
  for (let i = 0; i < materialsCount; i++) {
    const material = trmtr.materials(i)
    if (material && material.name() === materialName) {
      return material
    }
  }
  
  return null
}

/**
 * 释放材质资源
 * 
 * 释放材质及其关联的纹理资源
 * 
 * @param material - 要释放的材质
 */
export function disposeMaterial(material: THREE.MeshStandardMaterial): void {
  // 释放所有纹理
  if (material.map) {
    material.map.dispose()
  }
  if (material.normalMap) {
    material.normalMap.dispose()
  }
  if (material.emissiveMap) {
    material.emissiveMap.dispose()
  }
  if (material.aoMap) {
    material.aoMap.dispose()
  }
  if (material.alphaMap) {
    material.alphaMap.dispose()
  }
  
  // 释放材质
  material.dispose()
}

/**
 * 释放多个材质资源
 * 
 * @param materials - 要释放的材质数组
 */
export function disposeAllMaterials(materials: THREE.MeshStandardMaterial[]): void {
  for (const material of materials) {
    disposeMaterial(material)
  }
}
