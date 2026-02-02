/**
 * 顶点数据解析工具模块
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
 * @module core/data/vertexUtils
 */

import { Type, PolygonType } from '../../parsers'

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
 */
export function getVertexTypeInfo(type: Type): VertexTypeInfo {
  return TYPE_INFO_MAP[type] || TYPE_INFO_MAP[Type.NONE]
}

/**
 * 将 16 位浮点数转换为 32 位浮点数
 */
function float16ToFloat32(half: number): number {
  const sign = (half >> 15) & 0x1
  const exponent = (half >> 10) & 0x1f
  const mantissa = half & 0x3ff
  
  let result: number
  
  if (exponent === 0) {
    if (mantissa === 0) {
      result = 0
    } else {
      result = Math.pow(2, -14) * (mantissa / 1024)
    }
  } else if (exponent === 31) {
    if (mantissa === 0) {
      result = Infinity
    } else {
      result = NaN
    }
  } else {
    result = Math.pow(2, exponent - 15) * (1 + mantissa / 1024)
  }
  
  return sign ? -result : result
}

/**
 * 解析顶点属性数据
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
  
  const actualStride = stride === 0 ? byteSize : stride
  const result = new Float32Array(vertexCount * componentCount)
  const dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  
  for (let i = 0; i < vertexCount; i++) {
    const vertexOffset = offset + i * actualStride
    
    switch (type) {
      case Type.RGB_32_FLOAT:
        for (let j = 0; j < 3; j++) {
          result[i * componentCount + j] = dataView.getFloat32(vertexOffset + j * 4, true)
        }
        break
        
      case Type.RGBA_32_FLOAT:
        for (let j = 0; j < 4; j++) {
          result[i * componentCount + j] = dataView.getFloat32(vertexOffset + j * 4, true)
        }
        break
        
      case Type.RG_32_FLOAT:
        for (let j = 0; j < 2; j++) {
          result[i * componentCount + j] = dataView.getFloat32(vertexOffset + j * 4, true)
        }
        break
        
      case Type.RGBA_16_UNORM:
        for (let j = 0; j < 4; j++) {
          const value = dataView.getUint16(vertexOffset + j * 2, true)
          result[i * componentCount + j] = normalized ? value / 65535.0 : value
        }
        break
        
      case Type.RGBA_16_FLOAT:
        for (let j = 0; j < 4; j++) {
          const halfFloat = dataView.getUint16(vertexOffset + j * 2, true)
          result[i * componentCount + j] = float16ToFloat32(halfFloat)
        }
        break
        
      case Type.RGBA_8_UNORM:
        for (let j = 0; j < 4; j++) {
          const value = dataView.getUint8(vertexOffset + j)
          result[i * componentCount + j] = normalized ? value / 255.0 : value
        }
        break
        
      case Type.RGBA_8_UNSIGNED:
        for (let j = 0; j < 4; j++) {
          result[i * componentCount + j] = dataView.getUint8(vertexOffset + j)
        }
        break
        
      case Type.R_32_UINT:
        result[i * componentCount] = dataView.getUint32(vertexOffset, true)
        break
        
      case Type.R_32_INT:
        result[i * componentCount] = dataView.getInt32(vertexOffset, true)
        break
        
      case Type.NONE:
      default:
        for (let j = 0; j < componentCount; j++) {
          result[i * componentCount + j] = 0
        }
        break
    }
  }
  
  return result
}

/**
 * 解析索引数据
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
      const result = new Uint16Array(count)
      for (let i = 0; i < count; i++) {
        result[i] = dataView.getUint8(offset + i)
      }
      return result
    }
    
    case PolygonType.UINT16: {
      const result = new Uint16Array(count)
      for (let i = 0; i < count; i++) {
        result[i] = dataView.getUint16(offset + i * 2, true)
      }
      return result
    }
    
    case PolygonType.UINT32: {
      const result = new Uint32Array(count)
      for (let i = 0; i < count; i++) {
        result[i] = dataView.getUint32(offset + i * 4, true)
      }
      return result
    }
    
    case PolygonType.UINT64: {
      const result = new Uint32Array(count)
      for (let i = 0; i < count; i++) {
        result[i] = dataView.getUint32(offset + i * 8, true)
      }
      return result
    }
    
    default:
      return new Uint16Array(0)
  }
}

/**
 * 获取索引类型的字节大小
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
 */
export function extractUV2Components(data: Float32Array, vertexCount: number): Float32Array {
  const result = new Float32Array(vertexCount * 2)
  
  for (let i = 0; i < vertexCount; i++) {
    result[i * 2] = data[i * 4]
    result[i * 2 + 1] = data[i * 4 + 1]
  }
  
  return result
}
