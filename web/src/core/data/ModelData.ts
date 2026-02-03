/**
 * ModelData 类
 * 
 * 存储解析后的模型数据（网格、材质引用、骨骼引用），
 * 用于将原始FlatBuffers数据转换为通用格式。
 * 
 * @module core/data/ModelData
 */

import * as THREE from 'three'
import {
  type TRMDL,
  type TRMSH,
  type TRMBF,
  type TRMTR,
  type TRSKL,
  type MeshShape,
  type Buffer as TRMBFBuffer,
  VertexAttribute,
  UVWrapMode as FBUVWrapMode,
} from '../../parsers'
import {
  parseVertexAttribute,
  parseIndices,
  extractUV2Components,
  getVertexTypeInfo,
  getIndexByteSize,
} from './vertexUtils'
import { getTextureType, getTextureTypeFromName } from '../../utils/textureMapping'
import { IModelData, MeshGroup, TextureReference, TextureType, SamplerData, UVWrapMode, BoneData } from './types'
import { MeshData } from './MeshData'
import { MaterialData } from './MaterialData'
import { SkeletonData } from './SkeletonData'

/**
 * ModelData 类实现
 * 
 * 用于存储解析后的模型数据，包括网格、材质和骨骼数据。
 * 提供从 FlatBuffers 格式转换的静态工厂方法。
 * 
 * @implements {IModelData}
 * 
 * @example
 * ```typescript
 * // 从 FlatBuffers 数据创建 ModelData
 * const modelData = ModelData.fromFlatBuffers(
 *   trmdl,
 *   trmsh,
 *   trmbf,
 *   trmtr,
 *   trskl
 * );
 * 
 * // 访问网格数据
 * for (const mesh of modelData.meshes) {
 *   const geometry = mesh.toBufferGeometry();
 * }
 * ```
 */
export class ModelData implements IModelData {
  /**
   * 创建 ModelData 实例
   * 
   * @param name - 模型名称
   * @param meshes - 网格数据数组
   * @param materials - 材质数据数组
   * @param skeleton - 骨骼数据，可为 null
   */
  constructor(
    public readonly name: string,
    public readonly meshes: MeshData[],
    public readonly materials: MaterialData[],
    public readonly skeleton: SkeletonData | null
  ) {}

  /**
   * 获取网格数量
   */
  get meshCount(): number {
    return this.meshes.length
  }

  /**
   * 获取材质数量
   */
  get materialCount(): number {
    return this.materials.length
  }

  /**
   * 检查是否有骨骼数据
   */
  get hasSkeleton(): boolean {
    return this.skeleton !== null
  }

  /**
   * 获取总顶点数量
   */
  get totalVertexCount(): number {
    return this.meshes.reduce((sum, mesh) => sum + mesh.vertexCount, 0)
  }

  /**
   * 获取总三角形数量
   */
  get totalTriangleCount(): number {
    return this.meshes.reduce((sum, mesh) => sum + mesh.triangleCount, 0)
  }

  /**
   * 根据名称获取网格数据
   * 
   * @param name - 网格名称
   * @returns 网格数据，如果不存在则返回 null
   */
  getMeshByName(name: string): MeshData | null {
    return this.meshes.find(mesh => mesh.name === name) ?? null
  }

  /**
   * 根据索引获取网格数据
   * 
   * @param index - 网格索引
   * @returns 网格数据，如果索引越界则返回 null
   */
  getMeshByIndex(index: number): MeshData | null {
    if (index < 0 || index >= this.meshes.length) {
      return null
    }
    return this.meshes[index]
  }

  /**
   * 根据名称获取材质数据
   * 
   * @param name - 材质名称
   * @returns 材质数据，如果不存在则返回 null
   */
  getMaterialByName(name: string): MaterialData | null {
    return this.materials.find(mat => mat.name === name) ?? null
  }

  /**
   * 根据索引获取材质数据
   * 
   * @param index - 材质索引
   * @returns 材质数据，如果索引越界则返回 null
   */
  getMaterialByIndex(index: number): MaterialData | null {
    if (index < 0 || index >= this.materials.length) {
      return null
    }
    return this.materials[index]
  }

