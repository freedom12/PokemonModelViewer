/**
 * 模型加载器模块
 * 
 * 负责加载和解析宝可梦模型文件（TRMDL、TRMSH、TRMBF、TRMTR、TRMMT）
 * 
 * @module services/modelLoader
 */

import { flatbuffers, TRMDL, TRMSH, TRMBF, TRMTR, TRMMT, TRSKL } from '../parsers'
import { getPokemonIdFromFormId } from '../utils/pokemonPath'

/**
 * 模型文件类型
 */
export type ModelFileType = 'trmdl' | 'trmsh' | 'trmbf' | 'trmtr' | 'trmmt' | 'trskl'

/**
 * 解析结果接口
 */
export interface ParseResult<T> {
  /** 是否解析成功 */
  success: boolean
  /** 解析后的数据 */
  data?: T
  /** 错误信息 */
  error?: string
}

/**
 * 模型文件集合
 */
export interface ModelFiles {
  /** 模型定义文件数据 */
  trmdl: ArrayBuffer
  /** 网格文件数据 */
  trmsh: ArrayBuffer
  /** 缓冲区文件数据 */
  trmbf: ArrayBuffer
  /** 材质属性文件数据（可选） */
  trmtr?: ArrayBuffer
  /** 材质映射文件数据（可选） */
  trmmt?: ArrayBuffer
  /** 骨骼文件数据（可选） */
  trskl?: ArrayBuffer
}

/**
 * 解析后的模型数据
 */
export interface ParsedModelData {
  /** 模型定义 */
  trmdl: TRMDL
  /** 网格数据 */
  trmsh: TRMSH
  /** 缓冲区数据 */
  trmbf: TRMBF
  /** 材质属性数据（可选） */
  trmtr?: TRMTR
  /** 材质映射数据（可选） */
  trmmt?: TRMMT
  /** 骨骼数据（可选） */
  trskl?: TRSKL
  /** 基础路径（用于加载纹理） */
  basePath: string
}

/**
 * 模型加载错误类
 */
export class ModelLoadError extends Error {
  /** 错误类型 */
  type: 'file_not_found' | 'parse_error' | 'network_error' | 'invalid_format'
  /** 文件路径 */
  filePath?: string

  constructor(
    message: string,
    type: 'file_not_found' | 'parse_error' | 'network_error' | 'invalid_format',
    filePath?: string
  ) {
    super(message)
    this.name = 'ModelLoadError'
    this.type = type
    this.filePath = filePath
  }
}

/**
 * 生成模型文件路径
 * 
 * @param formId - 形态 ID，如 "pm0001_00_00"
 * @param fileType - 文件类型
 * @returns 文件路径
 */
export function getModelFilePath(formId: string, fileType: ModelFileType): string {
  const pokemonId = getPokemonIdFromFormId(formId)
  return `/SCVI/${pokemonId}/${formId}/${formId}.${fileType}`
}

/**
 * 加载单个文件
 * 
 * @param path - 文件路径
 * @returns Promise<ArrayBuffer> 文件数据
 * @throws ModelLoadError 如果文件加载失败
 */
async function loadFile(path: string): Promise<ArrayBuffer> {
  try {
    const response = await fetch(path)
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new ModelLoadError(
          `模型文件未找到: ${path}`,
          'file_not_found',
          path
        )
      }
      throw new ModelLoadError(
        `加载文件失败: ${path} (HTTP ${response.status})`,
        'network_error',
        path
      )
    }
    
    return await response.arrayBuffer()
  } catch (error) {
    if (error instanceof ModelLoadError) {
      throw error
    }
    
    throw new ModelLoadError(
      `网络请求失败: ${path} - ${error instanceof Error ? error.message : String(error)}`,
      'network_error',
      path
    )
  }
}

/**
 * 加载模型文件集合
 * 
 * 异步加载指定形态的所有模型文件（trmdl, trmsh, trmbf, trmtr, trmmt）
 * 
 * @param formId - 形态 ID，如 "pm0001_00_00"
 * @returns Promise<ModelFiles> 加载的文件数据
 * @throws ModelLoadError 如果必需文件加载失败
 * 
 * @validates 需求 2.1: 用户选择宝可梦时从对应目录加载 .trmdl 文件
 * @validates 需求 2.2: 根据 TRMDL 中的引用加载对应的 .trmsh 网格文件
 * @validates 需求 2.3: 加载对应的 .trmbf 缓冲区文件获取顶点和索引数据
 * @validates 需求 2.4: 加载 .trmtr 和 .trmmt 文件获取材质信息
 * @validates 需求 2.5: 文件不存在或格式错误时返回描述性错误信息
 * 
 * @example
 * const files = await loadModelFiles("pm0001_00_00")
 */
