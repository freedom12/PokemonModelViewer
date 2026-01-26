/**
 * 顶点数据解析器模块
 * 
 * 用于解析 TRMBF 缓冲区中的顶点属性数据和索引数据
 * 
 * 顶点属性类型映射表:
 * | Type 枚举值          | 字节大小 | TypedArray      | 用途         |
 * |---------------------|---------|-----------------|--------------|
 * | RGBA_8_UNORM (20)   | 4       | Uint8Array      | 顶点颜色     |
 * | RGBA_8_UNSIGNED (22)| 4       | Uint8Array      | 骨骼索引     |
 * | RGBA_16_UNORM (39)  | 8       | Uint16Array     | UV 坐标      |
 * | RGBA_16_FLOAT (43)  | 8       | Float16Array    | 切线/副法线  |
 * | RG_32_FLOAT (48)    | 8       | Float32Array    | UV 坐标      |
 * | RGB_32_FLOAT (51)   | 12      | Float32Array    | 位置/法线    |
 * | RGBA_32_FLOAT (54)  | 16      | Float32Array    | 切线         |
 * 
 * @module services/vertexParser
 */

import { Type, PolygonType } from '../parsers'

/**
 * 顶点属性类型信息
 */
export interface VertexTypeInfo {
  /** 每个顶点的字节大小 */
  byteSize: number
  /** 每个顶点的分量数量 */
  componentCount: number
  /** 是否需要归一化 */
  normalized: boolean
}

/**
 * 顶点属性类型映射表
 * 
 * 定义每种 Type 枚举值对应的字节大小、分量数量和归一化标志
 */
const TYPE_INFO_MAP: Record<Type, VertexTypeInfo> = {
  [Type.NONE]: { byteSize: 0, componentCount: 0, normalized: false },
  [Type.RGBA_8_UNORM]: { byteSize: 4, componentCount: 4, normalized: true },
  [Type.RGBA_8_UNSIGNED]: { byteSize: 4, componentCount: 4, normalized: false },
  [Type.R_32_UINT]: { byteSize: 4, componentCount: 1, normalized: false },
  [Type.R_32_INT]: { byteSize: 4, componentCount: 1, normalized: false },
  [Type.RGBA_16_UNORM]: { byteSize: 8, componentCount: 4, normalized: true },
  [Type.RGBA_16_FLOAT]: { byteSize: 8, componentCount: 4, normalized: false },
  [Type.RG_32_FLOAT]: { byteSize: 8, componentCount: 2, normalized: false },
  [Type.RGB_32_FLOAT]: { byteSize: 12, componentCount: 3, normalized: false },
  [Type.RGBA_32_FLOAT]: { byteSize: 16, componentCount: 4, normalized: false }
}

/**
 * 获取顶点属性类型信息
 * 
 * @param type - Type 枚举值
 * @returns 顶点类型信息
 */
export function getVertexTypeInfo(type: Type): VertexTypeInfo {
  return TYPE_INFO_MAP[type] || TYPE_INFO_MAP[Type.NONE]
}

/**
 * 解析顶点属性数据
 * 
 * 根据 Type 枚举值解析缓冲区中的顶点属性数据，返回 Float32Array
 * 
 * @param buffer - 原始缓冲区数据
 * @param type - 顶点属性类型（Type 枚举）
 * @param offset - 缓冲区中的起始偏移量（字节）
 * @param stride - 顶点步长（字节），如果为 0 则使用紧密排列
 * @param vertexCount - 顶点数量
 * @returns 解析后的 Float32Array，长度为 vertexCount * componentCount
 * 
 * @example
 * // 解析位置数据 (RGB_32_FLOAT)
 * const positions = parseVertexAttribute(buffer, Type.RGB_32_FLOAT, 0, 0, 100)
 * // positions.length === 300 (100 顶点 * 3 分量)
 * 
 * @validates 需求 3.1: 根据 TRMSH 中的顶点属性描述解析顶点位置数据
 * @validates 需求 3.2: 根据 TRMSH 中的顶点属性描述解析法线数据
 * @validates 需求 3.3: 根据 TRMSH 中的顶点属性描述解析 UV 坐标数据
 */