  /**
   * 验证 ModelData 的完整性
   * 
   * @returns 验证结果，包含是否有效和错误信息
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // 检查名称
    if (!this.name || this.name.trim() === '') {
      errors.push('Model name is required')
    }

    // 检查网格数据
    if (this.meshes.length === 0) {
      errors.push('Model must have at least one mesh')
    }

    // 验证每个网格
    for (let i = 0; i < this.meshes.length; i++) {
      const meshValidation = this.meshes[i].validate()
      if (!meshValidation.valid) {
        errors.push(`Mesh ${i} (${this.meshes[i].name}): ${meshValidation.errors.join(', ')}`)
      }
    }

    // 验证每个材质
    for (let i = 0; i < this.materials.length; i++) {
      const matValidation = this.materials[i].validate()
      if (!matValidation.valid) {
        errors.push(`Material ${i} (${this.materials[i].name}): ${matValidation.errors.join(', ')}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 从 FlatBuffers 数据创建 ModelData
   * 
   * 整合 TRMDL、TRMSH、TRMBF、TRMTR、TRSKL 解析，
   * 将原始 FlatBuffers 数据转换为通用的 ModelData 格式。
   * 
   * @param trmdl - TRMDL 模型定义数据
   * @param trmsh - TRMSH 网格数据
   * @param trmbf - TRMBF 缓冲区数据
   * @param trmtr - TRMTR 材质属性数据（可选）
   * @param trskl - TRSKL 骨骼数据（可选）
   * @returns ModelData 实例
   * 
   * @example
   * ```typescript
   * const modelData = ModelData.fromFlatBuffers(
   *   parsedTRMDL,
   *   parsedTRMSH,
   *   parsedTRMBF,
   *   parsedTRMTR,
   *   parsedTRSKL
   * );
   * ```
   */
  static fromFlatBuffers(
    trmdl: TRMDL,
    trmsh: TRMSH,
    trmbf: TRMBF,
    trmtr?: TRMTR,
    trskl?: TRSKL
  ): ModelData {
    // 获取模型名称（从第一个网格引用）
    let modelName = 'unnamed_model'
    if (trmdl.meshesLength() > 0) {
      const firstMesh = trmdl.meshes(0)
      if (firstMesh) {
        const filename = firstMesh.filename()
        if (filename) {
          // 从文件名提取模型名称（去掉扩展名）
          modelName = filename.replace(/\.[^/.]+$/, '')
        }
      }
    }

    // 解析网格数据
    const meshes = ModelData.parseMeshes(trmsh, trmbf)

    // 解析材质数据
    const materials = trmtr ? ModelData.parseMaterials(trmtr) : []

    // 解析骨骼数据
    const skeleton = trskl ? ModelData.parseSkeleton(trskl) : null

    return new ModelData(modelName, meshes, materials, skeleton)
  }

  /**
   * 从 TRMSH 和 TRMBF 解析网格数据
   * 
   * @param trmsh - TRMSH 网格数据
   * @param trmbf - TRMBF 缓冲区数据
   * @returns MeshData 数组
   */
  private static parseMeshes(trmsh: TRMSH, trmbf: TRMBF): MeshData[] {
    const meshes: MeshData[] = []
    const meshCount = trmsh.meshesLength()

    for (let i = 0; i < meshCount; i++) {
      const meshShape = trmsh.meshes(i)
      const buffer = trmbf.buffers(i)

      if (!meshShape || !buffer) {
        console.warn(`[ModelData] Skipping mesh ${i}: missing mesh shape or buffer`)
        continue
      }

      try {
        const meshData = ModelData.parseSingleMesh(meshShape, buffer, i)
        meshes.push(meshData)
      } catch (error) {
        console.warn(`[ModelData] Failed to parse mesh ${i}:`, error)
      }
    }

    return meshes
  }