export async function loadModelFiles(formId: string): Promise<ModelFiles> {
  // 生成文件路径
  const trmdlPath = getModelFilePath(formId, 'trmdl')
  const trmshPath = getModelFilePath(formId, 'trmsh')
  const trmbfPath = getModelFilePath(formId, 'trmbf')
  const trmtrPath = getModelFilePath(formId, 'trmtr')
  const trmmtPath = getModelFilePath(formId, 'trmmt')
  const trsklPath = getModelFilePath(formId, 'trskl')
  
  // 并行加载必需文件
  const [trmdl, trmsh, trmbf] = await Promise.all([
    loadFile(trmdlPath),
    loadFile(trmshPath),
    loadFile(trmbfPath)
  ])
  
  // 尝试加载可选的材质文件（失败时不抛出错误）
  let trmtr: ArrayBuffer | undefined
  let trmmt: ArrayBuffer | undefined
  let trskl: ArrayBuffer | undefined
  
  try {
    trmtr = await loadFile(trmtrPath)
  } catch (error) {
    // 材质属性文件是可选的，记录警告但不抛出错误
    console.warn(`材质属性文件加载失败: ${trmtrPath}`, error)
  }
  
  try {
    trmmt = await loadFile(trmmtPath)
  } catch (error) {
    // 材质映射文件是可选的，记录警告但不抛出错误
    console.warn(`材质映射文件加载失败: ${trmmtPath}`, error)
  }
  
  try {
    trskl = await loadFile(trsklPath)
  } catch (error) {
    // 骨骼文件是可选的，记录警告但不抛出错误
    console.warn(`骨骼文件加载失败: ${trsklPath}`, error)
  }
  
  return {
    trmdl,
    trmsh,
    trmbf,
    trmtr,
    trmmt,
    trskl
  }
}

/**
 * 解析 TRMDL 文件
 * 
 * @param buffer - 文件数据
 * @returns 解析结果
 */