export function parseVertexAttribute(
  buffer: Uint8Array,
  type: Type,
  offset: number,
  stride: number,
  vertexCount: number
): Float32Array {
  const typeInfo = getVertexTypeInfo(type)
  const { byteSize, componentCount, normalized } = typeInfo
  
  // 如果 stride 为 0，使用紧密排列（stride = byteSize）
  const actualStride = stride === 0 ? byteSize : stride
  
  // 创建结果数组
  const result = new Float32Array(vertexCount * componentCount)
  
  // 创建 DataView 用于读取不同类型的数据
  const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  
  for (let i = 0; i < vertexCount; i++) {
    const vertexOffset = offset + i * actualStride
    
    switch (type) {
      case Type.RGB_32_FLOAT:
        // 3 个 32 位浮点数（位置/法线）
        for (let j = 0; j < 3; j++) {
          result[i * componentCount + j] = dataView.getFloat32(vertexOffset + j * 4, true)
        }
        break
        
      case Type.RGBA_32_FLOAT:
        // 4 个 32 位浮点数（切线）
        for (let j = 0; j < 4; j++) {
          result[i * componentCount + j] = dataView.getFloat32(vertexOffset + j * 4, true)
        }
        break
        
      case Type.RG_32_FLOAT:
        // 2 个 32 位浮点数（UV 坐标）
        for (let j = 0; j < 2; j++) {
          result[i * componentCount + j] = dataView.getFloat32(vertexOffset + j * 4, true)
        }
        break
        
      case Type.RGBA_16_UNORM:
        // 4 个 16 位无符号归一化整数（UV 坐标）
        // 需要将 0-65535 映射到 0.0-1.0
        for (let j = 0; j < 4; j++) {
          const value = dataView.getUint16(vertexOffset + j * 2, true)
          result[i * componentCount + j] = normalized ? value / 65535.0 : value
        }
        break
        
      case Type.RGBA_16_FLOAT:
        // 4 个 16 位浮点数（切线/副法线）
        for (let j = 0; j < 4; j++) {
          const halfFloat = dataView.getUint16(vertexOffset + j * 2, true)
          result[i * componentCount + j] = float16ToFloat32(halfFloat)
        }
        break
        
      case Type.RGBA_8_UNORM:
        // 4 个 8 位无符号归一化整数（顶点颜色）
        // 需要将 0-255 映射到 0.0-1.0
        for (let j = 0; j < 4; j++) {
          const value = dataView.getUint8(vertexOffset + j)
          result[i * componentCount + j] = normalized ? value / 255.0 : value
        }
        break
        
      case Type.RGBA_8_UNSIGNED:
        // 4 个 8 位无符号整数（骨骼索引）
        for (let j = 0; j < 4; j++) {
          result[i * componentCount + j] = dataView.getUint8(vertexOffset + j)
        }
        break
        
      case Type.R_32_UINT:
        // 1 个 32 位无符号整数
        result[i * componentCount] = dataView.getUint32(vertexOffset, true)
        break
        
      case Type.R_32_INT:
        // 1 个 32 位有符号整数
        result[i * componentCount] = dataView.getInt32(vertexOffset, true)
        break
        
      case Type.NONE:
      default:
        // 未知类型，填充 0
        for (let j = 0; j < componentCount; j++) {
          result[i * componentCount + j] = 0
        }
        break
    }
  }
  
  return result
}

/**
 * 将 16 位浮点数（half float）转换为 32 位浮点数
 * 
 * IEEE 754 半精度浮点数格式:
 * - 1 位符号位
 * - 5 位指数位（偏移量 15）
 * - 10 位尾数位
 * 
 * @param half - 16 位浮点数的整数表示
 * @returns 32 位浮点数
 */
export function float16ToFloat32(half: number): number {
  const sign = (half >> 15) & 0x1
  const exponent = (half >> 10) & 0x1f
  const mantissa = half & 0x3ff
  
  let result: number
  
  if (exponent === 0) {
    if (mantissa === 0) {
      // 零
      result = 0
    } else {
      // 非规格化数
      result = Math.pow(2, -14) * (mantissa / 1024)
    }
  } else if (exponent === 31) {
    if (mantissa === 0) {
      // 无穷大
      result = Infinity
    } else {
      // NaN
      result = NaN
    }
  } else {
    // 规格化数
    result = Math.pow(2, exponent - 15) * (1 + mantissa / 1024)
  }
  
  return sign ? -result : result
}