  /**
   * 解析单个网格数据
   * 
   * @param meshShape - MeshShape 数据
   * @param buffer - Buffer 数据
   * @param meshIndex - 网格索引
   * @returns MeshData 实例
   */
  private static parseSingleMesh(
    meshShape: MeshShape,
    buffer: TRMBFBuffer,
    meshIndex: number
  ): MeshData {
    // 解析顶点属性
    const vertexData = ModelData.parseVertexAttributes(meshShape, buffer)

    // 解析索引数据
    const indices = ModelData.parseIndexData(meshShape, buffer)

    // 创建几何体组
    const groups = ModelData.createMeshGroups(meshShape)

    // 生成网格名称
    const meshName = `mesh_${meshIndex}`

    return new MeshData(
      meshName,
      vertexData.positions || new Float32Array(0),
      vertexData.normals,
      vertexData.uvs,
      vertexData.uvs2,
      vertexData.tangents,
      vertexData.colors,
      vertexData.skinIndices,
      vertexData.skinWeights,
      indices || new Uint16Array(0),
      groups
    )
  }

  /**
   * 顶点数据解析结果
   */
  private static parseVertexAttributes(
    meshShape: MeshShape,
    buffer: TRMBFBuffer
  ): {
    positions: Float32Array | null;
    normals: Float32Array | null;
    uvs: Float32Array | null;
    uvs2: Float32Array | null;
    colors: Float32Array | null;
    tangents: Float32Array | null;
    skinIndices: Float32Array | null;
    skinWeights: Float32Array | null;
  } {
    const result = {
      positions: null as Float32Array | null,
      normals: null as Float32Array | null,
      uvs: null as Float32Array | null,
      uvs2: null as Float32Array | null,
      colors: null as Float32Array | null,
      tangents: null as Float32Array | null,
      skinIndices: null as Float32Array | null,
      skinWeights: null as Float32Array | null,
    }

    // 获取顶点属性访问器
    const attributesCount = meshShape.attributesLength()
    if (attributesCount === 0) {
      return result
    }

    // 遍历所有属性组
    for (let attrGroupIdx = 0; attrGroupIdx < attributesCount; attrGroupIdx++) {
      const vertexAccessors = meshShape.attributes(attrGroupIdx)
      if (!vertexAccessors) continue

      // 获取顶点缓冲区
      const vertices = buffer.vertexBuffer(attrGroupIdx)
      if (!vertices) continue

      const vertexBuffer = vertices.bufferArray()
      if (!vertexBuffer) continue

      // 获取顶点步长
      const sizeInfo = vertexAccessors.size(0)
      const stride = sizeInfo ? sizeInfo.size() : 0

      // 计算顶点数量
      const vertexCount = stride > 0 ? Math.floor(vertexBuffer.length / stride) : 0
      if (vertexCount === 0) continue

      // 遍历所有属性访问器
      const attrsCount = vertexAccessors.attrsLength()
      for (let i = 0; i < attrsCount; i++) {
        const accessor = vertexAccessors.attrs(i)
        if (!accessor) continue

        const attribute = accessor.attribute()
        const type = accessor.type()
        const offset = accessor.position()
        const layer = accessor.attributeLayer()

        // 根据属性类型解析数据
        switch (attribute) {
          case VertexAttribute.POSITION:
            result.positions = parseVertexAttribute(
              vertexBuffer,
              type,
              offset,
              stride,
              vertexCount
            )
            break

          case VertexAttribute.NORMAL:
            result.normals = parseVertexAttribute(
              vertexBuffer,
              type,
              offset,
              stride,
              vertexCount
            )
            break

          case VertexAttribute.TEXCOORD:
            {
              const uvData = parseVertexAttribute(
                vertexBuffer,
                type,
                offset,
                stride,
                vertexCount
              )

              // 根据数据类型提取 UV 分量
              const typeInfo = getVertexTypeInfo(type)
              let uvs: Float32Array

              if (typeInfo.componentCount === 4) {
                // RGBA_16_UNORM 等 4 分量类型，只取前 2 个分量
                uvs = extractUV2Components(uvData, vertexCount)
              } else if (typeInfo.componentCount === 2) {
                // RG_32_FLOAT 等 2 分量类型，直接使用
                uvs = uvData
              } else {
                uvs = uvData
              }

              // 根据层级存储 UV
              if (layer === 0 && !result.uvs) {
                result.uvs = uvs
              } else if (layer === 1 || (layer === 0 && result.uvs)) {
                result.uvs2 = uvs
              }
            }
            break

          case VertexAttribute.COLOR:
            result.colors = parseVertexAttribute(
              vertexBuffer,
              type,
              offset,
              stride,
              vertexCount
            )
            break

          case VertexAttribute.TANGENT:
            result.tangents = parseVertexAttribute(
              vertexBuffer,
              type,
              offset,
              stride,
              vertexCount
            )
            break

          case VertexAttribute.BLEND_INDICES:
            result.skinIndices = parseVertexAttribute(
              vertexBuffer,
              type,
              offset,
              stride,
              vertexCount
            )
            break

          case VertexAttribute.BLEND_WEIGHTS:
            result.skinWeights = parseVertexAttribute(
              vertexBuffer,
              type,
              offset,
              stride,
              vertexCount
            )
            break

          default:
            break
        }
      }
    }

    return result
  }

