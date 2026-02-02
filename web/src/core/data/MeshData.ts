/**
 * MeshData 类
 * 
 * 存储单个网格的顶点数据（位置、法线、UV、切线、蒙皮权重等），
 * 并提供转换为 Three.js BufferGeometry 的方法。
 * 
 * @module core/data/MeshData
 */

import * as THREE from 'three'
import { IMeshData, MeshGroup } from './types'

/**
 * MeshData 类实现
 * 
 * 用于存储解析后的网格顶点数据，并提供转换为 Three.js BufferGeometry 的功能。
 * 
 * @implements {IMeshData}
 * 
 * @example
 * ```typescript
 * const meshData = new MeshData(
 *   'body_mesh',
 *   positions,
 *   normals,
 *   uvs,
 *   null, // uvs2
 *   tangents,
 *   null, // colors
 *   skinIndices,
 *   skinWeights,
 *   indices,
 *   groups
 * );
 * 
 * const geometry = meshData.toBufferGeometry();
 * ```
 */
export class MeshData implements IMeshData {
  /**
   * 创建 MeshData 实例
   * 
   * @param name - 网格名称
   * @param positions - 顶点位置数据 (x, y, z)
   * @param normals - 法线数据 (x, y, z)，可为 null
   * @param uvs - 第一套 UV 坐标 (u, v)，可为 null
   * @param uvs2 - 第二套 UV 坐标 (u, v)，可为 null
   * @param tangents - 切线数据 (x, y, z)，可为 null
   * @param colors - 顶点颜色数据 (r, g, b, a)，可为 null
   * @param skinIndices - 蒙皮骨骼索引 (4个索引)，可为 null
   * @param skinWeights - 蒙皮权重 (4个权重)，可为 null
   * @param indices - 索引数据
   * @param groups - 网格分组信息
   */
  constructor(
    public readonly name: string,
    public readonly positions: Float32Array,
    public readonly normals: Float32Array | null,
    public readonly uvs: Float32Array | null,
    public readonly uvs2: Float32Array | null,
    public readonly tangents: Float32Array | null,
    public readonly colors: Float32Array | null,
    public readonly skinIndices: Float32Array | null,
    public readonly skinWeights: Float32Array | null,
    public readonly indices: Uint16Array | Uint32Array,
    public readonly groups: MeshGroup[]
  ) {}

  /**
   * 获取顶点数量
   */
  get vertexCount(): number {
    return this.positions.length / 3
  }

  /**
   * 获取索引数量
   */
  get indexCount(): number {
    return this.indices.length
  }

  /**
   * 获取三角形数量
   */
  get triangleCount(): number {
    return Math.floor(this.indices.length / 3)
  }

  /**
   * 检查是否有蒙皮数据
   */
  get hasSkinning(): boolean {
    return this.skinIndices !== null && this.skinWeights !== null
  }

  /**
   * 转换为 Three.js BufferGeometry
   * 
   * 将存储的顶点数据转换为 Three.js 可用的 BufferGeometry 对象。
   * 
   * @returns Three.js BufferGeometry 对象
   * 
   * @example
   * ```typescript
   * const geometry = meshData.toBufferGeometry();
   * const mesh = new THREE.Mesh(geometry, material);
   * ```
   */
  toBufferGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry()