/**
 * 解析索引数据
 * 
 * 根据 PolygonType 枚举值解析缓冲区中的索引数据
 * 
 * @param buffer - 原始缓冲区数据
 * @param polygonType - 多边形类型（PolygonType 枚举）
 * @param offset - 缓冲区中的起始偏移量（字节）
 * @param count - 索引数量
 * @returns 解析后的索引数组（Uint16Array 或 Uint32Array）
 * 
 * @example
 * // 解析 16 位索引
 * const indices = parseIndices(buffer, PolygonType.UINT16, 0, 300)
 * 
 * @validates 需求 3.5: 设置 BufferGeometry 的索引属性
 */
export function parseIndices(
  buffer: Uint8Array,
  polygonType: PolygonType,
  offset: number,
  count: number
): Uint16Array | Uint32Array {
  const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  
  switch (polygonType) {
    case PolygonType.UINT8: {
      // 8 位索引，转换为 Uint16Array
      const result = new Uint16Array(count)
      for (let i = 0; i < count; i++) {
        result[i] = dataView.getUint8(offset + i)
      }
      return result
    }
    
    case PolygonType.UINT16: {
      // 16 位索引
      const result = new Uint16Array(count)
      for (let i = 0; i < count; i++) {
        result[i] = dataView.getUint16(offset + i * 2, true)
      }
      return result
    }
    
    case PolygonType.UINT32: {
      // 32 位索引
      const result = new Uint32Array(count)
      for (let i = 0; i < count; i++) {
        result[i] = dataView.getUint32(offset + i * 4, true)
      }
      return result
    }
    
    case PolygonType.UINT64: {
      // 64 位索引，转换为 Uint32Array（WebGL 不支持 64 位索引）
      // 注意：这可能会导致精度丢失，但在实际使用中索引值通常不会超过 32 位范围
      const result = new Uint32Array(count)
      for (let i = 0; i < count; i++) {
        // 只读取低 32 位
        result[i] = dataView.getUint32(offset + i * 8, true)
      }
      return result
    }
    
    default:
      // 默认使用 16 位索引
      return new Uint16Array(0)
  }
}

/**
 * 获取索引类型的字节大小
 * 
 * @param polygonType - 多边形类型（PolygonType 枚举）
 * @returns 每个索引的字节大小
 */
export function getIndexByteSize(polygonType: PolygonType): number {
  switch (polygonType) {
    case PolygonType.UINT8:
      return 1
    case PolygonType.UINT16:
      return 2
    case PolygonType.UINT32:
      return 4
    case PolygonType.UINT64:
      return 8
    default:
      return 2
  }
}

/**
 * 提取 UV 坐标（仅前两个分量）
 * 
 * 当 UV 数据以 RGBA_16_UNORM 格式存储时，只需要前两个分量（U 和 V）
 * 此函数从 4 分量数据中提取前 2 个分量
 * 
 * @param data - 原始 4 分量数据
 * @param vertexCount - 顶点数量
 * @returns 2 分量的 UV 数据
 */
export function extractUV2Components(data: Float32Array, vertexCount: number): Float32Array {
  const result = new Float32Array(vertexCount * 2)
  
  for (let i = 0; i < vertexCount; i++) {
    result[i * 2] = data[i * 4]
    result[i * 2 + 1] = data[i * 4 + 1]
  }
  
  return result
}

/**
 * 验证索引数据有效性
 * 
 * 检查所有索引值是否小于顶点数量
 * 
 * @param indices - 索引数组
 * @param vertexCount - 顶点数量
 * @returns 是否所有索引都有效
 * 
 * @validates Property 4: 索引数据有效性
 */
export function validateIndices(
  indices: Uint16Array | Uint32Array,
  vertexCount: number
): boolean {
  for (let i = 0; i < indices.length; i++) {
    if (indices[i] >= vertexCount) {
      return false
    }
  }
  return true
}

/**
 * 归一化法线向量
 * 
 * 确保每个法线向量的长度为 1.0
 * 
 * @param normals - 法线数据（3 分量）
 * @returns 归一化后的法线数据
 * 
 * @validates Property 3: 法线向量归一化
 */
export function normalizeNormals(normals: Float32Array): Float32Array {
  const result = new Float32Array(normals.length)
  const vertexCount = normals.length / 3
  
  for (let i = 0; i < vertexCount; i++) {
    const x = normals[i * 3]
    const y = normals[i * 3 + 1]
    const z = normals[i * 3 + 2]
    
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