  /**
   * 解析索引数据
   * 
   * @param meshShape - MeshShape 数据
   * @param buffer - Buffer 数据
   * @returns 索引数组
   */
  private static parseIndexData(
    meshShape: MeshShape,
    buffer: TRMBFBuffer
  ): Uint16Array | Uint32Array | null {
    // 获取索引缓冲区
    const indexBufferCount = buffer.indexBufferLength()
    if (indexBufferCount === 0) {
      return null
    }

    const indexes = buffer.indexBuffer(0)
    if (!indexes) {
      return null
    }

    const indexBuffer = indexes.bufferArray()
    if (!indexBuffer) {
      return null
    }

    // 获取多边形类型
    const polygonType = meshShape.polygonType()

    // 计算索引数量
    const indexByteSize = getIndexByteSize(polygonType)
    const indexCount = Math.floor(indexBuffer.length / indexByteSize)

    return parseIndices(indexBuffer, polygonType, 0, indexCount)
  }

  /**
   * 创建网格分组
   * 
   * @param meshShape - MeshShape 数据
   * @returns MeshGroup 数组
   */
  private static createMeshGroups(meshShape: MeshShape): MeshGroup[] {
    const groups: MeshGroup[] = []
    const materialsCount = meshShape.materialsLength()

    if (materialsCount === 0) {
      // 没有材质信息，创建一个默认组
      return [{
        start: 0,
        count: Infinity, // 将在实际使用时被替换为实际索引数量
        materialIndex: 0,
        materialName: null,
      }]
    }

    // 遍历所有材质信息，创建对应的几何体组
    for (let i = 0; i < materialsCount; i++) {
      const materialInfo = meshShape.materials(i)
      if (!materialInfo) continue

      const polyOffset = materialInfo.polyOffset()
      const polyCount = materialInfo.polyCount()
      const materialName = materialInfo.materialName()

      groups.push({
        start: polyOffset,
        count: polyCount,
        materialIndex: i,
        materialName: materialName,
      })
    }

    return groups
  }

  /**
   * 从 TRMTR 解析材质数据
   * 
   * @param trmtr - TRMTR 材质属性数据
   * @returns MaterialData 数组
   */
  private static parseMaterials(trmtr: TRMTR): MaterialData[] {
    const materials: MaterialData[] = []
    const materialsCount = trmtr.materialsLength()

    for (let i = 0; i < materialsCount; i++) {
      const material = trmtr.materials(i)
      if (!material) {
        console.warn(`[ModelData] Skipping material ${i}: null material`)
        continue
      }

      try {
        const materialData = ModelData.parseSingleMaterial(material)
        materials.push(materialData)
      } catch (error) {
        console.warn(`[ModelData] Failed to parse material ${i}:`, error)
      }
    }

    return materials
  }