export function parseTRMDL(buffer: ArrayBuffer): ParseResult<TRMDL> {
  try {
    const bytes = new Uint8Array(buffer)
    const bb = new flatbuffers.ByteBuffer(bytes)
    const trmdl = TRMDL.getRootAsTRMDL(bb)
    
    // 验证解析结果
    if (!trmdl || trmdl.meshesLength() === 0) {
      return {
        success: false,
        error: 'TRMDL 文件格式错误: 无法解析模型定义或网格列表为空'
      }
    }
    
    return {
      success: true,
      data: trmdl
    }
  } catch (error) {
    return {
      success: false,
      error: `TRMDL 解析失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 解析 TRMSH 文件
 * 
 * @param buffer - 文件数据
 * @returns 解析结果
 */
export function parseTRMSH(buffer: ArrayBuffer): ParseResult<TRMSH> {
  try {
    const bytes = new Uint8Array(buffer)
    const bb = new flatbuffers.ByteBuffer(bytes)
    const trmsh = TRMSH.getRootAsTRMSH(bb)
    
    // 验证解析结果
    if (!trmsh || trmsh.meshesLength() === 0) {
      return {
        success: false,
        error: 'TRMSH 文件格式错误: 无法解析网格数据或网格列表为空'
      }
    }
    
    return {
      success: true,
      data: trmsh
    }
  } catch (error) {
    return {
      success: false,
      error: `TRMSH 解析失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 解析 TRMBF 文件
 * 
 * @param buffer - 文件数据
 * @returns 解析结果
 */
export function parseTRMBF(buffer: ArrayBuffer): ParseResult<TRMBF> {
  try {
    const bytes = new Uint8Array(buffer)
    const bb = new flatbuffers.ByteBuffer(bytes)
    const trmbf = TRMBF.getRootAsTRMBF(bb)
    
    // 验证解析结果
    if (!trmbf || trmbf.buffersLength() === 0) {
      return {
        success: false,
        error: 'TRMBF 文件格式错误: 无法解析缓冲区数据或缓冲区列表为空'
      }
    }
    
    return {
      success: true,
      data: trmbf
    }
  } catch (error) {
    return {
      success: false,
      error: `TRMBF 解析失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 解析 TRMTR 文件
 * 
 * @param buffer - 文件数据
 * @returns 解析结果
 */
export function parseTRMTR(buffer: ArrayBuffer): ParseResult<TRMTR> {
  try {
    const bytes = new Uint8Array(buffer)
    const bb = new flatbuffers.ByteBuffer(bytes)
    const trmtr = TRMTR.getRootAsTRMTR(bb)
    
    // TRMTR 可能没有材质，这是允许的
    if (!trmtr) {
      return {
        success: false,
        error: 'TRMTR 文件格式错误: 无法解析材质属性数据'
      }
    }
    
    return {
      success: true,
      data: trmtr
    }
  } catch (error) {
    return {
      success: false,
      error: `TRMTR 解析失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 解析 TRMMT 文件
 * 
 * @param buffer - 文件数据
 * @returns 解析结果
 */
export function parseTRMMT(buffer: ArrayBuffer): ParseResult<TRMMT> {
  try {
    const bytes = new Uint8Array(buffer)
    const bb = new flatbuffers.ByteBuffer(bytes)
    const trmmt = TRMMT.getRootAsTRMMT(bb)
    
    // TRMMT 可能没有材质映射，这是允许的
    if (!trmmt) {
      return {
        success: false,
        error: 'TRMMT 文件格式错误: 无法解析材质映射数据'
      }
    }
    
    return {
      success: true,
      data: trmmt
    }
  } catch (error) {
    return {
      success: false,
      error: `TRMMT 解析失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 解析 TRSKL 文件
 * 
 * @param buffer - 文件数据
 * @returns 解析结果
 */
export function parseTRSKL(buffer: ArrayBuffer): ParseResult<TRSKL> {
  try {
    const bytes = new Uint8Array(buffer)
    const bb = new flatbuffers.ByteBuffer(bytes)
    const trskl = TRSKL.getRootAsTRSKL(bb)
    
    // TRSKL 可能没有骨骼数据
    if (!trskl) {
      return {
        success: false,
        error: 'TRSKL 文件格式错误: 无法解析骨骼数据'
      }
    }
    
    return {
      success: true,
      data: trskl
    }
  } catch (error) {
    return {
      success: false,
      error: `TRSKL 解析失败: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * 解析模型数据
 * 
 * 使用 FlatBuffers 解析器解析所有模型文件的二进制数据
 * 
 * @param files - 模型文件集合
 * @param formId - 形态 ID（用于生成基础路径）
 * @returns 解析后的模型数据
 * @throws ModelLoadError 如果必需文件解析失败
 * 
 * @validates 需求 2.1: 解析模型定义
 * @validates 需求 2.2: 解析网格文件
 * @validates 需求 2.3: 解析缓冲区文件
 * @validates 需求 2.4: 解析材质文件
 * @validates 需求 2.5: 格式错误时返回描述性错误信息
 * 
 * @example
 * const files = await loadModelFiles("pm0001_00_00")
 * const modelData = parseModelData(files, "pm0001_00_00")
 */
export function parseModelData(files: ModelFiles, formId: string): ParsedModelData {
  // 解析 TRMDL
  const trmdlResult = parseTRMDL(files.trmdl)
  if (!trmdlResult.success || !trmdlResult.data) {
    throw new ModelLoadError(
      trmdlResult.error || 'TRMDL 解析失败',
      'parse_error'
    )
  }
  
  // 解析 TRMSH
  const trmshResult = parseTRMSH(files.trmsh)
  if (!trmshResult.success || !trmshResult.data) {
    throw new ModelLoadError(
      trmshResult.error || 'TRMSH 解析失败',
      'parse_error'
    )
  }
  
  // 解析 TRMBF
  const trmbfResult = parseTRMBF(files.trmbf)
  if (!trmbfResult.success || !trmbfResult.data) {
    throw new ModelLoadError(
      trmbfResult.error || 'TRMBF 解析失败',
      'parse_error'
    )
  }
  
  // 生成基础路径
  const pokemonId = getPokemonIdFromFormId(formId)
  const basePath = `/SCVI/${pokemonId}/${formId}/`
  
  // 构建结果
  const result: ParsedModelData = {
    trmdl: trmdlResult.data,
    trmsh: trmshResult.data,
    trmbf: trmbfResult.data,
    basePath
  }
  
  // 解析可选的 TRMTR
  if (files.trmtr) {
    const trmtrResult = parseTRMTR(files.trmtr)
    if (trmtrResult.success && trmtrResult.data) {
      result.trmtr = trmtrResult.data
    } else {
      console.warn('TRMTR 解析失败:', trmtrResult.error)
    }
  }
  
  // 解析可选的 TRMMT
  if (files.trmmt) {
    const trmmtResult = parseTRMMT(files.trmmt)
    if (trmmtResult.success && trmmtResult.data) {
      result.trmmt = trmmtResult.data
    } else {
      console.warn('TRMMT 解析失败:', trmmtResult.error)
    }
  }
  
  // 解析可选的 TRSKL
  if (files.trskl) {
    const trsklResult = parseTRSKL(files.trskl)
    if (trsklResult.success && trsklResult.data) {
      result.trskl = trsklResult.data
    } else {
      console.warn('TRSKL 解析失败:', trsklResult.error)
    }
  }
  
  return result
}

/**
 * 加载并解析模型
 * 
 * 便捷函数，组合 loadModelFiles 和 parseModelData
 * 
 * @param formId - 形态 ID，如 "pm0001_00_00"
 * @returns Promise<ParsedModelData> 解析后的模型数据
 * @throws ModelLoadError 如果加载或解析失败
 * 
 * @example
 * const modelData = await loadAndParseModel("pm0001_00_00")
 */
export async function loadAndParseModel(formId: string): Promise<ParsedModelData> {
  const files = await loadModelFiles(formId)
  return parseModelData(files, formId)
}

/**
 * 获取模型中引用的网格文件名列表
 * 
 * @param trmdl - TRMDL 模型定义数据
 * @returns 网格文件名数组
 */
export function getMeshFileNames(trmdl: TRMDL): string[] {
  const fileNames: string[] = []
  const meshCount = trmdl.meshesLength()
  
  for (let i = 0; i < meshCount; i++) {
    const mesh = trmdl.meshes(i)
    if (mesh) {
      const filename = mesh.filename()
      if (filename) {
        fileNames.push(filename)
      }
    }
  }
  
  return fileNames
}

/**
 * 获取模型中引用的材质名称列表
 * 
 * @param trmdl - TRMDL 模型定义数据
 * @returns 材质名称数组
 */
export function getMaterialNames(trmdl: TRMDL): string[] {
  const materialNames: string[] = []
  const materialsCount = trmdl.materialsLength()
  
  for (let i = 0; i < materialsCount; i++) {
    const materialName = trmdl.materials(i)
    if (materialName) {
      materialNames.push(materialName)
    }
  }
  
  return materialNames
}

/**
 * 验证模型数据完整性
 * 
 * 检查模型数据是否包含所有必需的组件
 * 
 * @param modelData - 解析后的模型数据
 * @returns 验证结果，包含是否有效和错误信息
 */
export function validateModelData(modelData: ParsedModelData): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  // 检查 TRMDL
  if (!modelData.trmdl) {
    errors.push('缺少模型定义数据 (TRMDL)')
  } else if (modelData.trmdl.meshesLength() === 0) {
    errors.push('模型定义中没有网格引用')
  }
  
  // 检查 TRMSH
  if (!modelData.trmsh) {
    errors.push('缺少网格数据 (TRMSH)')
  } else if (modelData.trmsh.meshesLength() === 0) {
    errors.push('网格文件中没有网格数据')
  }
  
  // 检查 TRMBF
  if (!modelData.trmbf) {
    errors.push('缺少缓冲区数据 (TRMBF)')
  } else if (modelData.trmbf.buffersLength() === 0) {
    errors.push('缓冲区文件中没有缓冲区数据')
  }
  
  // 检查网格和缓冲区数量是否匹配
  if (modelData.trmsh && modelData.trmbf) {
    const meshCount = modelData.trmsh.meshesLength()
    const bufferCount = modelData.trmbf.buffersLength()
    
    if (meshCount !== bufferCount) {
      errors.push(`网格数量 (${meshCount}) 与缓冲区数量 (${bufferCount}) 不匹配`)
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}