    // 设置顶点位置（必需）
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3)
    )

    // 设置法线
    if (this.normals) {
      const normals3 = this.extractNormals3Components(this.normals)
      const normalizedNormals = this.normalizeVectors(normals3)
      geometry.setAttribute(
        'normal',
        new THREE.BufferAttribute(normalizedNormals, 3)
      )
    }

    // 设置第一套 UV 坐标
    if (this.uvs) {
      geometry.setAttribute(
        'uv',
        new THREE.BufferAttribute(this.uvs, 2)
      )
    }

    // 设置第二套 UV 坐标
    if (this.uvs2) {
      geometry.setAttribute(
        'uv2',
        new THREE.BufferAttribute(this.uvs2, 2)
      )
    }

    // 设置切线
    if (this.tangents) {
      const tangents3 = this.extractTangents3Components(this.tangents)
      const normalizedTangents = this.normalizeVectors(tangents3)
      geometry.setAttribute(
        'tangent',
        new THREE.BufferAttribute(normalizedTangents, 3)
      )
    }

    // 设置顶点颜色
    if (this.colors) {
      geometry.setAttribute(
        'color',
        new THREE.BufferAttribute(this.colors, 4)
      )
    }

    // 设置蒙皮索引
    if (this.skinIndices) {
      geometry.setAttribute(
        'skinIndex',
        new THREE.BufferAttribute(this.skinIndices, 4)
      )
    }

    // 设置蒙皮权重
    if (this.skinWeights) {
      geometry.setAttribute(
        'skinWeight',
        new THREE.BufferAttribute(this.skinWeights, 4)
      )
    }

    // 设置索引
    geometry.setIndex(new THREE.BufferAttribute(this.indices, 1))

    // 添加几何体组（用于多材质）
    for (const group of this.groups) {
      geometry.addGroup(group.start, group.count, group.materialIndex)
    }

    // 计算包围盒和包围球
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()

    // 如果没有法线数据，自动计算法线
    if (!this.normals) {
      geometry.computeVertexNormals()
    }

    return geometry
  }

  /**
   * 从 4 分量法线数据中提取 3 分量
   * 
   * 法线数据可能是 4 分量（RGBA_16_FLOAT），需要提取前 3 个分量
   * 
   * @param normals - 原始法线数据
   * @returns 3 分量法线数据
   */
  private extractNormals3Components(normals: Float32Array): Float32Array {
    const vertexCount = this.vertexCount
    const expectedLength4 = vertexCount * 4

    if (normals.length === expectedLength4) {
      // 4 分量数据，提取前 3 个分量
      const normals3 = new Float32Array(vertexCount * 3)
      for (let i = 0; i < vertexCount; i++) {
        normals3[i * 3] = normals[i * 4]
        normals3[i * 3 + 1] = normals[i * 4 + 1]
        normals3[i * 3 + 2] = normals[i * 4 + 2]
      }
      return normals3
    }

    // 已经是 3 分量数据
    return normals
  }

  /**
   * 从 4 分量切线数据中提取 3 分量
   * 
   * 切线数据可能是 4 分量（RGBA_16_FLOAT），包含 x,y,z,w（w 为 handedness）
   * 
   * @param tangents - 原始切线数据
   * @returns 3 分量切线数据
   */
  private extractTangents3Components(tangents: Float32Array): Float32Array {
    const vertexCount = this.vertexCount
    const expectedLength4 = vertexCount * 4

    if (tangents.length === expectedLength4) {
      const tangents3 = new Float32Array(vertexCount * 3)
      for (let i = 0; i < vertexCount; i++) {
        tangents3[i * 3] = tangents[i * 4]
        tangents3[i * 3 + 1] = tangents[i * 4 + 1]
        tangents3[i * 3 + 2] = tangents[i * 4 + 2]
      }
      return tangents3
    }

    return tangents
  }

  /**
   * 归一化向量数组
   * 
   * @param vectors - 向量数组 (每 3 个元素为一个向量)
   * @returns 归一化后的向量数组
   */
  private normalizeVectors(vectors: Float32Array): Float32Array {
    const result = new Float32Array(vectors.length)
    const count = vectors.length / 3

    for (let i = 0; i < count; i++) {
      const x = vectors[i * 3]
      const y = vectors[i * 3 + 1]
      const z = vectors[i * 3 + 2]

      const length = Math.sqrt(x * x + y * y + z * z)

      if (length > 0) {
        result[i * 3] = x / length
        result[i * 3 + 1] = y / length
        result[i * 3 + 2] = z / length
      } else {
        // 零向量保持不变
        result[i * 3] = 0
        result[i * 3 + 1] = 0
        result[i * 3 + 2] = 0
      }
    }

    return result
  }

  /**
   * 克隆 MeshData 实例
   * 
   * @returns 新的 MeshData 实例
   */
  clone(): MeshData {
    return new MeshData(
      this.name,
      new Float32Array(this.positions),
      this.normals ? new Float32Array(this.normals) : null,
      this.uvs ? new Float32Array(this.uvs) : null,
      this.uvs2 ? new Float32Array(this.uvs2) : null,
      this.tangents ? new Float32Array(this.tangents) : null,
      this.colors ? new Float32Array(this.colors) : null,
      this.skinIndices ? new Float32Array(this.skinIndices) : null,
      this.skinWeights ? new Float32Array(this.skinWeights) : null,
      this.indices instanceof Uint16Array
        ? new Uint16Array(this.indices)
        : new Uint32Array(this.indices),
      this.groups.map(g => ({ ...g }))
    )
  }

  /**
   * 验证 MeshData 的完整性
   * 
   * @returns 验证结果，包含是否有效和错误信息
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // 检查位置数据
    if (!this.positions || this.positions.length === 0) {
      errors.push('Positions data is required')
    } else if (this.positions.length % 3 !== 0) {
      errors.push('Positions data length must be a multiple of 3')
    }

    // 检查法线数据
    if (this.normals) {
      const expectedLength3 = this.vertexCount * 3
      const expectedLength4 = this.vertexCount * 4
      if (this.normals.length !== expectedLength3 && this.normals.length !== expectedLength4) {
        errors.push(`Normals data length mismatch: expected ${expectedLength3} or ${expectedLength4}, got ${this.normals.length}`)
      }
    }

    // 检查 UV 数据
    if (this.uvs && this.uvs.length !== this.vertexCount * 2) {
      errors.push(`UVs data length mismatch: expected ${this.vertexCount * 2}, got ${this.uvs.length}`)
    }

    // 检查索引数据
    if (!this.indices || this.indices.length === 0) {
      errors.push('Indices data is required')
    }

    // 检查蒙皮数据一致性
    if ((this.skinIndices && !this.skinWeights) || (!this.skinIndices && this.skinWeights)) {
      errors.push('Skin indices and skin weights must both be present or both be null')
    }

    // 检查蒙皮数据长度
    if (this.skinIndices && this.skinIndices.length !== this.vertexCount * 4) {
      errors.push(`Skin indices data length mismatch: expected ${this.vertexCount * 4}, got ${this.skinIndices.length}`)
    }

    if (this.skinWeights && this.skinWeights.length !== this.vertexCount * 4) {
      errors.push(`Skin weights data length mismatch: expected ${this.vertexCount * 4}, got ${this.skinWeights.length}`)
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}