  /**
   * 解析单个材质数据
   * 
   * @param material - FlatBuffers Material 数据
   * @returns MaterialData 实例
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FlatBuffers 生成的 Material 类型
  private static parseSingleMaterial(material: any): MaterialData {
    // 获取材质名称
    const name = material.name() || 'unnamed_material'

    // 获取 shader 名称
    let shaderName: string | null = null
    const shadersCount = material.shadersLength()
    for (let i = 0; i < shadersCount; i++) {
      const shader = material.shaders(i)
      if (shader) {
        const sn = shader.shaderName()
        if (sn) {
          shaderName = sn
          break
        }
      }
    }

    // 解析纹理引用
    const textures: TextureReference[] = []
    const texturesCount = material.texturesLength()
    for (let i = 0; i < texturesCount; i++) {
      const texture = material.textures(i)
      if (!texture) continue

      const textureFile = texture.textureFile()
      if (!textureFile) continue

      const textureName = texture.textureName() || ''
      const textureSlot = texture.textureSlot() || 0

      // 将 .bntx 扩展名转换为 .png
      const pngFilename = textureFile.replace(/\.bntx$/i, '.png')

      // 确定纹理类型
      let textureType: TextureType = getTextureTypeFromName(textureName)
      if (textureType === 'unknown') {
        textureType = getTextureType(pngFilename)
      }

      textures.push({
        name: textureName,
        filename: pngFilename,
        slot: textureSlot,
        type: textureType,
      })
    }

    // 解析浮点参数
    const floatParams = new Map<string, number>()
    const floatParamCount = material.floatParameterLength()
    for (let i = 0; i < floatParamCount; i++) {
      const param = material.floatParameter(i)
      if (!param) continue

      const paramName = param.floatName()
      const paramValue = param.floatValue()
      if (paramName && paramValue !== undefined && !isNaN(paramValue)) {
        floatParams.set(paramName, paramValue)
      }
    }

    // 解析颜色参数
    const colorParams = new Map<string, THREE.Vector4>()
    const colorParamCount = material.float4ParameterLength()
    for (let i = 0; i < colorParamCount; i++) {
      const param = material.float4Parameter(i)
      if (!param) continue

      const paramName = param.colorName()
      const colorValue = param.colorValue()
      if (paramName && colorValue) {
        colorParams.set(
          paramName,
          new THREE.Vector4(
            colorValue.r(),
            colorValue.g(),
            colorValue.b(),
            colorValue.a()
          )
        )
      }
    }

    // 获取透明类型
    const alphaType = material.alphaType() || null

    // 解析采样器数据
    const samplers: SamplerData[] = []
    const samplersCount = material.samplersLength()
    for (let i = 0; i < samplersCount; i++) {
      const sampler = material.samplers(i)
      if (!sampler) {
        samplers.push({ wrapU: 'repeat', wrapV: 'repeat' })
        continue
      }

      const wrapU = ModelData.convertUVWrapMode(sampler.repeatU())
      const wrapV = ModelData.convertUVWrapMode(sampler.repeatV())
      samplers.push({ wrapU, wrapV })
    }

    return new MaterialData(
      name,
      shaderName,
      textures,
      floatParams,
      colorParams,
      alphaType,
      samplers
    )
  }

  /**
   * 转换 FlatBuffers UV 包裹模式到通用格式
   * 
   * @param fbWrapMode - FlatBuffers UVWrapMode
   * @returns 通用 UVWrapMode
   */
  private static convertUVWrapMode(fbWrapMode: FBUVWrapMode): UVWrapMode {
    switch (fbWrapMode) {
      case FBUVWrapMode.CLAMP:
        return 'clamp'
      case FBUVWrapMode.MIRROR:
        return 'mirror'
      case FBUVWrapMode.MIRROR_ONCE:
        return 'mirror'
      case FBUVWrapMode.WRAP:
      default:
        return 'repeat'
    }
  }

  /**
   * 从 TRSKL 解析骨骼数据
   * 
   * @param trskl - TRSKL 骨骼数据
   * @returns SkeletonData 实例
   */
  private static parseSkeleton(trskl: TRSKL): SkeletonData {
    const bones: BoneData[] = []
    const boneCount = trskl.bonesLength()
    const transformNodeCount = trskl.transformNodesLength()

    // 创建 transformNodes 的映射：rigIdx -> transformNode
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FlatBuffers 生成的 TransformNode 类型
    const rigIdxToTransformNode = new Map<number, any>()
    for (let i = 0; i < transformNodeCount; i++) {
      const node = trskl.transformNodes(i)
      if (node) {
        const rigIdx = node.rigIdx()
        if (rigIdx >= 0) {
          rigIdxToTransformNode.set(rigIdx, node)
        }
      }
    }

    // 为每个骨骼创建 BoneData
    for (let boneIndex = 0; boneIndex < boneCount; boneIndex++) {
      const transformNode = rigIdxToTransformNode.get(boneIndex)

      let boneName = `Bone_${boneIndex}`
      let localPosition = new THREE.Vector3(0, 0, 0)
      let localRotation = new THREE.Euler(0, 0, 0, 'ZYX')
      let localScale = new THREE.Vector3(1, 1, 1)
      let parentIndex = -1

      if (transformNode) {
        // 设置骨骼名称
        const name = transformNode.name()
        if (name) {
          boneName = name.decode ? name.decode('utf-8') : name
        }

        // 设置骨骼的局部变换
        const transform = transformNode.transform()
        if (transform) {
          const scale = transform.vecScale()
          const rotation = transform.vecRot()
          const translation = transform.vecTranslate()

          if (scale) {
            localScale = new THREE.Vector3(scale.x(), scale.y(), scale.z())
          }
          if (rotation) {
            localRotation = new THREE.Euler(rotation.x(), rotation.y(), rotation.z(), 'ZYX')
          }
          if (translation) {
            localPosition = new THREE.Vector3(translation.x(), translation.y(), translation.z())
          }
        }

        // 获取父骨骼索引
        const parentIdx = transformNode.parentIdx()
        if (parentIdx >= 0) {
          // parentIdx 是 transformNodes 的索引，需要转换为 rigIdx
          const parentNode = trskl.transformNodes(parentIdx)
          if (parentNode) {
            const parentRigIdx = parentNode.rigIdx()
            if (parentRigIdx >= 0 && parentRigIdx < boneCount) {
              parentIndex = parentRigIdx
            }
          }
        }
      }

      bones.push({
        index: boneIndex,
        name: boneName,
        parentIndex,
        localPosition,
        localRotation,
        localScale,
      })
    }

    return new SkeletonData(bones)
  }

  /**
   * 克隆 ModelData 实例
   * 
   * @returns 新的 ModelData 实例
   */
  clone(): ModelData {
    return new ModelData(
      this.name,
      this.meshes.map(mesh => mesh.clone()),
      this.materials.map(mat => mat.clone()),
      this.skeleton ? new SkeletonData([...this.skeleton.bones]) : null
    )
  }

  /**
   * 获取模型的调试信息字符串
   * 
   * @returns 调试信息字符串
   */
  toString(): string {
    const lines: string[] = [
      `ModelData: ${this.name}`,
      `  Meshes: ${this.meshCount}`,
      `  Materials: ${this.materialCount}`,
      `  Skeleton: ${this.hasSkeleton ? `${this.skeleton!.boneCount} bones` : 'none'}`,
      `  Total Vertices: ${this.totalVertexCount}`,
      `  Total Triangles: ${this.totalTriangleCount}`,
    ]

    return lines.join('\n')
  }

  /**
   * 创建一个空的 ModelData 实例
   * 
   * @param name - 模型名称
   * @returns 空的 ModelData 实例
   */
  static createEmpty(name: string): ModelData {
    return new ModelData(name, [], [], null)
  }
}
